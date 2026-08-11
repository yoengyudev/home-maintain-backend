import crypto from "crypto";
import { prisma } from "../../database/prisma.client";
import { BadRequestException, NotFoundException } from "../../utils/app-error.util";
import { ServiceStatus, ServiceModerationStatus } from "../../generated/prisma/enums";
import { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";

interface CreateServiceData {
    name: string;
    categoryId: string;
    description?: string;
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
}

interface UpdateServiceData extends Partial<CreateServiceData> {
    serviceStatus?: ServiceStatus;
}

export class VendorServiceService {
    static async getServices(userId: string, lang: Lang = "en") {
        const providerProfile = await prisma.providerProfile.findUnique({
            where: { userId },
            include: {
                serviceListings: {
                    include: {
                        category: true,
                        areas: {
                            include: {
                                serviceArea: true
                            }
                        }
                    },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!providerProfile) {
            throw new NotFoundException(t("VENDOR_PROVIDER_PROFILE_NOT_FOUND", lang));
        }

        return providerProfile.serviceListings.map(service => ({
            id: service.id,
            publicId: service.publicId,
            name: service.name,
            description: service.description,
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
            serviceArea: service.areas.map(area => area.serviceArea.nameEn).join(', '),
            areas: service.areas.map(area => ({
                id: area.serviceAreaId,
                name: area.serviceArea.nameEn,
                publicId: area.serviceArea.publicId
            })),
            availability: service.availabilitySummary || 'Not specified',
            createdAt: service.createdAt,
            updatedAt: service.updatedAt
        }));
    }

    static async getServiceById(userId: string, serviceId: string, lang: Lang = "en") {
        const providerProfile = await prisma.providerProfile.findUnique({
            where: { userId }
        });

        if (!providerProfile) {
            throw new NotFoundException(t("VENDOR_PROVIDER_PROFILE_NOT_FOUND", lang));
        }

        const service = await prisma.serviceListing.findFirst({
            where: {
                id: serviceId,
                providerProfileId: providerProfile.id
            },
            include: {
                category: true,
                areas: {
                    include: {
                        serviceArea: true
                    }
                }
            }
        });

        if (!service) {
            throw new NotFoundException(t("VENDOR_SERVICE_NOT_FOUND", lang));
        }

        return {
            id: service.id,
            publicId: service.publicId,
            name: service.name,
            description: service.description,
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
            serviceArea: service.areas.map(area => area.serviceArea.nameEn).join(', '),
            areas: service.areas.map(area => ({
                id: area.serviceAreaId,
                name: area.serviceArea.nameEn,
                publicId: area.serviceArea.publicId
            })),
            availability: service.availabilitySummary || 'Not specified',
            createdAt: service.createdAt,
            updatedAt: service.updatedAt
        };
    }

    static async createService(userId: string, data: CreateServiceData, lang: Lang = "en") {
        const providerProfile = await prisma.providerProfile.findUnique({
            where: { userId }
        });

        if (!providerProfile) {
            throw new NotFoundException(t("VENDOR_PROVIDER_PROFILE_NOT_FOUND", lang));
        }

        // Handle category - accept both ID and name
        let category;
        if (data.categoryId) {
            // Try to find by ID first
            category = await prisma.serviceCategory.findUnique({
                where: { id: data.categoryId }
            });
        }
        
        // If not found by ID, try to find by name
        if (!category && data.categoryId) {
            category = await prisma.serviceCategory.findFirst({
                where: { 
                    OR: [
                        { nameEn: data.categoryId },
                        { slug: data.categoryId }
                    ]
                }
            });
        }

        if (!category) {
            throw new BadRequestException(t("VENDOR_INVALID_CATEGORY", lang));
        }

        // Verify areas if provided
        if (data.areaIds && data.areaIds.length > 0) {
            const areas = await prisma.serviceArea.findMany({
                where: { id: { in: data.areaIds } }
            });

            if (areas.length !== data.areaIds.length) {
                throw new BadRequestException(t("VENDOR_INVALID_SERVICE_AREAS", lang));
            }
        }

        const service = await prisma.serviceListing.create({
            data: {
                publicId: crypto.randomUUID(),
                providerProfileId: providerProfile.id,
                categoryId: category.id,
                name: data.name,
                description: data.description,
                price: data.price,
                priceUnit: data.priceUnit,
                pricingType: data.pricingType,
                duration: data.duration,
                imageUrl: data.imageUrl,
                quantityEnabled: data.quantityEnabled,
                quantityUnit: data.quantityUnit,
                minQuantity: data.minQuantity,
                maxQuantity: data.maxQuantity,
                availabilitySummary: data.availabilitySummary,
                serviceStatus: ServiceStatus.DISABLED, // Start as disabled until provider activates
                moderationStatus: ServiceModerationStatus.NORMAL,
                areas: data.areaIds && data.areaIds.length > 0 ? {
                    create: data.areaIds.map(areaId => ({
                        serviceAreaId: areaId
                    }))
                } : undefined
            },
            include: {
                category: true,
                areas: {
                    include: {
                        serviceArea: true
                    }
                }
            }
        });

        return {
            id: service.id,
            publicId: service.publicId,
            name: service.name,
            category: service.category.nameEn,
            price: Number(service.price),
            priceUnit: service.priceUnit,
            active: service.serviceStatus === ServiceStatus.ACTIVE,
            createdAt: service.createdAt
        };
    }

    static async updateService(userId: string, serviceId: string, data: UpdateServiceData, lang: Lang = "en") {
        const providerProfile = await prisma.providerProfile.findUnique({
            where: { userId }
        });

        if (!providerProfile) {
            throw new NotFoundException(t("VENDOR_PROVIDER_PROFILE_NOT_FOUND", lang));
        }

        const existingService = await prisma.serviceListing.findFirst({
            where: {
                id: serviceId,
                providerProfileId: providerProfile.id
            }
        });

        if (!existingService) {
            throw new NotFoundException(t("VENDOR_SERVICE_NOT_FOUND", lang));
        }

        // Handle category - accept both ID and name
        let category;
        if (data.categoryId) {
            // Try to find by ID first
            category = await prisma.serviceCategory.findUnique({
                where: { id: data.categoryId }
            });
            
            // If not found by ID, try to find by name
            if (!category) {
                category = await prisma.serviceCategory.findFirst({
                    where: { 
                        OR: [
                            { nameEn: data.categoryId },
                            { slug: data.categoryId }
                        ]
                    }
                });
            }

            if (!category) {
                throw new BadRequestException(t("VENDOR_INVALID_CATEGORY", lang));
            }
        }

        // Update areas if provided
        if (data.areaIds !== undefined) {
            // Verify areas
            if (data.areaIds.length > 0) {
                const areas = await prisma.serviceArea.findMany({
                    where: { id: { in: data.areaIds } }
                });

                if (areas.length !== data.areaIds.length) {
                    throw new BadRequestException(t("VENDOR_INVALID_SERVICE_AREAS", lang));
                }
            }

            // Remove existing areas
            await prisma.serviceListingArea.deleteMany({
                where: { serviceListingId: serviceId }
            });

            // Add new areas
            if (data.areaIds.length > 0) {
                await prisma.serviceListingArea.createMany({
                    data: data.areaIds.map(areaId => ({
                        serviceListingId: serviceId,
                        serviceAreaId: areaId
                    }))
                });
            }
        }

        const service = await prisma.serviceListing.update({
            where: { id: serviceId },
            data: {
                ...(data.name && { name: data.name }),
                ...(category && { categoryId: category.id }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.price !== undefined && { price: data.price }),
                ...(data.priceUnit !== undefined && { priceUnit: data.priceUnit }),
                ...(data.pricingType !== undefined && { pricingType: data.pricingType }),
                ...(data.duration !== undefined && { duration: data.duration }),
                ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
                ...(data.quantityEnabled !== undefined && { quantityEnabled: data.quantityEnabled }),
                ...(data.quantityUnit !== undefined && { quantityUnit: data.quantityUnit }),
                ...(data.minQuantity !== undefined && { minQuantity: data.minQuantity }),
                ...(data.maxQuantity !== undefined && { maxQuantity: data.maxQuantity }),
                ...(data.availabilitySummary !== undefined && { availabilitySummary: data.availabilitySummary }),
                ...(data.serviceStatus && { serviceStatus: data.serviceStatus })
            },
            include: {
                category: true,
                areas: {
                    include: {
                        serviceArea: true
                    }
                }
            }
        });

        return {
            id: service.id,
            publicId: service.publicId,
            name: service.name,
            category: service.category.nameEn,
            price: Number(service.price),
            priceUnit: service.priceUnit,
            active: service.serviceStatus === ServiceStatus.ACTIVE,
            updatedAt: service.updatedAt
        };
    }

    static async deleteService(userId: string, serviceId: string, lang: Lang = "en") {
        const providerProfile = await prisma.providerProfile.findUnique({
            where: { userId }
        });

        if (!providerProfile) {
            throw new NotFoundException(t("VENDOR_PROVIDER_PROFILE_NOT_FOUND", lang));
        }

        const existingService = await prisma.serviceListing.findFirst({
            where: {
                id: serviceId,
                providerProfileId: providerProfile.id
            }
        });

        if (!existingService) {
            throw new NotFoundException(t("VENDOR_SERVICE_NOT_FOUND", lang));
        }

        // Check if service has active bookings
        const activeBookings = await prisma.booking.count({
            where: {
                serviceListingId: serviceId,
                status: {
                    in: ['PENDING', 'ACCEPTED', 'IN_PROGRESS']
                }
            }
        });

        if (activeBookings > 0) {
            throw new BadRequestException(t("VENDOR_SERVICE_HAS_ACTIVE_BOOKINGS", lang));
        }

        await prisma.serviceListing.delete({
            where: { id: serviceId }
        });

        return {
            success: true,
            message: t("VENDOR_SERVICE_DELETED", lang)
        };
    }

    static async toggleServiceStatus(userId: string, serviceId: string, active: boolean, lang: Lang = "en") {
        const providerProfile = await prisma.providerProfile.findUnique({
            where: { userId }
        });

        if (!providerProfile) {
            throw new NotFoundException(t("VENDOR_PROVIDER_PROFILE_NOT_FOUND", lang));
        }

        const existingService = await prisma.serviceListing.findFirst({
            where: {
                id: serviceId,
                providerProfileId: providerProfile.id
            }
        });

        if (!existingService) {
            throw new NotFoundException(t("VENDOR_SERVICE_NOT_FOUND", lang));
        }

        const service = await prisma.serviceListing.update({
            where: { id: serviceId },
            data: {
                serviceStatus: active ? ServiceStatus.ACTIVE : ServiceStatus.DISABLED
            }
        });

        return {
            id: service.id,
            publicId: service.publicId,
            name: service.name,
            active: service.serviceStatus === ServiceStatus.ACTIVE,
            serviceStatus: service.serviceStatus
        };
    }

    static async getServiceCategories() {
        const categories = await prisma.serviceCategory.findMany({
            where: { isActive: true },
            orderBy: { nameEn: 'asc' }
        });

        return categories.map(cat => ({
            id: cat.id,
            publicId: cat.publicId,
            name: cat.nameEn,
            nameKm: cat.nameKm,
            slug: cat.slug,
            description: cat.descriptionEn,
            iconName: cat.iconName
        }));
    }

    static async getServiceAreas() {
        const areas = await prisma.serviceArea.findMany({
            where: { isActive: true },
            orderBy: { nameEn: 'asc' }
        });

        return areas.map(area => ({
            id: area.id,
            publicId: area.publicId,
            name: area.nameEn,
            nameKm: area.nameKm,
            slug: area.slug,
            provinceOrCity: area.provinceOrCity
        }));
    }
}
