import { prisma } from "../../database/prisma.client";
import { NotFoundException } from "../../utils/app-error.util";
import { BookingStatus } from "../../generated/prisma/enums";
import {
    buildPaginationMeta,
    firstQueryString,
    parsePaginationQuery,
} from "../../utils/pagination.util";
import type { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";

const bookingInclude = {
    customerProfile: {
        include: { user: { select: { email: true, phone: true } } },
    },
    providerProfile: {
        include: {
            user: { select: { email: true } },
            businessProfile: { select: { businessName: true } },
        },
    },
    serviceListing: {
        include: { category: { select: { nameEn: true, nameKm: true } } },
    },
    serviceArea: { select: { nameEn: true, nameKm: true } },
    issues: {
        select: {
            id: true,
            publicId: true,
            status: true,
            summaryEn: true,
            summaryKm: true,
            resolution: true,
            resolvedAt: true,
            createdAt: true,
        },
    },
} as const;

function formatBooking(b: any) {
    return {
        id: b.id,
        publicId: b.publicId,
        status: b.status,
        scheduledAt: b.scheduledAt.toISOString(),
        timeSlot: b.timeSlot,
        quantity: b.quantity,
        estimatedTotal: parseFloat(b.estimatedTotal),
        serviceAddress: b.serviceAddress,
        customerNotes: b.customerNotes,
        rejectionReason: b.rejectionReason,
        createdAt: b.createdAt.toISOString(),
        customer: {
            id: b.customerProfile.id,
            publicId: b.customerProfile.publicId,
            fullName: b.customerProfile.fullName,
            email: b.customerProfile.user?.email ?? "",
            phone: b.customerProfile.user?.phone ?? null,
        },
        provider: {
            id: b.providerProfile.id,
            publicId: b.providerProfile.publicId,
            contactName: b.providerProfile.contactName,
            businessName: b.providerProfile.businessProfile?.businessName ?? null,
            email: b.providerProfile.user?.email ?? "",
        },
        service: {
            id: b.serviceListing.id,
            publicId: b.serviceListing.publicId,
            name: b.serviceListing.name,
            price: parseFloat(b.serviceListing.price),
            category: b.serviceListing.category,
        },
        serviceArea: b.serviceArea,
        issues: b.issues.map((i: any) => ({
            ...i,
            resolvedAt: i.resolvedAt?.toISOString() ?? null,
            createdAt: i.createdAt.toISOString(),
        })),
    };
}

type BookingsQuery = {
    page?: unknown;
    limit?: unknown;
    status?: unknown;
    search?: unknown;
};

export class AdminBookingsService {
    static async list(query: BookingsQuery, lang: Lang) {
        const { page, limit, skip, take } = parsePaginationQuery(query.page, query.limit);
        const statusRaw = firstQueryString(query.status)?.trim().toUpperCase();
        const search = firstQueryString(query.search)?.trim();

        const validStatuses = Object.values(BookingStatus) as string[];
        const statusFilter =
            statusRaw && validStatuses.includes(statusRaw)
                ? (statusRaw as BookingStatus)
                : undefined;

        const where: any = {
            ...(statusFilter ? { status: statusFilter } : {}),
            ...(search
                ? {
                      OR: [
                          { publicId: { contains: search, mode: "insensitive" } },
                          {
                              customerProfile: {
                                  fullName: { contains: search, mode: "insensitive" },
                              },
                          },
                          {
                              providerProfile: {
                                  businessProfile: {
                                      businessName: { contains: search, mode: "insensitive" },
                                  },
                              },
                          },
                      ],
                  }
                : {}),
        };

        const [bookings, total] = await Promise.all([
            prisma.booking.findMany({
                where,
                include: bookingInclude,
                orderBy: { createdAt: "desc" },
                skip,
                take,
            }),
            prisma.booking.count({ where }),
        ]);

        return {
            items: bookings.map(formatBooking),
            meta: buildPaginationMeta(page, limit, total),
        };
    }

    static async getById(id: string, lang: Lang) {
        const booking = await prisma.booking.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
            include: bookingInclude,
        });
        if (!booking) throw new NotFoundException(t("ERROR_NOT_FOUND", lang));
        return formatBooking(booking);
    }
}
