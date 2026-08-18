import { prisma } from '../../database/prisma.client';
import { InvoiceStatus, NotificationType, AccountStatus } from '../../generated/prisma/enums';
import { NotificationDispatcher } from '../notifications/dispatcher.service';
import { Env } from '../../config/env.config';
import { logger } from '../../utils/logger.util';

export class InvoiceOverdueAlertService {
  private static intervalTimer: NodeJS.Timeout | null = null;
  private static isRunning = false;

  /**
   * Check all unpaid invoices whose due date has passed, and send
   * an alert every 24 hours across in-app, push, and Telegram.
   */
  public static async checkAndSendAlerts(): Promise<{ checked: number; alerted: number }> {
    if (this.isRunning) {
      return { checked: 0, alerted: 0 };
    }

    this.isRunning = true;
    let alertedCount = 0;

    try {
      const now = new Date();

      // Find all unpaid invoices where due date is in the past
      const overdueInvoices = await prisma.providerInvoice.findMany({
        where: {
          status: InvoiceStatus.UNPAID,
          dueAt: {
            not: null,
            lt: now,
          },
        },
        include: {
          providerProfile: {
            include: {
              user: {
                select: {
                  id: true,
                  accountStatus: true,
                },
              },
              businessProfile: {
                select: {
                  businessName: true,
                },
              },
            },
          },
        },
        orderBy: { dueAt: 'asc' },
      });

      const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

      for (const invoice of overdueInvoices) {
        const user = invoice.providerProfile?.user;
        if (!user || user.accountStatus !== AccountStatus.ACTIVE) {
          continue;
        }

        // Check when the last overdue alert was sent for this invoice
        const lastAlert = await prisma.notification.findFirst({
          where: {
            userId: user.id,
            relatedRecordId: invoice.id,
            relatedModule: 'COMMISSION_INVOICE_OVERDUE',
          },
          orderBy: { createdAt: 'desc' },
        });

        if (lastAlert) {
          const timeSinceLastAlert = Date.now() - new Date(lastAlert.createdAt).getTime();
          if (timeSinceLastAlert < TWENTY_FOUR_HOURS_MS) {
            // Alert was already sent in the last 24h, skip
            continue;
          }
        }

        // Calculate days overdue
        const dueDate = invoice.dueAt ? new Date(invoice.dueAt) : now;
        const daysOverdue = Math.max(
          1,
          Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        );

        const baseUrl = (Env.FRONTEND_ORIGIN || 'http://localhost:3000').split(',')[0].trim();
        const actionUrl = `${baseUrl}/provider/commission/invoices/${invoice.publicId || invoice.id}`;
        const providerName =
          invoice.providerProfile.businessProfile?.businessName ||
          invoice.providerProfile.contactName ||
          'Provider';

        // Dispatch to all active channels (In-App DB, FCM Push, WebSocket, and Telegram)
        await NotificationDispatcher.dispatch({
          userId: user.id,
          type: NotificationType.SYSTEM,
          priority: 'HIGH',
          relatedModule: 'COMMISSION_INVOICE_OVERDUE',
          relatedRecordId: invoice.id,
          relatedRoute: `/provider/commission/invoices/${invoice.publicId || invoice.id}`,
          titleEn: `⚠️ Urgent: Commission Invoice ${invoice.invoiceNumber} is Overdue`,
          titleKm: `⚠️ បន្ទាន់៖ វិក្កយបត្រកម្រៃសេវា ${invoice.invoiceNumber} បានហួសកាលកំណត់`,
          messageEn: `Your platform service fee of $${Number(invoice.totalCommission).toFixed(2)} is overdue by ${daysOverdue} day(s). Please settle payment immediately to maintain your active provider status.`,
          messageKm: `កម្រៃសេវាប្រព័ន្ធរបស់អ្នកចំនួន $${Number(invoice.totalCommission).toFixed(2)} បានហួសកាលកំណត់ ${daysOverdue} ថ្ងៃហើយ។ សូមមេត្តាធ្វើការទូទាត់ជាបន្ទាន់ដើម្បីរក្សាស្ថានភាពដំណើរការលើប្រព័ន្ធ។`,
          metadata: {
            invoiceId: invoice.id,
            publicId: invoice.publicId,
            invoiceNumber: invoice.invoiceNumber,
            providerName,
            totalCommission: Number(invoice.totalCommission),
            dueDate: invoice.dueAt ? new Date(invoice.dueAt).toISOString().split('T')[0] : undefined,
            daysOverdue,
            actionUrl,
          },
        });

        alertedCount++;
        logger.info(
          `[InvoiceOverdueAlertService] Sent 24h overdue alert for invoice ${invoice.invoiceNumber} (User: ${user.id}, Overdue: ${daysOverdue}d)`
        );
      }

      return { checked: overdueInvoices.length, alerted: alertedCount };
    } catch (error) {
      logger.error('[InvoiceOverdueAlertService] Failed to process overdue invoice alerts:', error);
      return { checked: 0, alerted: 0 };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start recurring background scheduler to monitor and send alerts every 24 hours.
   */
  public static startScheduler(intervalMs: number = 30 * 60 * 1000): void {
    if (this.intervalTimer) return;

    logger.info('[InvoiceOverdueAlertService] Starting 24h invoice overdue alert scheduler...');

    // Initial run on startup
    void this.checkAndSendAlerts();

    // Check periodically (e.g. every 30 minutes) to send alerts to invoices reaching the 24h window
    this.intervalTimer = setInterval(() => {
      void this.checkAndSendAlerts();
    }, intervalMs);
  }

  public static stopScheduler(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
      logger.info('[InvoiceOverdueAlertService] Stopped invoice overdue alert scheduler.');
    }
  }
}
