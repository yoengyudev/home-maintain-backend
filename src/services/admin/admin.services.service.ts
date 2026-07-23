import { prisma } from "../../database/prisma.client";
import { NotFoundException, BadRequestException } from "../../utils/app-error.util";
import {
    ServiceStatus,
    ServiceModerationStatus,
} from "../../generated/prisma/enums";
import {
    buildPaginationMeta,
    firstQueryString,
    parsePaginationQuery,
} from "../../utils/pagination.util";
import type { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";

const serviceInclude = {
    providerProfile: {
        select: {
            id: true,
            publicId: true,
            contactName: true,
            businessProfile: { select: { businessName: true } },
        },
    },
    category: { select: { id: true, publicId: true, nameEn: true, nameKm: true } },
    moderationHistory: {
        include: { adminProfile: { select: { fullName: true } } },
        orderBy: { createdAt: "desc" as const },
        take: 10,
    },
} as const;

function formatService(s: any) {
    return {
        id: s.id,
        publicId: s.publicId,
        name: s.name,
        description: s.description,
        price: parseFloat(s.price),
        priceUnit: s.priceUnit,
        imageUrl: s.imageUrl,
        serviceStatus: s.serviceStatus,
        moderationStatus: s.moderationStatus,
        createdAt: s.createdAt.toISOString(),
        provider: {
            id: s.providerProfile.id,
            publicId: s.providerProfile.publicId,
            contactName: s.providerProfile.contactName,
            businessName: s.providerProfile.businessProfile?.businessName ?? null,
        },
        category: s.category,
        moderationHistory: s.moderationHistory.map((h: any) => ({
            id: h.id,
            publicId: h.publicId,
            eventType: h.eventType,
            reason: h.reason,
            note: h.note,
            resultingServiceStatus: h.resultingServiceStatus,
            resultingModerationStatus: h.resultingModerationStatus,
            createdAt: h.createdAt.toISOString(),
            adminName: h.adminProfile?.fullName ?? null,
        })),
    };
}

type ServicesQuery = {
    page?: unknown;
    limit?: unknown;
    status?: unknown;
    moderationStatus?: unknown;
    search?: unknown;
    categoryId?: unknown;
};

export class AdminServicesService {
    static async list(query: ServicesQuery, lang: Lang) {
        const { page, limit, skip, take } = parsePaginationQuery(query.page, query.limit);
        const statusRaw = firstQueryString(query.status)?.trim().toUpperCase();
        const moderationRaw = firstQueryString(query.moderationStatus)?.trim().toUpperCase();
        const search = firstQueryString(query.search)?.trim();
        const categoryId = firstQueryString(query.categoryId)?.trim();

        const validStatuses = Object.values(ServiceStatus) as string[];
        const validModerations = Object.values(ServiceModerationStatus) as string[];

        const statusFilter =
            statusRaw && validStatuses.includes(statusRaw)
                ? (statusRaw as ServiceStatus)
                : undefined;
        const moderationFilter =
            moderationRaw && validModerations.includes(moderationRaw)
                ? (moderationRaw as ServiceModerationStatus)
                : undefined;

        const where: any = {
            ...(statusFilter ? { serviceStatus: statusFilter } : {}),
            ...(moderationFilter ? { moderationStatus: moderationFilter } : {}),
            ...(categoryId ? { categoryId } : {}),
            ...(search
                ? {
                      name: { contains: search, mode: "insensitive" },
                  }
                : {}),
        };

        const [services, total] = await Promise.all([
            prisma.serviceListing.findMany({
                where,
                include: serviceInclude,
                orderBy: { createdAt: "desc" },
                skip,
                take,
            }),
            prisma.serviceListing.count({ where }),
        ]);

        return {
            items: services.map(formatService),
            meta: buildPaginationMeta(page, limit, total),
        };
    }

    static async getById(id: string, lang: Lang) {
        const s = await prisma.serviceListing.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
            include: serviceInclude,
        });
        if (!s) throw new NotFoundException(t("ERROR_NOT_FOUND", lang));
        return formatService(s);
    }

    static async disable(id: string, reason: string, adminUserId: string, lang: Lang) {
        const s = await prisma.serviceListing.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
        });
        if (!s) throw new NotFoundException(t("ERROR_NOT_FOUND", lang));
        if (s.moderationStatus === ServiceModerationStatus.DISABLED_BY_ADMIN) {
            throw new BadRequestException("Service is already disabled");
        }

        const adminProfile = await prisma.adminProfile.findFirst({ where: { userId: adminUserId } });

        await prisma.serviceListing.update({
            where: { id: s.id },
            data: {
                serviceStatus: ServiceStatus.DISABLED,
                moderationStatus: ServiceModerationStatus.DISABLED_BY_ADMIN,
            },
        });

        await prisma.serviceModerationHistory.create({
            data: {
                publicId: `SMH-${Date.now()}`,
                serviceListingId: s.id,
                adminProfileId: adminProfile?.id,
                eventType: "DISABLED",
                reason,
                resultingServiceStatus: ServiceStatus.DISABLED,
                resultingModerationStatus: ServiceModerationStatus.DISABLED_BY_ADMIN,
            },
        });

        if (adminProfile) {
            await prisma.auditLog.create({
                data: {
                    publicId: `AUD-${Date.now()}`,
                    adminProfileId: adminProfile.id,
                    actorName: adminProfile.fullName,
                    eventType: "DISABLED",
                    severity: "WARNING",
                    actionEn: `Disabled service: ${s.name}`,
                    relatedModule: "Services",
                    relatedRecordId: s.publicId,
                    reasonEn: reason,
                },
            });
        }

        return this.getById(id, lang);
    }

    static async restore(id: string, adminUserId: string, lang: Lang) {
        const s = await prisma.serviceListing.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
        });
        if (!s) throw new NotFoundException(t("ERROR_NOT_FOUND", lang));
        if (s.moderationStatus !== ServiceModerationStatus.DISABLED_BY_ADMIN) {
            throw new BadRequestException("Service is not disabled by admin");
        }

        const adminProfile = await prisma.adminProfile.findFirst({ where: { userId: adminUserId } });

        await prisma.serviceListing.update({
            where: { id: s.id },
            data: {
                serviceStatus: ServiceStatus.ACTIVE,
                moderationStatus: ServiceModerationStatus.NORMAL,
            },
        });

        await prisma.serviceModerationHistory.create({
            data: {
                publicId: `SMH-${Date.now()}`,
                serviceListingId: s.id,
                adminProfileId: adminProfile?.id,
                eventType: "RESTORED",
                resultingServiceStatus: ServiceStatus.ACTIVE,
                resultingModerationStatus: ServiceModerationStatus.NORMAL,
            },
        });

        if (adminProfile) {
            await prisma.auditLog.create({
                data: {
                    publicId: `AUD-${Date.now()}`,
                    adminProfileId: adminProfile.id,
                    actorName: adminProfile.fullName,
                    eventType: "RESTORED",
                    severity: "INFO",
                    actionEn: `Restored service: ${s.name}`,
                    relatedModule: "Services",
                    relatedRecordId: s.publicId,
                },
            });
        }

        return this.getById(id, lang);
    }
}
