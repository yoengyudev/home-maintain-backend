import { TelegramInlineKeyboardMarkup } from '../telegram-bot.types';
import { telegramBotService } from '../telegram-bot.service';
import { FormattedTelegramMessage, formatTelegramDateTime } from './booking.template';

export const InvoiceTelegramTemplate = {
  formatGenerated(data: {
    invoiceNumber: string;
    publicId?: string;
    providerName: string;
    totalVolume: number;
    totalCommission: number;
    dueDate?: string;
    actionUrl?: string;
  }, _lang: 'en' | 'km' = 'en'): FormattedTelegramMessage {
    let text = `🧾 <b>New Commission Invoice Issued</b>\n\n`;
    text += `🆔 <b>Invoice Number:</b> <code>${telegramBotService.escapeHtml(data.invoiceNumber)}</code>\n`;
    text += `🏢 <b>Provider:</b> ${telegramBotService.escapeHtml(data.providerName)}\n`;
    text += `📊 <b>Total Volume:</b> $${Number(data.totalVolume || 0).toFixed(2)}\n`;
    text += `💵 <b>Commission Due:</b> <b>$${Number(data.totalCommission || 0).toFixed(2)}</b>\n`;

    if (data.dueDate) {
      text += `📅 <b>Due Date:</b> ${telegramBotService.escapeHtml(data.dueDate)}\n`;
    }

    text += `\n⏰ <i>${formatTelegramDateTime()}</i>`;

    const replyMarkup = data.actionUrl
      ? telegramBotService.buildInlineKeyboard([
          [{ text: '💳 View Invoice & Pay', url: data.actionUrl }],
        ])
      : undefined;

    return { text, replyMarkup };
  },

  formatPaid(data: {
    invoiceNumber: string;
    providerName: string;
    amount: number;
    paymentReference?: string;
    actionUrl?: string;
  }, _lang: 'en' | 'km' = 'en'): FormattedTelegramMessage {
    let text = `✅ <b>Invoice Payment Confirmed & Settled</b>\n\n`;
    text += `🧾 <b>Invoice:</b> <code>${telegramBotService.escapeHtml(data.invoiceNumber)}</code>\n`;
    text += `🏢 <b>Provider:</b> ${telegramBotService.escapeHtml(data.providerName)}\n`;
    text += `💵 <b>Amount Settled:</b> <b>$${Number(data.amount || 0).toFixed(2)}</b>\n`;

    if (data.paymentReference) {
      text += `🔢 <b>Reference:</b> <code>${telegramBotService.escapeHtml(data.paymentReference)}</code>\n`;
    }

    text += `\n⏰ <i>${formatTelegramDateTime()}</i>`;

    const replyMarkup = data.actionUrl
      ? telegramBotService.buildInlineKeyboard([
          [{ text: '📄 View Receipt', url: data.actionUrl }],
        ])
      : undefined;

    return { text, replyMarkup };
  },

  formatProofSubmitted(data: {
    invoiceNumber: string;
    providerName: string;
    amount: number;
    paymentReference?: string;
    notes?: string;
    actionUrl?: string;
  }, _lang: 'en' | 'km' = 'en'): FormattedTelegramMessage {
    let text = `💳 <b>Invoice Payment Proof Submitted</b>\n\n`;
    text += `🧾 <b>Invoice:</b> <code>${telegramBotService.escapeHtml(data.invoiceNumber)}</code>\n`;
    text += `🏢 <b>Provider:</b> ${telegramBotService.escapeHtml(data.providerName)}\n`;
    text += `💵 <b>Amount Paid:</b> <b>$${Number(data.amount || 0).toFixed(2)}</b>\n`;

    if (data.paymentReference) {
      text += `🔢 <b>Bank Reference:</b> <code>${telegramBotService.escapeHtml(data.paymentReference)}</code>\n`;
    }

    if (data.notes) {
      text += `💬 <b>Notes:</b> <i>${telegramBotService.escapeHtml(data.notes)}</i>\n`;
    }

    text += `\n⏰ <i>${formatTelegramDateTime()}</i>`;

    const replyMarkup = data.actionUrl
      ? telegramBotService.buildInlineKeyboard([
          [{ text: '🔍 Verify & Settle Invoice', url: data.actionUrl }],
        ])
      : undefined;

    return { text, replyMarkup };
  },
};
