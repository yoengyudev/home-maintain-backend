import { prisma } from "../../database/prisma.client";
import { NotFoundException } from "../../utils/app-error.util";

export class VendorReviewsService {
    static async getProviderReviews(userId: string) {
        const providerProfile = await prisma.providerProfile.findUnique({
            where: { userId }
        });

        if (!providerProfile) {
            throw new NotFoundException("Provider profile not found");
        }

        const reviews = await prisma.review.findMany({
            where: {
                providerProfileId: providerProfile.id
            },
            include: {
                customerProfile: {
                    include: {
                        user: true
                    }
                },
                serviceListing: true,
                booking: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return reviews.map(review => ({
            reviewId: review.publicId,
            bookingId: review.booking?.publicId || '',
            serviceId: review.serviceListing.publicId,
            serviceName: review.serviceListing.name,
            customerName: review.customerProfile.fullName,
            customerAvatar: review.customerProfile.avatarUrl,
            rating: review.rating.toNumber(),
            comment: review.comment,
            createdAt: review.createdAt.toISOString()
        }));
    }

    static async getProviderReviewStats(userId: string) {
        const providerProfile = await prisma.providerProfile.findUnique({
            where: { userId }
        });

        if (!providerProfile) {
            throw new NotFoundException("Provider profile not found");
        }

        const reviews = await prisma.review.findMany({
            where: {
                providerProfileId: providerProfile.id
            }
        });

        const totalReviews = reviews.length;
        const averageRating = totalReviews > 0 
            ? reviews.reduce((sum, review) => sum + review.rating.toNumber(), 0) / totalReviews 
            : 0;

        // Count by rating
        const ratingCounts = {
            5: reviews.filter(r => r.rating.toNumber() === 5).length,
            4: reviews.filter(r => r.rating.toNumber() === 4).length,
            3: reviews.filter(r => r.rating.toNumber() === 3).length,
            2: reviews.filter(r => r.rating.toNumber() === 2).length,
            1: reviews.filter(r => r.rating.toNumber() === 1).length,
        };

        return {
            totalReviews,
            averageRating: parseFloat(averageRating.toFixed(1)),
            ratingCounts
        };
    }

    static async getReviewById(reviewId: string, userId: string) {
        const review = await prisma.review.findUnique({
            where: { publicId: reviewId },
            include: {
                customerProfile: {
                    include: {
                        user: true
                    }
                },
                serviceListing: {
                    include: {
                        category: true
                    }
                },
                booking: true
            }
        });

        if (!review) {
            throw new NotFoundException("Review not found");
        }

        // Verify the review belongs to this provider
        const providerProfile = await prisma.providerProfile.findUnique({
            where: { userId }
        });

        if (!providerProfile || review.providerProfileId !== providerProfile.id) {
            throw new NotFoundException("Review not found");
        }

        return {
            reviewId: review.publicId,
            bookingId: review.booking?.publicId || '',
            serviceId: review.serviceListing.publicId,
            serviceName: review.serviceListing.name,
            serviceCategory: review.serviceListing.category?.nameEn || '',
            customerName: review.customerProfile.fullName,
            customerAvatar: review.customerProfile.avatarUrl,
            customerPhone: review.customerProfile.user?.phone || '',
            rating: review.rating.toNumber(),
            comment: review.comment,
            createdAt: review.createdAt.toISOString()
        };
    }
}
