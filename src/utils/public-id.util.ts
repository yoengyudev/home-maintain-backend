import { prisma } from "../database/prisma.client";

/**
 * Generates the next public id for a prefix, e.g. BK-2026-008, ADDR-004.
 */
export async function nextPublicId(
    prefix: string,
    model:
        | "booking"
        | "customerAddress"
        | "bookingStatusHistory"
        | "bookingTimelineItem"
        | "review"
        | "notification"
): Promise<string> {
    const year = new Date().getFullYear();
    const yearPrefix = `${prefix}-${year}-`;

    let lastPublicId: string | null = null;

    if (model === "booking") {
        const last = await prisma.booking.findFirst({
            where: { publicId: { startsWith: yearPrefix } },
            orderBy: { publicId: "desc" },
            select: { publicId: true },
        });
        lastPublicId = last?.publicId ?? null;
    } else if (model === "customerAddress") {
        const last = await prisma.customerAddress.findFirst({
            where: { publicId: { startsWith: `${prefix}-` } },
            orderBy: { publicId: "desc" },
            select: { publicId: true },
        });
        lastPublicId = last?.publicId ?? null;
    } else if (model === "bookingStatusHistory") {
        const last = await prisma.bookingStatusHistory.findFirst({
            where: { publicId: { startsWith: yearPrefix } },
            orderBy: { publicId: "desc" },
            select: { publicId: true },
        });
        lastPublicId = last?.publicId ?? null;
    } else if (model === "bookingTimelineItem") {
        const last = await prisma.bookingTimelineItem.findFirst({
            where: { publicId: { startsWith: yearPrefix } },
            orderBy: { publicId: "desc" },
            select: { publicId: true },
        });
        lastPublicId = last?.publicId ?? null;
    } else if (model === "review") {
        const last = await prisma.review.findFirst({
            where: { publicId: { startsWith: yearPrefix } },
            orderBy: { publicId: "desc" },
            select: { publicId: true },
        });
        lastPublicId = last?.publicId ?? null;
    } else {
        const last = await prisma.notification.findFirst({
            where: { publicId: { startsWith: yearPrefix } },
            orderBy: { publicId: "desc" },
            select: { publicId: true },
        });
        lastPublicId = last?.publicId ?? null;
    }

    if (model === "customerAddress") {
        const match = lastPublicId?.match(/(\d+)$/);
        const next = (match ? Number(match[1]) : 0) + 1;
        return `${prefix}-${String(next).padStart(3, "0")}`;
    }

    const match = lastPublicId?.match(/(\d+)$/);
    const next = (match ? Number(match[1]) : 0) + 1;
    return `${yearPrefix}${String(next).padStart(3, "0")}`;
}
