/**
 * Telegram Bot API Types & Interfaces
 * Reference: https://core.telegram.org/bots/api
 */

export type TelegramParseMode = 'HTML' | 'MarkdownV2' | 'Markdown';

export interface TelegramInlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
  web_app?: { url: string };
  login_url?: { url: string };
}

export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

export interface TelegramReplyKeyboardMarkup {
  keyboard: Array<Array<{ text: string }>>;
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  selective?: boolean;
}

export interface TelegramReplyKeyboardRemove {
  remove_keyboard: true;
  selective?: boolean;
}

export type TelegramReplyMarkup =
  | TelegramInlineKeyboardMarkup
  | TelegramReplyKeyboardMarkup
  | TelegramReplyKeyboardRemove;

export interface SendMessageOptions {
  parse_mode?: TelegramParseMode;
  disable_web_page_preview?: boolean;
  disable_notification?: boolean;
  reply_to_message_id?: number;
  reply_markup?: TelegramReplyMarkup;
}

export interface SendPhotoOptions {
  caption?: string;
  parse_mode?: TelegramParseMode;
  disable_notification?: boolean;
  reply_to_message_id?: number;
  reply_markup?: TelegramReplyMarkup;
}

export interface SendDocumentOptions {
  caption?: string;
  parse_mode?: TelegramParseMode;
  disable_notification?: boolean;
  reply_to_message_id?: number;
  reply_markup?: TelegramReplyMarkup;
  filename?: string;
  mime_type?: string;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
  supports_inline_queries?: boolean;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  sender_chat?: TelegramChat;
  date: number;
  chat: TelegramChat;
  text?: string;
  caption?: string;
  photo?: Array<{ file_id: string; width: number; height: number; file_size?: number }>;
  document?: { file_id: string; file_name?: string; mime_type?: string; file_size?: number };
}

export interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

export interface TelegramWebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
  allowed_updates?: string[];
}

export interface BookingTelegramPayload {
  id: string;
  publicId?: string;
  serviceName: string;
  category?: string;
  customerName: string;
  customerPhone?: string;
  providerName?: string;
  providerPhone?: string;
  serviceAddress?: string;
  scheduledAt?: string | Date;
  timeSlot?: string;
  quantity?: number;
  estimatedTotal: number;
  status: string;
  notes?: string;
}

export interface InvoiceTelegramPayload {
  invoiceNumber: string;
  publicId?: string;
  providerName: string;
  contactName?: string;
  phone?: string;
  totalVolume: number;
  totalCommission: number;
  status: string;
  dueDate?: string | Date;
  issuedDate?: string | Date;
}

export interface PaymentProofTelegramPayload {
  invoiceNumber: string;
  publicId?: string;
  providerName: string;
  amount: number;
  proofUrl: string;
  bankReference?: string;
  notes?: string;
  submittedAt?: string | Date;
}

export interface ProviderVerificationTelegramPayload {
  businessName: string;
  contactName: string;
  phone: string;
  email?: string;
  category?: string;
  primaryArea?: string;
  status: string;
}

export interface IncomingTelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
      title?: string;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    text?: string;
    date: number;
  };
}

