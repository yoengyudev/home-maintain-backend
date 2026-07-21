import { prisma } from "../../database/prisma.client";
import type { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";
import { NotFoundException } from "../../utils/app-error.util";
import {
    buildPaginationMeta,
    firstQueryString,
    parsePaginationQuery,
} from "../../utils/pagination.util";
import { NotificationStatus } from "../../generated/prisma/enums";
import { CustomerNotificationsHelper } from "./customer.notifications.helper";

type NotificationsQuery = {
    page?: unknown;
    limit?: unknown;
    status?: unknown;
};

export class CustomerNotificationsService {
    static async list(userId: string, query: NotificationsQuery, lang: Lang) {
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
            data: rows.map((row) => CustomerNotificationsHelper.format(row, lang)),
            meta: buildPaginationMeta(page, limit, total),
        };
    }

    static async unreadCount(userId: string) {
        const count = await prisma.notification.count({
            where: { userId, status: NotificationStatus.UNREAD },
        });
        return { count };
    }

    static async markRead(userId: string, id: string, lang: Lang) {
        const notification = await prisma.notification.findFirst({
            where: {
                userId,
                OR: [{ id }, { publicId: id }],
            },
        });

        if (!notification) {
            throw new NotFoundException(t("CUSTOMER_NOTIFICATION_NOT_FOUND", lang));
        }

        if (notification.status === NotificationStatus.READ) {
            return CustomerNotificationsHelper.format(notification, lang);
        }

        const updated = await prisma.notification.update({
            where: { id: notification.id },
            data: {
                status: NotificationStatus.READ,
                readAt: new Date(),
            },
        });

        return CustomerNotificationsHelper.format(updated, lang);
    }

    static async markAllRead(userId: string, lang: Lang) {
        await prisma.notification.updateMany({
            where: { userId, status: NotificationStatus.UNREAD },
            data: {
                status: NotificationStatus.READ,
                readAt: new Date(),
            },
        });

        const unread = await this.unreadCount(userId);
        return {
            ...unread,
            message: t("CUSTOMER_NOTIFICATIONS_MARKED_READ_SUCCESSFULLY", lang),
        };
    }
}
