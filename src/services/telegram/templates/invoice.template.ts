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

  formatOverdue(data: {
    invoiceNumber: string;
    publicId?: string;
    providerName: string;
    amount: number;
    dueDate?: string;
    daysOverdue?: number;
    actionUrl?: string;
  }, lang: 'en' | 'km' = 'en'): FormattedTelegramMessage {
    const isKh = lang === 'km';
    let text = isKh
      ? `🚨 <b>ការរំលឹក៖ វិក្កយបត្រកម្រៃសេវាបានហួសកាលកំណត់!</b>\n\n`
      : `🚨 <b>ALERT: Commission Invoice is OVERDUE!</b>\n\n`;

    text += `🧾 <b>${isKh ? 'លេខវិក្កយបត្រ' : 'Invoice Number'}:</b> <code>${telegramBotService.escapeHtml(data.invoiceNumber)}</code>\n`;
    text += `🏢 <b>${isKh ? 'អ្នកផ្តល់សេវា' : 'Provider'}:</b> ${telegramBotService.escapeHtml(data.providerName)}\n`;
    text += `💵 <b>${isKh ? 'ទឹកប្រាក់ត្រូវទូទាត់' : 'Outstanding Amount'}:</b> <b>$${Number(data.amount || 0).toFixed(2)}</b>\n`;

    if (data.dueDate) {
      text += `📅 <b>${isKh ? 'ថ្ងៃផុតកំណត់' : 'Due Date'}:</b> ${telegramBotService.escapeHtml(data.dueDate)}\n`;
    }
    if (data.daysOverdue !== undefined && data.daysOverdue > 0) {
      text += `⏳ <b>${isKh ? 'ហួសកំណត់' : 'Overdue by'}:</b> <b>${data.daysOverdue} ${isKh ? 'ថ្ងៃ' : 'day(s)'}</b>\n`;
    }

    text += isKh
      ? `\n⚠️ <i>សូមមេត្តាធ្វើការទូទាត់កម្រៃសេវាដើម្បីធានានិរន្តរភាពក្នុងការទទួលការងារលើប្រព័ន្ធ។</i>\n`
      : `\n⚠️ <i>Please settle your outstanding platform fee to maintain active status on the platform.</i>\n`;

    text += `\n⏰ <i>${formatTelegramDateTime()}</i>`;

    const replyMarkup = data.actionUrl
      ? telegramBotService.buildInlineKeyboard([
          [{ text: isKh ? '💳 មើលវិក្កយបត្រ & ទូទាត់' : '💳 View Invoice & Pay', url: data.actionUrl }],
        ])
      : undefined;

    return { text, replyMarkup };
  },
};
