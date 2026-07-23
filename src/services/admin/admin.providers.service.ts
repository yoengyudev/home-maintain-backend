import { prisma } from "../../database/prisma.client";
import { NotFoundException, BadRequestException } from "../../utils/app-error.util";
import { ProviderStatus } from "../../generated/prisma/enums";
import {
    buildPaginationMeta,
    firstQueryString,
    parsePaginationQuery,
} from "../../utils/pagination.util";
import type { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";

const providerInclude = {
    user: { select: { email: true, phone: true } },
    primaryCategory: { select: { id: true, publicId: true, nameEn: true, nameKm: true } },
    primaryArea: { select: { id: true, publicId: true, nameEn: true, nameKm: true } },
    businessProfile: {
        select: {
            businessName: true,
            providerType: true,
            description: true,
            logoUrl: true,
            addressLine: true,
            district: true,
            cityProvince: true,
        },
    },
    verifications: {
        select: { status: true, submittedAt: true, reviewedAt: true },
        orderBy: { createdAt: "desc" as const },
        take: 1,
    },
} as const;

function formatProvider(p: any) {
    return {
        id: p.id,
        publicId: p.publicId,
        contactName: p.contactName,
        email: p.user?.email ?? "",
        phone: p.user?.phone ?? null,
        status: p.status,
        avatarUrl: p.avatarUrl,
        primaryCategory: p.primaryCategory,
        primaryArea: p.primaryArea,
        businessProfile: p.businessProfile,
        verificationStatus: p.verifications?.[0]?.status ?? null,
        averageRating: p.averageRating ? parseFloat(p.averageRating) : null,
        completedJobs: p.completedJobs,
        approvedAt: p.approvedAt?.toISOString() ?? null,
        suspendedAt: p.suspendedAt?.toISOString() ?? null,
        suspensionReason: p.suspensionReason,
        createdAt: p.createdAt.toISOString(),
    };
}

type ProvidersQuery = {
    page?: unknown;
    limit?: unknown;
    status?: unknown;
    search?: unknown;
};

export class AdminProvidersService {
    static async list(query: ProvidersQuery, lang: Lang) {
        const { page, limit, skip, take } = parsePaginationQuery(query.page, query.limit);
        const statusRaw = firstQueryString(query.status)?.trim().toUpperCase();
        const search = firstQueryString(query.search)?.trim();

        const validStatuses = Object.values(ProviderStatus) as string[];
        const statusFilter = statusRaw && validStatuses.includes(statusRaw)
            ? (statusRaw as ProviderStatus)
            : undefined;

        const where: any = {
            ...(statusFilter ? { status: statusFilter } : {}),
            ...(search
                ? {
                      OR: [
                          { contactName: { contains: search, mode: "insensitive" } },
                          { user: { email: { contains: search, mode: "insensitive" } } },
                          {
                              businessProfile: {
                                  businessName: { contains: search, mode: "insensitive" },
                              },
                          },
                      ],
                  }
                : {}),
        };

        const [providers, total] = await Promise.all([
            prisma.providerProfile.findMany({
                where,
                include: providerInclude,
                orderBy: { createdAt: "desc" },
                skip,
                take,
            }),
            prisma.providerProfile.count({ where }),
        ]);

        return {
            items: providers.map(formatProvider),
            meta: buildPaginationMeta(page, limit, total),
        };
    }

    static async getById(id: string, lang: Lang) {
        const provider = await prisma.providerProfile.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
            include: providerInclude,
        });

        if (!provider) {
            throw new NotFoundException(t("ERROR_NOT_FOUND", lang));
        }

        return formatProvider(provider);
    }

    static async suspend(id: string, reason: string, adminUserId: string, lang: Lang) {
        const provider = await prisma.providerProfile.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
            include: { user: true },
        });

        if (!provider) throw new NotFoundException(t("ERROR_NOT_FOUND", lang));
        if (provider.status === ProviderStatus.SUSPENDED) {
            throw new BadRequestException("Provider is already suspended");
        }

        const updated = await prisma.providerProfile.update({
            where: { id: provider.id },
            data: {
                status: ProviderStatus.SUSPENDED,
                suspendedAt: new Date(),
                suspensionReason: reason,
            },
            include: providerInclude,
        });

        // Log audit event
        const adminProfile = await prisma.adminProfile.findFirst({
            where: { userId: adminUserId },
        });
        if (adminProfile) {
            await prisma.auditLog.create({
                data: {
                    publicId: `AUD-${Date.now()}`,
                    adminProfileId: adminProfile.id,
                    actorName: adminProfile.fullName,
                    eventType: "SUSPENDED",
                    severity: "WARNING",
                    actionEn: `Suspended provider: ${provider.contactName}`,
                    relatedModule: "Providers",
                    relatedRecordId: provider.publicId,
                    reasonEn: reason,
                },
            });
        }

        return formatProvider(updated);
    }

    static async restore(id: string, adminUserId: string, lang: Lang) {
        const provider = await prisma.providerProfile.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
            include: { user: true },
        });

        if (!provider) throw new NotFoundException(t("ERROR_NOT_FOUND", lang));
        if (provider.status !== ProviderStatus.SUSPENDED) {
            throw new BadRequestException("Provider is not suspended");
        }

        const updated = await prisma.providerProfile.update({
            where: { id: provider.id },
            data: {
                status: ProviderStatus.ACTIVE,
                suspendedAt: null,
                suspensionReason: null,
            },
            include: providerInclude,
        });

        const adminProfile = await prisma.adminProfile.findFirst({
            where: { userId: adminUserId },
        });
        if (adminProfile) {
            await prisma.auditLog.create({
                data: {
                    publicId: `AUD-${Date.now()}`,
                    adminProfileId: adminProfile.id,
                    actorName: adminProfile.fullName,
                    eventType: "RESTORED",
                    severity: "INFO",
                    actionEn: `Restored provider: ${provider.contactName}`,
                    relatedModule: "Providers",
                    relatedRecordId: provider.publicId,
                },
            });
        }

        return formatProvider(updated);
    }
}
