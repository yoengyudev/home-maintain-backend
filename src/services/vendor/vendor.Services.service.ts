import crypto from "crypto";
import { prisma } from "../../database/prisma.client";
import { BadRequestException, NotFoundException } from "../../utils/app-error.util";
import { ServiceStatus, ServiceModerationStatus } from "../../generated/prisma/enums";
import { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";

interface CreateServiceData {
    name: string;
    nameKm?: string;
    categoryId: string;
    description?: string;
    descriptionKm?: string;
    price: number;
    priceUnit?: string;
    pricingType?: string;
    duration?: string;
    imageUrl?: string;
    quantityEnabled?: boolean;
    quantityUnit?: string;
    minQuantity?: number;
    maxQuantity?: number;
    availabilitySummary?: string;
    areaIds?: string[];
    serviceArea?: string;
    active?: boolean;
    serviceStatus?: ServiceStatus;
}

interface UpdateServiceData extends Partial<CreateServiceData> {}

function resolveServiceStatus(payload: { active?: boolean; serviceStatus?: ServiceStatus }) {
    if (typeof payload.active === "boolean") {
        return payload.active ? ServiceStatus.ACTIVE : ServiceStatus.DISABLED;
    }
    return payload.serviceStatus;
}

async function resolveCategory(categoryId?: string) {
    const token = categoryId?.trim();
    if (!token) return null;

    const byId = await prisma.serviceCategory.findUnique({ where: { id: token } });
    if (byId) return byId;

    const byPublicId = await prisma.serviceCategory.findUnique({ where: { publicId: token } });
    if (byPublicId) return byPublicId;

    const bySlug = await prisma.serviceCategory.findUnique({ where: { slug: token } });
    if (bySlug) return bySlug;

    return prisma.serviceCategory.findFirst({
        where: {
            OR: [
                { nameEn: { equals: token, mode: "insensitive" } },
                { nameKm: token },
            ],
        },
    });
}

async function resolveAreaIds(areaIds?: string[], serviceArea?: string) {
    const tokens = [
        ...(areaIds ?? []),
        ...(serviceArea
            ? serviceArea.split(/[,|]/).map((part) => part.trim()).filter(Boolean)
            : []),
    ];
    if (tokens.length === 0) return [] as string[];

    const matchedAreas = await prisma.serviceArea.findMany({
        where: {
            OR: tokens.flatMap((token) => [
                { id: token },
                { publicId: token },
                { slug: token },
                { nameEn: { equals: token, mode: "insensitive" as const } },
                { nameKm: token },
            ]),
        },
    });

    return [...new Set(matchedAreas.map((area) => area.id))];
}

function mapServiceRecord(service: {
    id: string;
    publicId: string;
    name: string;
    nameKm?: string | null;
    description: string | null;
    descriptionKm?: string | null;
    category: { nameEn: string };
    categoryId: string;
    price: unknown;
    priceUnit: string | null;
    pricingType: string | null;
    duration: string | null;
    imageUrl: string | null;
    quantityEnabled: boolean | null;
    quantityUnit: string | null;
    minQuantity: number | null;
    maxQuantity: number | null;
    availabilitySummary: string | null;
    serviceStatus: ServiceStatus;
    moderationStatus: string;
    areas: Array<{
        serviceAreaId: string;
        serviceArea: { nameEn: string; publicId: string };
    }>;
    createdAt: Date;
    updatedAt: Date;
}) {
    return {
        id: service.id,
        publicId: service.publicId,
        name: service.name,
        nameKm: service.nameKm || null,
        description: service.description,
        descriptionKm: service.descriptionKm || null,
        category: service.category.nameEn,
        categoryId: service.categoryId,
        price: Number(service.price),
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
        moderationStatus: service.moderationStatus,
        active: service.serviceStatus === ServiceStatus.ACTIVE,
        serviceArea: service.areas.map((area) => area.serviceArea.nameEn).join(", "),
        areas: service.areas.map((area) => ({
            id: area.serviceAreaId,
            name: area.serviceArea.nameEn,
            publicId: area.serviceArea.publicId,
        })),
        availability: service.availabilitySummary || "Not specified",
        createdAt: service.createdAt,
        updatedAt: service.updatedAt,
    };
}

export class VendorServiceService {
    static async getServices(userId: string, lang: Lang = "en") {
        const providerProfile = await prisma.providerProfile.findUnique({
            where: { userId },
            include: {
                serviceListings: {
                    where: { deletedAt: null },
                    include: {
                        category: true,
                        areas: {
                            include: {
                                serviceArea: true,
                            },
                        },
                    },
                    orderBy: { createdAt: "desc" },
                },
            },
        });

        if (!providerProfile) {
            throw new NotFoundException(t("VENDOR_PROVIDER_PROFILE_NOT_FOUND", lang));
        }

        return providerProfile.serviceListings.map(mapServiceRecord);
    }

    static async getServiceById(userId: string, serviceId: string, lang: Lang = "en") {
        const providerProfile = await prisma.providerProfile.findUnique({
            where: { userId },
        });

        if (!providerProfile) {
            throw new NotFoundException(t("VENDOR_PROVIDER_PROFILE_NOT_FOUND", lang));
        }

        const service = await prisma.serviceListing.findFirst({
            where: {
                providerProfileId: providerProfile.id,
                deletedAt: null,
                OR: [{ id: serviceId }, { publicId: serviceId }],
            },
            include: {
                category: true,
                areas: {
                    include: {
                        serviceArea: true,
                    },
                },
            },
        });

        if (!service) {
            throw new NotFoundException(t("VENDOR_SERVICE_NOT_FOUND", lang));
        }

        return mapServiceRecord(service);
    }

    static async createService(userId: string, payload: CreateServiceData, lang: Lang = "en") {
        const providerProfile = await prisma.providerProfile.findUnique({
            where: { userId },
        });

        if (!providerProfile) {
            throw new NotFoundException(t("VENDOR_PROVIDER_PROFILE_NOT_FOUND", lang));
        }

        const category = await resolveCategory(payload.categoryId);
        if (!category) {
            throw new BadRequestException(t("VENDOR_INVALID_CATEGORY", lang));
        }

        const areaIds = await resolveAreaIds(payload.areaIds, payload.serviceArea);

        const service = await prisma.serviceListing.create({
            data: {
                publicId: crypto.randomUUID(),
                providerProfileId: providerProfile.id,
                categoryId: category.id,
                name: payload.name,
                nameKm: payload.nameKm?.trim() || null,
                description: payload.description,
                descriptionKm: payload.descriptionKm?.trim() || null,
                price: payload.price,
                priceUnit: payload.priceUnit,
                pricingType: payload.pricingType,
                duration: payload.duration,
                imageUrl: payload.imageUrl,
                quantityEnabled: payload.quantityEnabled,
                quantityUnit: payload.quantityUnit,
                minQuantity: payload.minQuantity,
                maxQuantity: payload.maxQuantity,
                availabilitySummary: payload.availabilitySummary,
                serviceStatus: resolveServiceStatus(payload) ?? ServiceStatus.ACTIVE,
                moderationStatus: ServiceModerationStatus.NORMAL,
                areas: {
                    create: areaIds.map((serviceAreaId) => ({ serviceAreaId })),
                },
            },
            include: {
                category: true,
                areas: {
                    include: {
                        serviceArea: true,
                    },
                },
            },
        });

        return {
            id: service.id,
            publicId: service.publicId,
            name: service.name,
            nameKm: service.nameKm || null,
            category: service.category.nameEn,
            price: Number(service.price),
            priceUnit: service.priceUnit,
            active: service.serviceStatus === ServiceStatus.ACTIVE,
            createdAt: service.createdAt,
        };
    }

    static async updateService(userId: string, serviceId: string, payload: UpdateServiceData, lang: Lang = "en") {
        const providerProfile = await prisma.providerProfile.findUnique({
            where: { userId },
        });

        if (!providerProfile) {
            throw new NotFoundException(t("VENDOR_PROVIDER_PROFILE_NOT_FOUND", lang));
        }

        const existingService = await prisma.serviceListing.findFirst({
            where: {
                providerProfileId: providerProfile.id,
                deletedAt: null,
                OR: [{ id: serviceId }, { publicId: serviceId }],
            },
        });

        if (!existingService) {
            throw new NotFoundException(t("VENDOR_SERVICE_NOT_FOUND", lang));
        }

        const category = payload.categoryId
            ? await resolveCategory(payload.categoryId)
            : null;

        if (payload.categoryId && !category) {
            console.warn(
                "Unknown category token on update, keeping existing category:",
                payload.categoryId
            );
        }

        if (payload.areaIds !== undefined || payload.serviceArea !== undefined) {
            const areaIds = await resolveAreaIds(payload.areaIds, payload.serviceArea);

            await prisma.serviceListingArea.deleteMany({
                where: { serviceListingId: existingService.id },
            });

            if (areaIds.length > 0) {
                await prisma.serviceListingArea.createMany({
                    data: areaIds.map((serviceAreaId) => ({
                        serviceListingId: existingService.id,
                        serviceAreaId,
                    })),
                });
            }
        }

        const nextStatus = resolveServiceStatus(payload);

        const service = await prisma.serviceListing.update({
            where: { id: existingService.id },
            data: {
                ...(payload.name && { name: payload.name }),
                ...(payload.nameKm !== undefined && { nameKm: payload.nameKm?.trim() || null }),
                ...(category && { categoryId: category.id }),
                ...(payload.description !== undefined && { description: payload.description }),
                ...(payload.descriptionKm !== undefined && {
                    descriptionKm: payload.descriptionKm?.trim() || null,
                }),
                ...(payload.price !== undefined && { price: payload.price }),
                ...(payload.priceUnit !== undefined && { priceUnit: payload.priceUnit }),
                ...(payload.pricingType !== undefined && { pricingType: payload.pricingType }),
                ...(payload.duration !== undefined && { duration: payload.duration }),
                ...(payload.imageUrl !== undefined && { imageUrl: payload.imageUrl }),
                ...(payload.quantityEnabled !== undefined && { quantityEnabled: payload.quantityEnabled }),
                ...(payload.quantityUnit !== undefined && { quantityUnit: payload.quantityUnit }),
                ...(payload.minQuantity !== undefined && { minQuantity: payload.minQuantity }),
                ...(payload.maxQuantity !== undefined && { maxQuantity: payload.maxQuantity }),
                ...(payload.availabilitySummary !== undefined && {
                    availabilitySummary: payload.availabilitySummary,
                }),
                ...(nextStatus && { serviceStatus: nextStatus }),
            },
            include: {
                category: true,
                areas: {
                    include: {
                        serviceArea: true,
                    },
                },
            },
        });

        return {
            id: service.id,
            publicId: service.publicId,
            name: service.name,
            nameKm: service.nameKm || null,
            category: service.category.nameEn,
            price: Number(service.price),
            priceUnit: service.priceUnit,
            active: service.serviceStatus === ServiceStatus.ACTIVE,
            updatedAt: service.updatedAt,
        };
    }

    static async deleteService(userId: string, serviceId: string, lang: Lang = "en") {
        const providerProfile = await prisma.providerProfile.findUnique({
            where: { userId },
        });

        if (!providerProfile) {
            throw new NotFoundException(t("VENDOR_PROVIDER_PROFILE_NOT_FOUND", lang));
        }

        const existingService = await prisma.serviceListing.findFirst({
            where: {
                providerProfileId: providerProfile.id,
                deletedAt: null,
                OR: [{ id: serviceId }, { publicId: serviceId }],
            },
        });

        if (!existingService) {
            throw new NotFoundException(t("VENDOR_SERVICE_NOT_FOUND", lang));
        }

        const activeBookings = await prisma.booking.count({
            where: {
                serviceListingId: existingService.id,
                status: {
                    in: ["PENDING", "ACCEPTED", "IN_PROGRESS"],
                },
            },
        });

        if (activeBookings > 0) {
            throw new BadRequestException(t("VENDOR_SERVICE_HAS_ACTIVE_BOOKINGS", lang));
        }

        await prisma.serviceListing.update({
            where: { id: existingService.id },
            data: {
                deletedAt: new Date(),
                serviceStatus: ServiceStatus.DISABLED,
            },
        });

        return {
            success: true,
            message: t("VENDOR_SERVICE_DELETED", lang),
        };
    }

    static async toggleServiceStatus(userId: string, serviceId: string, active: boolean, lang: Lang = "en") {
        const providerProfile = await prisma.providerProfile.findUnique({
            where: { userId },
        });

        if (!providerProfile) {
            throw new NotFoundException(t("VENDOR_PROVIDER_PROFILE_NOT_FOUND", lang));
        }

        const existingService = await prisma.serviceListing.findFirst({
            where: {
                providerProfileId: providerProfile.id,
                deletedAt: null,
                OR: [{ id: serviceId }, { publicId: serviceId }],
            },
        });

        if (!existingService) {
            throw new NotFoundException(t("VENDOR_SERVICE_NOT_FOUND", lang));
        }

        const service = await prisma.serviceListing.update({
            where: { id: existingService.id },
            data: {
                serviceStatus: active ? ServiceStatus.ACTIVE : ServiceStatus.DISABLED,
            },
        });

        return {
            id: service.id,
            publicId: service.publicId,
            name: service.name,
            active: service.serviceStatus === ServiceStatus.ACTIVE,
            serviceStatus: service.serviceStatus,
        };
    }

    static async getServiceCategories() {
        const categories = await prisma.serviceCategory.findMany({
            where: { isActive: true },
            orderBy: { nameEn: "asc" },
        });

        return categories.map((cat) => ({
            id: cat.id,
            publicId: cat.publicId,
            name: cat.nameEn,
            nameKm: cat.nameKm,
            slug: cat.slug,
            description: cat.descriptionEn,
            iconName: cat.iconName,
        }));
    }

    static async getServiceAreas() {
        const matchedAreas = await prisma.serviceArea.findMany({
            where: { isActive: true },
            orderBy: { nameEn: "asc" },
        });

        return matchedAreas.map((area) => ({
            id: area.id,
            publicId: area.publicId,
            name: area.nameEn,
            nameKm: area.nameKm,
            slug: area.slug,
            provinceOrCity: area.provinceOrCity,
            latitude: area.latitude ? Number(area.latitude) : null,
            longitude: area.longitude ? Number(area.longitude) : null,
            radiusKm: Number(area.radiusKm ?? 15),
        }));
    }
}
