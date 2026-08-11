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
        let draftVerification = await prisma.providerVerification.findFirst({
            where: {
                providerProfileId: providerProfile.id,
                status: ProviderVerificationStatus.DRAFT
            }
        });

        if (!draftVerification) {
            draftVerification = await prisma.providerVerification.create({
                data: {
                    publicId: crypto.randomUUID(),
                    providerProfileId: providerProfile.id,
                    status: ProviderVerificationStatus.DRAFT
                }
            });
        }

        return {
            success: true,
            message: t("VENDOR_VERIFICATION_DRAFT_SAVED", lang),
            verificationId: draftVerification.publicId
        };
    }

    static async submitVerification(userId: string, data: VerificationSubmissionData, lang: Lang = "en") {
        const providerProfile = await prisma.providerProfile.findUnique({
            where: { userId },
            include: { businessProfile: true, user: true }
        });

        if (!providerProfile) {
            throw new NotFoundException(t("VENDOR_PROVIDER_PROFILE_NOT_FOUND", lang));
        }

        // Check if there's already a pending verification
        const existingVerification = await prisma.providerVerification.findFirst({
            where: {
                providerProfileId: providerProfile.id,
                status: {
                    in: [ProviderVerificationStatus.UNDER_REVIEW, ProviderVerificationStatus.CHANGES_REQUIRED]
                }
            }
        });

        if (existingVerification) {
            throw new BadRequestException(t("VENDOR_VERIFICATION_ALREADY_UNDER_REVIEW", lang));
        }

        // Update business profile
        if (providerProfile.businessProfile) {
            await prisma.providerBusinessProfile.update({
                where: { id: providerProfile.businessProfile.id },
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
        }

        await prisma.providerProfile.update({
            where: { id: providerProfile.id },
            data: {
                contactName: data.contactName
            }
        });

        // Create verification record
        const verification = await prisma.$transaction(async (tx) => {
            // Delete any existing drafts
            await tx.providerVerification.deleteMany({
                where: {
                    providerProfileId: providerProfile.id,
                    status: ProviderVerificationStatus.DRAFT
                }
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
                    checklistItems: {
                        create: [
                            { publicId: crypto.randomUUID(), label: "Business Information", isComplete: true, sortOrder: 1 },
                            { publicId: crypto.randomUUID(), label: "Contact Details", isComplete: true, sortOrder: 2 },
                            { publicId: crypto.randomUUID(), label: "Service Categories", isComplete: true, sortOrder: 3 },
                            { publicId: crypto.randomUUID(), label: "Required Documents", isComplete: true, sortOrder: 4 },
                            { publicId: crypto.randomUUID(), label: "Terms & Conditions", isComplete: true, sortOrder: 5 }
                        ]
                    },
                    timelineItems: {
                        create: {
                            publicId: crypto.randomUUID(),
                            title: "Verification Submitted",
                            description: "Provider submitted verification for review",
                            status: ProviderVerificationStatus.UNDER_REVIEW
                        }
                    }
                }
            });

            return newVerification;
        });

        return {
            success: true,
            message: t("VENDOR_VERIFICATION_SUBMITTED", lang),
            verificationId: verification.publicId,
            status: verification.status
        };
    }

    static async getVerificationStatus(userId: string, lang: Lang = "en") {
        const providerProfile = await prisma.providerProfile.findUnique({
            where: { userId },
            include: {
                verifications: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: {
                        documents: true,
                        checklistItems: true,
                        decisions: {
                            include: {
                                adminProfile: true
                            }
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

        const verification = providerProfile.verifications[0];

        if (!verification) {
            return {
                exists: false,
                status: null,
                data: null
            };
        }

        return {
            exists: true,
            status: verification.status,
            submittedAt: verification.submittedAt,
            reviewedAt: verification.reviewedAt,
            reviewerNotes: verification.reviewerNotes,
            documents: verification.documents.map(doc => ({
                documentType: doc.documentType,
                fileName: doc.fileName,
                fileUrl: doc.fileUrl,
                isVerified: doc.isVerified
            })),
            checklistItems: verification.checklistItems.map(item => ({
                label: item.label,
                isComplete: item.isComplete,
                notes: item.notes
            })),
            decisions: verification.decisions.map(decision => ({
                status: decision.status,
                reason: decision.reason,
                decidedAt: decision.decidedAt,
                reviewerName: decision.adminProfile?.fullName
            })),
            timeline: verification.timelineItems.map(item => ({
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
                status: ProviderVerificationStatus.CHANGES_REQUIRED
            }
        });

        if (!verification) {
            throw new BadRequestException(t("VENDOR_VERIFICATION_NO_CHANGES_REQUIRED", lang));
        }

        // Update business profile
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

        // Update documents if provided
        if (data.documents && data.documents.length > 0) {
            await prisma.$transaction(async (tx) => {
                // Delete existing documents
                await tx.providerVerificationDocument.deleteMany({
                    where: { providerVerificationId: verification.id }
                });

                // Create new documents
                await tx.providerVerificationDocument.createMany({
                    data: data.documents.map(doc => ({
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

        await prisma.providerVerification.deleteMany({
            where: {
                providerProfileId: providerProfile.id,
                status: ProviderVerificationStatus.DRAFT
            }
        });

        return {
            success: true,
            message: t("VENDOR_VERIFICATION_DRAFT_DELETED", lang)
        };
    }
}
