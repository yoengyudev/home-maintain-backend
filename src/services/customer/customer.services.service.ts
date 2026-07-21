import { prisma } from "../../database/prisma.client";
import type { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";
import { NotFoundException } from "../../utils/app-error.util";
import {
    buildPaginationMeta,
    firstQueryString,
    parsePaginationQuery,
} from "../../utils/pagination.util";
import {
    ProviderStatus,
    ServiceModerationStatus,
    ServiceStatus,
} from "../../generated/prisma/enums";

type ServicesQuery = {
    page?: unknown;
    limit?: unknown;
    search?: unknown;
    category?: unknown;
    area?: unknown;
};

const serviceInclude = {
    category: true,
    providerProfile: {
        include: {
            businessProfile: true,
        },
    },
    areas: {
        include: {
            serviceArea: true,
        },
    },
    _count: {
        select: {
            reviews: true,
        },
    },
} as const;

export class CustomerServicesService {
    static async getServices(query: ServicesQuery, lang: Lang) {
        const { page, limit, skip, take } = parsePaginationQuery(query.page, query.limit);
        const search = firstQueryString(query.search)?.trim() ?? "";
        const category = firstQueryString(query.category)?.trim() ?? "";
        const area = firstQueryString(query.area)?.trim() ?? "";

        const where = {
            serviceStatus: ServiceStatus.ACTIVE,
            moderationStatus: {
                not: ServiceModerationStatus.DISABLED_BY_ADMIN,
            },
            providerProfile: {
                status: ProviderStatus.ACTIVE,
            },
            ...(search
                ? {
                      OR: [
                          { name: { contains: search, mode: "insensitive" as const } },
                          { description: { contains: search, mode: "insensitive" as const } },
                          {
                              category: {
                                  OR: [
                                      { nameEn: { contains: search, mode: "insensitive" as const } },
                                      { nameKm: { contains: search, mode: "insensitive" as const } },
                                      { slug: { contains: search, mode: "insensitive" as const } },
                                  ],
                              },
                          },
                          {
                              providerProfile: {
                                  OR: [
                                      { contactName: { contains: search, mode: "insensitive" as const } },
                                      {
                                          businessProfile: {
                                              businessName: {
                                                  contains: search,
                                                  mode: "insensitive" as const,
                                              },
                                          },
                                      },
                                  ],
                              },
                          },
                      ],
                  }
                : {}),
            ...(category
                ? {
                      category: {
                          isActive: true,
                          OR: [{ id: category }, { slug: category }, { publicId: category }],
                      },
                  }
                : {}),
            ...(area
                ? {
                      areas: {
                          some: {
                              serviceArea: {
                                  isActive: true,
                                  OR: [{ slug: area }, { publicId: area }],
                              },
                          },
                      },
                  }
                : {}),
        };

        const [services, total] = await Promise.all([
            prisma.serviceListing.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: "desc" },
                include: serviceInclude,
            }),
            prisma.serviceListing.count({ where }),
        ]);

        return {
            data: services.map((service) => this.formatService(service, lang)),
            meta: buildPaginationMeta(page, limit, total),
        };
    }

    /**
     * Top booked active services (default 3).
     * Falls back to newest active services when there aren't enough bookings yet.
     */
    static async getRecommendedServices(query: { limit?: unknown }, lang: Lang) {
        const limitRaw = Number(firstQueryString(query.limit) ?? 3);
        const limit = Number.isFinite(limitRaw)
            ? Math.min(Math.max(Math.trunc(limitRaw), 1), 12)
            : 3;

        const activeWhere = {
            serviceStatus: ServiceStatus.ACTIVE,
            moderationStatus: {
                not: ServiceModerationStatus.DISABLED_BY_ADMIN,
            },
            providerProfile: {
                status: ProviderStatus.ACTIVE,
            },
        };

        const topBooked = await prisma.booking.groupBy({
            by: ["serviceListingId"],
            _count: { serviceListingId: true },
            orderBy: { _count: { serviceListingId: "desc" } },
            take: limit,
        });

        const bookedIds = topBooked.map((row) => row.serviceListingId);
        const bookingCountById = new Map(
            topBooked.map((row) => [row.serviceListingId, row._count.serviceListingId])
        );

        let recommended =
            bookedIds.length > 0
                ? await prisma.serviceListing.findMany({
                      where: {
                          ...activeWhere,
                          id: { in: bookedIds },
                      },
                      include: serviceInclude,
                  })
                : [];

        // Preserve booking-count order from groupBy
        recommended = bookedIds
            .map((id) => recommended.find((service) => service.id === id))
            .filter((service): service is NonNullable<typeof service> => Boolean(service));

        if (recommended.length < limit) {
            const excludeIds = recommended.map((service) => service.id);
            const fallback = await prisma.serviceListing.findMany({
                where: {
                    ...activeWhere,
                    ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
                },
                orderBy: [{ createdAt: "desc" }],
                take: limit - recommended.length,
                include: serviceInclude,
            });
            recommended = [...recommended, ...fallback];
        }

        return {
            data: recommended.map((service) => ({
                ...this.formatService(service, lang),
                bookingCount: bookingCountById.get(service.id) ?? 0,
                isTopBooked: (bookingCountById.get(service.id) ?? 0) > 0,
            })),
            source: bookedIds.length > 0 ? "top_booked" : "default",
        };
    }

    static async getServiceById(id: string, lang: Lang) {
        const service = await prisma.serviceListing.findFirst({
            where: {
                id,
                serviceStatus: ServiceStatus.ACTIVE,
                moderationStatus: {
                    not: ServiceModerationStatus.DISABLED_BY_ADMIN,
                },
                providerProfile: {
                    status: ProviderStatus.ACTIVE,
                },
            },
            include: serviceInclude,
        });

        if (!service) {
            throw new NotFoundException(t("CUSTOMER_SERVICE_NOT_FOUND", lang));
        }

        return this.formatService(service, lang);
    }

    private static formatService(
        service: {
            id: string;
            publicId: string;
            name: string;
            description: string | null;
            price: { toNumber?: () => number } | number | string;
            priceUnit: string | null;
            pricingType: string | null;
            duration: string | null;
            imageUrl: string | null;
            quantityEnabled: boolean;
            quantityUnit: string | null;
            minQuantity: number | null;
            maxQuantity: number | null;
            availabilitySummary: string | null;
            serviceStatus: ServiceStatus;
            category: {
                id: string;
                publicId: string;
                slug: string;
                nameEn: string;
                nameKm: string;
                iconName: string | null;
            };
            providerProfile: {
                id: string;
                publicId: string;
                contactName: string;
                avatarUrl: string | null;
                averageRating: { toNumber?: () => number } | number | string | null;
                completedJobs: number;
                businessProfile: {
                    businessName: string;
                } | null;
            };
            areas: Array<{
                serviceArea: {
                    publicId: string;
                    slug: string;
                    nameEn: string;
                    nameKm: string;
                };
            }>;
            _count: {
                reviews: number;
            };
        },
        lang: Lang
    ) {
        const isKh = lang === "kh";

        return {
            id: service.id,
            publicId: service.publicId,
            name: service.name,
            description: service.description,
            price: this.toNumber(service.price),
            priceUnit: service.priceUnit,
            pricingType: service.pricingType,
            duration: service.duration,
            imageUrl: service.imageUrl,
            quantityEnabled: service.quantityEnabled,
            quantityUnit: service.quantityUnit,
            minQuantity: service.minQuantity,
            maxQuantity: service.maxQuantity,
            availabilitySummary: service.availabilitySummary,
            serviceStatus: service.serviceStatus,
            reviewCount: service._count.reviews,
            category: {
                id: service.category.id,
                publicId: service.category.publicId,
                slug: service.category.slug,
                name: isKh ? service.category.nameKm : service.category.nameEn,
                nameEn: service.category.nameEn,
                nameKm: service.category.nameKm,
                iconName: service.category.iconName,
            },
            provider: {
                id: service.providerProfile.id,
                publicId: service.providerProfile.publicId,
                contactName: service.providerProfile.contactName,
                businessName: service.providerProfile.businessProfile?.businessName ?? null,
                avatarUrl: service.providerProfile.avatarUrl,
                averageRating: this.toNumber(service.providerProfile.averageRating),
                completedJobs: service.providerProfile.completedJobs,
            },
            areas: service.areas.map(({ serviceArea }) => ({
                publicId: serviceArea.publicId,
                slug: serviceArea.slug,
                name: isKh ? serviceArea.nameKm : serviceArea.nameEn,
                nameEn: serviceArea.nameEn,
                nameKm: serviceArea.nameKm,
            })),
        };
    }

    private static toNumber(value: { toNumber?: () => number } | number | string | null | undefined) {
        if (value === null || value === undefined) return null;
        if (typeof value === "number") return value;
        if (typeof value === "string") return Number(value);
        if (typeof value.toNumber === "function") return value.toNumber();
        return Number(value);
    }
}
