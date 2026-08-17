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
    BookingStatus,
    ServiceModerationStatus,
    ServiceStatus,
} from "../../generated/prisma/enums";
import { availableToCustomersWhere } from "../../utils/customer-provider-visibility.util";
import { buildAvailabilityCalendar, resolveSchedule } from "../../utils/provider-availability.util";

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
            primaryArea: true,
            serviceAreas: {
                include: {
                    serviceArea: true,
                },
            },
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

const serviceDetailInclude = {
    ...serviceInclude,
    reviews: {
        orderBy: { createdAt: "desc" as const },
        take: 8,
        include: {
            customerProfile: {
                select: {
                    fullName: true,
                    avatarUrl: true,
                },
            },
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
            deletedAt: null,
            serviceStatus: ServiceStatus.ACTIVE,
            moderationStatus: {
                not: ServiceModerationStatus.DISABLED_BY_ADMIN,
            },
            providerProfile: availableToCustomersWhere,
            ...(search
                ? {
                      OR: [
                          { name: { contains: search, mode: "insensitive" as const } },
                          { nameKm: { contains: search, mode: "insensitive" as const } },
                          { description: { contains: search, mode: "insensitive" as const } },
                          { descriptionKm: { contains: search, mode: "insensitive" as const } },
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
                          deletedAt: null,
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
                                  deletedAt: null,
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
            deletedAt: null,
            serviceStatus: ServiceStatus.ACTIVE,
            moderationStatus: {
                not: ServiceModerationStatus.DISABLED_BY_ADMIN,
            },
            providerProfile: availableToCustomersWhere,
        };

        const topBooked = await prisma.booking.groupBy({
            by: ["serviceListingId"],
            where: {
                status: {
                    in: [
                        BookingStatus.COMPLETED,
                        BookingStatus.IN_PROGRESS,
                        BookingStatus.ACCEPTED,
                    ],
                },
                serviceListing: activeWhere,
            },
            _count: { id: true },
            orderBy: {
                _count: { id: "desc" },
            },
            take: limit,
        });

        const bookedIds = topBooked
            .map((b) => b.serviceListingId)
            .filter((id): id is string => Boolean(id));

        const bookingCountById = new Map<string, number>(
            topBooked
                .filter((b): b is typeof b & { serviceListingId: string } => Boolean(b.serviceListingId))
                .map((b) => [b.serviceListingId, b._count.id])
        );

        let recommended =
            bookedIds.length > 0
                ? await prisma.serviceListing.findMany({
                      where: {
                          id: { in: bookedIds },
                          ...activeWhere,
                      },
                      include: serviceInclude,
                  })
                : [];

        recommended.sort(
            (a, b) =>
                (bookingCountById.get(b.id) ?? 0) - (bookingCountById.get(a.id) ?? 0)
        );

        if (recommended.length < limit) {
            const excludeIds = recommended.map((s) => s.id);
            const fallback = await prisma.serviceListing.findMany({
                where: {
                    ...activeWhere,
                    ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
                },
                take: limit - recommended.length,
                orderBy: { createdAt: "desc" },
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
                deletedAt: null,
                OR: [{ id }, { publicId: id }],
                serviceStatus: ServiceStatus.ACTIVE,
                moderationStatus: {
                    not: ServiceModerationStatus.DISABLED_BY_ADMIN,
                },
                providerProfile: availableToCustomersWhere,
            },
            include: serviceDetailInclude,
        });

        if (!service) {
            throw new NotFoundException(t("CUSTOMER_SERVICE_NOT_FOUND", lang));
        }

        return this.formatService(service, lang);
    }

    static async getServiceAvailability(id: string, query: { days?: unknown }, lang: Lang) {
        const service = await prisma.serviceListing.findFirst({
            where: {
                deletedAt: null,
                OR: [{ id }, { publicId: id }],
                serviceStatus: ServiceStatus.ACTIVE,
                moderationStatus: {
                    not: ServiceModerationStatus.DISABLED_BY_ADMIN,
                },
                providerProfile: availableToCustomersWhere,
            },
            include: {
                providerProfile: {
                    include: { businessProfile: true },
                },
            },
        });

        if (!service) {
            throw new NotFoundException(t("CUSTOMER_SERVICE_NOT_FOUND", lang));
        }

        const daysRaw = Number(firstQueryString(query.days) ?? 30);
        const days = Number.isFinite(daysRaw) ? Math.min(Math.max(Math.trunc(daysRaw), 7), 60) : 30;
        const profile = service.providerProfile.businessProfile;

        // Fetch active bookings within the availability date range to filter full slots
        const startYmd = new Date().toISOString().slice(0, 10);
        const activeBookings = await prisma.booking.findMany({
            where: {
                providerProfileId: service.providerProfileId,
                status: {
                    in: [BookingStatus.PENDING, BookingStatus.ACCEPTED, BookingStatus.IN_PROGRESS],
                },
                scheduledAt: {
                    gte: new Date(`${startYmd}T00:00:00.000Z`),
                },
            },
            select: {
                scheduledAt: true,
                timeSlot: true,
            },
        });

        const bookedCounts = new Map<string, number>();
        for (const b of activeBookings) {
            const dateYmd = b.scheduledAt.toISOString().slice(0, 10);
            const slotStr = b.timeSlot?.trim() || "";
            if (slotStr) {
                const k1 = `${dateYmd}_${slotStr.toLowerCase()}`;
                const k2 = `${dateYmd}_${slotStr.toLowerCase().replace(/\s/g, "")}`;
                bookedCounts.set(k1, (bookedCounts.get(k1) ?? 0) + 1);
                bookedCounts.set(k2, (bookedCounts.get(k2) ?? 0) + 1);
            }
        }

        const calendar = buildAvailabilityCalendar(profile, days, bookedCounts);
        const resolved = resolveSchedule(profile);

        return {
            temporaryPause: Boolean(profile?.temporarilyPaused),
            workingDays: resolved.workingDays,
            unavailableDates: (profile?.unavailableDates ?? []).map((date) =>
                date.toISOString().slice(0, 10)
            ),
            dates: calendar,
        };
    }

    private static formatService(
        service: {
            id: string;
            publicId: string;
            name: string;
            nameKm?: string | null;
            description: string | null;
            descriptionKm?: string | null;
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
                    logoUrl?: string | null;
                } | null;
                primaryArea?: {
                    publicId: string;
                    slug: string;
                    nameEn: string;
                    nameKm: string;
                    latitude?: unknown;
                    longitude?: unknown;
                    radiusKm?: unknown;
                    isActive?: boolean;
                } | null;
                serviceAreas?: Array<{
                    serviceArea: {
                        publicId: string;
                        slug: string;
                        nameEn: string;
                        nameKm: string;
                        latitude?: unknown;
                        longitude?: unknown;
                        radiusKm?: unknown;
                        isActive?: boolean;
                    };
                }>;
            };
            areas: Array<{
                serviceArea: {
                    publicId: string;
                    slug: string;
                    nameEn: string;
                    nameKm: string;
                    latitude?: unknown;
                    longitude?: unknown;
                    radiusKm?: unknown;
                    isActive?: boolean;
                };
            }>;
            _count: {
                reviews: number;
            };
            reviews?: Array<{
                publicId: string;
                rating: { toNumber?: () => number } | number | string;
                comment: string | null;
                createdAt: Date;
                customerProfile?: {
                    fullName: string | null;
                    avatarUrl: string | null;
                } | null;
            }>;
        },
        lang: Lang
    ) {
        const isKh = lang === "kh";

        const mapArea = (serviceArea: {
            publicId: string;
            slug: string;
            nameEn: string;
            nameKm: string;
            latitude?: unknown;
            longitude?: unknown;
            radiusKm?: unknown;
        }) => ({
            publicId: serviceArea.publicId,
            slug: serviceArea.slug,
            name: isKh ? serviceArea.nameKm : serviceArea.nameEn,
            nameEn: serviceArea.nameEn,
            nameKm: serviceArea.nameKm,
            latitude: this.toNumber(serviceArea.latitude as any),
            longitude: this.toNumber(serviceArea.longitude as any),
            radiusKm: this.toNumber(serviceArea.radiusKm as any) ?? 15,
        });

        const listingAreas = service.areas
            .filter(({ serviceArea }) => serviceArea.isActive !== false)
            .map(({ serviceArea }) => mapArea(serviceArea));
        const providerAreas = (service.providerProfile.serviceAreas || [])
            .filter((row) => row.serviceArea.isActive !== false)
            .map((row) => mapArea(row.serviceArea));
        const primaryArea =
            service.providerProfile.primaryArea &&
            service.providerProfile.primaryArea.isActive !== false
                ? [mapArea(service.providerProfile.primaryArea)]
                : [];
        const areas =
            listingAreas.length > 0
                ? listingAreas
                : providerAreas.length > 0
                  ? providerAreas
                  : primaryArea;
        const hadLinkedAreas =
            service.areas.length > 0 ||
            (service.providerProfile.serviceAreas || []).length > 0 ||
            Boolean(service.providerProfile.primaryArea);
        const coverageUnavailable = hadLinkedAreas && areas.length === 0;

        return {
            id: service.id,
            publicId: service.publicId,
            name: isKh ? service.nameKm || service.name : service.name || service.nameKm || "",
            description: isKh
                ? service.descriptionKm || service.description
                : service.description || service.descriptionKm || null,
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
            reviews: (service.reviews || []).map((review) => ({
                publicId: review.publicId,
                rating: this.toNumber(review.rating) ?? 0,
                comment: review.comment,
                createdAt: review.createdAt.toISOString(),
                authorName: review.customerProfile?.fullName || "Customer",
                authorAvatarUrl: review.customerProfile?.avatarUrl ?? null,
            })),
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
                logoUrl:
                    service.providerProfile.businessProfile?.logoUrl ??
                    service.providerProfile.avatarUrl,
                averageRating: this.toNumber(service.providerProfile.averageRating),
                completedJobs: service.providerProfile.completedJobs,
            },
            areas,
            coverageUnavailable,
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
