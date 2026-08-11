import { prisma } from "../../database/prisma.client";
import { BadRequestException, NotFoundException } from "../../utils/app-error.util";
import {
    buildPaginationMeta,
    firstQueryString,
    parsePaginationQuery,
} from "../../utils/pagination.util";
import { BookingStatus, NotificationType } from "../../generated/prisma/enums";
import { CustomerNotificationsHelper } from "../customer/customer.notifications.helper";

type BookingsQuery = {
    page?: unknown;
    limit?: unknown;
    status?: unknown;
};

const bookingInclude = {
    serviceListing: {
        select: {
            id: true,
            publicId: true,
            name: true,
        },
    },
    customerProfile: {
        select: {
            userId: true,
            fullName: true,
            user: { select: { email: true, phone: true } },
        },
    },
    serviceArea: {
        select: { nameEn: true, nameKm: true },
    },
} as const;

const STATUS_UI: Record<BookingStatus, string> = {
    PENDING: "Pending",
    ACCEPTED: "Accepted",
    IN_PROGRESS: "In Progress",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    REJECTED: "Rejected",
    RESCHEDULED: "Rescheduled",
};

function calendarDate(date: Date): string {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Phnom_Penh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(date);
}

function decimalNumber(value: { toNumber?: () => number } | number | string | null | undefined): number {
    if (value == null) return 0;
    if (typeof value === "number") return value;
    if (typeof value === "string") return Number(value) || 0;
    return value.toNumber?.() ?? 0;
}

function formatBooking(booking: any) {
    return {
        bookingId: booking.publicId || booking.id,
        serviceId: booking.serviceListing?.publicId || booking.serviceListingId,
        serviceName: booking.serviceListing?.name || "Service",
        customerName: booking.customerProfile?.fullName || "Customer",
        customerPhone: booking.customerProfile?.user?.phone || "",
        customerEmail: booking.customerProfile?.user?.email || "",
        quantity: booking.quantity ?? 1,
        requestedDate: calendarDate(booking.scheduledAt),
        requestedTimeSlot: booking.timeSlot || "",
        serviceAddress: booking.serviceAddress || "",
        areaSummary: booking.areaSummary || booking.serviceArea?.nameEn || booking.serviceArea?.nameKm || "",
        accessInstructions: booking.accessInstructions || "",
        estimatedTotal: decimalNumber(booking.estimatedTotal),
        requestCreationTime: booking.createdAt.toISOString(),
        status: STATUS_UI[booking.status as BookingStatus] || booking.status,
        rejectionReason: booking.rejectionReason || undefined,
        notes: booking.customerNotes || undefined,
        scheduledAt: booking.scheduledAt.toISOString(),
    };
}

export class VendorBookingsService {
    private static async requireProvider(userId: string) {
        const provider = await prisma.providerProfile.findUnique({
            where: { userId },
            select: { id: true },
        });
        if (!provider) {
            throw new NotFoundException("Provider profile not found");
        }
        return provider;
    }

    private static parseStatusFilter(statusRaw?: string): BookingStatus[] | null {
        if (!statusRaw || statusRaw === "ALL") return null;

        const map: Record<string, BookingStatus[]> = {
            PENDING: [BookingStatus.PENDING],
            ACCEPTED: [BookingStatus.ACCEPTED],
            IN_PROGRESS: [BookingStatus.IN_PROGRESS],
            "IN-PROGRESS": [BookingStatus.IN_PROGRESS],
            COMPLETED: [BookingStatus.COMPLETED],
            CANCELLED: [BookingStatus.CANCELLED],
            REJECTED: [BookingStatus.REJECTED],
            RESCHEDULED: [BookingStatus.RESCHEDULED],
        };

        return map[statusRaw] ?? null;
    }

    static async list(userId: string, query: BookingsQuery) {
        const provider = await this.requireProvider(userId);
        const { page, limit, skip, take } = parsePaginationQuery(query.page, query.limit);
        const statusFilter = this.parseStatusFilter(firstQueryString(query.status)?.trim().toUpperCase());

        const where = {
            providerProfileId: provider.id,
            ...(statusFilter ? { status: { in: statusFilter } } : {}),
        };

        const [bookings, total] = await Promise.all([
            prisma.booking.findMany({
                where,
                skip,
                take,
                orderBy: { scheduledAt: "asc" },
                include: bookingInclude,
            }),
            prisma.booking.count({ where }),
        ]);

        return {
            items: bookings.map(formatBooking),
            meta: buildPaginationMeta(page, limit, total),
        };
    }

    static async getById(userId: string, id: string) {
        const provider = await this.requireProvider(userId);
        const booking = await prisma.booking.findFirst({
            where: {
                providerProfileId: provider.id,
                OR: [{ id }, { publicId: id }],
            },
            include: bookingInclude,
        });

        if (!booking) {
            throw new NotFoundException("Booking not found");
        }

        return formatBooking(booking);
    }

    static async accept(userId: string, id: string) {
        return this.transition(userId, id, {
            allowed: [BookingStatus.PENDING, BookingStatus.RESCHEDULED],
            next: BookingStatus.ACCEPTED,
            reason: "Accepted by provider",
            timelineSortOrder: 1,
            timelineTitle: "Vendor Assigned",
            timelineDescription: "The provider accepted your booking request.",
            notify: {
                titleEn: "Booking accepted",
                titleKm: "ការកក់ត្រូវបានទទួលយក",
                messageEn: "Your provider accepted the booking and will arrive at the scheduled time.",
                messageKm: "អ្នកផ្តល់សេវាបានទទួលយកការកក់ ហើយនឹងមកដល់តាមពេលកំណត់។",
            },
        });
    }

    static async reject(userId: string, id: string, reason?: string) {
        const rejectionReason = reason?.trim() || "Rejected by provider";
        return this.transition(userId, id, {
            allowed: [BookingStatus.PENDING, BookingStatus.RESCHEDULED],
            next: BookingStatus.REJECTED,
            reason: rejectionReason,
            rejectionReason,
            timelineSortOrder: 1,
            timelineTitle: "Request rejected",
            timelineDescription: rejectionReason,
            notify: {
                titleEn: "Booking rejected",
                titleKm: "ការកក់ត្រូវបានបដិសេធ",
                messageEn: `Your booking was declined. ${rejectionReason}`,
                messageKm: `ការកក់របស់អ្នកត្រូវបានបដិសេធ។ ${rejectionReason}`,
            },
        });
    }

    static async start(userId: string, id: string) {
        return this.transition(userId, id, {
            allowed: [BookingStatus.ACCEPTED],
            next: BookingStatus.IN_PROGRESS,
            reason: "Service started by provider",
            timelineSortOrder: 2,
            timelineTitle: "Service in progress",
            timelineDescription: "The provider started the service.",
            notify: {
                titleEn: "Service started",
                titleKm: "សេវាកម្មបានចាប់ផ្តើម",
                messageEn: "Your provider has started the service.",
                messageKm: "អ្នកផ្តល់សេវាបានចាប់ផ្តើមការងារ។",
            },
        });
    }

    static async complete(userId: string, id: string) {
        return this.transition(userId, id, {
            allowed: [BookingStatus.IN_PROGRESS],
            next: BookingStatus.COMPLETED,
            reason: "Service completed by provider",
            timelineSortOrder: 3,
            timelineTitle: "Service completed",
            timelineDescription: "The provider marked this booking as completed.",
            notify: {
                titleEn: "Service completed",
                titleKm: "សេវាកម្មបានបញ្ចប់",
                messageEn: "Your booking was marked complete. You can leave a review.",
                messageKm: "ការកក់របស់អ្នកត្រូវបានបញ្ចប់។ អ្នកអាចវាយតម្លៃបាន។",
            },
        });
    }

    private static async findOwned(userId: string, id: string) {
        const provider = await this.requireProvider(userId);
        const booking = await prisma.booking.findFirst({
            where: {
                providerProfileId: provider.id,
                OR: [{ id }, { publicId: id }],
            },
            include: bookingInclude,
        });
        if (!booking) {
            throw new NotFoundException("Booking not found");
        }
        return booking;
    }

    private static async transition(
        userId: string,
        id: string,
        options: {
            allowed: BookingStatus[];
            next: BookingStatus;
            reason: string;
            rejectionReason?: string;
            timelineSortOrder: number;
            timelineTitle: string;
            timelineDescription: string;
            notify: {
                titleEn: string;
                titleKm: string;
                messageEn: string;
                messageKm: string;
            };
        }
    ) {
        const booking = await this.findOwned(userId, id);
        if (!options.allowed.includes(booking.status)) {
            throw new BadRequestException(
                `This booking cannot move from ${STATUS_UI[booking.status]} to ${STATUS_UI[options.next]}.`
            );
        }

        const updated = await prisma.$transaction(async (tx) => {
            const next = await tx.booking.update({
                where: { id: booking.id },
                data: {
                    status: options.next,
                    ...(options.rejectionReason !== undefined && {
                        rejectionReason: options.rejectionReason,
                    }),
                },
                include: bookingInclude,
            });

            await tx.bookingStatusHistory.create({
                data: {
                    publicId: `BSH-${booking.publicId}-${Date.now()}`,
                    bookingId: booking.id,
                    fromStatus: booking.status,
                    toStatus: options.next,
                    reason: options.reason,
                },
            });

            await tx.bookingTimelineItem.updateMany({
                where: { bookingId: booking.id, sortOrder: options.timelineSortOrder },
                data: {
                    title: options.timelineTitle,
                    description: options.timelineDescription,
                    isComplete: true,
                    occurredAt: new Date(),
                },
            });

            return next;
        });

        if (booking.customerProfile?.userId) {
            try {
                await CustomerNotificationsHelper.create({
                    userId: booking.customerProfile.userId,
                    type: NotificationType.BOOKING,
                    titleEn: options.notify.titleEn,
                    titleKm: options.notify.titleKm,
                    messageEn: `${options.notify.messageEn} (${booking.publicId})`,
                    messageKm: `${options.notify.messageKm} (${booking.publicId})`,
                    relatedModule: "booking",
                    relatedRecordId: booking.id,
                    relatedRoute: `/bookings/${booking.id}`,
                    priority: "high",
                });
            } catch (error) {
                console.error("Failed to notify customer about booking transition", error);
            }
        }

        return formatBooking(updated);
    }
}
