import { prisma } from "../../database/prisma.client";
import { NotFoundException } from "../../utils/app-error.util";
import {
    buildPaginationMeta,
    parsePaginationQuery,
} from "../../utils/pagination.util";
import type { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";

type ServiceAreasQuery = { page?: unknown; limit?: unknown; isActive?: unknown };

function formatArea(a: any, providerCount: number) {
    return {
        id: a.id,
        publicId: a.publicId,
        nameEn: a.nameEn,
        nameKm: a.nameKm,
        slug: a.slug,
        provinceOrCity: a.provinceOrCity,
        isActive: a.isActive,
        providerCount,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
    };
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
        const providerCounts = await prisma.providerProfile.groupBy({
            by: ["primaryAreaId"],
            where: { primaryAreaId: { in: areaIds } },
            _count: { id: true },
        });
        const countMap = new Map(
            providerCounts.map((r) => [r.primaryAreaId, r._count.id])
        );

        return {
            items: areas.map((a) => formatArea(a, countMap.get(a.id) ?? 0)),
            meta: buildPaginationMeta(page, limit, total),
        };
    }

    static async getById(id: string, lang: Lang) {
        const a = await prisma.serviceArea.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
        });
        if (!a) throw new NotFoundException(t("ERROR_NOT_FOUND", lang));
        const count = await prisma.providerProfile.count({ where: { primaryAreaId: a.id } });
        return formatArea(a, count);
    }

    static async create(
        data: {
            nameEn: string;
            nameKm: string;
            provinceOrCity?: string;
            isActive?: boolean;
        },
        adminUserId: string,
        lang: Lang
    ) {
        const slug = data.nameEn
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");

        const area = await prisma.serviceArea.create({
            data: {
                publicId: `AREA-${Date.now()}`,
                nameEn: data.nameEn,
                nameKm: data.nameKm,
                slug,
                provinceOrCity: data.provinceOrCity,
                isActive: data.isActive ?? true,
            },
        });

        return formatArea(area, 0);
    }

    static async update(
        id: string,
        data: Partial<{
            nameEn: string;
            nameKm: string;
            provinceOrCity: string;
            isActive: boolean;
        }>,
        adminUserId: string,
        lang: Lang
    ) {
        const a = await prisma.serviceArea.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
        });
        if (!a) throw new NotFoundException(t("ERROR_NOT_FOUND", lang));

        await prisma.serviceArea.update({ where: { id: a.id }, data });
        return this.getById(id, lang);
    }
}
