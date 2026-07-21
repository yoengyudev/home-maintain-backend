import { prisma } from "../../database/prisma.client";
import {
    NotificationStatus,
    NotificationType,
} from "../../generated/prisma/enums";
import { nextPublicId } from "../../utils/public-id.util";
import { sendPushToUserSafe } from "../fcm-push.service";

type CreateNotificationInput = {
    userId: string;
    type?: NotificationType;
    titleEn: string;
    titleKm?: string | null;
    messageEn: string;
    messageKm?: string | null;
    priority?: string | null;
    relatedModule?: string | null;
    relatedRecordId?: string | null;
    relatedRoute?: string | null;
};

export class CustomerNotificationsHelper {
    static async create(input: CreateNotificationInput) {
        const publicId = await nextPublicId("NTF", "notification");

        const notification = await prisma.notification.create({
            data: {
                publicId,
                userId: input.userId,
                type: input.type ?? NotificationType.BOOKING,
                status: NotificationStatus.UNREAD,
                titleEn: input.titleEn,
                titleKm: input.titleKm ?? null,
                messageEn: input.messageEn,
                messageKm: input.messageKm ?? null,
                priority: input.priority ?? null,
                relatedModule: input.relatedModule ?? "booking",
                relatedRecordId: input.relatedRecordId ?? null,
                relatedRoute: input.relatedRoute ?? null,
            },
        });

        const route = input.relatedRoute || "/notifications";
        sendPushToUserSafe(input.userId, {
            title: input.titleEn,
            body: input.messageEn,
            data: {
                notificationPublicId: notification.publicId,
                relatedModule: input.relatedModule ?? "booking",
                relatedRecordId: input.relatedRecordId ?? "",
                url: route,
                type: String(input.type ?? NotificationType.BOOKING),
            },
        });

        return notification;
    }

    static format(
        notification: {
            id: string;
            publicId: string;
            type: NotificationType;
            status: NotificationStatus;
            titleEn: string;
            titleKm: string | null;
            messageEn: string;
            messageKm: string | null;
            priority: string | null;
            relatedModule: string | null;
            relatedRecordId: string | null;
            relatedRoute: string | null;
            readAt: Date | null;
            createdAt: Date;
        },
        lang: "en" | "kh"
    ) {
        const isKh = lang === "kh";
        const title = isKh && notification.titleKm ? notification.titleKm : notification.titleEn;
        const message =
            isKh && notification.messageKm ? notification.messageKm : notification.messageEn;
        const bookingId =
            notification.relatedModule === "booking" ? notification.relatedRecordId : null;

        return {
            id: notification.id,
            publicId: notification.publicId,
            type: notification.type,
            status: notification.status,
            unread: notification.status === NotificationStatus.UNREAD,
            title,
            message,
            titleEn: notification.titleEn,
            titleKm: notification.titleKm,
            messageEn: notification.messageEn,
            messageKm: notification.messageKm,
            priority: notification.priority,
            relatedModule: notification.relatedModule,
            relatedRecordId: notification.relatedRecordId,
            relatedRoute: notification.relatedRoute,
            bookingId,
            /** @deprecated prefer bookingId — kept for older clients */
            bookingPublicId: bookingId,
            readAt: notification.readAt?.toISOString() ?? null,
            createdAt: notification.createdAt.toISOString(),
        };
    }
}
