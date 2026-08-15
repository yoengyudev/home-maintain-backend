import { telegramBotService } from '../telegram-bot.service';
import { FormattedTelegramMessage, formatTelegramDateTime } from './booking.template';

export const VerificationTelegramTemplate = {
  formatDecision(data: {
    status: 'APPROVED' | 'CHANGES_REQUIRED' | 'REJECTED';
    businessName: string;
    reviewerNotes?: string;
    actionUrl?: string;
  }, _lang: 'en' | 'km' = 'en'): FormattedTelegramMessage {
    let icon = '📋';
    let titleEn = 'Verification Status Update';

    if (data.status === 'APPROVED') {
      icon = '🎉';
      titleEn = 'Account Verification Approved!';
    } else if (data.status === 'CHANGES_REQUIRED') {
      icon = '⚠️';
      titleEn = 'Verification Action Required: Changes Requested';
    } else if (data.status === 'REJECTED') {
      icon = '❌';
      titleEn = 'Account Verification Rejected';
    }

    let text = `${icon} <b>${titleEn}</b>\n\n`;
    text += `🏢 <b>Business:</b> ${telegramBotService.escapeHtml(data.businessName)}\n`;
    text += `📌 <b>Status:</b> <code>${telegramBotService.escapeHtml(data.status)}</code>\n`;

    if (data.reviewerNotes) {
      text += `\n💬 <b>Admin Reviewer Notes:</b>\n<i>${telegramBotService.escapeHtml(data.reviewerNotes)}</i>\n`;
    }

    text += `\n⏰ <i>${formatTelegramDateTime()}</i>`;

    const replyMarkup = data.actionUrl
      ? telegramBotService.buildInlineKeyboard([
          [{ text: '🔍 Open Profile & Manage', url: data.actionUrl }],
        ])
      : undefined;

    return { text, replyMarkup };
  },
};
