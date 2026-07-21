import { prisma } from "../../database/prisma.client";
import type { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";
import {
    BadRequestException,
    NotFoundException,
} from "../../utils/app-error.util";
import {
    buildPaginationMeta,
    firstQueryString,
    parsePaginationQuery,
} from "../../utils/pagination.util";
import { nextPublicId } from "../../utils/public-id.util";
import {
    BookingStatus,
    ProviderStatus,
    ServiceModerationStatus,
    ServiceStatus,
} from "../../generated/prisma/enums";
import type { z } from "zod";
import type {
    customerCancelBookingSchema,
    customerCreateBookingSchema,
    customerRescheduleBookingSchema,
} from "../../validators/customer/booking.validator";
import { CustomerAddressesService } from "./customer.addresses.service";
import { CustomerNotificationsHelper } from "./customer.notifications.helper";

type CreateBookingDto = z.infer<typeof customerCreateBookingSchema>;
type CancelBookingDto = z.infer<typeof customerCancelBookingSchema>;
type RescheduleBookingDto = z.infer<typeof customerRescheduleBookingSchema>;

type BookingsQuery = {
    page?: unknown;
    limit?: unknown;
    status?: unknown;
};

const CANCELABLE: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.ACCEPTED, BookingStatus.RESCHEDULED];
const RESCHEDULABLE: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.ACCEPTED, BookingStatus.RESCHEDULED];

const bookingInclude = {
    serviceListing: {
        include: {
            category: true,
        },
    },
    providerProfile: {
        include: {
            businessProfile: true,
        },
    },
    customerAddress: true,
    serviceArea: true,
    timelineItems: {
        orderBy: { sortOrder: "asc" as const },
    },
    statusHistory: {
        orderBy: { changedAt: "desc" as const },
        take: 20,
    },
    review: true,
} as const;

export class CustomerBookingsService {
    static async list(userId: string, query: BookingsQuery, lang: Lang) {
        const customer = await this.requireCustomerProfile(userId, lang);
        const { page, limit, skip, take } = parsePaginationQuery(query.page, query.limit);
        const statusRaw = firstQueryString(query.status)?.trim().toUpperCase();

        const statusFilter = this.parseStatusFilter(statusRaw);

        const where = {
            customerProfileId: customer.id,
            ...(statusFilter ? { status: { in: statusFilter } } : {}),
        };

        const [bookings, total] = await Promise.all([
            prisma.booking.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: "desc" },
                include: bookingInclude,
            }),
            prisma.booking.count({ where }),
        ]);

        return {
            data: bookings.map((booking) => this.formatBooking(booking, lang)),
            meta: buildPaginationMeta(page, limit, total),
        };
    }

    static async getById(userId: string, id: string, lang: Lang) {
        const customer = await this.requireCustomerProfile(userId, lang);
        const booking = await prisma.booking.findFirst({
            where: {
                customerProfileId: customer.id,
                OR: [{ id }, { publicId: id }],
            },
            include: bookingInclude,
        });

        if (!booking) {
            throw new NotFoundException(t("CUSTOMER_BOOKING_NOT_FOUND", lang));
        }

        return this.formatBooking(booking, lang);
    }

    static async create(userId: string, data: CreateBookingDto, lang: Lang) {
        const customer = await this.requireCustomerProfile(userId, lang);

        const service = await prisma.serviceListing.findFirst({
            where: {
                OR: [{ id: data.serviceId }, { publicId: data.serviceId }],
                serviceStatus: ServiceStatus.ACTIVE,
                moderationStatus: { not: ServiceModerationStatus.DISABLED_BY_ADMIN },
                providerProfile: { status: ProviderStatus.ACTIVE },
            },
            include: {
                providerProfile: {
                    include: { businessProfile: true },
                },
                category: true,
                areas: {
                    include: { serviceArea: true },
                    take: 1,
                },
            },
        });

        if (!service) {
            throw new NotFoundException(t("CUSTOMER_SERVICE_NOT_FOUND", lang));
        }

        const scheduledAt = this.buildScheduledAt(data.scheduledDate, data.timeSlot, lang);
        if (scheduledAt.getTime() < Date.now() - 60_000) {
            throw new BadRequestException(t("CUSTOMER_BOOKING_SCHEDULE_IN_PAST", lang));
        }

        let customerAddressId: string | null = null;
        let serviceAddress = "";
        let accessInstructions = data.accessInstructions ?? null;

        if (data.addressId) {
            const address = await prisma.customerAddress.findFirst({
                where: {
                    customerProfileId: customer.id,
                    OR: [{ id: data.addressId }, { publicId: data.addressId }],
                },
            });
            if (!address) {
                throw new NotFoundException(t("CUSTOMER_ADDRESS_NOT_FOUND", lang));
            }
            customerAddressId = address.id;
            serviceAddress = address.addressLine;
            accessInstructions = accessInstructions ?? address.notes;
        } else if (data.address) {
            const created = await CustomerAddressesService.create(userId, data.address, lang);
            customerAddressId = created.id;
            serviceAddress = created.addressLine;
            accessInstructions = accessInstructions ?? created.notes;
        } else {
            throw new BadRequestException(t("CUSTOMER_BOOKING_ADDRESS_REQUIRED", lang));
        }

        const quantity = data.quantity ?? 1;
        const unitPrice = Number(service.price);
        const estimatedTotal = Number((unitPrice * quantity).toFixed(2));
        const serviceAreaId = service.areas[0]?.serviceAreaId ?? service.providerProfile.primaryAreaId ?? null;
        const areaSummary = service.areas[0]
            ? lang === "kh"
                ? service.areas[0].serviceArea.nameKm
                : service.areas[0].serviceArea.nameEn
            : null;

        const publicId = await nextPublicId("BK", "booking");
        const historyPublicId = `BSH-${publicId}`;
        const timelinePublicIds = [0, 1, 2, 3].map((i) => `BTL-${publicId}-${i}`);

        const providerName =
            service.providerProfile.businessProfile?.businessName?.trim() ||
            service.providerProfile.contactName;

        const booking = await prisma.$transaction(async (tx) => {
            const created = await tx.booking.create({
                data: {
                    publicId,
                    customerProfileId: customer.id,
                    providerProfileId: service.providerProfileId,
                    serviceListingId: service.id,
                    customerAddressId,
                    serviceAreaId,
                    scheduledAt,
                    timeSlot: data.timeSlot,
                    quantity,
                    estimatedTotal,
                    serviceAddress,
                    areaSummary,
                    accessInstructions,
                    customerNotes: data.customerNotes ?? null,
                    status: BookingStatus.PENDING,
                    timelineItems: {
                        create: [
                            {
                                publicId: timelinePublicIds[0],
                                title: "Booking Placed",
                                description: `Your service request was submitted. ${providerName} is reviewing details.`,
                                isComplete: true,
                                occurredAt: new Date(),
                                sortOrder: 0,
                            },
                            {
                                publicId: timelinePublicIds[1],
                                title: "Vendor Assigned",
                                description: "Technician matching will begin before the scheduled time.",
                                isComplete: false,
                                sortOrder: 1,
                            },
                            {
                                publicId: timelinePublicIds[2],
                                title: "In Service",
                                description: "Technician will arrive at your address and complete the service.",
                                isComplete: false,
                                sortOrder: 2,
                            },
                            {
                                publicId: timelinePublicIds[3],
                                title: "Completed",
                                description: "Pay after the service is completed.",
                                isComplete: false,
                                sortOrder: 3,
                            },
                        ],
                    },
                    statusHistory: {
                        create: {
                            publicId: historyPublicId,
                            toStatus: BookingStatus.PENDING,
                            reason: "Booking created by customer",
                        },
                    },
                },
                include: bookingInclude,
            });

            return created;
        });

        await CustomerNotificationsHelper.create({
            userId,
            titleEn: "Booking pending confirmation",
            titleKm: "ការកក់កំពុងរង់ចាំការបញ្ជាក់",
            messageEn: `${providerName} received your booking for ${data.scheduledDate} (${data.timeSlot}).`,
            messageKm: `${providerName} បានទទួលការកក់របស់អ្នកសម្រាប់ ${data.scheduledDate} (${data.timeSlot})។`,
            relatedModule: "booking",
            relatedRecordId: booking.id,
            relatedRoute: `/bookings/${booking.id}`,
            priority: "normal",
        });

        return this.formatBooking(booking, lang);
    }

    static async cancel(
        userId: string,
        id: string,
        data: CancelBookingDto,
        lang: Lang
    ) {
        const customer = await this.requireCustomerProfile(userId, lang);
        const booking = await prisma.booking.findFirst({
            where: {
                customerProfileId: customer.id,
                OR: [{ id }, { publicId: id }],
            },
        });

        if (!booking) {
            throw new NotFoundException(t("CUSTOMER_BOOKING_NOT_FOUND", lang));
        }

        if (!CANCELABLE.includes(booking.status)) {
            throw new BadRequestException(t("CUSTOMER_BOOKING_CANNOT_CANCEL", lang));
        }

        const historyPublicId = `BSH-${booking.publicId}-${Date.now()}`;

        const updated = await prisma.$transaction(async (tx) => {
            const next = await tx.booking.update({
                where: { id: booking.id },
                data: { status: BookingStatus.CANCELLED },
                include: bookingInclude,
            });

            await tx.bookingStatusHistory.create({
                data: {
                    publicId: historyPublicId,
                    bookingId: booking.id,
                    fromStatus: booking.status,
                    toStatus: BookingStatus.CANCELLED,
                    reason: data.reason?.trim() || "Cancelled by customer",
                },
            });

            await tx.bookingTimelineItem.updateMany({
                where: { bookingId: booking.id, sortOrder: 0 },
                data: {
                    title: "Cancelled",
                    description: data.reason?.trim() || "This booking was cancelled by you.",
                    isComplete: true,
                    occurredAt: new Date(),
                },
            });

            return next;
        });

        await CustomerNotificationsHelper.create({
            userId,
            titleEn: "Booking cancelled",
            titleKm: "ការកក់ត្រូវបានលុបចោល",
            messageEn: `Your booking ${booking.publicId} was cancelled.`,
            messageKm: `ការកក់ ${booking.publicId} របស់អ្នកត្រូវបានលុបចោល។`,
            relatedModule: "booking",
            relatedRecordId: booking.id,
            relatedRoute: `/bookings/${booking.id}`,
            priority: "high",
        });

        return this.formatBooking(updated, lang);
    }

    static async reschedule(
        userId: string,
        id: string,
        data: RescheduleBookingDto,
        lang: Lang
    ) {
        const customer = await this.requireCustomerProfile(userId, lang);
        const booking = await prisma.booking.findFirst({
            where: {
                customerProfileId: customer.id,
                OR: [{ id }, { publicId: id }],
            },
        });

        if (!booking) {
            throw new NotFoundException(t("CUSTOMER_BOOKING_NOT_FOUND", lang));
        }

        if (!RESCHEDULABLE.includes(booking.status)) {
            throw new BadRequestException(t("CUSTOMER_BOOKING_CANNOT_RESCHEDULE", lang));
        }

        const scheduledAt = this.buildScheduledAt(data.scheduledDate, data.timeSlot, lang);
        if (scheduledAt.getTime() < Date.now() - 60_000) {
            throw new BadRequestException(t("CUSTOMER_BOOKING_SCHEDULE_IN_PAST", lang));
        }

        const historyPublicId = `BSH-${booking.publicId}-R-${Date.now()}`;
        const nextStatus =
            booking.status === BookingStatus.PENDING
                ? BookingStatus.PENDING
                : BookingStatus.RESCHEDULED;

        const updated = await prisma.$transaction(async (tx) => {
            const next = await tx.booking.update({
                where: { id: booking.id },
                data: {
                    scheduledAt,
                    timeSlot: data.timeSlot,
                    status: nextStatus,
                },
                include: bookingInclude,
            });

            await tx.bookingStatusHistory.create({
                data: {
                    publicId: historyPublicId,
                    bookingId: booking.id,
                    fromStatus: booking.status,
                    toStatus: nextStatus,
                    reason: `Rescheduled to ${data.scheduledDate} ${data.timeSlot}`,
                },
            });

            await tx.bookingTimelineItem.updateMany({
                where: { bookingId: booking.id, sortOrder: 0 },
                data: {
                    description: `Schedule updated to ${data.scheduledDate} @ ${data.timeSlot}.`,
                    occurredAt: new Date(),
                    isComplete: true,
                },
            });

            return next;
        });

        await CustomerNotificationsHelper.create({
            userId,
            titleEn: "Booking rescheduled",
            titleKm: "ការកក់ត្រូវបានកំណត់ពេលឡើងវិញ",
            messageEn: `Your booking ${booking.publicId} was rescheduled to ${data.scheduledDate} (${data.timeSlot}).`,
            messageKm: `ការកក់ ${booking.publicId} ត្រូវបានកំណត់ពេលឡើងវិញទៅ ${data.scheduledDate} (${data.timeSlot})។`,
            relatedModule: "booking",
            relatedRecordId: booking.id,
            relatedRoute: `/bookings/${booking.id}`,
            priority: "normal",
        });

        return this.formatBooking(updated, lang);
    }

    private static parseStatusFilter(statusRaw?: string): BookingStatus[] | null {
        if (!statusRaw || statusRaw === "ALL") return null;

        const map: Record<string, BookingStatus[]> = {
            PENDING: [BookingStatus.PENDING, BookingStatus.RESCHEDULED],
            ACCEPTED: [BookingStatus.ACCEPTED],
            IN_PROGRESS: [BookingStatus.IN_PROGRESS],
            "IN-PROGRESS": [BookingStatus.IN_PROGRESS],
            COMPLETED: [BookingStatus.COMPLETED],
            CANCELLED: [BookingStatus.CANCELLED, BookingStatus.REJECTED],
            REJECTED: [BookingStatus.REJECTED],
            RESCHEDULED: [BookingStatus.RESCHEDULED],
        };

        return map[statusRaw] ?? null;
    }

    private static buildScheduledAt(date: string, timeSlot: string, lang: Lang): Date {
        const startMatch = timeSlot.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
        if (!startMatch) {
            throw new BadRequestException(t("CUSTOMER_BOOKING_INVALID_TIMESLOT", lang));
        }

        let hours = Number(startMatch[1]);
        const minutes = Number(startMatch[2]);
        const meridiem = startMatch[3]?.toUpperCase();

        if (meridiem === "PM" && hours < 12) hours += 12;
        if (meridiem === "AM" && hours === 12) hours = 0;

        const scheduledAt = new Date(`${date}T00:00:00`);
        if (Number.isNaN(scheduledAt.getTime())) {
            throw new BadRequestException(t("CUSTOMER_BOOKING_INVALID_DATE", lang));
        }
        scheduledAt.setHours(hours, minutes, 0, 0);
        return scheduledAt;
    }

    private static formatBooking(
        booking: {
            id: string;
            publicId: string;
            scheduledAt: Date;
            timeSlot: string | null;
            quantity: number;
            estimatedTotal: { toNumber?: () => number } | number | string;
            serviceAddress: string;
            areaSummary: string | null;
            accessInstructions: string | null;
            customerNotes: string | null;
            rejectionReason: string | null;
            status: BookingStatus;
            createdAt: Date;
            updatedAt: Date;
            serviceListing: {
                id: string;
                publicId: string;
                name: string;
                imageUrl: string | null;
                priceUnit: string | null;
                duration: string | null;
                category: {
                    id: string;
                    publicId: string;
                    slug: string;
                    nameEn: string;
                    nameKm: string;
                };
            };
            providerProfile: {
                id: string;
                publicId: string;
                contactName: string;
                avatarUrl: string | null;
                businessProfile: {
                    businessName: string;
                    logoUrl: string | null;
                } | null;
            };
            customerAddress: {
                id: string;
                publicId: string;
                label: string;
                fullName: string;
                phone: string;
                addressLine: string;
                notes: string | null;
                latitude: { toNumber?: () => number } | number | string | null;
                longitude: { toNumber?: () => number } | number | string | null;
                detectedLocation: string | null;
                isDefault: boolean;
            } | null;
            serviceArea: {
                publicId: string;
                slug: string;
                nameEn: string;
                nameKm: string;
            } | null;
            timelineItems: Array<{
                publicId: string;
                title: string;
                description: string | null;
                isComplete: boolean;
                occurredAt: Date | null;
                sortOrder: number;
            }>;
            review: {
                publicId: string;
                rating: { toNumber?: () => number } | number | string;
                comment: string | null;
                createdAt: Date;
                updatedAt: Date;
            } | null;
        },
        lang: Lang
    ) {
        const isKh = lang === "kh";
        const providerName =
            booking.providerProfile.businessProfile?.businessName?.trim() ||
            booking.providerProfile.contactName;

        return {
            id: booking.id,
            publicId: booking.publicId,
            status: booking.status,
            statusLabel: this.statusLabel(booking.status),
            scheduledAt: booking.scheduledAt.toISOString(),
            scheduledDate: booking.scheduledAt.toISOString().slice(0, 10),
            timeSlot: booking.timeSlot,
            quantity: booking.quantity,
            estimatedTotal: this.toNumber(booking.estimatedTotal) ?? 0,
            serviceAddress: booking.serviceAddress,
            areaSummary: booking.areaSummary,
            accessInstructions: booking.accessInstructions,
            customerNotes: booking.customerNotes,
            rejectionReason: booking.rejectionReason,
            hasReview: Boolean(booking.review),
            review: booking.review
                ? {
                      publicId: booking.review.publicId,
                      rating: this.toNumber(booking.review.rating) ?? 0,
                      comment: booking.review.comment,
                      createdAt: booking.review.createdAt.toISOString(),
                      updatedAt: booking.review.updatedAt.toISOString(),
                  }
                : null,
            createdAt: booking.createdAt.toISOString(),
            updatedAt: booking.updatedAt.toISOString(),
            service: {
                id: booking.serviceListing.id,
                publicId: booking.serviceListing.publicId,
                name: booking.serviceListing.name,
                imageUrl: booking.serviceListing.imageUrl,
                priceUnit: booking.serviceListing.priceUnit,
                duration: booking.serviceListing.duration,
                category: {
                    id: booking.serviceListing.category.id,
                    publicId: booking.serviceListing.category.publicId,
                    slug: booking.serviceListing.category.slug,
                    name: isKh
                        ? booking.serviceListing.category.nameKm
                        : booking.serviceListing.category.nameEn,
                    nameEn: booking.serviceListing.category.nameEn,
                    nameKm: booking.serviceListing.category.nameKm,
                },
            },
            provider: {
                id: booking.providerProfile.id,
                publicId: booking.providerProfile.publicId,
                contactName: booking.providerProfile.contactName,
                businessName: booking.providerProfile.businessProfile?.businessName ?? null,
                name: providerName,
                avatarUrl:
                    booking.providerProfile.avatarUrl ??
                    booking.providerProfile.businessProfile?.logoUrl ??
                    null,
            },
            address: booking.customerAddress
                ? CustomerAddressesService.format(booking.customerAddress)
                : {
                      id: null,
                      publicId: null,
                      label: "Service address",
                      fullName: "",
                      phone: "",
                      addressLine: booking.serviceAddress,
                      notes: booking.accessInstructions,
                      latitude: null,
                      longitude: null,
                      detectedLocation: null,
                      isDefault: false,
                  },
            area: booking.serviceArea
                ? {
                      publicId: booking.serviceArea.publicId,
                      slug: booking.serviceArea.slug,
                      name: isKh ? booking.serviceArea.nameKm : booking.serviceArea.nameEn,
                      nameEn: booking.serviceArea.nameEn,
                      nameKm: booking.serviceArea.nameKm,
                  }
                : null,
            timeline: booking.timelineItems.map((item) => ({
                publicId: item.publicId,
                title: item.title,
                description: item.description,
                isComplete: item.isComplete,
                occurredAt: item.occurredAt?.toISOString() ?? null,
                sortOrder: item.sortOrder,
            })),
        };
    }

    private static statusLabel(status: BookingStatus) {
        switch (status) {
            case BookingStatus.PENDING:
                return "Pending";
            case BookingStatus.ACCEPTED:
                return "Accepted";
            case BookingStatus.IN_PROGRESS:
                return "In Progress";
            case BookingStatus.COMPLETED:
                return "Completed";
            case BookingStatus.CANCELLED:
                return "Cancelled";
            case BookingStatus.REJECTED:
                return "Rejected";
            case BookingStatus.RESCHEDULED:
                return "Rescheduled";
            default:
                return status;
        }
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
