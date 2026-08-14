import { prisma } from "../../database/prisma.client";
import { BadRequestException, NotFoundException } from "../../utils/app-error.util";
import {
    buildPaginationMeta,
    parsePaginationQuery,
} from "../../utils/pagination.util";
import type { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";
import { toAreaGeoNumber } from "../../utils/provider-service-areas.util";

type ServiceAreasQuery = { page?: unknown; limit?: unknown; isActive?: unknown };

type ServiceAreaUpsert = {
    nameEn: string;
    nameKm: string;
    provinceOrCity?: string;
    latitude?: number | null;
    longitude?: number | null;
    radiusKm?: number;
    isActive?: boolean;
};

function formatArea(a: any, providerCount: number) {
    return {
        id: a.id,
        publicId: a.publicId,
        nameEn: a.nameEn,
        nameKm: a.nameKm,
        slug: a.slug,
        provinceOrCity: a.provinceOrCity,
        latitude: toAreaGeoNumber(a.latitude),
        longitude: toAreaGeoNumber(a.longitude),
        radiusKm: toAreaGeoNumber(a.radiusKm) ?? 15,
        isActive: a.isActive,
        providerCount,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
    };
}

async function countProvidersForArea(areaId: string) {
    const [primaryCount, junctionCount] = await Promise.all([
        prisma.providerProfile.count({ where: { primaryAreaId: areaId } }),
        prisma.providerServiceArea.count({ where: { serviceAreaId: areaId } }),
    ]);
    // Prefer junction count when present; fall back to primary for legacy rows.
    return Math.max(primaryCount, junctionCount);
}

export class AdminServiceAreasService {
    static async list(query: ServiceAreasQuery, lang: Lang) {
        const { page, limit, skip, take } = parsePaginationQuery(query.page, query.limit);

        const isActiveRaw = query.isActive;
        const isActiveFilter =
            isActiveRaw === "true"
                ? true
                : isActiveRaw === "false"
                ? false
                : undefined;

        const where: any = isActiveFilter !== undefined ? { isActive: isActiveFilter } : {};

        const [areas, total] = await Promise.all([
            prisma.serviceArea.findMany({
                where,
                orderBy: { nameEn: "asc" },
                skip,
                take,
            }),
            prisma.serviceArea.count({ where }),
        ]);

        const areaIds = areas.map((a) => a.id);
        const [primaryCounts, junctionCounts] = await Promise.all([
            prisma.providerProfile.groupBy({
                by: ["primaryAreaId"],
                where: { primaryAreaId: { in: areaIds } },
                _count: { id: true },
            }),
            prisma.providerServiceArea.groupBy({
                by: ["serviceAreaId"],
                where: { serviceAreaId: { in: areaIds } },
                _count: { id: true },
            }),
        ]);
        const primaryMap = new Map(
            primaryCounts.map((r) => [r.primaryAreaId, r._count.id])
        );
        const junctionMap = new Map(
            junctionCounts.map((r) => [r.serviceAreaId, r._count.id])
        );

        return {
            items: areas.map((a) =>
                formatArea(
                    a,
                    Math.max(primaryMap.get(a.id) ?? 0, junctionMap.get(a.id) ?? 0)
                )
            ),
            meta: buildPaginationMeta(page, limit, total),
        };
    }

    static async getById(id: string, lang: Lang) {
        const a = await prisma.serviceArea.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
        });
        if (!a) throw new NotFoundException(t("ADMIN_SERVICE_AREA_NOT_FOUND", lang));
        const count = await countProvidersForArea(a.id);
        return formatArea(a, count);
    }

    static async create(data: ServiceAreaUpsert, adminUserId: string, lang: Lang) {
        const slug = data.nameEn
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");

        if (
            data.latitude == null ||
            data.longitude == null ||
            !Number.isFinite(Number(data.latitude)) ||
            !Number.isFinite(Number(data.longitude))
        ) {
            throw new BadRequestException(t("ADMIN_SERVICE_AREA_LOCATION_REQUIRED", lang));
        }

        const radiusKm =
            data.radiusKm !== undefined && Number.isFinite(Number(data.radiusKm))
                ? Math.max(0.5, Number(data.radiusKm))
                : 15;

        const area = await prisma.serviceArea.create({
            data: {
                publicId: `AREA-${Date.now()}`,
                nameEn: data.nameEn,
                nameKm: data.nameKm,
                slug,
                provinceOrCity: data.provinceOrCity,
                latitude: Number(data.latitude),
                longitude: Number(data.longitude),
                radiusKm,
                isActive: data.isActive ?? true,
            },
        });

        return formatArea(area, 0);
    }

    static async update(
        id: string,
        data: Partial<ServiceAreaUpsert>,
        adminUserId: string,
        lang: Lang
    ) {
        const a = await prisma.serviceArea.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
        });
        if (!a) throw new NotFoundException(t("ADMIN_SERVICE_AREA_NOT_FOUND", lang));

        const patch: Record<string, unknown> = {};
        if (data.nameEn !== undefined) patch.nameEn = data.nameEn;
        if (data.nameKm !== undefined) patch.nameKm = data.nameKm;
        if (data.provinceOrCity !== undefined) patch.provinceOrCity = data.provinceOrCity;
        if (data.isActive !== undefined) patch.isActive = data.isActive;
        if (data.latitude !== undefined) patch.latitude = data.latitude;
        if (data.longitude !== undefined) patch.longitude = data.longitude;
        if (data.radiusKm !== undefined && Number.isFinite(Number(data.radiusKm))) {
            patch.radiusKm = Math.max(0.5, Number(data.radiusKm));
        }

        await prisma.serviceArea.update({ where: { id: a.id }, data: patch });
        return this.getById(id, lang);
    }

    static async disable(id: string, adminUserId: string, lang: Lang) {
        const a = await prisma.serviceArea.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
        });
        if (!a) throw new NotFoundException(t("ADMIN_SERVICE_AREA_NOT_FOUND", lang));

        await prisma.serviceArea.update({ where: { id: a.id }, data: { isActive: false } });

        const adminProfile = await prisma.adminProfile.findFirst({ where: { userId: adminUserId } });
        if (adminProfile) {
            await prisma.auditLog.create({
                data: {
                    publicId: `AUD-${Date.now()}`,
                    adminProfileId: adminProfile.id,
                    actorName: adminProfile.fullName,
                    eventType: "DISABLED",
                    severity: "WARNING",
                    actionEn: `Disabled service area: ${a.nameEn}`,
                    relatedModule: "ServiceAreas",
                    relatedRecordId: a.publicId,
                },
            });
        }

        return this.getById(id, lang);
    }

    static async restore(id: string, adminUserId: string, lang: Lang) {
        const a = await prisma.serviceArea.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
        });
        if (!a) throw new NotFoundException(t("ADMIN_SERVICE_AREA_NOT_FOUND", lang));

        await prisma.serviceArea.update({ where: { id: a.id }, data: { isActive: true } });

        const adminProfile = await prisma.adminProfile.findFirst({ where: { userId: adminUserId } });
        if (adminProfile) {
            await prisma.auditLog.create({
                data: {
                    publicId: `AUD-${Date.now()}`,
                    adminProfileId: adminProfile.id,
                    actorName: adminProfile.fullName,
                    eventType: "RESTORED",
                    severity: "INFO",
                    actionEn: `Restored service area: ${a.nameEn}`,
                    relatedModule: "ServiceAreas",
                    relatedRecordId: a.publicId,
                },
            });
        }

        return this.getById(id, lang);
    }

    static async delete(id: string, adminUserId: string, lang: Lang) {
        const a = await prisma.serviceArea.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
        });
        if (!a) throw new NotFoundException(t("ADMIN_SERVICE_AREA_NOT_FOUND", lang));

        const [primaryCount, junctionCount, listingCount] = await Promise.all([
            prisma.providerProfile.count({ where: { primaryAreaId: a.id } }),
            prisma.providerServiceArea.count({ where: { serviceAreaId: a.id } }),
            prisma.serviceListingArea.count({ where: { serviceAreaId: a.id } }),
        ]);
        const providerCount = Math.max(primaryCount, junctionCount);
        if (providerCount > 0 || listingCount > 0) {
            const { BadRequestException } = await import("../../utils/app-error.util");
            throw new BadRequestException(
                t("ADMIN_SERVICE_AREA_DELETE_HAS_LINKS", lang, {
                    providers: providerCount,
                })
            );
        }

        const adminProfile = await prisma.adminProfile.findFirst({ where: { userId: adminUserId } });
        if (adminProfile) {
            await prisma.auditLog.create({
                data: {
                    publicId: `AUD-${Date.now()}`,
                    adminProfileId: adminProfile.id,
                    actorName: adminProfile.fullName,
                    eventType: "DISABLED",
                    severity: "CRITICAL",
                    actionEn: `Deleted service area: ${a.nameEn}`,
                    relatedModule: "ServiceAreas",
                    relatedRecordId: a.publicId,
                },
            });
        }

        await prisma.serviceArea.delete({ where: { id: a.id } });
        return { deleted: true, id: a.publicId };
    }
}
