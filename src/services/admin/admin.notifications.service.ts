import { prisma } from "../../database/prisma.client";
import { NotFoundException } from "../../utils/app-error.util";
import {
    buildPaginationMeta,
    parsePaginationQuery,
} from "../../utils/pagination.util";
import { NotificationStatus, UserRole } from "../../generated/prisma/enums";
import type { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";

function formatNotification(n: any) {
    return {
        id: n.id,
        publicId: n.publicId,
        type: n.type,
        status: n.status,
        titleEn: n.titleEn,
        titleKm: n.titleKm,
        messageEn: n.messageEn,
        messageKm: n.messageKm,
        priority: n.priority,
        relatedModule: n.relatedModule,
        relatedRecordId: n.relatedRecordId,
        relatedRoute: n.relatedRoute,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
    };
}

type NotificationsQuery = { page?: unknown; limit?: unknown };

export class AdminNotificationsService {
    static async list(userId: string, query: NotificationsQuery, lang: Lang) {
        const { page, limit, skip, take } = parsePaginationQuery(query.page, query.limit);

        const [notifications, total] = await Promise.all([
            prisma.notification.findMany({
                where: { userId },
                orderBy: { createdAt: "desc" },
                skip,
                take,
            }),
            prisma.notification.count({ where: { userId } }),
        ]);

        return {
            items: notifications.map(formatNotification),
            meta: buildPaginationMeta(page, limit, total),
        };
    }

    static async unreadCount(userId: string) {
        const count = await prisma.notification.count({
            where: { userId, status: NotificationStatus.UNREAD },
        });
        return { count };
    }

    static async markRead(userId: string, notificationId: string, lang: Lang) {
        const notification = await prisma.notification.findFirst({
            where: { OR: [{ id: notificationId }, { publicId: notificationId }], userId },
        });
        if (!notification) throw new NotFoundException(t("ERROR_NOT_FOUND", lang));

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
    }
}
