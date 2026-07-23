import { prisma } from "../../database/prisma.client";
import { NotFoundException } from "../../utils/app-error.util";
import {
    buildPaginationMeta,
    parsePaginationQuery,
} from "../../utils/pagination.util";
import type { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";

type CategoriesQuery = { page?: unknown; limit?: unknown; isActive?: unknown };

function formatCategory(c: any, counts: { providers: number; services: number }) {
    return {
        id: c.id,
        publicId: c.publicId,
        nameEn: c.nameEn,
        nameKm: c.nameKm,
        slug: c.slug,
        descriptionEn: c.descriptionEn,
        descriptionKm: c.descriptionKm,
        iconName: c.iconName,
        isActive: c.isActive,
        providerCount: counts.providers,
        serviceCount: counts.services,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
    };
}

export class AdminCategoriesService {
    static async list(query: CategoriesQuery, lang: Lang) {
        const { page, limit, skip, take } = parsePaginationQuery(query.page, query.limit);

        const isActiveRaw = query.isActive;
        const isActiveFilter =
            isActiveRaw === "true"
                ? true
                : isActiveRaw === "false"
                ? false
                : undefined;

        const where: any = isActiveFilter !== undefined ? { isActive: isActiveFilter } : {};

        const [categories, total] = await Promise.all([
            prisma.serviceCategory.findMany({
                where,
                orderBy: { nameEn: "asc" },
                skip,
                take,
            }),
            prisma.serviceCategory.count({ where }),
        ]);

        const categoryIds = categories.map((c) => c.id);

        const [providerCounts, serviceCounts] = await Promise.all([
            prisma.providerProfile.groupBy({
                by: ["primaryCategoryId"],
                where: { primaryCategoryId: { in: categoryIds } },
                _count: { id: true },
            }),
            prisma.serviceListing.groupBy({
                by: ["categoryId"],
                where: { categoryId: { in: categoryIds } },
                _count: { id: true },
            }),
        ]);

        const providerMap = new Map(
            providerCounts.map((r) => [r.primaryCategoryId, r._count.id])
        );
        const serviceMap = new Map(
            serviceCounts.map((r) => [r.categoryId, r._count.id])
        );

        return {
            items: categories.map((c) =>
                formatCategory(c, {
                    providers: providerMap.get(c.id) ?? 0,
                    services: serviceMap.get(c.id) ?? 0,
                })
            ),
            meta: buildPaginationMeta(page, limit, total),
        };
    }

    static async getById(id: string, lang: Lang) {
        const c = await prisma.serviceCategory.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
        });
        if (!c) throw new NotFoundException(t("ERROR_NOT_FOUND", lang));

        const [providers, services] = await Promise.all([
            prisma.providerProfile.count({ where: { primaryCategoryId: c.id } }),
            prisma.serviceListing.count({ where: { categoryId: c.id } }),
        ]);

        return formatCategory(c, { providers, services });
    }

    static async create(
        data: {
            nameEn: string;
            nameKm: string;
            descriptionEn?: string;
            descriptionKm?: string;
            iconName?: string;
            isActive?: boolean;
        },
        adminUserId: string,
        lang: Lang
    ) {
        const slug = data.nameEn
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");

        const category = await prisma.serviceCategory.create({
            data: {
                publicId: `CAT-${Date.now()}`,
                nameEn: data.nameEn,
                nameKm: data.nameKm,
                slug,
                descriptionEn: data.descriptionEn,
                descriptionKm: data.descriptionKm,
                iconName: data.iconName,
                isActive: data.isActive ?? true,
            },
        });

        const adminProfile = await prisma.adminProfile.findFirst({ where: { userId: adminUserId } });
        if (adminProfile) {
            await prisma.auditLog.create({
                data: {
                    publicId: `AUD-${Date.now()}`,
                    adminProfileId: adminProfile.id,
                    actorName: adminProfile.fullName,
                    eventType: "CREATED",
                    severity: "INFO",
                    actionEn: `Created category: ${category.nameEn}`,
                    relatedModule: "Categories",
                    relatedRecordId: category.publicId,
                },
            });
        }

        return formatCategory(category, { providers: 0, services: 0 });
    }

    static async update(
        id: string,
        data: Partial<{
            nameEn: string;
            nameKm: string;
            descriptionEn: string;
            descriptionKm: string;
            iconName: string;
            isActive: boolean;
        }>,
        adminUserId: string,
        lang: Lang
    ) {
        const c = await prisma.serviceCategory.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
        });
        if (!c) throw new NotFoundException(t("ERROR_NOT_FOUND", lang));

        const updated = await prisma.serviceCategory.update({
            where: { id: c.id },
            data,
        });

        return this.getById(updated.id, lang);
    }
}
