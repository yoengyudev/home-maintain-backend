import { prisma } from "../../database/prisma.client";
import { BadRequestException, NotFoundException } from "../../utils/app-error.util";
import { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";
import {
    buildPaginationMeta,
    firstQueryString,
    parsePaginationQuery,
} from "../../utils/pagination.util";
import { BookingStatus, NotificationType } from "../../generated/prisma/enums";
import { BookingNotificationCopy, NotificationsHelper } from "../notifications.helper";
import { publishBookingUpdated } from "../../websocket/booking-events";

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
    customerAddress: {
        select: {
            id: true,
            publicId: true,
            addressLine: true,
            latitude: true,
            longitude: true,
            detectedLocation: true,
        },
    },
    serviceArea: {
        select: { nameEn: true, nameKm: true, latitude: true, longitude: true },
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
    const lat =
        booking.customerAddress?.latitude != null
            ? Number(booking.customerAddress.latitude)
            : booking.serviceArea?.latitude != null
            ? Number(booking.serviceArea.latitude)
            : null;
    const lng =
        booking.customerAddress?.longitude != null
            ? Number(booking.customerAddress.longitude)
            : booking.serviceArea?.longitude != null
            ? Number(booking.serviceArea.longitude)
            : null;

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
        serviceAddress: booking.serviceAddress || booking.customerAddress?.addressLine || "",
        areaSummary: booking.areaSummary || booking.serviceArea?.nameEn || booking.serviceArea?.nameKm || "",
        accessInstructions: booking.accessInstructions || "",
        estimatedTotal: decimalNumber(booking.estimatedTotal),
        requestCreationTime: booking.createdAt.toISOString(),
        status: STATUS_UI[booking.status as BookingStatus] || booking.status,
        rejectionReason: booking.rejectionReason || undefined,
        notes: booking.customerNotes || undefined,
        scheduledAt: booking.scheduledAt.toISOString(),
        latitude: lat,
        longitude: lng,
    };
}

export class VendorBookingsService {
    private static async requireProvider(userId: string, lang: Lang = "en") {
        const provider = await prisma.providerProfile.findUnique({
            where: { userId },
            select: { id: true },
        });
        if (!provider) {
            throw new NotFoundException(t("VENDOR_PROVIDER_PROFILE_NOT_FOUND", lang));
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

    static async list(userId: string, query: BookingsQuery, lang: Lang = "en") {
        const provider = await this.requireProvider(userId, lang);
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

    static async getById(userId: string, id: string, lang: Lang = "en") {
        const provider = await this.requireProvider(userId, lang);
        const booking = await prisma.booking.findFirst({
            where: {
                providerProfileId: provider.id,
                OR: [{ id }, { publicId: id }],
            },
            include: bookingInclude,
        });

        if (!booking) {
            throw new NotFoundException(t("VENDOR_BOOKING_NOT_FOUND", lang));
        }

        return formatBooking(booking);
    }

    static async accept(userId: string, id: string, lang: Lang = "en") {
        return this.transition(userId, id, {
            allowed: [BookingStatus.PENDING, BookingStatus.RESCHEDULED],
            next: BookingStatus.ACCEPTED,
            reason: "Accepted by provider",
            timelineSortOrder: 1,
            timelineTitle: "Vendor Assigned",
            timelineDescription: "The provider accepted your booking request.",
            notify: "accepted",
        }, lang);
    }

    static async reject(userId: string, id: string, reason?: string, lang: Lang = "en") {
        const rejectionReason = reason?.trim() || "Rejected by provider";
        return this.transition(userId, id, {
            allowed: [BookingStatus.PENDING, BookingStatus.RESCHEDULED],
            next: BookingStatus.REJECTED,
            reason: rejectionReason,
            rejectionReason,
            timelineSortOrder: 1,
            timelineTitle: "Request rejected",
            timelineDescription: rejectionReason,
            notify: "rejected",
        }, lang);
    }

    static async start(userId: string, id: string, lang: Lang = "en") {
        return this.transition(userId, id, {
            allowed: [BookingStatus.ACCEPTED],
            next: BookingStatus.IN_PROGRESS,
            reason: "Service started by provider",
            timelineSortOrder: 2,
            timelineTitle: "Service in progress",
            timelineDescription: "The provider started the service.",
            notify: "started",
        }, lang);
    }

    static async complete(userId: string, id: string, lang: Lang = "en") {
        return this.transition(userId, id, {
            allowed: [BookingStatus.IN_PROGRESS],
            next: BookingStatus.COMPLETED,
            reason: "Service completed by provider",
            timelineSortOrder: 3,
            timelineTitle: "Service completed",
            timelineDescription: "The provider marked this booking as completed.",
            notify: "completed",
        }, lang);
    }

    private static async findOwned(userId: string, id: string, lang: Lang = "en") {
        const provider = await this.requireProvider(userId, lang);
        const booking = await prisma.booking.findFirst({
            where: {
                providerProfileId: provider.id,
                OR: [{ id }, { publicId: id }],
            },
            include: bookingInclude,
        });
        if (!booking) {
            throw new NotFoundException(t("VENDOR_BOOKING_NOT_FOUND", lang));
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
            notify: "accepted" | "rejected" | "started" | "completed";
        },
        lang: Lang = "en"
    ) {
        const booking = await this.findOwned(userId, id, lang);
        if (!options.allowed.includes(booking.status)) {
            throw new BadRequestException(
                t("VENDOR_BOOKING_INVALID_TRANSITION", lang, {
                    from: STATUS_UI[booking.status],
                    to: STATUS_UI[options.next],
                })
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

            if (options.next === BookingStatus.COMPLETED) {
                await tx.providerProfile.update({
                    where: { id: booking.providerProfileId },
                    data: {
                        completedJobs: { increment: 1 },
                    },
                });

                const existingCommission = await tx.bookingCommission.findUnique({
                    where: { bookingId: booking.id },
                });

                if (!existingCommission) {
                    const activeSetting = await tx.commissionSetting.findFirst({
                        where: { isActive: true },
                        orderBy: { createdAt: "desc" },
                    });

                    const commType = activeSetting?.type ?? "PERCENTAGE";
                    const commRate = activeSetting?.value ? Number(activeSetting.value) : 5.0; // default 5% if not yet configured
                    const bookingAmount = decimalNumber(booking.estimatedTotal);

                    let commissionAmount = 0;
                    if (commType === "FIXED") {
                        commissionAmount = parseFloat(Math.min(commRate, bookingAmount).toFixed(2));
                    } else {
                        commissionAmount = parseFloat(((bookingAmount * commRate) / 100).toFixed(2));
                    }
                    const providerEarning = parseFloat(Math.max(0, bookingAmount - commissionAmount).toFixed(2));

                    await tx.bookingCommission.create({
                        data: {
                            publicId: `COM-${booking.publicId}`,
                            bookingId: booking.id,
                            providerProfileId: booking.providerProfileId,
                            commissionType: commType,
                            commissionRate: commRate,
                            bookingAmount,
                            commissionAmount,
                            providerEarning,
                            status: "UNPAID",
                        },
                    });
                }
            }

            return next;
        });

        publishBookingUpdated({
            bookingId: updated.id,
            publicId: updated.publicId,
            status: updated.status,
            customerUserId: booking.customerProfile?.userId,
            providerUserId: userId,
        });

        if (booking.customerProfile?.userId) {
            const bookingCtx = {
                bookingPublicId: booking.publicId,
                serviceName: booking.serviceListing?.name,
                customerName: booking.customerProfile?.fullName,
                reason: options.rejectionReason,
            };
            const copy =
                options.notify === "accepted"
                    ? BookingNotificationCopy.acceptedForCustomer(bookingCtx)
                    : options.notify === "rejected"
                      ? BookingNotificationCopy.rejectedForCustomer(bookingCtx)
                      : options.notify === "started"
                        ? BookingNotificationCopy.startedForCustomer(bookingCtx)
                        : BookingNotificationCopy.completedForCustomer(bookingCtx);
            const bookingRef = booking.publicId || booking.id;

            await NotificationsHelper.notifyUser(booking.customerProfile.userId, {
                ...copy,
                type: NotificationType.BOOKING,
                relatedModule: "booking",
                relatedRecordId: bookingRef,
                relatedRoute: `/bookings/${bookingRef}`,
                priority: "high",
            });
        }

        return formatBooking(updated);
    }
}
