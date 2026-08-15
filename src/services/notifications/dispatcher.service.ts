import { prisma } from '../../database/prisma.client';
import {
  NotificationType,
  NotificationStatus,
  UserRole,
  AccountStatus,
} from '../../generated/prisma/enums';
import { nextPublicId } from '../../utils/public-id.util';
import { sendPushToUserSafe } from '../fcm-push.service';
import { broadcastRealtimeNotification } from '../../websocket/booking-ws';
import { telegramQueueService } from '../telegram/queue/telegram-queue.service';
import { TelegramAccountService } from '../telegram/telegram-account.service';
import { Env } from '../../config/env.config';
import {
  BookingTelegramTemplate,
  InvoiceTelegramTemplate,
  VerificationTelegramTemplate,
  GenericTelegramTemplate,
} from '../telegram/templates';
import { logger } from '../../utils/logger.util';

export interface DispatchNotificationPayload {
  userId?: string;
  userIds?: string[];
  toAdmins?: boolean;
  type?: NotificationType;
  titleEn: string;
  titleKm?: string | null;
  messageEn: string;
  messageKm?: string | null;
  priority?: string;
  relatedModule?: string;
  relatedRecordId?: string;
  relatedRoute?: string;
  metadata?: Record<string, unknown>;
}

/**
 * NotificationDispatcher orchestrates multi-channel message delivery:
 * 1. In-App Database Notifications
 * 2. Real-time WebSocket Broadcast
 * 3. Firebase Cloud Messaging (FCM) Push
 * 4. Telegram Bot & Channel Delivery (Queue Worker)
 */
export class NotificationDispatcher {
  /**
   * Dispatch a notification to a single user or multiple users across all channels.
   */
  public static async dispatch(payload: DispatchNotificationPayload): Promise<void> {
    const targetUserIds: string[] = [];

    if (payload.userId) {
      targetUserIds.push(payload.userId);
    }
    if (payload.userIds && payload.userIds.length > 0) {
      targetUserIds.push(...payload.userIds);
    }

    if (payload.toAdmins) {
      try {
        const admins = await prisma.user.findMany({
          where: {
            role: UserRole.ADMIN,
            accountStatus: AccountStatus.ACTIVE,
          },
          select: { id: true },
        });
        targetUserIds.push(...admins.map((a) => a.id));
      } catch (err) {
        logger.error('[NotificationDispatcher] Failed to fetch admins:', err);
      }
    }

    const uniqueUserIds = Array.from(new Set(targetUserIds));

    // 1. Deliver to each recipient across channels
    for (const uid of uniqueUserIds) {
      void this.deliverToUser(uid, payload);
    }

    // 2. If toAdmins is requested, also check if there's a dedicated Admin Telegram Channel / Group
    if (payload.toAdmins && Env.TELEGRAM_DEFAULT_CHAT_ID) {
      this.deliverToTelegramChat(Env.TELEGRAM_DEFAULT_CHAT_ID, payload, 'en');
    }
  }

  private static async deliverToUser(userId: string, payload: DispatchNotificationPayload): Promise<void> {
    try {
      // 1. In-App Notification (Database)
      const publicId = await nextPublicId('NTF', 'notification');
      const notification = await prisma.notification.create({
        data: {
          publicId,
          userId,
          type: payload.type || NotificationType.SYSTEM,
          status: NotificationStatus.UNREAD,
          titleEn: payload.titleEn,
          titleKm: payload.titleKm || payload.titleEn,
          messageEn: payload.messageEn,
          messageKm: payload.messageKm || payload.messageEn,
          priority: payload.priority || 'NORMAL',
          relatedModule: payload.relatedModule,
          relatedRecordId: payload.relatedRecordId,
          relatedRoute: payload.relatedRoute,
        },
      });

      // 2. Real-time WebSocket Broadcast
      try {
        broadcastRealtimeNotification(notification);
      } catch {
        // Ignore WS errors
      }

      // Check User Preferences
      const preference = await prisma.userPreference.findUnique({
        where: { userId },
        select: { language: true, pushNotifications: true },
      });

      const isKm = preference?.language === 'KM';
      const userLang = isKm ? 'km' : 'en';
      const title = isKm ? payload.titleKm || payload.titleEn : payload.titleEn;
      const body = isKm ? payload.messageKm || payload.messageEn : payload.messageEn;

      // 3. Firebase Push Notification (if enabled)
      if (preference?.pushNotifications !== false) {
        sendPushToUserSafe(userId, {
          title,
          body,
          data: {
            notificationPublicId: notification.publicId,
            relatedModule: payload.relatedModule ?? '',
            relatedRecordId: payload.relatedRecordId ?? '',
            url: payload.relatedRoute || '/notifications',
            type: String(payload.type || NotificationType.SYSTEM),
            titleEn: payload.titleEn,
            titleKm: payload.titleKm || payload.titleEn,
            messageEn: payload.messageEn,
            messageKm: payload.messageKm || payload.messageEn,
          },
        });
      }

      // 4. Telegram Channel Delivery
      const chatIds = await TelegramAccountService.getConnectedChatIdsForUser(userId);
      for (const chatId of chatIds) {
        this.deliverToTelegramChat(chatId, payload, userLang);
      }
    } catch (error) {
      logger.error(`[NotificationDispatcher] Failed delivering to user ${userId}:`, error);
    }
  }

  private static deliverToTelegramChat(
    chatId: string | number,
    payload: DispatchNotificationPayload,
    _lang: 'en' | 'km' = 'en'
  ): void {
    try {
      const route = payload.relatedRoute;
      const fullActionUrl = route
        ? route.startsWith('http')
          ? route
          : `${Env.FRONTEND_ORIGIN?.split(',')[0] || 'http://localhost:3000'}${route}`
        : undefined;

      const meta = payload.metadata || {};

      // Select template based on related module or notification type
      if (payload.relatedModule === 'booking' || payload.type === NotificationType.BOOKING) {
        const msg = BookingTelegramTemplate.format(
          {
            bookingId: (meta.bookingId as string) || payload.relatedRecordId || 'Booking',
            publicId: (meta.publicId as string) || payload.relatedRecordId,
            serviceName: (meta.serviceName as string) || payload.titleEn,
            customerName: meta.customerName as string | undefined,
            providerName: meta.providerName as string | undefined,
            status: (meta.status as string) || 'UPDATED',
            date: meta.date as string | undefined,
            timeSlot: meta.timeSlot as string | undefined,
            address: meta.address as string | undefined,
            amount: typeof meta.amount === 'number' ? meta.amount : undefined,
            notes: meta.notes as string | undefined,
            actionUrl: fullActionUrl,
          },
          'en'
        );
        telegramQueueService.enqueueMessage(chatId, msg.text, {
          parse_mode: 'HTML',
          reply_markup: msg.replyMarkup,
        });
        return;
      }

      if (payload.relatedModule === 'COMMISSION_INVOICE') {
        const msg = InvoiceTelegramTemplate.formatGenerated(
          {
            invoiceNumber: (meta.invoiceNumber as string) || payload.relatedRecordId || 'Invoice',
            providerName: (meta.providerName as string) || 'Provider',
            totalVolume: (meta.totalVolume as number) || 0,
            totalCommission: (meta.totalCommission as number) || 0,
            dueDate: meta.dueDate as string | undefined,
            actionUrl: fullActionUrl,
          },
          'en'
        );
        telegramQueueService.enqueueMessage(chatId, msg.text, {
          parse_mode: 'HTML',
          reply_markup: msg.replyMarkup,
        });
        return;
      }

      if (payload.type === NotificationType.VERIFICATION) {
        const msg = VerificationTelegramTemplate.formatDecision(
          {
            status: ((meta.status as string) || 'APPROVED') as any,
            businessName: (meta.businessName as string) || 'Provider',
            reviewerNotes: meta.notes as string | undefined,
            actionUrl: fullActionUrl,
          },
          'en'
        );
        telegramQueueService.enqueueMessage(chatId, msg.text, {
          parse_mode: 'HTML',
          reply_markup: msg.replyMarkup,
        });
        return;
      }

      // Fallback Generic Template
      const genericMsg = GenericTelegramTemplate.format(
        {
          titleEn: payload.titleEn,
          titleKm: payload.titleKm,
          messageEn: payload.messageEn,
          messageKm: payload.messageKm,
          type: String(payload.type || 'SYSTEM'),
          relatedModule: payload.relatedModule,
          relatedRecordId: payload.relatedRecordId,
          actionUrl: fullActionUrl,
        },
        'en'
      );

      telegramQueueService.enqueueMessage(chatId, genericMsg.text, {
        parse_mode: 'HTML',
        reply_markup: genericMsg.replyMarkup,
      });
    } catch (err) {
      logger.warn(`[NotificationDispatcher] Telegram formatting failed for chatId ${chatId}:`, err);
    }
  }
}
