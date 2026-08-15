import { TelegramInlineKeyboardMarkup } from '../telegram-bot.types';
import { telegramBotService } from '../telegram-bot.service';

export interface FormattedTelegramMessage {
  text: string;
  replyMarkup?: TelegramInlineKeyboardMarkup;
}

export function formatTelegramDateTime(dateInput: Date | string | number = new Date()): string {
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  return date.toLocaleString('en-US', {
    timeZone: 'Asia/Phnom_Penh',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export const BookingTelegramTemplate = {
  format(data: {
    bookingId: string;
    publicId?: string;
    serviceName: string;
    customerName?: string;
    providerName?: string;
    status: string;
    actionTextEn?: string;
    actionTextKm?: string;
    date?: string;
    timeSlot?: string;
    address?: string;
    amount?: number;
    notes?: string;
    actionUrl?: string;
  }, _lang: 'en' | 'km' = 'en'): FormattedTelegramMessage {
    const statusUpper = data.status.toUpperCase();
    const code = data.publicId || data.bookingId;

    const statusIcons: Record<string, string> = {
      PENDING: '⏳',
      REQUESTED: '📩',
      ACCEPTED: '✅',
      IN_PROGRESS: '🛠️',
      COMPLETED: '🎉',
      CANCELLED: '❌',
      REJECTED: '🚫',
    };

    const icon = statusIcons[statusUpper] || '📋';

    let text = `${icon} <b>Booking Update: ${statusUpper}</b>\n\n`;
    text += `🆔 <b>Booking ID:</b> <code>${telegramBotService.escapeHtml(code)}</code>\n`;
    text += `🔧 <b>Service:</b> ${telegramBotService.escapeHtml(data.serviceName)}\n`;

    if (data.customerName) {
      text += `👤 <b>Customer:</b> ${telegramBotService.escapeHtml(data.customerName)}\n`;
    }
    if (data.providerName) {
      text += `🏢 <b>Provider:</b> ${telegramBotService.escapeHtml(data.providerName)}\n`;
    }

    if (data.date) {
      text += `📅 <b>Date:</b> ${telegramBotService.escapeHtml(data.date)}`;
      if (data.timeSlot) text += ` (${telegramBotService.escapeHtml(data.timeSlot)})`;
      text += `\n`;
    }

    if (data.address) {
      text += `📍 <b>Location:</b> ${telegramBotService.escapeHtml(data.address)}\n`;
    }

    if (data.amount != null) {
      text += `💰 <b>Total:</b> <b>$${Number(data.amount).toFixed(2)}</b>\n`;
    }

    if (data.notes) {
      text += `💬 <b>Notes:</b> <i>${telegramBotService.escapeHtml(data.notes)}</i>\n`;
    }

    text += `\n⏰ <i>${formatTelegramDateTime()}</i>`;

    const replyMarkup = data.actionUrl
      ? telegramBotService.buildInlineKeyboard([
          [{ text: '🔍 View Booking Details', url: data.actionUrl }],
        ])
      : undefined;

    return { text, replyMarkup };
  },
};
