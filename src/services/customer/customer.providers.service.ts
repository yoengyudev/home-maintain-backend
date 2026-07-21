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

type ProvidersQuery = {
    page?: unknown;
    limit?: unknown;
    search?: unknown;
    category?: unknown;
    area?: unknown;
};

const activeServiceWhere = {
    serviceStatus: ServiceStatus.ACTIVE,
    moderationStatus: {
        not: ServiceModerationStatus.DISABLED_BY_ADMIN,
    },
} as const;

export class CustomerProvidersService {
    static async getProviders(query: ProvidersQuery, lang: Lang) {
        const { page, limit, skip, take } = parsePaginationQuery(query.page, query.limit);
        const search = firstQueryString(query.search)?.trim() ?? "";
        const category = firstQueryString(query.category)?.trim() ?? "";
        const area = firstQueryString(query.area)?.trim() ?? "";

        const where = {
            status: ProviderStatus.ACTIVE,
            serviceListings: {
                some: {
                    ...activeServiceWhere,
                    ...(category
                        ? {
                              category: {
                                  isActive: true,
                                  OR: [{ slug: category }, { publicId: category }],
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
                },
            },
            ...(search
                ? {
                      OR: [
                          { contactName: { contains: search, mode: "insensitive" as const } },
                          {
                              businessProfile: {
                                  OR: [
                                      {
                                          businessName: {
                                              contains: search,
                                              mode: "insensitive" as const,
                                          },
                                      },
                                      {
                                          description: {
                                              contains: search,
                                              mode: "insensitive" as const,
                                          },
                                      },
                                      {
                                          cityProvince: {
                                              contains: search,
                                              mode: "insensitive" as const,
                                          },
                                      },
                                      {
                                          district: {
                                              contains: search,
                                              mode: "insensitive" as const,
                                          },
                                      },
                                  ],
                              },
                          },
                      ],
                  }
                : {}),
        };

        const [providers, total] = await Promise.all([
            prisma.providerProfile.findMany({
                where,
                skip,
                take,
                orderBy: [{ averageRating: "desc" }, { completedJobs: "desc" }, { createdAt: "desc" }],
                include: {
                    businessProfile: true,
                    primaryArea: true,
                    primaryCategory: true,
                    _count: {
                        select: {
                            reviews: true,
                            serviceListings: {
                                where: activeServiceWhere,
                            },
                        },
                    },
                },
            }),
            prisma.providerProfile.count({ where }),
        ]);

        return {
            data: providers.map((provider) => this.formatProviderSummary(provider, lang)),
            meta: buildPaginationMeta(page, limit, total),
        };
    }

    /**
     * Top booked active providers (default 3).
     * Falls back to highest-rated active providers when there aren't enough bookings yet.
     */
    static async getRecommendedProviders(query: { limit?: unknown }, lang: Lang) {
        const limitRaw = Number(firstQueryString(query.limit) ?? 3);
        const limit = Number.isFinite(limitRaw)
            ? Math.min(Math.max(Math.trunc(limitRaw), 1), 12)
            : 3;

        const activeWhere = {
            status: ProviderStatus.ACTIVE,
            serviceListings: {
                some: activeServiceWhere,
            },
        };

        const providerInclude = {
            businessProfile: true,
            primaryArea: true,
            primaryCategory: true,
            _count: {
                select: {
                    reviews: true,
                    serviceListings: {
                        where: activeServiceWhere,
                    },
                },
            },
        } as const;

        const topBooked = await prisma.booking.groupBy({
            by: ["providerProfileId"],
            _count: { providerProfileId: true },
            orderBy: { _count: { providerProfileId: "desc" } },
            take: limit,
        });

        const bookedIds = topBooked.map((row) => row.providerProfileId);
        const bookingCountById = new Map(
            topBooked.map((row) => [row.providerProfileId, row._count.providerProfileId])
        );

        let recommended =
            bookedIds.length > 0
                ? await prisma.providerProfile.findMany({
                      where: {
                          ...activeWhere,
                          id: { in: bookedIds },
                      },
                      include: providerInclude,
                  })
                : [];

        recommended = bookedIds
            .map((id) => recommended.find((provider) => provider.id === id))
            .filter((provider): provider is NonNullable<typeof provider> => Boolean(provider));

        if (recommended.length < limit) {
            const excludeIds = recommended.map((provider) => provider.id);
            const fallback = await prisma.providerProfile.findMany({
                where: {
                    ...activeWhere,
                    ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
                },
                orderBy: [
                    { averageRating: "desc" },
                    { completedJobs: "desc" },
                    { createdAt: "desc" },
                ],
                take: limit - recommended.length,
                include: providerInclude,
            });
            recommended = [...recommended, ...fallback];
        }

        return {
            data: recommended.map((provider) => ({
                ...this.formatProviderSummary(provider, lang),
                bookingCount: bookingCountById.get(provider.id) ?? 0,
                isTopBooked: (bookingCountById.get(provider.id) ?? 0) > 0,
            })),
            source: bookedIds.length > 0 ? "top_booked" : "default",
        };
    }

    static async getProviderByPublicId(publicId: string, lang: Lang) {
        const provider = await prisma.providerProfile.findFirst({
            where: {
                publicId,
                status: ProviderStatus.ACTIVE,
            },
            include: {
                businessProfile: true,
                primaryArea: true,
                primaryCategory: true,
                serviceListings: {
                    where: activeServiceWhere,
                    orderBy: { createdAt: "desc" },
                    include: {
                        category: true,
                        areas: {
                            include: {
                                serviceArea: true,
                            },
                        },
                        _count: {
                            select: { reviews: true },
                        },
                    },
                },
                reviews: {
                    orderBy: { createdAt: "desc" },
                    take: 10,
                    include: {
                        customerProfile: true,
                        serviceListing: {
                            select: {
                                publicId: true,
                                name: true,
                            },
                        },
                    },
                },
                _count: {
                    select: {
                        reviews: true,
                        serviceListings: {
                            where: activeServiceWhere,
                        },
                    },
                },
            },
        });

        if (!provider) {
            throw new NotFoundException(t("CUSTOMER_PROVIDER_NOT_FOUND", lang));
        }

        return this.formatProviderDetail(provider, lang);
    }

    private static formatProviderSummary(
        provider: {
            publicId: string;
            contactName: string;
            avatarUrl: string | null;
            averageRating: { toNumber?: () => number } | number | string | null;
            completedJobs: number;
            approvedAt: Date | null;
            createdAt: Date;
            businessProfile: {
                businessName: string;
                description: string | null;
                logoUrl: string | null;
                addressLine: string | null;
                district: string | null;
                cityProvince: string | null;
                coverageSummary: string | null;
                providerType: string | null;
            } | null;
            primaryArea: {
                publicId: string;
                slug: string;
                nameEn: string;
                nameKm: string;
            } | null;
            primaryCategory: {
                publicId: string;
                slug: string;
                nameEn: string;
                nameKm: string;
                iconName: string | null;
            } | null;
            _count: {
                reviews: number;
                serviceListings: number;
            };
        },
        lang: Lang
    ) {
        const isKh = lang === "kh";
        const business = provider.businessProfile;
        const location =
            [business?.district, business?.cityProvince].filter(Boolean).join(", ") ||
            (provider.primaryArea
                ? isKh
                    ? provider.primaryArea.nameKm
                    : provider.primaryArea.nameEn
                : null);

        return {
            publicId: provider.publicId,
            contactName: provider.contactName,
            businessName: business?.businessName ?? null,
            name: business?.businessName?.trim() || provider.contactName,
            description: business?.description ?? null,
            avatarUrl: provider.avatarUrl,
            logoUrl: business?.logoUrl ?? provider.avatarUrl,
            providerType: business?.providerType ?? null,
            location,
            coverageSummary: business?.coverageSummary ?? null,
            averageRating: this.toNumber(provider.averageRating),
            completedJobs: provider.completedJobs,
            reviewCount: provider._count.reviews,
            activeServiceCount: provider._count.serviceListings,
            isVerified: true,
            memberSince: String((provider.approvedAt ?? provider.createdAt).getFullYear()),
            primaryArea: provider.primaryArea
                ? {
                      publicId: provider.primaryArea.publicId,
                      slug: provider.primaryArea.slug,
                      name: isKh ? provider.primaryArea.nameKm : provider.primaryArea.nameEn,
                      nameEn: provider.primaryArea.nameEn,
                      nameKm: provider.primaryArea.nameKm,
                  }
                : null,
            primaryCategory: provider.primaryCategory
                ? {
                      publicId: provider.primaryCategory.publicId,
                      slug: provider.primaryCategory.slug,
                      name: isKh
                          ? provider.primaryCategory.nameKm
                          : provider.primaryCategory.nameEn,
                      nameEn: provider.primaryCategory.nameEn,
                      nameKm: provider.primaryCategory.nameKm,
                      iconName: provider.primaryCategory.iconName,
                  }
                : null,
        };
    }

    private static formatProviderDetail(
        provider: {
            publicId: string;
            contactName: string;
            avatarUrl: string | null;
            averageRating: { toNumber?: () => number } | number | string | null;
            completedJobs: number;
            approvedAt: Date | null;
            createdAt: Date;
            businessProfile: {
                businessName: string;
                description: string | null;
                logoUrl: string | null;
                addressLine: string | null;
                district: string | null;
                cityProvince: string | null;
                coverageSummary: string | null;
                providerType: string | null;
                workingDays: string[];
                workingHoursStart: string | null;
                workingHoursEnd: string | null;
            } | null;
            primaryArea: {
                publicId: string;
                slug: string;
                nameEn: string;
                nameKm: string;
            } | null;
            primaryCategory: {
                publicId: string;
                slug: string;
                nameEn: string;
                nameKm: string;
                iconName: string | null;
            } | null;
            serviceListings: Array<{
                publicId: string;
                name: string;
                description: string | null;
                price: { toNumber?: () => number } | number | string;
                priceUnit: string | null;
                pricingType: string | null;
                duration: string | null;
                imageUrl: string | null;
                availabilitySummary: string | null;
                category: {
                    publicId: string;
                    slug: string;
                    nameEn: string;
                    nameKm: string;
                    iconName: string | null;
                };
                areas: Array<{
                    serviceArea: {
                        publicId: string;
                        slug: string;
                        nameEn: string;
                        nameKm: string;
                    };
                }>;
                _count: { reviews: number };
            }>;
            reviews: Array<{
                publicId: string;
                rating: { toNumber?: () => number } | number | string;
                comment: string | null;
                createdAt: Date;
                customerProfile: {
                    fullName: string;
                    avatarUrl: string | null;
                };
                serviceListing: {
                    publicId: string;
                    name: string;
                };
            }>;
            _count: {
                reviews: number;
                serviceListings: number;
            };
        },
        lang: Lang
    ) {
        const isKh = lang === "kh";
        const summary = this.formatProviderSummary(provider, lang);

        const areaMap = new Map<
            string,
            { publicId: string; slug: string; name: string; nameEn: string; nameKm: string }
        >();

        if (provider.primaryArea) {
            areaMap.set(provider.primaryArea.publicId, {
                publicId: provider.primaryArea.publicId,
                slug: provider.primaryArea.slug,
                name: isKh ? provider.primaryArea.nameKm : provider.primaryArea.nameEn,
                nameEn: provider.primaryArea.nameEn,
                nameKm: provider.primaryArea.nameKm,
            });
        }

        for (const listing of provider.serviceListings) {
            for (const { serviceArea } of listing.areas) {
                if (areaMap.has(serviceArea.publicId)) continue;
                areaMap.set(serviceArea.publicId, {
                    publicId: serviceArea.publicId,
                    slug: serviceArea.slug,
                    name: isKh ? serviceArea.nameKm : serviceArea.nameEn,
                    nameEn: serviceArea.nameEn,
                    nameKm: serviceArea.nameKm,
                });
            }
        }

        return {
            ...summary,
            addressLine: provider.businessProfile?.addressLine ?? null,
            workingDays: provider.businessProfile?.workingDays ?? [],
            workingHoursStart: provider.businessProfile?.workingHoursStart ?? null,
            workingHoursEnd: provider.businessProfile?.workingHoursEnd ?? null,
            areas: Array.from(areaMap.values()),
            services: provider.serviceListings.map((listing) => ({
                publicId: listing.publicId,
                name: listing.name,
                description: listing.description,
                price: this.toNumber(listing.price) ?? 0,
                priceUnit: listing.priceUnit,
                pricingType: listing.pricingType,
                duration: listing.duration,
                imageUrl: listing.imageUrl,
                availabilitySummary: listing.availabilitySummary,
                reviewCount: listing._count.reviews,
                category: {
                    publicId: listing.category.publicId,
                    slug: listing.category.slug,
                    name: isKh ? listing.category.nameKm : listing.category.nameEn,
                    nameEn: listing.category.nameEn,
                    nameKm: listing.category.nameKm,
                    iconName: listing.category.iconName,
                },
                areas: listing.areas.map(({ serviceArea }) => ({
                    publicId: serviceArea.publicId,
                    slug: serviceArea.slug,
                    name: isKh ? serviceArea.nameKm : serviceArea.nameEn,
                    nameEn: serviceArea.nameEn,
                    nameKm: serviceArea.nameKm,
                })),
            })),
            reviews: provider.reviews.map((review) => ({
                publicId: review.publicId,
                rating: this.toNumber(review.rating) ?? 0,
                comment: review.comment,
                createdAt: review.createdAt.toISOString(),
                authorName: review.customerProfile.fullName,
                authorAvatarUrl: review.customerProfile.avatarUrl,
                service: {
                    publicId: review.serviceListing.publicId,
                    name: review.serviceListing.name,
                },
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
