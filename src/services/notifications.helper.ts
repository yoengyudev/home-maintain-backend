import { prisma } from "../database/prisma.client";
import {
    AccountStatus,
    NotificationStatus,
    NotificationType,
    UserRole,
} from "../generated/prisma/enums";
import { nextPublicId } from "../utils/public-id.util";
import { sendPushToUserSafe } from "./fcm-push.service";
import { broadcastRealtimeNotification } from "../websocket/booking-ws";
import { telegramQueueService } from "./telegram/queue/telegram-queue.service";
import { TelegramAccountService } from "./telegram/telegram-account.service";
import { GenericTelegramTemplate } from "./telegram/templates";
import { Env } from "../config/env.config";

export type NotificationCopy = {
    titleEn: string;
    titleKm: string;
    messageEn: string;
    messageKm: string;
};

export type NotifyPayload = NotificationCopy & {
    type?: NotificationType;
    priority?: string | null;
    relatedModule?: string | null;
    relatedRecordId?: string | null;
    relatedRoute?: string | null;
};

/**
 * Reusable bilingual (en + kh) notification + FCM push.
 * Call `notifyUser` / `notifyAdmins` from any service.
 */
export class NotificationsHelper {
    static async notifyUser(userId: string, payload: NotifyPayload) {
        if (!userId) return null;
        try {
            const [notification] = await this.notifyMany([userId], payload);
            return notification ?? null;
        } catch (error) {
            console.error("[Notifications] failed to notify user", userId, error);
            return null;
        }
    }

    static async notifyAdmins(payload: NotifyPayload) {
        try {
            const admins = await prisma.user.findMany({
                where: {
                    role: UserRole.ADMIN,
                    accountStatus: AccountStatus.ACTIVE,
                },
                select: { id: true },
            });
            return this.notifyMany(
                admins.map((admin) => admin.id),
                payload
            );
        } catch (error) {
            console.error("[Notifications] failed to notify admins", error);
            return [];
        }
    }

    static async notifyMany(userIds: string[], payload: NotifyPayload) {
        const uniqueIds = [...new Set(userIds.filter(Boolean))];
        const created = [];
        for (const userId of uniqueIds) {
            created.push(await this.createOne(userId, payload));
        }
        return created;
    }

    private static async createOne(userId: string, payload: NotifyPayload) {
        const publicId = await nextPublicId("NTF", "notification");
        const type = payload.type ?? NotificationType.SYSTEM;
        const relatedModule = payload.relatedModule ?? null;
        const relatedRoute = payload.relatedRoute ?? null;

        const notification = await prisma.notification.create({
            data: {
                publicId,
                userId,
                type,
                status: NotificationStatus.UNREAD,
                titleEn: payload.titleEn,
                titleKm: payload.titleKm,
                messageEn: payload.messageEn,
                messageKm: payload.messageKm,
                priority: payload.priority ?? null,
                relatedModule,
                relatedRecordId: payload.relatedRecordId ?? null,
                relatedRoute,
            },
        });

        const preference = await prisma.userPreference.findUnique({
            where: { userId },
            select: { language: true },
        });
        const isKm = preference?.language === "KM";
        const title = isKm ? payload.titleKm : payload.titleEn;
        const body = isKm ? payload.messageKm : payload.messageEn;

        sendPushToUserSafe(userId, {
            title,
            body,
            data: {
                notificationPublicId: notification.publicId,
                relatedModule: relatedModule ?? "",
                relatedRecordId: payload.relatedRecordId ?? "",
                url: relatedRoute || "/notifications",
                type: String(type),
                titleEn: payload.titleEn,
                titleKm: payload.titleKm,
                messageEn: payload.messageEn,
                messageKm: payload.messageKm,
            },
        });

        try {
            broadcastRealtimeNotification(notification);
        } catch {
            // Ignore broadcast failure
        }

        // Automatic Telegram Channel Delivery
        try {
            const chatIds = await TelegramAccountService.getConnectedChatIdsForUser(userId);
            const fullActionUrl = relatedRoute
                ? relatedRoute.startsWith("http")
                    ? relatedRoute
                    : `${Env.FRONTEND_ORIGIN?.split(",")[0] || "http://localhost:3000"}${relatedRoute}`
                : undefined;

            for (const chatId of chatIds) {
                const genericMsg = GenericTelegramTemplate.format(
                    {
                        titleEn: payload.titleEn,
                        titleKm: payload.titleKm,
                        messageEn: payload.messageEn,
                        messageKm: payload.messageKm,
                        type: String(type),
                        relatedModule,
                        relatedRecordId: payload.relatedRecordId ?? null,
                        actionUrl: fullActionUrl,
                    },
                    "en"
                );
                telegramQueueService.enqueueMessage(chatId, genericMsg.text, {
                    parse_mode: "HTML",
                    reply_markup: genericMsg.replyMarkup,
                });
            }
        } catch (tgErr) {
            console.warn("[Notifications] Telegram dispatch warning:", tgErr);
        }

        return notification;
    }
}

export const VerificationNotificationCopy = {
    submitted(businessName: string): NotificationCopy {
        const name = businessName.trim() || "A provider";
        return {
            titleEn: "New verification submitted",
            titleKm: "មានសំណើផ្ទៀងផ្ទាត់ថ្មី",
            messageEn: `${name} submitted a verification for review.`,
            messageKm: `${name} បានដាក់ស្នើការផ្ទៀងផ្ទាត់សម្រាប់ពិនិត្យ។`,
        };
    },

    resubmitted(businessName: string): NotificationCopy {
        const name = businessName.trim() || "A provider";
        return {
            titleEn: "Verification resubmitted",
            titleKm: "សំណើផ្ទៀងផ្ទាត់ត្រូវបានដាក់ស្នើឡើងវិញ",
            messageEn: `${name} submitted the requested verification changes.`,
            messageKm: `${name} បានដាក់ស្នើការផ្ទៀងផ្ទាត់ឡើងវិញតាមការស្នើសុំកែប្រែ។`,
        };
    },

    approved(): NotificationCopy {
        return {
            titleEn: "Verification approved",
            titleKm: "ការផ្ទៀងផ្ទាត់ត្រូវបានអនុម័ត",
            messageEn: "Your provider account has been approved. You can now receive bookings.",
            messageKm: "គណនីអ្នកផ្តល់សេវារបស់អ្នកត្រូវបានអនុម័ត។ ឥឡូវអ្នកអាចទទួលការកក់បាន។",
        };
    },

    rejected(reason?: string): NotificationCopy {
        const detail = reason?.trim();
        return {
            titleEn: "Verification rejected",
            titleKm: "ការផ្ទៀងផ្ទាត់ត្រូវបានបដិសេធ",
            messageEn: detail
                ? `Your verification was rejected. ${detail}`
                : "Your verification was rejected. Please review the admin notes and submit again.",
            messageKm: detail
                ? `ការផ្ទៀងផ្ទាត់របស់អ្នកត្រូវបានបដិសេធ។ ${detail}`
                : "ការផ្ទៀងផ្ទាត់របស់អ្នកត្រូវបានបដិសេធ។ សូមពិនិត្យមតិរបស់អ្នកគ្រប់គ្រង រួចដាក់ស្នើឡើងវិញ។",
        };
    },

    changesRequired(reason?: string): NotificationCopy {
        const detail = reason?.trim();
        return {
            titleEn: "Verification changes required",
            titleKm: "ត្រូវការកែប្រែការផ្ទៀងផ្ទាត់",
            messageEn: detail
                ? `An admin requested changes to your verification. ${detail}`
                : "An admin requested changes to your verification. Please update and resubmit.",
            messageKm: detail
                ? `អ្នកគ្រប់គ្រងបានស្នើសុំឱ្យអ្នកកែប្រែការផ្ទៀងផ្ទាត់។ ${detail}`
                : "អ្នកគ្រប់គ្រងបានស្នើសុំឱ្យអ្នកកែប្រែការផ្ទៀងផ្ទាត់។ សូមធ្វើបច្ចុប្បន្នភាព រួចដាក់ស្នើឡើងវិញ។",
        };
    },
};

type BookingCopyCtx = {
    bookingPublicId: string;
    serviceName?: string;
    providerName?: string;
    customerName?: string;
    scheduledDate?: string;
    timeSlot?: string;
    reason?: string;
};

function bookingLabel(ctx: BookingCopyCtx) {
    return ctx.bookingPublicId || "booking";
}

function scheduleLabel(ctx: BookingCopyCtx) {
    if (ctx.scheduledDate && ctx.timeSlot) return `${ctx.scheduledDate} (${ctx.timeSlot})`;
    return ctx.scheduledDate || ctx.timeSlot || "";
}

export const BookingNotificationCopy = {
    createdForCustomer(ctx: BookingCopyCtx): NotificationCopy {
        const provider = ctx.providerName?.trim() || "Your provider";
        const service = ctx.serviceName?.trim() || "your service";
        const when = scheduleLabel(ctx);
        return {
            titleEn: "Booking Placed Successfully",
            titleKm: "ការកក់ទទួលបានជោគជ័យ",
            messageEn: when
                ? `Your booking for ${service} with ${provider} on ${when} has been placed successfully.`
                : `Your booking for ${service} with ${provider} has been placed successfully.`,
            messageKm: when
                ? `ការកក់សេវាកម្ម ${service} ជាមួយ ${provider} នៅ ${when} ត្រូវបានដាក់ស្នើដោយជោគជ័យ។`
                : `ការកក់សេវាកម្ម ${service} ជាមួយ ${provider} ត្រូវបានដាក់ស្នើដោយជោគជ័យ។`,
        };
    },

    createdForVendor(ctx: BookingCopyCtx): NotificationCopy {
        const customer = ctx.customerName?.trim() || "A customer";
        const service = ctx.serviceName?.trim() || "a service";
        const when = scheduleLabel(ctx);
        return {
            titleEn: "New booking request",
            titleKm: "សំណើកក់ថ្មី",
            messageEn: when
                ? `${customer} requested ${service} on ${when}.`
                : `${customer} requested ${service}.`,
            messageKm: when
                ? `${customer} បានស្នើសុំ ${service} នៅ ${when}។`
                : `${customer} បានស្នើសុំ ${service}។`,
        };
    },

    cancelledForCustomer(ctx: BookingCopyCtx): NotificationCopy {
        return {
            titleEn: "Booking cancelled",
            titleKm: "ការកក់ត្រូវបានលុបចោល",
            messageEn: `Your booking ${bookingLabel(ctx)} was cancelled.`,
            messageKm: `ការកក់ ${bookingLabel(ctx)} របស់អ្នកត្រូវបានលុបចោល។`,
        };
    },

    cancelledForVendor(ctx: BookingCopyCtx): NotificationCopy {
        const customer = ctx.customerName?.trim() || "A customer";
        const service = ctx.serviceName?.trim() || "a booking";
        return {
            titleEn: "Booking cancelled",
            titleKm: "ការកក់ត្រូវបានលុបចោល",
            messageEn: `${customer} cancelled ${service} (${bookingLabel(ctx)}).`,
            messageKm: `${customer} បានលុបចោល ${service} (${bookingLabel(ctx)})។`,
        };
    },

    rescheduledForCustomer(ctx: BookingCopyCtx): NotificationCopy {
        const when = scheduleLabel(ctx);
        return {
            titleEn: "Booking rescheduled",
            titleKm: "ការកក់ត្រូវបានកំណត់ពេលឡើងវិញ",
            messageEn: when
                ? `Your booking ${bookingLabel(ctx)} was rescheduled to ${when}.`
                : `Your booking ${bookingLabel(ctx)} was rescheduled.`,
            messageKm: when
                ? `ការកក់ ${bookingLabel(ctx)} ត្រូវបានកំណត់ពេលឡើងវិញទៅ ${when}។`
                : `ការកក់ ${bookingLabel(ctx)} ត្រូវបានកំណត់ពេលឡើងវិញ។`,
        };
    },

    rescheduledForVendor(ctx: BookingCopyCtx): NotificationCopy {
        const customer = ctx.customerName?.trim() || "A customer";
        const when = scheduleLabel(ctx);
        return {
            titleEn: "Booking rescheduled",
            titleKm: "ការកក់ត្រូវបានកំណត់ពេលឡើងវិញ",
            messageEn: when
                ? `${customer} rescheduled ${bookingLabel(ctx)} to ${when}.`
                : `${customer} rescheduled ${bookingLabel(ctx)}.`,
            messageKm: when
                ? `${customer} បានកំណត់ពេល ${bookingLabel(ctx)} ឡើងវិញទៅ ${when}។`
                : `${customer} បានកំណត់ពេល ${bookingLabel(ctx)} ឡើងវិញ។`,
        };
    },

    acceptedForCustomer(ctx: BookingCopyCtx): NotificationCopy {
        return {
            titleEn: "Booking accepted",
            titleKm: "ការកក់ត្រូវបានទទួលយក",
            messageEn: `Your provider accepted booking ${bookingLabel(ctx)} and will arrive at the scheduled time.`,
            messageKm: `អ្នកផ្តល់សេវាបានទទួលយកការកក់ ${bookingLabel(ctx)} ហើយនឹងមកដល់តាមពេលកំណត់។`,
        };
    },

    rejectedForCustomer(ctx: BookingCopyCtx): NotificationCopy {
        const detail = ctx.reason?.trim();
        return {
            titleEn: "Booking rejected",
            titleKm: "ការកក់ត្រូវបានបដិសេធ",
            messageEn: detail
                ? `Your booking ${bookingLabel(ctx)} was declined. ${detail}`
                : `Your booking ${bookingLabel(ctx)} was declined.`,
            messageKm: detail
                ? `ការកក់ ${bookingLabel(ctx)} របស់អ្នកត្រូវបានបដិសេធ។ ${detail}`
                : `ការកក់ ${bookingLabel(ctx)} របស់អ្នកត្រូវបានបដិសេធ។`,
        };
    },

    startedForCustomer(ctx: BookingCopyCtx): NotificationCopy {
        return {
            titleEn: "Service started",
            titleKm: "សេវាកម្មបានចាប់ផ្តើម",
            messageEn: `Your provider has started the service for ${bookingLabel(ctx)}.`,
            messageKm: `អ្នកផ្តល់សេវាបានចាប់ផ្តើមការងារសម្រាប់ ${bookingLabel(ctx)}។`,
        };
    },

    completedForCustomer(ctx: BookingCopyCtx): NotificationCopy {
        return {
            titleEn: "Service completed",
            titleKm: "សេវាកម្មបានបញ្ចប់",
            messageEn: `Booking ${bookingLabel(ctx)} was marked complete. You can leave a review.`,
            messageKm: `ការកក់ ${bookingLabel(ctx)} ត្រូវបានបញ្ចប់។ អ្នកអាចវាយតម្លៃបាន។`,
        };
    },

    reviewedForCustomer(ctx: BookingCopyCtx): NotificationCopy {
        const provider = ctx.providerName?.trim() || "your provider";
        return {
            titleEn: "Review submitted",
            titleKm: "បានដាក់ការវាយតម្លៃ",
            messageEn: `Thanks for reviewing ${provider}. Your feedback helps other customers.`,
            messageKm: `អរគុណសម្រាប់ការវាយតម្លៃ ${provider}។ មតិរបស់អ្នកជួយអតិថិជនផ្សេងទៀត។`,
        };
    },

    reviewedForVendor(ctx: BookingCopyCtx): NotificationCopy {
        const customer = ctx.customerName?.trim() || "A customer";
        const service = ctx.serviceName?.trim() || "your service";
        return {
            titleEn: "New review received",
            titleKm: "បានទទួលការវាយតម្លៃថ្មី",
            messageEn: `${customer} left a review for ${service} (${bookingLabel(ctx)}).`,
            messageKm: `${customer} បានវាយតម្លៃ ${service} (${bookingLabel(ctx)})។`,
        };
    },
};

export const InvoiceNotificationCopy = {
    generatedForVendor(invoiceNumber: string, amount: number): NotificationCopy {
        return {
            titleEn: "New invoice issued",
            titleKm: "វិក្កយបត្រថ្មីត្រូវបានចេញ",
            messageEn: `Invoice ${invoiceNumber} for $${amount.toFixed(2)} platform service fee has been issued.`,
            messageKm: `វិក្កយបត្រ ${invoiceNumber} ចំនួន $${amount.toFixed(2)} សម្រាប់កម្រៃសេវាប្រព័ន្ធត្រូវបានចេញ។`,
        };
    },
    paidForVendor(invoiceNumber: string, amount: number): NotificationCopy {
        return {
            titleEn: "Invoice payment confirmed",
            titleKm: "ការទូទាត់វិក្កយបត្រត្រូវបានបញ្ជាក់",
            messageEn: `Payment for invoice ${invoiceNumber} ($${amount.toFixed(2)}) has been confirmed.`,
            messageKm: `ការទូទាត់សម្រាប់វិក្កយបត្រ ${invoiceNumber} ($${amount.toFixed(2)}) ត្រូវបានបញ្ជាក់រួចរាល់។`,
        };
    },
    paymentSubmittedForAdmin(providerName: string, invoiceNumber: string, amount: number): NotificationCopy {
        return {
            titleEn: "Invoice payment proof submitted",
            titleKm: "បានបញ្ជូនភស្តុតាងទូទាត់វិក្កយបត្រ",
            messageEn: `${providerName} submitted payment proof for invoice ${invoiceNumber} ($${amount.toFixed(2)}). Please verify and confirm.`,
            messageKm: `${providerName} បានបញ្ជូនភស្តុតាងទូទាត់សម្រាប់វិក្កយបត្រ ${invoiceNumber} ($${amount.toFixed(2)})។ សូមពិនិត្យផ្ទៀងផ្ទាត់។`,
        };
    },
};

