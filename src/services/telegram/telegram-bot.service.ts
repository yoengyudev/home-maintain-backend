import { Env } from '../../config/env.config';
import { logger } from '../../utils/logger.util';
import {
  TelegramApiResponse,
  TelegramMessage,
  TelegramUser,
  TelegramWebhookInfo,
  SendMessageOptions,
  SendPhotoOptions,
  SendDocumentOptions,
  TelegramInlineKeyboardMarkup,
  BookingTelegramPayload,
  InvoiceTelegramPayload,
  PaymentProofTelegramPayload,
  ProviderVerificationTelegramPayload,
  IncomingTelegramUpdate,
} from './telegram-bot.types';

/**
 * Reusable Telegram Bot Service for Home Maintain Backend
 * Provides comprehensive Telegram Bot API integration using native fetch.
 * 
 * Features:
 * - HTML message formatting & escaping
 * - Sending text messages, photos, documents, chat actions
 * - Interactive Inline Keyboard & URL button builders
 * - Pre-built rich templates (Bookings, Commission Invoices, Payment Slips, Verification)
 * - Webhook setup & inspection
 * - Safe error handling (won't crash the server if Telegram API is unreachable)
 */
export class TelegramBotService {
  private botToken: string;
  private defaultChatId: string;
  private apiBaseUrl: string;
  private isPolling = false;
  private lastUpdateId = 0;

  constructor(token?: string, defaultChatId?: string) {
    this.botToken = token || Env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
    this.defaultChatId = defaultChatId || Env.TELEGRAM_DEFAULT_CHAT_ID || process.env.TELEGRAM_DEFAULT_CHAT_ID || '';
    this.apiBaseUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  /**
   * Check if Telegram Bot token is configured
   */
  public isConfigured(): boolean {
    return Boolean(this.botToken && this.botToken.trim().length > 0);
  }

  /**
   * Dynamically update or set Bot Token
   */
  public setBotToken(token: string): void {
    this.botToken = token.trim();
    this.apiBaseUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  /**
   * Set default Chat ID / Admin Channel ID
   */
  public setDefaultChatId(chatId: string): void {
    this.defaultChatId = chatId.trim();
  }

  /**
   * Get default Chat ID
   */
  public getDefaultChatId(): string {
    return this.defaultChatId;
  }

  // ===========================================================================
  // Core HTTP Request Handler
  // ===========================================================================

  /**
   * Generic Telegram Bot API request runner
   */
  private async request<T>(
    endpoint: string,
    body?: Record<string, unknown> | FormData,
    timeoutMs = 10000
  ): Promise<TelegramApiResponse<T>> {
    if (!this.isConfigured()) {
      logger.warn(`[TelegramBot] Action '${endpoint}' skipped: TELEGRAM_BOT_TOKEN is not configured.`);
      return { ok: false, description: 'Telegram Bot Token not configured' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
      const response = await fetch(`${this.apiBaseUrl}/${endpoint}`, {
        method: 'POST',
        headers: isFormData
          ? undefined
          : {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
        body: isFormData ? body : JSON.stringify(body || {}),
        signal: controller.signal,
      });

      const data = (await response.json()) as TelegramApiResponse<T>;
      if (!data.ok) {
        logger.warn(`[TelegramBot] API error on '${endpoint}': ${data.description || 'Unknown error'}`);
      }
      return data;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`[TelegramBot] Request failed for '${endpoint}': ${msg}`);
      return { ok: false, description: msg };
    } finally {
      clearTimeout(timer);
    }
  }

  // ===========================================================================
  // Formatting & HTML Utility Helpers
  // ===========================================================================

  /**
   * Escape HTML entities for Telegram HTML parse_mode
   */
  public escapeHtml(text: string | number | boolean | null | undefined): string {
    if (text == null) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Build an inline keyboard markup object
   */
  public buildInlineKeyboard(
    buttons: Array<Array<{ text: string; url?: string; callback_data?: string }>>
  ): TelegramInlineKeyboardMarkup | undefined {
    const validRows = buttons
      .map((row) =>
        row.filter((btn) => {
          if (btn.callback_data) return true;
          if (btn.url) {
            const u = btn.url.trim();
            // Telegram rejects localhost and non-public URLs in inline keyboard buttons
            if (u.includes('localhost') || u.includes('127.0.0.1')) return false;
            return u.startsWith('https://') || u.startsWith('http://') || u.startsWith('tg://');
          }
          return false;
        })
      )
      .filter((row) => row.length > 0);

    if (validRows.length === 0) return undefined;

    return {
      inline_keyboard: validRows.map((row) =>
        row.map((btn) => ({
          text: btn.text,
          url: btn.url,
          callback_data: btn.callback_data,
        }))
      ),
    };
  }

  // ===========================================================================
  // Bot Management & Health APIs
  // ===========================================================================

  /**
   * Test your bot's auth token and get basic information about the bot
   */
  public async getMe(): Promise<TelegramUser | null> {
    const res = await this.request<TelegramUser>('getMe');
    return res.ok && res.result ? res.result : null;
  }

  /**
   * Set webhook URL for receiving incoming updates
   */
  public async setWebhook(
    url: string,
    secretToken?: string,
    maxConnections = 40,
    allowedUpdates?: string[]
  ): Promise<boolean> {
    const res = await this.request<boolean>('setWebhook', {
      url,
      secret_token: secretToken,
      max_connections: maxConnections,
      allowed_updates: allowedUpdates,
    });
    return Boolean(res.ok && res.result);
  }

  /**
   * Delete current webhook integration (switches back to getUpdates polling)
   */
  public async deleteWebhook(dropPendingUpdates = false): Promise<boolean> {
    const res = await this.request<boolean>('deleteWebhook', {
      drop_pending_updates: dropPendingUpdates,
    });
    return Boolean(res.ok && res.result);
  }

  /**
   * Get current webhook status
   */
  public async getWebhookInfo(): Promise<TelegramWebhookInfo | null> {
    const res = await this.request<TelegramWebhookInfo>('getWebhookInfo');
    return res.ok && res.result ? res.result : null;
  }

  /**
   * Fetch updates using long polling
   */
  public async getUpdates(
    offset?: number,
    limit = 100,
    timeout = 25
  ): Promise<IncomingTelegramUpdate[]> {
    const res = await this.request<IncomingTelegramUpdate[]>(
      'getUpdates',
      {
        offset,
        limit,
        timeout,
      },
      (timeout + 15) * 1000
    );
    return res.ok && Array.isArray(res.result) ? res.result : [];
  }

  /**
   * Start long polling for Telegram updates (ideal for development and environments without a public webhook)
   */
  public async startPolling(
    handler: (update: IncomingTelegramUpdate) => Promise<void> | void
  ): Promise<void> {
    if (!this.isConfigured()) {
      logger.info('[TelegramBot] Long polling disabled: TELEGRAM_BOT_TOKEN is not configured.');
      return;
    }

    if (this.isPolling) {
      logger.warn('[TelegramBot] Long polling is already active.');
      return;
    }

    try {
      const webhookInfo = await this.getWebhookInfo();
      if (webhookInfo?.url) {
        logger.info(`[TelegramBot] Webhook detected at ${webhookInfo.url}. Deleting webhook to switch to polling mode...`);
        await this.deleteWebhook();
      }
    } catch (err) {
      logger.warn('[TelegramBot] Could not check/clear webhook before polling:', err);
    }

    this.isPolling = true;
    logger.info('[TelegramBot] Telegram long polling started.');

    (async () => {
      while (this.isPolling) {
        try {
          const updates = await this.getUpdates(
            this.lastUpdateId ? this.lastUpdateId + 1 : undefined,
            50,
            20
          );

          for (const update of updates) {
            if (!this.isPolling) break;
            if (update.update_id) {
              this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);
            }
            try {
              await handler(update);
            } catch (handleErr) {
              logger.error('[TelegramBot] Error handling update:', handleErr);
            }
          }
        } catch (pollErr: any) {
          if (!this.isPolling) break;
          logger.warn(`[TelegramBot] Polling loop issue: ${pollErr?.message || pollErr}`);
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    })();
  }

  /**
   * Stop long polling
   */
  public stopPolling(): void {
    if (!this.isPolling) return;
    this.isPolling = false;
    logger.info('[TelegramBot] Telegram long polling stopped.');
  }

  // ===========================================================================
  // Core Messaging APIs
  // ===========================================================================

  /**
   * Send a text message to a specific chat or channel
   */
  public async sendMessage(
    chatId: string | number,
    text: string,
    options: SendMessageOptions = {}
  ): Promise<TelegramMessage | null> {
    const targetChatId = chatId || this.defaultChatId;
    if (!targetChatId) {
      logger.warn('[TelegramBot] sendMessage skipped: No Chat ID provided and no defaultChatId configured.');
      return null;
    }

    const payload: Record<string, unknown> = {
      chat_id: targetChatId,
      text,
      parse_mode: options.parse_mode || 'HTML',
      disable_web_page_preview: options.disable_web_page_preview ?? false,
      disable_notification: options.disable_notification ?? false,
    };

    if (options.reply_to_message_id) payload.reply_to_message_id = options.reply_to_message_id;
    if (options.reply_markup) {
      if ('inline_keyboard' in options.reply_markup && (!options.reply_markup.inline_keyboard || options.reply_markup.inline_keyboard.length === 0)) {
        // ignore empty inline keyboard
      } else {
        payload.reply_markup = options.reply_markup;
      }
    }

    const res = await this.request<TelegramMessage>('sendMessage', payload);
    return res.ok && res.result ? res.result : null;
  }

  /**
   * Send a photo by URL or file ID
   */
  public async sendPhoto(
    chatId: string | number,
    photoUrlOrFileId: string,
    options: SendPhotoOptions = {}
  ): Promise<TelegramMessage | null> {
    const targetChatId = chatId || this.defaultChatId;
    if (!targetChatId) {
      logger.warn('[TelegramBot] sendPhoto skipped: No Chat ID provided.');
      return null;
    }

    const payload: Record<string, unknown> = {
      chat_id: targetChatId,
      photo: photoUrlOrFileId,
      caption: options.caption,
      parse_mode: options.parse_mode || 'HTML',
      disable_notification: options.disable_notification ?? false,
    };

    if (options.reply_to_message_id) payload.reply_to_message_id = options.reply_to_message_id;
    if (options.reply_markup) payload.reply_markup = options.reply_markup;

    const res = await this.request<TelegramMessage>('sendPhoto', payload);
    return res.ok && res.result ? res.result : null;
  }

  /**
   * Send a document or file by URL
   */
  public async sendDocument(
    chatId: string | number,
    documentUrlOrFileId: string,
    options: SendDocumentOptions = {}
  ): Promise<TelegramMessage | null> {
    const targetChatId = chatId || this.defaultChatId;
    if (!targetChatId) {
      logger.warn('[TelegramBot] sendDocument skipped: No Chat ID provided.');
      return null;
    }

    const payload: Record<string, unknown> = {
      chat_id: targetChatId,
      document: documentUrlOrFileId,
      caption: options.caption,
      parse_mode: options.parse_mode || 'HTML',
      disable_notification: options.disable_notification ?? false,
    };

    if (options.reply_to_message_id) payload.reply_to_message_id = options.reply_to_message_id;
    if (options.reply_markup) payload.reply_markup = options.reply_markup;

    const res = await this.request<TelegramMessage>('sendDocument', payload);
    return res.ok && res.result ? res.result : null;
  }

  /**
   * Send chat action status (e.g. typing, upload_photo)
   */
  public async sendChatAction(
    chatId: string | number,
    action: 'typing' | 'upload_photo' | 'record_video' | 'upload_document' | 'find_location' = 'typing'
  ): Promise<boolean> {
    const targetChatId = chatId || this.defaultChatId;
    if (!targetChatId) return false;
    const res = await this.request<boolean>('sendChatAction', {
      chat_id: targetChatId,
      action,
    });
    return Boolean(res.ok && res.result);
  }

  /**
   * Edit text of an existing message
   */
  public async editMessageText(
    chatId: string | number,
    messageId: number,
    text: string,
    options: SendMessageOptions = {}
  ): Promise<TelegramMessage | null> {
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: options.parse_mode || 'HTML',
      disable_web_page_preview: options.disable_web_page_preview ?? false,
    };
    if (options.reply_markup) payload.reply_markup = options.reply_markup;

    const res = await this.request<TelegramMessage>('editMessageText', payload);
    return res.ok && res.result ? res.result : null;
  }

  /**
   * Delete a message
   */
  public async deleteMessage(chatId: string | number, messageId: number): Promise<boolean> {
    const res = await this.request<boolean>('deleteMessage', {
      chat_id: chatId,
      message_id: messageId,
    });
    return Boolean(res.ok && res.result);
  }

  // ===========================================================================
  // High-Level Domain Notification Templates
  // ===========================================================================

  /**
   * Send a general Admin System Alert
   */
  public async sendAdminAlert(
    title: string,
    message: string,
    chatId?: string | number,
    details?: Record<string, string | number | boolean | null | undefined>,
    actionUrl?: string
  ): Promise<TelegramMessage | null> {
    const target = chatId || this.defaultChatId;
    if (!target) return null;

    let text = `🚨 <b>${this.escapeHtml(title)}</b>\n\n${this.escapeHtml(message)}\n`;

    if (details && Object.keys(details).length > 0) {
      text += `\n📋 <b>Details:</b>\n`;
      for (const [key, value] of Object.entries(details)) {
        if (value != null && value !== '') {
          text += `• <b>${this.escapeHtml(key)}:</b> <code>${this.escapeHtml(value)}</code>\n`;
        }
      }
    }

    text += `\n⏰ <i>${new Date().toLocaleString()}</i>`;

    const options: SendMessageOptions = { parse_mode: 'HTML' };
    if (actionUrl) {
      options.reply_markup = this.buildInlineKeyboard([
        [{ text: '🔍 View in Admin Dashboard', url: actionUrl }],
      ]);
    }

    return this.sendMessage(target, text, options);
  }

  /**
   * Send a Booking Notification (Created, Accepted, Completed, etc.)
   */
  public async sendBookingNotification(
    chatId: string | number,
    booking: BookingTelegramPayload,
    actionUrl?: string
  ): Promise<TelegramMessage | null> {
    const target = chatId || this.defaultChatId;
    if (!target) return null;

    const statusIcons: Record<string, string> = {
      PENDING: '⏳',
      REQUESTED: '📩',
      ACCEPTED: '✅',
      IN_PROGRESS: '🛠',
      COMPLETED: '🎉',
      CANCELLED: '❌',
      REJECTED: '🚫',
    };

    const icon = statusIcons[booking.status.toUpperCase()] || '📋';
    const bookingCode = booking.publicId || booking.id;

    let text = `${icon} <b>Booking Notification: ${this.escapeHtml(booking.status.toUpperCase())}</b>\n\n`;
    text += `🆔 <b>Booking ID:</b> <code>${this.escapeHtml(bookingCode)}</code>\n`;
    text += `🔧 <b>Service:</b> ${this.escapeHtml(booking.serviceName)}\n`;
    if (booking.category) {
      text += `📂 <b>Category:</b> ${this.escapeHtml(booking.category)}\n`;
    }
    text += `👤 <b>Customer:</b> ${this.escapeHtml(booking.customerName)}`;
    if (booking.customerPhone) text += ` (${this.escapeHtml(booking.customerPhone)})`;
    text += `\n`;

    if (booking.providerName) {
      text += `🏢 <b>Provider:</b> ${this.escapeHtml(booking.providerName)}\n`;
    }

    if (booking.scheduledAt) {
      const dateStr = typeof booking.scheduledAt === 'string'
        ? booking.scheduledAt
        : booking.scheduledAt.toLocaleDateString();
      text += `📅 <b>Scheduled:</b> ${this.escapeHtml(dateStr)}`;
      if (booking.timeSlot) text += ` (${this.escapeHtml(booking.timeSlot)})`;
      text += `\n`;
    }

    if (booking.serviceAddress) {
      text += `📍 <b>Address:</b> ${this.escapeHtml(booking.serviceAddress)}\n`;
    }

    text += `💰 <b>Amount:</b> <b>$${Number(booking.estimatedTotal || 0).toFixed(2)}</b>\n`;

    if (booking.notes) {
      text += `💬 <b>Notes:</b> <i>${this.escapeHtml(booking.notes)}</i>\n`;
    }

    text += `\n⏰ <i>${new Date().toLocaleString()}</i>`;

    const options: SendMessageOptions = { parse_mode: 'HTML' };
    if (actionUrl) {
      options.reply_markup = this.buildInlineKeyboard([
        [{ text: '🔍 View Booking Details', url: actionUrl }],
      ]);
    }

    return this.sendMessage(target, text, options);
  }

  /**
   * Send a Commission Invoice Issued Notification
   */
  public async sendInvoiceNotification(
    chatId: string | number,
    invoice: InvoiceTelegramPayload,
    actionUrl?: string
  ): Promise<TelegramMessage | null> {
    const target = chatId || this.defaultChatId;
    if (!target) return null;

    let text = `🧾 <b>Commission Invoice: ${this.escapeHtml(invoice.invoiceNumber)}</b>\n\n`;
    text += `🏢 <b>Provider:</b> ${this.escapeHtml(invoice.providerName)}\n`;
    if (invoice.phone) text += `📞 <b>Phone:</b> ${this.escapeHtml(invoice.phone)}\n`;
    text += `📊 <b>Total Bookings Volume:</b> $${Number(invoice.totalVolume || 0).toFixed(2)}\n`;
    text += `💵 <b>Platform Service Fee:</b> <b>$${Number(invoice.totalCommission || 0).toFixed(2)}</b>\n`;
    text += `📌 <b>Status:</b> <code>${this.escapeHtml(invoice.status)}</code>\n`;

    if (invoice.dueDate) {
      const dueStr = typeof invoice.dueDate === 'string'
        ? invoice.dueDate
        : invoice.dueDate.toLocaleDateString();
      text += `📅 <b>Due Date:</b> ${this.escapeHtml(dueStr)}\n`;
    }

    text += `\n⏰ <i>${new Date().toLocaleString()}</i>`;

    const options: SendMessageOptions = { parse_mode: 'HTML' };
    if (actionUrl) {
      options.reply_markup = this.buildInlineKeyboard([
        [{ text: '📄 Open Invoice & Pay', url: actionUrl }],
      ]);
    }

    return this.sendMessage(target, text, options);
  }

  /**
   * Send a Submitted Payment Proof Notification with photo attachment or link
   */
  public async sendPaymentProofNotification(
    chatId: string | number,
    proof: PaymentProofTelegramPayload,
    actionUrl?: string
  ): Promise<TelegramMessage | null> {
    const target = chatId || this.defaultChatId;
    if (!target) return null;

    let caption = `💳 <b>Payment Proof Submitted</b>\n\n`;
    caption += `🧾 <b>Invoice:</b> <code>${this.escapeHtml(proof.invoiceNumber)}</code>\n`;
    caption += `🏢 <b>Provider:</b> ${this.escapeHtml(proof.providerName)}\n`;
    caption += `💵 <b>Amount Paid:</b> <b>$${Number(proof.amount || 0).toFixed(2)}</b>\n`;

    if (proof.bankReference) {
      caption += `🔢 <b>Bank Reference:</b> <code>${this.escapeHtml(proof.bankReference)}</code>\n`;
    }

    if (proof.notes) {
      caption += `💬 <b>Notes:</b> <i>${this.escapeHtml(proof.notes)}</i>\n`;
    }

    caption += `\n⏰ <i>${new Date().toLocaleString()}</i>`;

    const inlineKeyboard = actionUrl
      ? this.buildInlineKeyboard([
          [{ text: '✅ Verify & Settle Invoice', url: actionUrl }],
        ])
      : undefined;

    // If a valid image URL is provided, send as photo with caption
    if (proof.proofUrl && (proof.proofUrl.startsWith('http://') || proof.proofUrl.startsWith('https://'))) {
      return this.sendPhoto(target, proof.proofUrl, {
        caption,
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard,
      });
    }

    // Fallback to text message
    return this.sendMessage(target, caption, {
      parse_mode: 'HTML',
      reply_markup: inlineKeyboard,
    });
  }

  /**
   * Send a Provider Verification Submission Alert
   */
  public async sendProviderVerificationAlert(
    chatId: string | number,
    provider: ProviderVerificationTelegramPayload,
    actionUrl?: string
  ): Promise<TelegramMessage | null> {
    const target = chatId || this.defaultChatId;
    if (!target) return null;

    let text = `📝 <b>New Provider Verification Request</b>\n\n`;
    text += `🏢 <b>Business Name:</b> ${this.escapeHtml(provider.businessName)}\n`;
    text += `👤 <b>Contact:</b> ${this.escapeHtml(provider.contactName)}\n`;
    text += `📞 <b>Phone:</b> ${this.escapeHtml(provider.phone)}\n`;
    if (provider.email) text += `📧 <b>Email:</b> ${this.escapeHtml(provider.email)}\n`;
    if (provider.category) text += `📂 <b>Category:</b> ${this.escapeHtml(provider.category)}\n`;
    if (provider.primaryArea) text += `📍 <b>Area:</b> ${this.escapeHtml(provider.primaryArea)}\n`;
    text += `📌 <b>Status:</b> <code>${this.escapeHtml(provider.status)}</code>\n`;

    text += `\n⏰ <i>${new Date().toLocaleString()}</i>`;

    const options: SendMessageOptions = { parse_mode: 'HTML' };
    if (actionUrl) {
      options.reply_markup = this.buildInlineKeyboard([
        [{ text: '🔍 Review Submission', url: actionUrl }],
      ]);
    }

    return this.sendMessage(target, text, options);
  }
}

/**
 * Singleton instance of TelegramBotService
 */
export const telegramBotService = new TelegramBotService();
export default telegramBotService;
