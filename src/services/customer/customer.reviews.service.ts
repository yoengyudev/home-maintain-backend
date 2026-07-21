import { prisma } from "../../database/prisma.client";
import type { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";
import {
    BadRequestException,
    NotFoundException,
} from "../../utils/app-error.util";
import { nextPublicId } from "../../utils/public-id.util";
import { BookingStatus } from "../../generated/prisma/enums";
import type { z } from "zod";
import type { customerCreateReviewSchema } from "../../validators/customer/review.validator";
import { CustomerNotificationsHelper } from "./customer.notifications.helper";

type CreateReviewDto = z.infer<typeof customerCreateReviewSchema>;

export class CustomerReviewsService {
    static async createForBooking(
        userId: string,
        bookingPublicId: string,
        data: CreateReviewDto,
        lang: Lang
    ) {
        const customer = await this.requireCustomerProfile(userId, lang);

        const booking = await prisma.booking.findFirst({
            where: {
                publicId: bookingPublicId,
                customerProfileId: customer.id,
            },
            include: {
                review: true,
                serviceListing: true,
                providerProfile: {
                    include: { businessProfile: true },
                },
            },
        });

        if (!booking) {
            throw new NotFoundException(t("CUSTOMER_BOOKING_NOT_FOUND", lang));
        }

        if (booking.status !== BookingStatus.COMPLETED) {
            throw new BadRequestException(t("CUSTOMER_REVIEW_BOOKING_NOT_COMPLETED", lang));
        }

        if (booking.review) {
            throw new BadRequestException(t("CUSTOMER_REVIEW_ALREADY_EXISTS", lang));
        }

        const publicId = await nextPublicId("REV", "review");
        const rating = Number(data.rating.toFixed(1));

        const review = await prisma.$transaction(async (tx) => {
            const created = await tx.review.create({
                data: {
                    publicId,
                    customerProfileId: customer.id,
                    providerProfileId: booking.providerProfileId,
                    serviceListingId: booking.serviceListingId,
                    bookingId: booking.id,
                    rating,
                    comment: data.comment,
                },
            });

            const aggregate = await tx.review.aggregate({
                where: { providerProfileId: booking.providerProfileId },
                _avg: { rating: true },
                _count: { rating: true },
            });

            await tx.providerProfile.update({
                where: { id: booking.providerProfileId },
                data: {
                    averageRating: aggregate._avg.rating ?? rating,
                },
            });

            return created;
        });

        const providerName =
            booking.providerProfile.businessProfile?.businessName?.trim() ||
            booking.providerProfile.contactName;

        await CustomerNotificationsHelper.create({
            userId,
            titleEn: "Review submitted",
            titleKm: "បានដាក់ការវាយតម្លៃ",
            messageEn: `Thanks for reviewing ${providerName}. Your feedback helps other customers.`,
            messageKm: `អរគុណសម្រាប់ការវាយតម្លៃ ${providerName}។ មតិរបស់អ្នកជួយអតិថិជនផ្សេងទៀត។`,
            relatedModule: "booking",
            relatedRecordId: booking.publicId,
            relatedRoute: `/bookings/${booking.publicId}`,
            priority: "normal",
        });

        return this.format(review);
    }

    static async getForBooking(userId: string, bookingPublicId: string, lang: Lang) {
        const customer = await this.requireCustomerProfile(userId, lang);

        const booking = await prisma.booking.findFirst({
            where: {
                publicId: bookingPublicId,
                customerProfileId: customer.id,
            },
            include: { review: true },
        });

        if (!booking) {
            throw new NotFoundException(t("CUSTOMER_BOOKING_NOT_FOUND", lang));
        }

        if (!booking.review) {
            throw new NotFoundException(t("CUSTOMER_REVIEW_NOT_FOUND", lang));
        }

        return this.format(booking.review);
    }

    static format(review: {
        publicId: string;
        rating: { toNumber?: () => number } | number | string;
        comment: string | null;
        createdAt: Date;
        updatedAt: Date;
        bookingId: string | null;
    }) {
        return {
            publicId: review.publicId,
            rating: this.toNumber(review.rating) ?? 0,
            comment: review.comment,
            createdAt: review.createdAt.toISOString(),
            updatedAt: review.updatedAt.toISOString(),
        };
    }

    private static async requireCustomerProfile(userId: string, lang: Lang) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { customerProfile: true },
        });

        if (!user?.customerProfile) {
            throw new NotFoundException(t("CUSTOMER_NOT_FOUND", lang));
        }

        return user.customerProfile;
    }

    private static toNumber(value: { toNumber?: () => number } | number | string | null | undefined) {
        if (value === null || value === undefined) return null;
        if (typeof value === "number") return value;
        if (typeof value === "string") return Number(value);
        if (typeof value.toNumber === "function") return value.toNumber();
        return Number(value);
    }
}
