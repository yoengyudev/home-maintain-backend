import { telegramBotService } from './telegram-bot.service';
import { TelegramAccountService } from './telegram-account.service';
import { prisma } from '../../database/prisma.client';
import { logger } from '../../utils/logger.util';

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

export class TelegramCommandRouter {
  public static async handleUpdate(update: IncomingTelegramUpdate): Promise<void> {
    const msg = update.message;
    if (!msg || !msg.text) return;

    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const from = msg.from;

    logger.info(`[TelegramBot] Received message from chatId ${chatId}: "${text}"`);

    // 1. /start command (may contain deep-link token like `/start tg_xxx`)
    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      const token = parts[1]?.trim();

      if (token) {
        await this.handleStartToken(chatId, token, from);
      } else {
        await this.handleStartPlain(chatId, from);
      }
      return;
    }

    // 2. /help command
    if (text.startsWith('/help')) {
      await this.handleHelp(chatId);
      return;
    }

    // 3. /profile command
    if (text.startsWith('/profile')) {
      await this.handleProfile(chatId);
      return;
    }

    // 4. /bookings command
    if (text.startsWith('/bookings')) {
      await this.handleBookings(chatId);
      return;
    }

    // 5. /invoices command
    if (text.startsWith('/invoices')) {
      await this.handleInvoices(chatId);
      return;
    }

    // 6. /stop or /disconnect command
    if (text.startsWith('/stop') || text.startsWith('/disconnect')) {
      await this.handleStop(chatId);
      return;
    }

    // Fallback response for unhandled text
    await this.handleUnknown(chatId);
  }

  private static async handleStartToken(
    chatId: number,
    token: string,
    from?: { username?: string; first_name?: string; last_name?: string }
  ): Promise<void> {
    // 1. Check if token is for Login Authorization (`auth_...`)
    if (token.startsWith('auth_')) {
      const { TelegramAuthService } = await import('./telegram-auth.service');
      const authResult = await TelegramAuthService.confirmSession(token, {
        chatId,
        username: from?.username,
        firstName: from?.first_name,
        lastName: from?.last_name,
      });

      if (authResult.success) {
        let msg = `👋 <b>Welcome to FixItHome!</b>\n\n`;
        msg += `✅ <b>Login Authorized Successfully!</b>\n\n`;
        msg += `You are now signed in to <b>FixItHome</b>. You can return to the browser/app window now.\n\n`;
        msg += `Your Telegram is also linked to receive booking alerts and updates automatically! 🔔`;

        await telegramBotService.sendMessage(chatId, msg, { parse_mode: 'HTML' });
      } else {
        let errorMsg = `⚠️ <b>Login Failed</b>\n\n`;
        errorMsg += `${authResult.message}\n\n`;
        errorMsg += `Please return to FixItHome and click <b>Continue with Telegram</b> to try again.`;

        await telegramBotService.sendMessage(chatId, errorMsg, { parse_mode: 'HTML' });
      }
      return;
    }

    // 2. Otherwise token is for linking from Profile Settings (`tg_...`)
    const linkResult = await TelegramAccountService.linkAccountByToken(token, {
      chatId,
      username: from?.username || null,
      firstName: from?.first_name || null,
      lastName: from?.last_name || null,
    });

    if (linkResult.success) {
      const role = linkResult.user?.role || 'User';
      let welcomeMsg = `🎉 <b>Welcome to FixItHome Notifications!</b>\n\n`;
      welcomeMsg += `✅ Your Telegram account has been successfully linked to your <b>FixItHome</b> account (<code>${linkResult.user?.email}</code>).\n\n`;
      welcomeMsg += `You will now receive instant updates on:\n`;
      welcomeMsg += `• 📦 Booking requests & status updates\n`;
      welcomeMsg += `• 🧾 Invoices & payment confirmations\n`;
      welcomeMsg += `• 🔔 Real-time alerts & announcements\n\n`;
      welcomeMsg += `<b>Available Commands:</b>\n`;
      welcomeMsg += `• /profile - View your connected account info\n`;
      welcomeMsg += `• /bookings - View your recent bookings\n`;
      welcomeMsg += `• /help - Get assistance\n`;
      welcomeMsg += `• /stop - Disconnect your Telegram`;

      await telegramBotService.sendMessage(chatId, welcomeMsg, {
        parse_mode: 'HTML',
      });
    } else {
      let errorMsg = `⚠️ <b>Connection Failed</b>\n\n`;
      errorMsg += `${linkResult.message}\n\n`;
      errorMsg += `Please log into your FixItHome profile and click <b>Connect Telegram</b> to get a fresh link.`;

      await telegramBotService.sendMessage(chatId, errorMsg, { parse_mode: 'HTML' });
    }
  }

  private static async handleStartPlain(
    chatId: number,
    from?: { first_name?: string }
  ): Promise<void> {
    const user = await TelegramAccountService.findUserByChatId(chatId);

    if (user) {
      let msg = `👋 <b>Hello ${telegramBotService.escapeHtml(from?.first_name || 'there')}!</b>\n\n`;
      msg += `Your Telegram is linked to FixItHome account (<code>${user.email}</code>).\n\n`;
      msg += `<b>Available Commands:</b>\n`;
      msg += `• /profile - View your connected account info\n`;
      msg += `• /bookings - View your recent bookings\n`;
      msg += `• /invoices - View commission invoices\n`;
      msg += `• /help - Get assistance\n`;
      msg += `• /stop - Disconnect your Telegram\n`;

      await telegramBotService.sendMessage(chatId, msg, { parse_mode: 'HTML' });
    } else {
      let msg = `👋 <b>Welcome to FixItHome Bot!</b>\n\n`;
      msg += `This bot delivers real-time notifications for home maintenance bookings, status updates, and invoices.\n\n`;
      msg += `To connect your account:\n`;
      msg += `1. Log into your FixItHome Customer or Provider profile\n`;
      msg += `2. Click <b>Connect Telegram</b>\n`;
      msg += `3. Tap the link to connect instantly!\n`;

      await telegramBotService.sendMessage(chatId, msg, { parse_mode: 'HTML' });
    }
  }

  private static async handleHelp(chatId: number): Promise<void> {
    let msg = `ℹ️ <b>FixItHome Bot Help & Commands</b>\n\n`;
    msg += `• /start - Welcome & Account Connection\n`;
    msg += `• /profile - View your linked profile details\n`;
    msg += `• /bookings - Quick look at your recent bookings\n`;
    msg += `• /invoices - View commission invoices (Providers)\n`;
    msg += `• /stop - Unlink your Telegram from FixItHome\n\n`;
    msg += `📞 <b>Support Hotline:</b> +855 23 999 888\n`;
    msg += `📧 <b>Email:</b> support@fixithome.com`;

    await telegramBotService.sendMessage(chatId, msg, { parse_mode: 'HTML' });
  }

  private static async handleProfile(chatId: number): Promise<void> {
    const user = await TelegramAccountService.findUserByChatId(chatId);

    if (!user) {
      await telegramBotService.sendMessage(
        chatId,
        `⚠️ Your Telegram account is not currently linked to any FixItHome user. Please connect via your profile settings.`
      );
      return;
    }

    const name =
      user.customerProfile?.fullName ||
      user.providerProfile?.businessProfile?.businessName ||
      user.providerProfile?.contactName ||
      user.email;

    let msg = `👤 <b>Your FixItHome Profile</b>\n\n`;
    msg += `📛 <b>Name:</b> ${telegramBotService.escapeHtml(name)}\n`;
    msg += `📧 <b>Email:</b> <code>${telegramBotService.escapeHtml(user.email)}</code>\n`;
    msg += `💼 <b>Role:</b> <code>${user.role}</code>\n`;
    msg += `📱 <b>Phone:</b> ${user.phone ? telegramBotService.escapeHtml(user.phone) : 'Not set'}\n`;
    msg += `🛡️ <b>Status:</b> <code>${user.accountStatus}</code>\n`;

    await telegramBotService.sendMessage(chatId, msg, { parse_mode: 'HTML' });
  }

  private static async handleBookings(chatId: number): Promise<void> {
    const user = await TelegramAccountService.findUserByChatId(chatId);

    if (!user) {
      await telegramBotService.sendMessage(chatId, `⚠️ Please connect your FixItHome account first via your profile.`);
      return;
    }

    const bookings = await prisma.booking.findMany({
      where:
        user.role === 'PROVIDER' && user.providerProfile
          ? { providerProfileId: user.providerProfile.id }
          : user.customerProfile
          ? { customerProfileId: user.customerProfile.id }
          : { id: '__none__' },
      include: {
        serviceListing: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    if (bookings.length === 0) {
      await telegramBotService.sendMessage(chatId, `📋 You have no recent bookings.`);
      return;
    }

    let msg = `📋 <b>Your Recent Bookings:</b>\n\n`;
    bookings.forEach((b, idx) => {
      const code = b.publicId || b.id;
      const sName = b.serviceListing?.name || 'Service';
      msg += `<b>${idx + 1}.</b> <code>${code}</code> - ${telegramBotService.escapeHtml(sName)}\n`;
      msg += `   Status: <b>${b.status}</b> | Total: <b>$${Number(b.estimatedTotal || 0).toFixed(2)}</b>\n\n`;
    });

    await telegramBotService.sendMessage(chatId, msg, { parse_mode: 'HTML' });
  }

  private static async handleInvoices(chatId: number): Promise<void> {
    const user = await TelegramAccountService.findUserByChatId(chatId);

    if (!user || user.role !== 'PROVIDER' || !user.providerProfile) {
      await telegramBotService.sendMessage(chatId, `🧾 Invoices are available for registered Provider accounts.`);
      return;
    }

    const invoices = await prisma.providerInvoice.findMany({
      where: { providerProfileId: user.providerProfile.id },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    if (invoices.length === 0) {
      await telegramBotService.sendMessage(chatId, `🧾 No commission invoices found.`);
      return;
    }

    let msg = `🧾 <b>Recent Commission Invoices:</b>\n\n`;
    invoices.forEach((inv, idx) => {
      msg += `<b>${idx + 1}.</b> <code>${inv.invoiceNumber}</code>\n`;
      msg += `   Fee: <b>$${Number(inv.totalCommission || 0).toFixed(2)}</b> | Status: <b>${inv.status}</b>\n\n`;
    });

    await telegramBotService.sendMessage(chatId, msg, { parse_mode: 'HTML' });
  }

  private static async handleStop(chatId: number): Promise<void> {
    await TelegramAccountService.unlinkByChatId(chatId);
    let msg = `👋 <b>Telegram Notifications Disconnected</b>\n\n`;
    msg += `Your Telegram account has been unlinked from FixItHome. You will no longer receive bot messages.\n\n`;
    msg += `You can reconnect anytime from your profile settings!`;

    await telegramBotService.sendMessage(chatId, msg, { parse_mode: 'HTML' });
  }

  private static async handleUnknown(chatId: number): Promise<void> {
    let msg = `🤖 I didn't recognize that command.\n\nType /help to see what I can do!`;
    await telegramBotService.sendMessage(chatId, msg, { parse_mode: 'HTML' });
  }
}
