import { prisma } from "../../database/prisma.client";
import { NotFoundException, BadRequestException } from "../../utils/app-error.util";
import { ProviderVerificationStatus, ProviderStatus } from "../../generated/prisma/enums";
import {
    buildPaginationMeta,
    firstQueryString,
    parsePaginationQuery,
} from "../../utils/pagination.util";
import type { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";

const verificationInclude = {
    providerProfile: {
        include: {
            user: { select: { email: true } },
            businessProfile: { select: { businessName: true } },
            primaryCategory: { select: { nameEn: true, nameKm: true } },
            primaryArea: { select: { nameEn: true, nameKm: true } },
        },
    },
    documents: {
        select: {
            id: true,
            documentType: true,
            fileName: true,
            fileUrl: true,
            isVerified: true,
            uploadedAt: true,
        },
    },
    decisions: {
        include: {
            adminProfile: { select: { fullName: true } },
        },
        orderBy: { decidedAt: "desc" as const },
        take: 10,
    },
} as const;

function formatVerification(v: any) {
    return {
        id: v.id,
        publicId: v.publicId,
        status: v.status,
        submittedAt: v.submittedAt?.toISOString() ?? null,
        reviewedAt: v.reviewedAt?.toISOString() ?? null,
        reviewerNotes: v.reviewerNotes,
        createdAt: v.createdAt.toISOString(),
        provider: {
            id: v.providerProfile.id,
            publicId: v.providerProfile.publicId,
            contactName: v.providerProfile.contactName,
            email: v.providerProfile.user?.email ?? "",
            businessName: v.providerProfile.businessProfile?.businessName ?? null,
            primaryCategory: v.providerProfile.primaryCategory,
            primaryArea: v.providerProfile.primaryArea,
        },
        documents: v.documents.map((d: any) => ({
            ...d,
            uploadedAt: d.uploadedAt.toISOString(),
        })),
        decisions: v.decisions.map((d: any) => ({
            id: d.id,
            status: d.status,
            reason: d.reason,
            decidedAt: d.decidedAt.toISOString(),
            adminName: d.adminProfile?.fullName ?? null,
        })),
    };
}

type VerificationsQuery = {
    page?: unknown;
    limit?: unknown;
    status?: unknown;
};

export class AdminVerificationsService {
    static async list(query: VerificationsQuery, lang: Lang) {
        const { page, limit, skip, take } = parsePaginationQuery(query.page, query.limit);
        const statusRaw = firstQueryString(query.status)?.trim().toUpperCase();

        const validStatuses = Object.values(ProviderVerificationStatus) as string[];
        const statusFilter =
            statusRaw && validStatuses.includes(statusRaw)
                ? (statusRaw as ProviderVerificationStatus)
                : undefined;

        const where: any = statusFilter ? { status: statusFilter } : {};

        const [verifications, total] = await Promise.all([
            prisma.providerVerification.findMany({
                where,
                include: verificationInclude,
                orderBy: { submittedAt: "desc" },
                skip,
                take,
            }),
            prisma.providerVerification.count({ where }),
        ]);

        return {
            items: verifications.map(formatVerification),
            meta: buildPaginationMeta(page, limit, total),
        };
    }

    static async getById(id: string, lang: Lang) {
        const v = await prisma.providerVerification.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
            include: verificationInclude,
        });
        if (!v) throw new NotFoundException(t("ERROR_NOT_FOUND", lang));
        return formatVerification(v);
    }

    static async approve(id: string, notes: string | undefined, adminUserId: string, lang: Lang) {
        const v = await prisma.providerVerification.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
            include: { providerProfile: true },
        });
        if (!v) throw new NotFoundException(t("ERROR_NOT_FOUND", lang));
        if (v.status !== ProviderVerificationStatus.UNDER_REVIEW) {
            throw new BadRequestException("Verification must be UNDER_REVIEW to approve");
        }

        const adminProfile = await prisma.adminProfile.findFirst({ where: { userId: adminUserId } });

        await prisma.$transaction([
            prisma.providerVerification.update({
                where: { id: v.id },
                data: {
                    status: ProviderVerificationStatus.APPROVED,
                    reviewedAt: new Date(),
                    reviewerNotes: notes,
                },
            }),
            prisma.providerProfile.update({
                where: { id: v.providerProfileId },
                data: {
                    status: ProviderStatus.ACTIVE,
                    approvedAt: new Date(),
                },
            }),
            ...(adminProfile
                ? [
                      prisma.providerVerificationDecision.create({
                          data: {
                              publicId: `VD-${Date.now()}`,
                              providerVerificationId: v.id,
                              adminProfileId: adminProfile.id,
                              status: ProviderVerificationStatus.APPROVED,
                              reason: notes,
                          },
                      }),
                      prisma.auditLog.create({
                          data: {
                              publicId: `AUD-${Date.now()}`,
                              adminProfileId: adminProfile.id,
                              actorName: adminProfile.fullName,
                              eventType: "APPROVED",
                              severity: "INFO",
                              actionEn: `Approved verification for ${v.providerProfile.contactName}`,
                              relatedModule: "Verifications",
                              relatedRecordId: v.publicId,
                              reasonEn: notes,
                          },
                      }),
                  ]
                : []),
        ]);

        return this.getById(id, lang);
    }

    static async requestChanges(id: string, reason: string, adminUserId: string, lang: Lang) {
        const v = await prisma.providerVerification.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
            include: { providerProfile: true },
        });
        if (!v) throw new NotFoundException(t("ERROR_NOT_FOUND", lang));

        const adminProfile = await prisma.adminProfile.findFirst({ where: { userId: adminUserId } });

        await prisma.$transaction([
            prisma.providerVerification.update({
                where: { id: v.id },
                data: {
                    status: ProviderVerificationStatus.CHANGES_REQUIRED,
                    reviewedAt: new Date(),
                    reviewerNotes: reason,
                },
            }),
            ...(adminProfile
                ? [
                      prisma.providerVerificationDecision.create({
                          data: {
                              publicId: `VD-${Date.now()}`,
                              providerVerificationId: v.id,
                              adminProfileId: adminProfile.id,
                              status: ProviderVerificationStatus.CHANGES_REQUIRED,
                              reason,
                          },
                      }),
                      prisma.auditLog.create({
                          data: {
                              publicId: `AUD-${Date.now()}`,
                              adminProfileId: adminProfile.id,
                              actorName: adminProfile.fullName,
                              eventType: "REQUESTED_CHANGES",
                              severity: "NOTICE",
                              actionEn: `Requested changes for ${v.providerProfile.contactName}`,
                              relatedModule: "Verifications",
                              relatedRecordId: v.publicId,
                              reasonEn: reason,
                          },
                      }),
                  ]
                : []),
        ]);

        return this.getById(id, lang);
    }

    static async reject(id: string, reason: string, adminUserId: string, lang: Lang) {
        const v = await prisma.providerVerification.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
            include: { providerProfile: true },
        });
        if (!v) throw new NotFoundException(t("ERROR_NOT_FOUND", lang));

        const adminProfile = await prisma.adminProfile.findFirst({ where: { userId: adminUserId } });

        await prisma.$transaction([
            prisma.providerVerification.update({
                where: { id: v.id },
                data: {
                    status: ProviderVerificationStatus.REJECTED,
                    reviewedAt: new Date(),
                    reviewerNotes: reason,
                },
            }),
            ...(adminProfile
                ? [
                      prisma.providerVerificationDecision.create({
                          data: {
                              publicId: `VD-${Date.now()}`,
                              providerVerificationId: v.id,
                              adminProfileId: adminProfile.id,
                              status: ProviderVerificationStatus.REJECTED,
                              reason,
                          },
                      }),
                      prisma.auditLog.create({
                          data: {
                              publicId: `AUD-${Date.now()}`,
                              adminProfileId: adminProfile.id,
                              actorName: adminProfile.fullName,
                              eventType: "REJECTED",
                              severity: "WARNING",
                              actionEn: `Rejected verification for ${v.providerProfile.contactName}`,
                              relatedModule: "Verifications",
                              relatedRecordId: v.publicId,
                              reasonEn: reason,
                          },
                      }),
                  ]
                : []),
        ]);

        return this.getById(id, lang);
    }
}
