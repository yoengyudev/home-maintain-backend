import {
    NotificationStatus,
    NotificationType,
} from "../../generated/prisma/enums";
import { NotificationsHelper } from "../notifications.helper";

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
        return NotificationsHelper.notifyUser(input.userId, {
            type: input.type ?? NotificationType.BOOKING,
            titleEn: input.titleEn,
            titleKm: input.titleKm || input.titleEn,
            messageEn: input.messageEn,
            messageKm: input.messageKm || input.messageEn,
            priority: input.priority ?? null,
            relatedModule: input.relatedModule ?? "booking",
            relatedRecordId: input.relatedRecordId ?? null,
            relatedRoute: input.relatedRoute ?? null,
        });
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
