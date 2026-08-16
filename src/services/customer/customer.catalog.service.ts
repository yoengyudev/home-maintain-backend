import { prisma } from "../../database/prisma.client";
import { BookingStatus, ProviderStatus, ServiceModerationStatus, ServiceStatus } from "../../generated/prisma/enums";

const normalizePagination = (value: unknown, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeLimit = (value: unknown, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : fallback;
};

const getLocalizedText = (lang: "en" | "kh", en?: string | null, kh?: string | null) => {
    if (lang === "kh") {
        return kh || en || "";
    }
    return en || kh || "";
};

type AreaGeoSource = {
    publicId: string;
    slug: string;
    nameEn: string;
    nameKm: string;
    latitude: unknown;
    longitude: unknown;
    radiusKm: unknown;
    isActive?: boolean;
};

const mapAreaRef = (lang: "en" | "kh", area: AreaGeoSource) => ({
    publicId: area.publicId,
    slug: area.slug,
    name: getLocalizedText(lang, area.nameEn, area.nameKm),
    nameEn: area.nameEn,
    nameKm: area.nameKm,
    latitude: area.latitude != null ? Number(area.latitude) : null,
    longitude: area.longitude != null ? Number(area.longitude) : null,
    radiusKm: Number(area.radiusKm ?? 15),
});

/** Prefer listing areas; else provider multi areas; else primary area. Inactive areas are excluded. */
const resolveServiceAreaRefs = (
    lang: "en" | "kh",
    listingAreas: Array<{ serviceArea: AreaGeoSource }>,
    provider?: {
        serviceAreas?: Array<{ serviceArea: AreaGeoSource }>;
        primaryArea?: AreaGeoSource | null;
    }
) => {
    const activeListing = listingAreas.filter(
        (row) => row.serviceArea.isActive !== false
    );
    if (activeListing.length > 0) {
        return activeListing.map((row) => mapAreaRef(lang, row.serviceArea));
    }

    const fromProvider = (provider?.serviceAreas || [])
        .filter((row) => row.serviceArea.isActive !== false)
        .map((row) => mapAreaRef(lang, row.serviceArea));
    if (fromProvider.length > 0) return fromProvider;

    if (provider?.primaryArea && provider.primaryArea.isActive !== false) {
        return [mapAreaRef(lang, provider.primaryArea)];
    }

    return [];
};

export class CustomerCatalogService {
    static async listServiceCategories(lang: "en" | "kh", page = 1, limit = 50, search?: string) {
        const safePage = normalizePagination(page, 1);
        const safeLimit = normalizeLimit(limit, 50);
        const skip = (safePage - 1) * safeLimit;
        const searchText = search?.trim().toLowerCase();

        const [items, total] = await Promise.all([
            prisma.serviceCategory.findMany({
                where: {
                    isActive: true,
                    ...(searchText
                        ? {
                              OR: [
                                  { nameEn: { contains: searchText, mode: "insensitive" } },
                                  { nameKm: { contains: searchText, mode: "insensitive" } },
                                  { slug: { contains: searchText, mode: "insensitive" } },
                              ],
                          }
                        : {}),
                },
                orderBy: { nameEn: "asc" },
                skip,
                take: safeLimit,
                include: {
                    serviceListings: {
                        where: {
                            serviceStatus: ServiceStatus.ACTIVE,
                            moderationStatus: { not: ServiceModerationStatus.DISABLED_BY_ADMIN },
                        },
                    },
                },
            }),
            prisma.serviceCategory.count({
                where: {
                    isActive: true,
                    ...(searchText
                        ? {
                              OR: [
                                  { nameEn: { contains: searchText, mode: "insensitive" } },
                                  { nameKm: { contains: searchText, mode: "insensitive" } },
                                  { slug: { contains: searchText, mode: "insensitive" } },
                              ],
                          }
                        : {}),
                },
            }),
        ]);

        return {
            data: items.map((item) => ({
                id: item.id,
                publicId: item.publicId,
                slug: item.slug,
                name: getLocalizedText(lang, item.nameEn, item.nameKm),
                nameEn: item.nameEn,
                nameKm: item.nameKm,
                description: getLocalizedText(lang, item.descriptionEn, item.descriptionKm) || null,
                descriptionEn: item.descriptionEn,
                descriptionKm: item.descriptionKm,
                iconName: item.iconName,
                isActive: item.isActive,
                activeServiceCount: item.serviceListings.length,
            })),
            meta: {
                page: safePage,
                limit: safeLimit,
                total,
                totalPages: Math.max(1, Math.ceil(total / safeLimit)),
            },
        };
    }

    static async getServiceCategoryById(id: string, lang: "en" | "kh") {
        const item = await prisma.serviceCategory.findFirst({
            where: {
                OR: [{ id }, { publicId: id }],
                isActive: true,
            },
            include: {
                serviceListings: {
                    where: {
                        serviceStatus: ServiceStatus.ACTIVE,
                        moderationStatus: { not: ServiceModerationStatus.DISABLED_BY_ADMIN },
                    },
                },
            },
        });

        if (!item) {
            return null;
        }

        return {
            id: item.id,
            publicId: item.publicId,
            slug: item.slug,
            name: getLocalizedText(lang, item.nameEn, item.nameKm),
            nameEn: item.nameEn,
            nameKm: item.nameKm,
            description: getLocalizedText(lang, item.descriptionEn, item.descriptionKm) || null,
            descriptionEn: item.descriptionEn,
            descriptionKm: item.descriptionKm,
            iconName: item.iconName,
            isActive: item.isActive,
            activeServiceCount: item.serviceListings.length,
        };
    }

    static async listServices(lang: "en" | "kh", page = 1, limit = 20, search?: string, category?: string) {
        const safePage = normalizePagination(page, 1);
        const safeLimit = normalizeLimit(limit, 20);
        const skip = (safePage - 1) * safeLimit;
        const searchText = search?.trim().toLowerCase();

        const where: any = {
            serviceStatus: ServiceStatus.ACTIVE,
            moderationStatus: { not: ServiceModerationStatus.DISABLED_BY_ADMIN },
            ...(searchText
                ? {
                      OR: [
                          { name: { contains: searchText, mode: "insensitive" } },
                          { nameKm: { contains: searchText, mode: "insensitive" } },
                          { description: { contains: searchText, mode: "insensitive" } },
                          { descriptionKm: { contains: searchText, mode: "insensitive" } },
                      ],
                  }
                : {}),
            ...(category
                ? {
                      category: {
                          OR: [
                              { id: category },
                              { publicId: category },
                              { slug: category },
                          ],
                      },
                  }
                : {}),
        };

        const [items, total] = await Promise.all([
            prisma.serviceListing.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take: safeLimit,
                include: {
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
                    reviews: true,
                    bookings: true,
                },
            }),
            prisma.serviceListing.count({ where }),
        ]);

        return {
            data: items.map((item) => ({
                id: item.id,
                publicId: item.publicId,
                name: getLocalizedText(lang, item.name, item.nameKm),
                description: getLocalizedText(lang, item.description, item.descriptionKm) || null,
                price: Number(item.price),
                priceUnit: item.priceUnit,
                pricingType: item.pricingType,
                duration: item.duration,
                imageUrl: item.imageUrl,
                quantityEnabled: item.quantityEnabled,
                quantityUnit: item.quantityUnit,
                minQuantity: item.minQuantity,
                maxQuantity: item.maxQuantity,
                availabilitySummary: item.availabilitySummary,
                serviceStatus: item.serviceStatus,
                reviewCount: item.reviews.length,
                bookingCount: item.bookings.length,
                isTopBooked: item.bookings.length > 0,
                category: {
                    id: item.category.id,
                    publicId: item.category.publicId,
                    slug: item.category.slug,
                    name: getLocalizedText(lang, item.category.nameEn, item.category.nameKm),
                    nameEn: item.category.nameEn,
                    nameKm: item.category.nameKm,
                    iconName: item.category.iconName,
                },
                provider: {
                    id: item.providerProfile.id,
                    publicId: item.providerProfile.publicId,
                    contactName: item.providerProfile.contactName,
                    businessName: item.providerProfile.businessProfile?.businessName ?? null,
                    avatarUrl: item.providerProfile.avatarUrl,
                    logoUrl:
                        item.providerProfile.businessProfile?.logoUrl ??
                        item.providerProfile.avatarUrl,
                    averageRating: item.providerProfile.averageRating ? Number(item.providerProfile.averageRating) : null,
                    completedJobs: item.providerProfile.completedJobs,
                },
                areas: item.areas
                    .filter((listingArea) => listingArea.serviceArea.isActive !== false)
                    .map((listingArea) => ({
                    publicId: listingArea.serviceArea.publicId,
                    slug: listingArea.serviceArea.slug,
                    name: getLocalizedText(lang, listingArea.serviceArea.nameEn, listingArea.serviceArea.nameKm),
                    nameEn: listingArea.serviceArea.nameEn,
                    nameKm: listingArea.serviceArea.nameKm,
                    latitude: listingArea.serviceArea.latitude != null ? Number(listingArea.serviceArea.latitude) : null,
                    longitude: listingArea.serviceArea.longitude != null ? Number(listingArea.serviceArea.longitude) : null,
                    radiusKm: Number(listingArea.serviceArea.radiusKm ?? 15),
                })),
            })),
            meta: {
                page: safePage,
                limit: safeLimit,
                total,
                totalPages: Math.max(1, Math.ceil(total / safeLimit)),
            },
        };
    }

    static async getServiceById(id: string, lang: "en" | "kh") {
        const item = await prisma.serviceListing.findFirst({
            where: {
                OR: [{ id }, { publicId: id }],
                serviceStatus: ServiceStatus.ACTIVE,
                moderationStatus: { not: ServiceModerationStatus.DISABLED_BY_ADMIN },
            },
            include: {
                category: true,
                providerProfile: {
                    include: {
                        businessProfile: true,
                        primaryArea: true,
                        serviceAreas: { include: { serviceArea: true } },
                    },
                },
                areas: { include: { serviceArea: true } },
                reviews: {
                    orderBy: { createdAt: "desc" },
                    take: 8,
                    include: {
                        customerProfile: {
                            select: { fullName: true, avatarUrl: true },
                        },
                    },
                },
                bookings: true,
            },
        });

        if (!item) {
            return null;
        }

        return {
            id: item.id,
            publicId: item.publicId,
            name: getLocalizedText(lang, item.name, item.nameKm),
            description: getLocalizedText(lang, item.description, item.descriptionKm) || null,
            price: Number(item.price),
            priceUnit: item.priceUnit,
            pricingType: item.pricingType,
            duration: item.duration,
            imageUrl: item.imageUrl,
            quantityEnabled: item.quantityEnabled,
            quantityUnit: item.quantityUnit,
            minQuantity: item.minQuantity,
            maxQuantity: item.maxQuantity,
            availabilitySummary: item.availabilitySummary,
            serviceStatus: item.serviceStatus,
            reviewCount: item.reviews.length,
            reviews: item.reviews.map((review) => ({
                publicId: review.publicId,
                rating: Number(review.rating),
                comment: review.comment,
                createdAt: review.createdAt.toISOString(),
                authorName: review.customerProfile?.fullName ?? "Customer",
                authorAvatarUrl: review.customerProfile?.avatarUrl ?? null,
            })),
            bookingCount: item.bookings.length,
            isTopBooked: item.bookings.length > 0,
            category: {
                id: item.category.id,
                publicId: item.category.publicId,
                slug: item.category.slug,
                name: getLocalizedText(lang, item.category.nameEn, item.category.nameKm),
                nameEn: item.category.nameEn,
                nameKm: item.category.nameKm,
                iconName: item.category.iconName,
            },
            provider: {
                id: item.providerProfile.id,
                publicId: item.providerProfile.publicId,
                contactName: item.providerProfile.contactName,
                businessName: item.providerProfile.businessProfile?.businessName ?? null,
                avatarUrl: item.providerProfile.avatarUrl,
                logoUrl:
                    item.providerProfile.businessProfile?.logoUrl ??
                    item.providerProfile.avatarUrl,
                averageRating: item.providerProfile.averageRating ? Number(item.providerProfile.averageRating) : null,
                completedJobs: item.providerProfile.completedJobs,
            },
            areas: resolveServiceAreaRefs(lang, item.areas, item.providerProfile),
        };
    }

    static async listRecommendedServices(lang: "en" | "kh", limit = 3) {
        const safeLimit = normalizeLimit(limit, 3);
        const items = await prisma.serviceListing.findMany({
            where: {
                serviceStatus: ServiceStatus.ACTIVE,
                moderationStatus: { not: ServiceModerationStatus.DISABLED_BY_ADMIN },
            },
            orderBy: { createdAt: "desc" },
            take: safeLimit,
            include: {
                category: true,
                providerProfile: { include: { businessProfile: true } },
                areas: { include: { serviceArea: true } },
                reviews: true,
                bookings: true,
            },
        });

        return {
            data: items.map((item) => ({
                id: item.id,
                publicId: item.publicId,
                name: getLocalizedText(lang, item.name, item.nameKm),
                description: getLocalizedText(lang, item.description, item.descriptionKm) || null,
                price: Number(item.price),
                priceUnit: item.priceUnit,
                pricingType: item.pricingType,
                duration: item.duration,
                imageUrl: item.imageUrl,
                quantityEnabled: item.quantityEnabled,
                quantityUnit: item.quantityUnit,
                minQuantity: item.minQuantity,
                maxQuantity: item.maxQuantity,
                availabilitySummary: item.availabilitySummary,
                serviceStatus: item.serviceStatus,
                reviewCount: item.reviews.length,
                bookingCount: item.bookings.length,
                isTopBooked: item.bookings.length > 0,
                category: {
                    id: item.category.id,
                    publicId: item.category.publicId,
                    slug: item.category.slug,
                    name: getLocalizedText(lang, item.category.nameEn, item.category.nameKm),
                    nameEn: item.category.nameEn,
                    nameKm: item.category.nameKm,
                    iconName: item.category.iconName,
                },
                provider: {
                    id: item.providerProfile.id,
                    publicId: item.providerProfile.publicId,
                    contactName: item.providerProfile.contactName,
                    businessName: item.providerProfile.businessProfile?.businessName ?? null,
                    avatarUrl: item.providerProfile.avatarUrl,
                    logoUrl:
                        item.providerProfile.businessProfile?.logoUrl ??
                        item.providerProfile.avatarUrl,
                    averageRating: item.providerProfile.averageRating ? Number(item.providerProfile.averageRating) : null,
                    completedJobs: item.providerProfile.completedJobs,
                },
                areas: item.areas
                    .filter((listingArea) => listingArea.serviceArea.isActive !== false)
                    .map((listingArea) => ({
                    publicId: listingArea.serviceArea.publicId,
                    slug: listingArea.serviceArea.slug,
                    name: getLocalizedText(lang, listingArea.serviceArea.nameEn, listingArea.serviceArea.nameKm),
                    nameEn: listingArea.serviceArea.nameEn,
                    nameKm: listingArea.serviceArea.nameKm,
                    latitude: listingArea.serviceArea.latitude != null ? Number(listingArea.serviceArea.latitude) : null,
                    longitude: listingArea.serviceArea.longitude != null ? Number(listingArea.serviceArea.longitude) : null,
                    radiusKm: Number(listingArea.serviceArea.radiusKm ?? 15),
                })),
            })),
            source: "default",
        };
    }

    static async listProviders(lang: "en" | "kh", page = 1, limit = 20, search?: string, category?: string) {
        const safePage = normalizePagination(page, 1);
        const safeLimit = normalizeLimit(limit, 20);
        const skip = (safePage - 1) * safeLimit;
        const searchText = search?.trim().toLowerCase();

        const where: any = {
            status: ProviderStatus.ACTIVE,
            NOT: {
                businessProfile: {
                    is: { temporarilyPaused: true },
                },
            },
            ...(searchText
                ? {
                      OR: [
                          { contactName: { contains: searchText, mode: "insensitive" } },
                          { businessProfile: { is: { businessName: { contains: searchText, mode: "insensitive" } } } },
                      ],
                  }
                : {}),
            ...(category
                ? {
                      OR: [
                          { primaryCategory: { OR: [{ id: category }, { publicId: category }, { slug: category }] } },
                          { serviceListings: { some: { category: { OR: [{ id: category }, { publicId: category }, { slug: category }] } } } },
                      ],
                  }
                : {}),
        };

        const [items, total] = await Promise.all([
            prisma.providerProfile.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take: safeLimit,
                include: {
                    businessProfile: true,
                    primaryCategory: true,
                    primaryArea: true,
                    serviceListings: {
                        where: {
                            serviceStatus: ServiceStatus.ACTIVE,
                            moderationStatus: { not: ServiceModerationStatus.DISABLED_BY_ADMIN },
                        },
                    },
                    bookings: true,
                    reviews: true,
                },
            }),
            prisma.providerProfile.count({ where }),
        ]);

        return {
            data: items.map((item) => ({
                id: item.id,
                publicId: item.publicId,
                contactName: item.contactName,
                businessName: item.businessProfile?.businessName ?? null,
                name: item.businessProfile?.businessName ?? item.contactName,
                description: item.businessProfile?.description ?? null,
                avatarUrl: item.avatarUrl,
                logoUrl: item.businessProfile?.logoUrl ?? null,
                providerType: item.businessProfile?.providerType ?? null,
                location: [item.businessProfile?.cityProvince, item.businessProfile?.district].filter(Boolean).join(", ") || null,
                coverageSummary: item.businessProfile?.coverageSummary ?? null,
                averageRating: item.averageRating ? Number(item.averageRating) : null,
                completedJobs: Math.max(
                    item.completedJobs ?? 0,
                    item.bookings?.filter((b) => b.status === BookingStatus.COMPLETED).length ?? 0
                ),
                reviewCount: item.reviews.length,
                activeServiceCount: item.serviceListings.length,
                isVerified: item.status === ProviderStatus.ACTIVE,
                memberSince: item.createdAt.toISOString(),
                bookingCount: item.bookings.length,
                isTopBooked: item.bookings.length > 0,
                primaryArea: item.primaryArea
                    ? {
                          publicId: item.primaryArea.publicId,
                          slug: item.primaryArea.slug,
                          name: getLocalizedText(lang, item.primaryArea.nameEn, item.primaryArea.nameKm),
                          nameEn: item.primaryArea.nameEn,
                          nameKm: item.primaryArea.nameKm,
                      }
                    : null,
                primaryCategory: item.primaryCategory
                    ? {
                          id: item.primaryCategory.id,
                          publicId: item.primaryCategory.publicId,
                          slug: item.primaryCategory.slug,
                          name: getLocalizedText(lang, item.primaryCategory.nameEn, item.primaryCategory.nameKm),
                          nameEn: item.primaryCategory.nameEn,
                          nameKm: item.primaryCategory.nameKm,
                          iconName: item.primaryCategory.iconName,
                      }
                    : null,
            })),
            meta: {
                page: safePage,
                limit: safeLimit,
                total,
                totalPages: Math.max(1, Math.ceil(total / safeLimit)),
            },
        };
    }

    static async getProviderById(id: string, lang: "en" | "kh") {
        const item = await prisma.providerProfile.findFirst({
            where: {
                OR: [{ id }, { publicId: id }],
                status: ProviderStatus.ACTIVE,
                NOT: {
                    businessProfile: {
                        is: { temporarilyPaused: true },
                    },
                },
            },
            include: {
                businessProfile: true,
                primaryCategory: true,
                primaryArea: true,
                serviceListings: {
                    where: {
                        serviceStatus: ServiceStatus.ACTIVE,
                        moderationStatus: { not: ServiceModerationStatus.DISABLED_BY_ADMIN },
                    },
                    include: {
                        category: true,
                        areas: { include: { serviceArea: true } },
                        reviews: true,
                    },
                },
                reviews: {
                    include: {
                        customerProfile: true,
                        serviceListing: true,
                    },
                },
                bookings: true,
            },
        });

        if (!item) {
            return null;
        }

        const areas = Array.from(new Map(item.serviceListings.flatMap((service) => service.areas.map((area) => [area.serviceArea.publicId, {
            publicId: area.serviceArea.publicId,
            slug: area.serviceArea.slug,
            name: getLocalizedText(lang, area.serviceArea.nameEn, area.serviceArea.nameKm),
            nameEn: area.serviceArea.nameEn,
            nameKm: area.serviceArea.nameKm,
        }]))).values());

        return {
            id: item.id,
            publicId: item.publicId,
            contactName: item.contactName,
            businessName: item.businessProfile?.businessName ?? null,
            name: item.businessProfile?.businessName ?? item.contactName,
            description: item.businessProfile?.description ?? null,
            avatarUrl: item.avatarUrl,
            logoUrl: item.businessProfile?.logoUrl ?? null,
            providerType: item.businessProfile?.providerType ?? null,
            location: [item.businessProfile?.cityProvince, item.businessProfile?.district].filter(Boolean).join(", ") || null,
            coverageSummary: item.businessProfile?.coverageSummary ?? null,
            averageRating: item.averageRating ? Number(item.averageRating) : null,
            completedJobs: item.completedJobs,
            reviewCount: item.reviews.length,
            activeServiceCount: item.serviceListings.length,
            isVerified: item.status === ProviderStatus.ACTIVE,
            memberSince: item.createdAt.toISOString(),
            bookingCount: item.bookings.length,
            isTopBooked: item.bookings.length > 0,
            primaryArea: item.primaryArea
                ? {
                      publicId: item.primaryArea.publicId,
                      slug: item.primaryArea.slug,
                      name: getLocalizedText(lang, item.primaryArea.nameEn, item.primaryArea.nameKm),
                      nameEn: item.primaryArea.nameEn,
                      nameKm: item.primaryArea.nameKm,
                  }
                : null,
            primaryCategory: item.primaryCategory
                ? {
                      id: item.primaryCategory.id,
                      publicId: item.primaryCategory.publicId,
                      slug: item.primaryCategory.slug,
                      name: getLocalizedText(lang, item.primaryCategory.nameEn, item.primaryCategory.nameKm),
                      nameEn: item.primaryCategory.nameEn,
                      nameKm: item.primaryCategory.nameKm,
                      iconName: item.primaryCategory.iconName,
                  }
                : null,
            addressLine: item.businessProfile?.addressLine ?? null,
            workingDays: item.businessProfile?.workingDays ?? [],
            workingHours: item.businessProfile?.workingHours ?? {},
            areas,
            services: item.serviceListings.map((service) => ({
                id: service.id,
                publicId: service.publicId,
                name: getLocalizedText(lang, service.name, service.nameKm),
                description: getLocalizedText(lang, service.description, service.descriptionKm) || null,
                price: Number(service.price),
                priceUnit: service.priceUnit,
                pricingType: service.pricingType,
                duration: service.duration,
                imageUrl: service.imageUrl,
                availabilitySummary: service.availabilitySummary,
                reviewCount: service.reviews.length,
                category: {
                    id: service.category.id,
                    publicId: service.category.publicId,
                    slug: service.category.slug,
                    name: getLocalizedText(lang, service.category.nameEn, service.category.nameKm),
                    nameEn: service.category.nameEn,
                    nameKm: service.category.nameKm,
                    iconName: service.category.iconName,
                },
                areas: service.areas
                    .filter((listingArea) => listingArea.serviceArea.isActive !== false)
                    .map((listingArea) => ({
                    publicId: listingArea.serviceArea.publicId,
                    slug: listingArea.serviceArea.slug,
                    name: getLocalizedText(lang, listingArea.serviceArea.nameEn, listingArea.serviceArea.nameKm),
                    nameEn: listingArea.serviceArea.nameEn,
                    nameKm: listingArea.serviceArea.nameKm,
                })),
            })),
            reviews: item.reviews.map((review) => ({
                publicId: review.publicId,
                rating: Number(review.rating),
                comment: review.comment,
                createdAt: review.createdAt.toISOString(),
                authorName: review.customerProfile?.fullName ?? "Customer",
                authorAvatarUrl: review.customerProfile?.avatarUrl ?? null,
                service: {
                    id: review.serviceListing?.id,
                    publicId: review.serviceListing?.publicId ?? "",
                    name: review.serviceListing?.name ?? "",
                },
            })),
        };
    }

    static async listRecommendedProviders(lang: "en" | "kh", limit = 3) {
        const safeLimit = normalizeLimit(limit, 3);
        const items = await prisma.providerProfile.findMany({
            where: {
                status: ProviderStatus.ACTIVE,
            },
            orderBy: { createdAt: "desc" },
            take: safeLimit,
            include: {
                businessProfile: true,
                primaryCategory: true,
                primaryArea: true,
                serviceListings: {
                    where: {
                        serviceStatus: ServiceStatus.ACTIVE,
                        moderationStatus: { not: ServiceModerationStatus.DISABLED_BY_ADMIN },
                    },
                },
                bookings: true,
                reviews: true,
            },
        });

        return {
            data: items.map((item) => ({
                id: item.id,
                publicId: item.publicId,
                contactName: item.contactName,
                businessName: item.businessProfile?.businessName ?? null,
                name: item.businessProfile?.businessName ?? item.contactName,
                description: item.businessProfile?.description ?? null,
                avatarUrl: item.avatarUrl,
                logoUrl: item.businessProfile?.logoUrl ?? null,
                providerType: item.businessProfile?.providerType ?? null,
                location: [item.businessProfile?.cityProvince, item.businessProfile?.district].filter(Boolean).join(", ") || null,
                coverageSummary: item.businessProfile?.coverageSummary ?? null,
                averageRating: item.averageRating ? Number(item.averageRating) : null,
                completedJobs: item.completedJobs,
                reviewCount: item.reviews.length,
                activeServiceCount: item.serviceListings.length,
                isVerified: item.status === ProviderStatus.ACTIVE,
                memberSince: item.createdAt.toISOString(),
                bookingCount: item.bookings.length,
                isTopBooked: item.bookings.length > 0,
                primaryArea: item.primaryArea
                    ? {
                          publicId: item.primaryArea.publicId,
                          slug: item.primaryArea.slug,
                          name: getLocalizedText(lang, item.primaryArea.nameEn, item.primaryArea.nameKm),
                          nameEn: item.primaryArea.nameEn,
                          nameKm: item.primaryArea.nameKm,
                      }
                    : null,
                primaryCategory: item.primaryCategory
                    ? {
                          id: item.primaryCategory.id,
                          publicId: item.primaryCategory.publicId,
                          slug: item.primaryCategory.slug,
                          name: getLocalizedText(lang, item.primaryCategory.nameEn, item.primaryCategory.nameKm),
                          nameEn: item.primaryCategory.nameEn,
                          nameKm: item.primaryCategory.nameKm,
                          iconName: item.primaryCategory.iconName,
                      }
                    : null,
            })),
            source: "default",
        };
    }
}
