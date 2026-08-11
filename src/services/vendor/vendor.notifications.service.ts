import { prisma } from "../../database/prisma.client";
import {
    buildPaginationMeta,
    firstQueryString,
    parsePaginationQuery,
} from "../../utils/pagination.util";
import { NotificationStatus } from "../../generated/prisma/enums";
import type { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";
import { NotFoundException } from "../../utils/app-error.util";

type NotificationsQuery = {
    page?: unknown;
    limit?: unknown;
    status?: unknown;
};

const TYPE_UI: Record<string, "request" | "booking" | "review" | "verification"> = {
    BOOKING: "booking",
    VERIFICATION: "verification",
    PROVIDER: "request",
    CUSTOMER: "request",
    SERVICE: "booking",
};

function formatNotification(row: {
    id: string;
    publicId: string;
    type: string;
    status: NotificationStatus;
    titleEn: string;
    titleKm: string | null;
    messageEn: string;
    messageKm: string | null;
    priority: string | null;
    relatedRecordId: string | null;
    createdAt: Date;
}) {
    return {
        id: row.publicId || row.id,
        title: row.titleEn,
        titleKm: row.titleKm || row.titleEn,
        message: row.messageEn,
        messageKm: row.messageKm || row.messageEn,
        timestamp: row.createdAt.toISOString(),
        read: row.status === NotificationStatus.READ,
        type: TYPE_UI[row.type] || "booking",
        targetId: row.relatedRecordId || undefined,
        priority: row.priority || "Normal",
    };
}

export class VendorNotificationsService {
    static async list(userId: string, query: NotificationsQuery) {
        const { page, limit, skip, take } = parsePaginationQuery(query.page, query.limit);
        const statusRaw = firstQueryString(query.status)?.trim().toUpperCase();
        const statusFilter =
            statusRaw === "UNREAD" || statusRaw === "READ"
                ? (statusRaw as NotificationStatus)
                : undefined;

        const where = {
            userId,
            ...(statusFilter ? { status: statusFilter } : {}),
        };

        const [rows, total] = await Promise.all([
            prisma.notification.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: "desc" },
            }),
            prisma.notification.count({ where }),
        ]);

        return {
            items: rows.map(formatNotification),
            meta: buildPaginationMeta(page, limit, total),
        };
    }

    static async markRead(userId: string, id: string, lang: Lang) {
        const notification = await prisma.notification.findFirst({
            where: {
                userId,
                OR: [{ id }, { publicId: id }],
            },
        });

        if (!notification) {
            throw new NotFoundException(t("VENDOR_NOTIFICATION_NOT_FOUND", lang));
        }

        if (notification.status === NotificationStatus.READ) {
            return formatNotification(notification);
        }

        const updated = await prisma.notification.update({
            where: { id: notification.id },
            data: {
                status: NotificationStatus.READ,
                readAt: new Date(),
            },
        });

        return formatNotification(updated);
    }

    static async markAllRead(userId: string) {
        await prisma.notification.updateMany({
            where: { userId, status: NotificationStatus.UNREAD },
            data: {
                status: NotificationStatus.READ,
                readAt: new Date(),
            },
        });

        const count = await prisma.notification.count({
            where: { userId, status: NotificationStatus.UNREAD },
        });

        return { count };
    }
}
