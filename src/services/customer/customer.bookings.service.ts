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
    NotificationType,
    ServiceModerationStatus,
    ServiceStatus,
} from "../../generated/prisma/enums";
import { availableToCustomersWhere } from "../../utils/customer-provider-visibility.util";
import type { z } from "zod";
import type {
    customerCancelBookingSchema,
    customerCreateBookingSchema,
    customerRescheduleBookingSchema,
} from "../../validators/customer/booking.validator";
import { CustomerAddressesService } from "./customer.addresses.service";
import { BookingNotificationCopy, NotificationsHelper } from "../notifications.helper";
import { publishBookingCreated, publishBookingUpdated } from "../../websocket/booking-events";
import {
    findNearestArea,
    isWithinAnyServiceArea,
} from "../../utils/geo-distance.util";
import { toAreaGeoNumber } from "../../utils/provider-service-areas.util";
import {
    evaluateAvailabilityDay,
    isSlotOnDay,
} from "../../utils/provider-availability.util";

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
            _count: {
                select: {
                    reviews: true,
                    bookings: true,
                },
            },
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
                providerProfile: availableToCustomersWhere,
            },
            include: {
                providerProfile: {
                    include: {
                        businessProfile: true,
                        serviceAreas: {
                            include: { serviceArea: true },
                        },
                        primaryArea: true,
                    },
                },
                category: true,
                areas: {
                    include: { serviceArea: true },
                },
            },
        });

        if (!service) {
            throw new NotFoundException(t("CUSTOMER_SERVICE_NOT_FOUND", lang));
        }

        if (service.providerProfile.businessProfile?.temporarilyPaused) {
            throw new BadRequestException(t("CUSTOMER_PROVIDER_UNAVAILABLE", lang));
        }

        await this.assertBookableSchedule(
            service.providerProfileId,
            service.providerProfile.businessProfile,
            data.scheduledDate,
            data.timeSlot,
            lang
        );

        const scheduledAt = this.buildScheduledAt(data.scheduledDate, data.timeSlot, lang);
        if (scheduledAt.getTime() < Date.now() - 60_000) {
            throw new BadRequestException(t("CUSTOMER_BOOKING_SCHEDULE_IN_PAST", lang));
        }

        let customerAddressId: string | null = null;
        let serviceAddress = "";
        let accessInstructions = data.accessInstructions ?? null;
        let customerLat: number | null = null;
        let customerLng: number | null = null;

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
            customerLat = toAreaGeoNumber(address.latitude);
            customerLng = toAreaGeoNumber(address.longitude);
        } else if (data.address) {
            const created = await CustomerAddressesService.create(userId, data.address, lang);
            customerAddressId = created.id;
            serviceAddress = created.addressLine;
            accessInstructions = accessInstructions ?? created.notes;
            customerLat = toAreaGeoNumber((created as any).latitude);
            customerLng = toAreaGeoNumber((created as any).longitude);
        } else {
            throw new BadRequestException(t("CUSTOMER_BOOKING_ADDRESS_REQUIRED", lang));
        }

        // Build coverage circles: listing areas first, else provider multi areas, else primary.
        // Disabled (isActive=false) areas are never used.
        const hasLinkedAreas =
            service.areas.length > 0 ||
            service.providerProfile.serviceAreas.length > 0 ||
            Boolean(service.providerProfile.primaryAreaId);
        const coverageAreas = this.resolveCoverageAreas(service);
        if (hasLinkedAreas && coverageAreas.length === 0) {
            throw new BadRequestException(
                t("CUSTOMER_BOOKING_NO_ACTIVE_SERVICE_AREA", lang)
            );
        }
        if (coverageAreas.some((a) => a.latitude != null && a.longitude != null)) {
            if (customerLat == null || customerLng == null) {
                throw new BadRequestException(
                    t("CUSTOMER_BOOKING_ADDRESS_LOCATION_REQUIRED", lang)
                );
            }
            if (!isWithinAnyServiceArea(customerLat, customerLng, coverageAreas)) {
                throw new BadRequestException(
                    t("CUSTOMER_BOOKING_OUTSIDE_SERVICE_AREA", lang)
                );
            }
        }

        const quantity = data.quantity ?? 1;
        const unitPrice = Number(service.price);
        const estimatedTotal = Number((unitPrice * quantity).toFixed(2));

        const matchedArea =
            customerLat != null && customerLng != null
                ? findNearestArea(customerLat, customerLng, coverageAreas)
                : null;
        const firstActiveListingAreaId = service.areas.find(
            (a) => a.serviceArea.isActive !== false
        )?.serviceAreaId;
        const serviceAreaId =
            (matchedArea?.isWithin ? matchedArea.areaId : null) ||
            firstActiveListingAreaId ||
            (service.providerProfile.primaryArea?.isActive !== false
                ? service.providerProfile.primaryAreaId
                : null) ||
            coverageAreas[0]?.id ||
            null;

        const matchedAreaRow =
            service.areas.find((a) => a.serviceAreaId === serviceAreaId)?.serviceArea ||
            service.providerProfile.serviceAreas.find(
                (a) => a.serviceAreaId === serviceAreaId
            )?.serviceArea ||
            service.providerProfile.primaryArea;

        const areaSummary = matchedAreaRow
            ? lang === "kh"
                ? matchedAreaRow.nameKm
                : matchedAreaRow.nameEn
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

        const bookingCtx = {
            bookingPublicId: booking.publicId,
            serviceName: service.name,
            providerName,
            customerName: customer.fullName,
            scheduledDate: data.scheduledDate,
            timeSlot: data.timeSlot,
        };
        const bookingRef = booking.publicId || booking.id;

        await NotificationsHelper.notifyUser(userId, {
            ...BookingNotificationCopy.createdForCustomer(bookingCtx),
            type: NotificationType.BOOKING,
            relatedModule: "booking",
            relatedRecordId: bookingRef,
            relatedRoute: `/bookings/${bookingRef}`,
            priority: "normal",
        });

        await NotificationsHelper.notifyUser(service.providerProfile.userId, {
            ...BookingNotificationCopy.createdForVendor(bookingCtx),
            type: NotificationType.BOOKING,
            relatedModule: "booking",
            relatedRecordId: bookingRef,
            relatedRoute: `/provider/requests/${bookingRef}`,
            priority: "high",
        });

        publishBookingCreated({
            bookingId: booking.id,
            publicId: booking.publicId,
            status: booking.status,
            customerUserId: userId,
            providerUserId: service.providerProfile.userId,
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
            include: {
                serviceListing: { select: { name: true } },
                providerProfile: { select: { userId: true } },
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

        const bookingCtx = {
            bookingPublicId: booking.publicId,
            serviceName: booking.serviceListing?.name,
            customerName: customer.fullName,
            reason: data.reason ?? undefined,
        };
        const bookingRef = booking.publicId || booking.id;
        const vendorRoute =
            booking.status === BookingStatus.PENDING || booking.status === BookingStatus.RESCHEDULED
                ? `/provider/requests/${bookingRef}`
                : `/provider/bookings/${bookingRef}`;

        publishBookingUpdated({
            bookingId: updated.id,
            publicId: updated.publicId,
            status: updated.status,
            customerUserId: userId,
            providerUserId: booking.providerProfile.userId,
        });

        await NotificationsHelper.notifyUser(userId, {
            ...BookingNotificationCopy.cancelledForCustomer(bookingCtx),
            type: NotificationType.BOOKING,
            relatedModule: "booking",
            relatedRecordId: bookingRef,
            relatedRoute: `/bookings/${bookingRef}`,
            priority: "high",
        });

        await NotificationsHelper.notifyUser(booking.providerProfile.userId, {
            ...BookingNotificationCopy.cancelledForVendor(bookingCtx),
            type: NotificationType.BOOKING,
            relatedModule: "booking",
            relatedRecordId: bookingRef,
            relatedRoute: vendorRoute,
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
            include: {
                serviceListing: { select: { name: true } },
            },
        });

        if (!booking) {
            throw new NotFoundException(t("CUSTOMER_BOOKING_NOT_FOUND", lang));
        }

        if (!RESCHEDULABLE.includes(booking.status)) {
            throw new BadRequestException(t("CUSTOMER_BOOKING_CANNOT_RESCHEDULE", lang));
        }

        const providerProfile = await prisma.providerProfile.findUnique({
            where: { id: booking.providerProfileId },
            include: { businessProfile: true },
        });

        if (providerProfile?.businessProfile?.temporarilyPaused) {
            throw new BadRequestException(t("CUSTOMER_PROVIDER_UNAVAILABLE", lang));
        }

        await this.assertBookableSchedule(
            booking.providerProfileId,
            providerProfile?.businessProfile,
            data.scheduledDate,
            data.timeSlot,
            lang
        );

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

        const bookingCtx = {
            bookingPublicId: booking.publicId,
            serviceName: booking.serviceListing?.name,
            customerName: customer.fullName,
            scheduledDate: data.scheduledDate,
            timeSlot: data.timeSlot,
        };
        const bookingRef = booking.publicId || booking.id;
        const vendorRoute =
            nextStatus === BookingStatus.PENDING
                ? `/provider/requests/${bookingRef}`
                : `/provider/bookings/${bookingRef}`;

        publishBookingUpdated({
            bookingId: updated.id,
            publicId: updated.publicId,
            status: updated.status,
            customerUserId: userId,
            providerUserId: providerProfile?.userId,
        });

        await NotificationsHelper.notifyUser(userId, {
            ...BookingNotificationCopy.rescheduledForCustomer(bookingCtx),
            type: NotificationType.BOOKING,
            relatedModule: "booking",
            relatedRecordId: bookingRef,
            relatedRoute: `/bookings/${bookingRef}`,
            priority: "normal",
        });

        if (providerProfile?.userId) {
            await NotificationsHelper.notifyUser(providerProfile.userId, {
                ...BookingNotificationCopy.rescheduledForVendor(bookingCtx),
                type: NotificationType.BOOKING,
                relatedModule: "booking",
                relatedRecordId: bookingRef,
                relatedRoute: vendorRoute,
                priority: "high",
            });
        }

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

    private static resolveCoverageAreas(service: {
        areas: Array<{
            serviceAreaId: string;
            serviceArea: {
                id: string;
                latitude: unknown;
                longitude: unknown;
                radiusKm: unknown;
                isActive?: boolean;
            };
        }>;
        providerProfile: {
            primaryAreaId: string | null;
            primaryArea: {
                id: string;
                latitude: unknown;
                longitude: unknown;
                radiusKm: unknown;
                isActive?: boolean;
            } | null;
            serviceAreas: Array<{
                serviceAreaId: string;
                serviceArea: {
                    id: string;
                    latitude: unknown;
                    longitude: unknown;
                    radiusKm: unknown;
                    isActive?: boolean;
                };
            }>;
        };
    }) {
        const fromListing = service.areas
            .filter((row) => row.serviceArea.isActive !== false)
            .map((row) => ({
                id: row.serviceArea.id,
                latitude: toAreaGeoNumber(row.serviceArea.latitude),
                longitude: toAreaGeoNumber(row.serviceArea.longitude),
                radiusKm: toAreaGeoNumber(row.serviceArea.radiusKm) ?? 15,
            }));

        if (fromListing.length > 0) return fromListing;

        const fromProvider = service.providerProfile.serviceAreas
            .filter((row) => row.serviceArea.isActive !== false)
            .map((row) => ({
                id: row.serviceArea.id,
                latitude: toAreaGeoNumber(row.serviceArea.latitude),
                longitude: toAreaGeoNumber(row.serviceArea.longitude),
                radiusKm: toAreaGeoNumber(row.serviceArea.radiusKm) ?? 15,
            }));

        if (fromProvider.length > 0) return fromProvider;

        if (
            service.providerProfile.primaryArea &&
            service.providerProfile.primaryArea.isActive !== false
        ) {
            return [
                {
                    id: service.providerProfile.primaryArea.id,
                    latitude: toAreaGeoNumber(service.providerProfile.primaryArea.latitude),
                    longitude: toAreaGeoNumber(service.providerProfile.primaryArea.longitude),
                    radiusKm:
                        toAreaGeoNumber(service.providerProfile.primaryArea.radiusKm) ?? 15,
                },
            ];
        }

        return [];
    }

    private static async assertBookableSchedule(
        providerProfileId: string | undefined,
        profile:
            | {
                  workingDays?: string[];
                  workingHours?: unknown;
                  unavailableDates?: Date[];
                  temporarilyPaused?: boolean;
                  maxBookingsPerSlot?: number;
              }
            | null
            | undefined,
        scheduledDate: string,
        timeSlot: string,
        lang: Lang
    ) {
        const ymd = scheduledDate.slice(0, 10);
        const bookedCounts = new Map<string, number>();

        if (providerProfileId) {
            const activeBookings = await prisma.booking.findMany({
                where: {
                    providerProfileId,
                    status: {
                        in: [BookingStatus.PENDING, BookingStatus.ACCEPTED, BookingStatus.IN_PROGRESS],
                    },
                    scheduledAt: {
                        gte: new Date(`${ymd}T00:00:00.000Z`),
                        lt: new Date(`${ymd}T23:59:59.999Z`),
                    },
                },
                select: {
                    timeSlot: true,
                },
            });

            for (const b of activeBookings) {
                const slotStr = b.timeSlot?.trim() || "";
                if (slotStr) {
                    const k1 = `${ymd}_${slotStr.toLowerCase()}`;
                    const k2 = `${ymd}_${slotStr.toLowerCase().replace(/\s/g, "")}`;
                    bookedCounts.set(k1, (bookedCounts.get(k1) ?? 0) + 1);
                    bookedCounts.set(k2, (bookedCounts.get(k2) ?? 0) + 1);
                }
            }
        }

        const day = evaluateAvailabilityDay(profile, ymd, bookedCounts);
        if (!day.available) {
            throw new BadRequestException(
                day.reason === "paused"
                    ? t("CUSTOMER_PROVIDER_UNAVAILABLE", lang)
                    : t("CUSTOMER_BOOKING_DAY_CLOSED", lang)
            );
        }
        if (timeSlot && day.slots.length > 0 && !isSlotOnDay(day, timeSlot)) {
            throw new BadRequestException(t("CUSTOMER_BOOKING_SLOT_UNAVAILABLE", lang));
        }
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
                nameKm?: string | null;
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
                averageRating: { toNumber?: () => number } | number | string | null;
                completedJobs: number;
                businessProfile: {
                    businessName: string;
                    logoUrl: string | null;
                } | null;
                _count?: {
                    reviews: number;
                    bookings: number;
                };
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
                name: isKh
                    ? booking.serviceListing.nameKm || booking.serviceListing.name
                    : booking.serviceListing.name || booking.serviceListing.nameKm || "",
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
                averageRating: this.toNumber(booking.providerProfile.averageRating),
                completedJobs: booking.providerProfile.completedJobs ?? 0,
                reviewCount: booking.providerProfile._count?.reviews ?? 0,
                bookingCount: booking.providerProfile._count?.bookings ?? 0,
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
