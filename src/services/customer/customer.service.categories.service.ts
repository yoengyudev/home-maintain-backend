import { prisma } from "../../database/prisma.client";
import type { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";
import { NotFoundException } from "../../utils/app-error.util";
import {
    buildPaginationMeta,
    firstQueryString,
    parsePaginationQuery,
} from "../../utils/pagination.util";
import { ServiceStatus } from "../../generated/prisma/enums";

export class CustomerServiceCategoriesService {
    static async getCategories(
        query: { page?: unknown; limit?: unknown; search?: unknown },
        lang: Lang
    ) {
        const { page, limit, skip, take } = parsePaginationQuery(query.page, query.limit);
        const search = firstQueryString(query.search)?.trim() ?? "";

        const where = {
            isActive: true,
            ...(search
                ? {
                      OR: [
                          { nameEn: { contains: search, mode: "insensitive" as const } },
                          { nameKm: { contains: search, mode: "insensitive" as const } },
                          { slug: { contains: search, mode: "insensitive" as const } },
                      ],
                  }
                : {}),
        };

        const [categories, total] = await Promise.all([
            prisma.serviceCategory.findMany({
                where,
                skip,
                take,
                orderBy: { nameEn: "asc" },
                include: {
                    _count: {
                        select: {
                            serviceListings: {
                                where: { serviceStatus: ServiceStatus.ACTIVE },
                            },
                        },
                    },
                },
            }),
            prisma.serviceCategory.count({ where }),
        ]);

        return {
            data: categories.map((category) => this.formatCategory(category, lang)),
            meta: buildPaginationMeta(page, limit, total),
        };
    }

    static async getCategoryById(id: string, lang: Lang) {
        const category = await prisma.serviceCategory.findFirst({
            where: {
                id,
                isActive: true,
            },
            include: {
                _count: {
                    select: {
                        serviceListings: {
                            where: { serviceStatus: ServiceStatus.ACTIVE },
                        },
                    },
                },
            },
        });

        if (!category) {
            throw new NotFoundException(t("CUSTOMER_CATEGORY_NOT_FOUND", lang));
        }

        return this.formatCategory(category, lang);
    }

    private static formatCategory(
        category: {
            id: string;
            publicId: string;
            nameEn: string;
            nameKm: string;
            slug: string;
            descriptionEn: string | null;
            descriptionKm: string | null;
            iconName: string | null;
            isActive: boolean;
            _count?: { serviceListings: number };
        },
        lang: Lang
    ) {
        const isKh = lang === "kh";

        return {
            id: category.id,
            publicId: category.publicId,
            slug: category.slug,
            name: isKh ? category.nameKm : category.nameEn,
            nameEn: category.nameEn,
            nameKm: category.nameKm,
            description: isKh ? category.descriptionKm : category.descriptionEn,
            descriptionEn: category.descriptionEn,
            descriptionKm: category.descriptionKm,
            iconName: category.iconName,
            isActive: category.isActive,
            activeServiceCount: category._count?.serviceListings ?? 0,
        };
    }
}
