import { telegramBotService } from '../telegram-bot.service';
import { FormattedTelegramMessage, formatTelegramDateTime } from './booking.template';

export const GenericTelegramTemplate = {
  format(data: {
    titleEn: string;
    titleKm?: string | null;
    messageEn: string;
    messageKm?: string | null;
    type?: string;
    relatedModule?: string | null;
    relatedRecordId?: string | null;
    actionUrl?: string;
  }, _lang: 'en' | 'km' = 'en'): FormattedTelegramMessage {
    const title = data.titleEn || 'Notification';
    const message = data.messageEn || '';

    let text = `🔔 <b>${telegramBotService.escapeHtml(title)}</b>\n\n`;
    text += `💬 ${telegramBotService.escapeHtml(message)}\n`;

    if (data.relatedModule && data.relatedRecordId) {
      text += `\n📌 <b>${telegramBotService.escapeHtml(data.relatedModule.toUpperCase())}:</b> <code>${telegramBotService.escapeHtml(data.relatedRecordId)}</code>\n`;
    }

    text += `\n⏰ <i>${formatTelegramDateTime()}</i>`;

    const replyMarkup = data.actionUrl
      ? telegramBotService.buildInlineKeyboard([
          [{ text: '🔗 Open Link', url: data.actionUrl }],
        ])
      : undefined;

    return { text, replyMarkup };
  },
};


