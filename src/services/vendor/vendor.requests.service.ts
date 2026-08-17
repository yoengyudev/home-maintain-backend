import crypto from "crypto";
import { prisma } from "../../database/prisma.client";
import { BadRequestException, NotFoundException } from "../../utils/app-error.util";
import { ProviderVerificationStatus } from "../../generated/prisma/enums";
import { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";

interface VerificationSubmissionData {
    businessName: string;
    providerType: string;
    contactName: string;
    email: string;
    addressLine: string;
    district: string;
    cityProvince: string;
    about: string;
    logoUrl?: string;
    latitude?: number;
    longitude?: number;
    serviceCategories: string[];
    documents: Array<{
        documentType: string;
        fileName: string;
        fileUrl: string;
        mimeType?: string;
        documentNumber?: string;
    }>;
}

interface VerificationDraftData extends Partial<VerificationSubmissionData> {
    step?: number;
}

export class VendorVerificationService {
    static async getDraftVerification(userId: string, lang: Lang = "en") {
        const providerProfile = await prisma.providerProfile.findUnique({
            where: { userId },
            include: {
                user: true,
                businessProfile: true,
                verifications: {
                    where: { status: ProviderVerificationStatus.DRAFT },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: {
                        documents: true,
                        checklistItems: true
                    }
                }
            }
        });

        if (!providerProfile) {
            throw new NotFoundException(t("VENDOR_PROVIDER_PROFILE_NOT_FOUND", lang));
        }

        const draft = providerProfile.verifications[0];
        
        if (!draft) {
            return {
                exists: false,
                data: null
            };
        }

        return {
            exists: true,
            data: {
                id: draft.publicId,
                businessName: providerProfile.businessProfile?.businessName,
                providerType: providerProfile.businessProfile?.providerType,
                contactName: providerProfile.contactName,
                email: providerProfile.user?.email,
                addressLine: providerProfile.businessProfile?.addressLine,
                district: providerProfile.businessProfile?.district,
                cityProvince: providerProfile.businessProfile?.cityProvince,
                about: providerProfile.businessProfile?.description,
                logoUrl: providerProfile.businessProfile?.logoUrl,
                latitude: providerProfile.businessProfile?.latitude?.toNumber(),
                longitude: providerProfile.businessProfile?.longitude?.toNumber(),
                documents: draft.documents.map(doc => ({
                    documentType: doc.documentType,
                    fileName: doc.fileName,
                    fileUrl: doc.fileUrl,
                    mimeType: doc.mimeType,
                    documentNumber: doc.documentNumber
                })),
                checklistItems: draft.checklistItems.map(item => ({
                    label: item.label,
                    isComplete: item.isComplete,
                    notes: item.notes
                })),
                step: 1
            }
        };
    }

    static async saveDraftVerification(userId: string, data: VerificationDraftData, lang: Lang = "en") {
        const providerProfile = await prisma.providerProfile.findUnique({
            where: { userId },
            include: { businessProfile: true, verifications: true }
        });

        if (!providerProfile) {
            throw new NotFoundException(t("VENDOR_PROVIDER_PROFILE_NOT_FOUND", lang));
        }

        // Update business profile if data provided
        if (providerProfile.businessProfile) {
            await prisma.providerBusinessProfile.update({
                where: { id: providerProfile.businessProfile.id },
                data: {
                    ...(data.businessName && { businessName: data.businessName }),
                    ...(data.providerType && { providerType: data.providerType }),
                    ...(data.addressLine && { addressLine: data.addressLine }),
                    ...(data.district && { district: data.district }),
                    ...(data.cityProvince && { cityProvince: data.cityProvince }),
                    ...(data.about && { description: data.about }),
                    ...(data.logoUrl && { logoUrl: data.logoUrl }),
                    ...(data.latitude !== undefined && { latitude: data.latitude }),
                    ...(data.longitude !== undefined && { longitude: data.longitude })
                }
            });
        }

        await prisma.providerProfile.update({
            where: { id: providerProfile.id },
            data: {
                ...(data.contactName && { contactName: data.contactName })
            }
        });

        // Find or create draft verification
        let draft = await prisma.providerVerification.findFirst({
            where: {
                providerProfileId: providerProfile.id,
                status: ProviderVerificationStatus.DRAFT,
                deletedAt: null,
            },
            include: { documents: true }
        });

        if (!draft) {
            draft = await prisma.providerVerification.create({
                data: {
                    publicId: crypto.randomUUID(),
                    providerProfileId: providerProfile.id,
                    status: ProviderVerificationStatus.DRAFT
                },
                include: { documents: true }
            });
        }

        // Update documents if provided
        if (data.documents && data.documents.length > 0) {
            const documentsToCreate = data.documents;
            await prisma.$transaction(async (tx) => {
                // Delete existing documents
                await tx.providerVerificationDocument.deleteMany({
                    where: { providerVerificationId: draft!.id }
                });

                // Create new documents
                await tx.providerVerificationDocument.createMany({
                    data: documentsToCreate.map(doc => ({
                        publicId: crypto.randomUUID(),
                        providerVerificationId: draft!.id,
                        documentType: doc.documentType,
                        fileName: doc.fileName,
                        fileUrl: doc.fileUrl,
                        mimeType: doc.mimeType,
                        documentNumber: doc.documentNumber
                    }))
                });
            });
        }

        return {
            id: draft.publicId,
            step: data.step || 1,
            savedAt: new Date()
        };
    }

    static async submitVerification(userId: string, data: VerificationSubmissionData, lang: Lang = "en") {
        const providerProfile = await prisma.providerProfile.findUnique({
            where: { userId },
            include: { businessProfile: true }
        });

        if (!providerProfile) {
            throw new NotFoundException(t("VENDOR_PROVIDER_PROFILE_NOT_FOUND", lang));
        }

        // Check if there's already an active verification
        const existingVerification = await prisma.providerVerification.findFirst({
            where: {
                providerProfileId: providerProfile.id,
                deletedAt: null,
                status: {
                    in: [
                        ProviderVerificationStatus.UNDER_REVIEW,
                        ProviderVerificationStatus.APPROVED
                    ]
                }
            }
        });

        if (existingVerification) {
            throw new BadRequestException(t("VENDOR_VERIFICATION_ALREADY_UNDER_REVIEW", lang));
        }

        // Update or create business profile
        if (providerProfile.businessProfile) {
            await prisma.providerBusinessProfile.update({
                where: { providerProfileId: providerProfile.id },
                data: {
                    businessName: data.businessName,
                    providerType: data.providerType,
                    addressLine: data.addressLine,
                    district: data.district,
                    cityProvince: data.cityProvince,
                    description: data.about,
                    logoUrl: data.logoUrl,
                    latitude: data.latitude,
                    longitude: data.longitude
                }
            });
        } else {
            await prisma.providerBusinessProfile.create({
                data: {
                    providerProfileId: providerProfile.id,
                    businessName: data.businessName,
                    providerType: data.providerType,
                    addressLine: data.addressLine,
                    district: data.district,
                    cityProvince: data.cityProvince,
                    description: data.about,
                    logoUrl: data.logoUrl,
                    latitude: data.latitude,
                    longitude: data.longitude
                }
            });
        }

        // Update contact name in provider profile
        await prisma.providerProfile.update({
            where: { id: providerProfile.id },
            data: {
                contactName: data.contactName
            }
        });

        // Create verification record
        const verification = await prisma.$transaction(async (tx) => {
            // Soft delete any existing drafts
            await tx.providerVerification.updateMany({
                where: {
                    providerProfileId: providerProfile.id,
                    status: ProviderVerificationStatus.DRAFT,
                    deletedAt: null,
                },
                data: {
                    deletedAt: new Date(),
                },
            });

            // Create new verification
            const newVerification = await tx.providerVerification.create({
                data: {
                    publicId: crypto.randomUUID(),
                    providerProfileId: providerProfile.id,
                    status: ProviderVerificationStatus.UNDER_REVIEW,
                    submittedAt: new Date(),
                    documents: {
                        create: data.documents.map(doc => ({
                            publicId: crypto.randomUUID(),
                            documentType: doc.documentType,
                            fileName: doc.fileName,
                            fileUrl: doc.fileUrl,
                            mimeType: doc.mimeType,
                            documentNumber: doc.documentNumber
                        }))
                    },
                    timelineItems: {
                        create: {
                            publicId: crypto.randomUUID(),
                            title: "Verification Submitted",
                            description: "Provider submitted initial verification request",
                            status: ProviderVerificationStatus.UNDER_REVIEW
                        }
                    }
                },
                include: {
                    documents: true,
                    timelineItems: true
                }
            });

            return newVerification;
        });

        return {
            id: verification.publicId,
            status: verification.status,
            submittedAt: verification.submittedAt,
            documents: verification.documents.map(doc => ({
                id: doc.publicId,
                type: doc.documentType,
                name: doc.fileName,
                url: doc.fileUrl
            }))
        };
    }

    static async getVerificationStatus(userId: string, lang: Lang = "en") {
        const providerProfile = await prisma.providerProfile.findUnique({
            where: { userId },
            include: {
                verifications: {
                    where: { deletedAt: null },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: {
                        documents: true,
                        checklistItems: true,
                        decisions: {
                            orderBy: { decidedAt: 'desc' },
                            take: 1
                        },
                        timelineItems: {
                            orderBy: { occurredAt: 'desc' }
                        }
                    }
                }
            }
        });

        if (!providerProfile) {
            throw new NotFoundException(t("VENDOR_PROVIDER_PROFILE_NOT_FOUND", lang));
        }

        const latestVerification = providerProfile.verifications[0];

        if (!latestVerification) {
            return {
                status: "NOT_SUBMITTED",
                canSubmit: true,
                message: "No verification request submitted yet"
            };
        }

        const latestDecision = latestVerification.decisions[0];

        return {
            id: latestVerification.publicId,
            status: latestVerification.status,
            submittedAt: latestVerification.submittedAt,
            reviewedAt: latestVerification.reviewedAt,
            rejectionReason: latestDecision?.reason,
            actionRequired: latestDecision?.reason, // Simplified mapping
            reviewerNotes: latestVerification.reviewerNotes,
            documents: latestVerification.documents.map(doc => ({
                id: doc.publicId,
                type: doc.documentType,
                name: doc.fileName,
                status: "VERIFIED"
            })),
            checklist: latestVerification.checklistItems.map(item => ({
                id: item.publicId,
                label: item.label,
                checked: item.isComplete
            })),
            timeline: latestVerification.timelineItems.map(item => ({
                id: item.publicId,
                title: item.title,
                description: item.description,
                status: item.status,
                occurredAt: item.occurredAt
            }))
        };
    }

    static async updateVerificationForChanges(userId: string, data: Partial<VerificationSubmissionData>, lang: Lang = "en") {
        const providerProfile = await prisma.providerProfile.findUnique({
            where: { userId },
            include: { businessProfile: true }
        });

        if (!providerProfile) {
            throw new NotFoundException(t("VENDOR_PROVIDER_PROFILE_NOT_FOUND", lang));
        }

        // Find verification with CHANGES_REQUIRED status
        const verification = await prisma.providerVerification.findFirst({
            where: {
                providerProfileId: providerProfile.id,
                status: ProviderVerificationStatus.CHANGES_REQUIRED,
                deletedAt: null
            }
        });

        if (!verification) {
            throw new BadRequestException(t("VENDOR_VERIFICATION_NO_CHANGES_REQUIRED", lang));
        }

        // Update business profile
        if (providerProfile.businessProfile) {
            await prisma.providerBusinessProfile.update({
                where: { providerProfileId: providerProfile.id },
                data: {
                    ...(data.businessName && { businessName: data.businessName }),
                    ...(data.providerType && { providerType: data.providerType }),
                    ...(data.addressLine && { addressLine: data.addressLine }),
                    ...(data.district && { district: data.district }),
                    ...(data.cityProvince && { cityProvince: data.cityProvince }),
                    ...(data.about && { description: data.about }),
                    ...(data.logoUrl && { logoUrl: data.logoUrl }),
                    ...(data.latitude !== undefined && { latitude: data.latitude }),
                    ...(data.longitude !== undefined && { longitude: data.longitude })
                }
            });
        }

        await prisma.providerProfile.update({
            where: { id: providerProfile.id },
            data: {
                ...(data.contactName && { contactName: data.contactName })
            }
        });

        // Update documents if provided
        if (data.documents && data.documents.length > 0) {
            const documentsToCreate = data.documents;
            await prisma.$transaction(async (tx) => {
                // Delete existing documents
                await tx.providerVerificationDocument.deleteMany({
                    where: { providerVerificationId: verification.id }
                });

                // Create new documents
                await tx.providerVerificationDocument.createMany({
                    data: documentsToCreate.map(doc => ({
                        publicId: crypto.randomUUID(),
                        providerVerificationId: verification.id,
                        documentType: doc.documentType,
                        fileName: doc.fileName,
                        fileUrl: doc.fileUrl,
                        mimeType: doc.mimeType,
                        documentNumber: doc.documentNumber
                    }))
                });
            });
        }

        // Update verification status back to UNDER_REVIEW
        const updatedVerification = await prisma.providerVerification.update({
            where: { id: verification.id },
            data: {
                status: ProviderVerificationStatus.UNDER_REVIEW,
                reviewerNotes: null,
                timelineItems: {
                    create: {
                        publicId: crypto.randomUUID(),
                        title: "Verification Resubmitted",
                        description: "Provider submitted requested changes",
                        status: ProviderVerificationStatus.UNDER_REVIEW
                    }
                }
            }
        });

        return {
            success: true,
            message: t("VENDOR_VERIFICATION_UPDATED", lang),
            verificationId: updatedVerification.publicId,
            status: updatedVerification.status
        };
    }

    static async deleteDraftVerification(userId: string, lang: Lang = "en") {
        const providerProfile = await prisma.providerProfile.findUnique({
            where: { userId }
        });

        if (!providerProfile) {
            throw new NotFoundException(t("VENDOR_PROVIDER_PROFILE_NOT_FOUND", lang));
        }

        await prisma.providerVerification.updateMany({
            where: {
                providerProfileId: providerProfile.id,
                status: ProviderVerificationStatus.DRAFT,
                deletedAt: null,
            },
            data: {
                deletedAt: new Date(),
            },
        });

        return {
            success: true,
            message: t("VENDOR_VERIFICATION_DRAFT_DELETED", lang)
        };
    }
}
