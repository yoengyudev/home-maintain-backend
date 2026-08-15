import * as crypto from 'crypto';
import { prisma } from '../../database/prisma.client';
import { nextPublicId } from '../../utils/public-id.util';
import { logger } from '../../utils/logger.util';
import { telegramBotService } from './telegram-bot.service';

export interface TelegramProfileStatus {
  isConnected: boolean;
  accounts: Array<{
    chatId: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    connectedAt: Date;
  }>;
}

export class TelegramAccountService {
  /**
   * Generates a 10-minute one-time link token for an authenticated user.
   */
  public static async generateLinkToken(userId: string): Promise<{
    token: string;
    url: string;
    expiresAt: Date;
  }> {
    const rawToken = `tg_${crypto.randomBytes(12).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Clean up old unused expired tokens for this user
    await prisma.telegramLinkToken.deleteMany({
      where: {
        userId,
        OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }],
      },
    });

    await prisma.telegramLinkToken.create({
      data: {
        token: rawToken,
        userId,
        expiresAt,
      },
    });

    let botUsername = 'fix_it_home_bot';
    try {
      const me = await telegramBotService.getMe();
      if (me?.username) botUsername = me.username;
    } catch {
      // fallback to default username
    }

    const url = `https://t.me/${botUsername}?start=${rawToken}`;
    return { token: rawToken, url, expiresAt };
  }

  /**
   * Link a Telegram user/chat to a FixItHome user using a valid one-time token.
   */
  public static async linkAccountByToken(
    token: string,
    telegramUser: {
      chatId: string | number;
      username?: string | null;
      firstName?: string | null;
      lastName?: string | null;
    }
  ): Promise<{
    success: boolean;
    message: string;
    user?: { id: string; email: string; role: string };
  }> {
    const linkRecord = await prisma.telegramLinkToken.findUnique({
      where: { token: token.trim() },
      include: { user: true },
    });

    if (!linkRecord) {
      return {
        success: false,
        message: 'Invalid or unrecognized connection token. Please generate a new link from your profile.',
      };
    }

    if (linkRecord.usedAt) {
      return {
        success: false,
        message: 'This connection token has already been used. Please generate a new link from your profile.',
      };
    }

    if (linkRecord.expiresAt < new Date()) {
      return {
        success: false,
        message: 'This connection token has expired (valid for 10 minutes). Please generate a new link from your profile.',
      };
    }

    const chatIdStr = String(telegramUser.chatId).trim();

    // Mark token as used
    await prisma.telegramLinkToken.update({
      where: { id: linkRecord.id },
      data: { usedAt: new Date() },
    });

    // Check if this Telegram chatId is already linked to any user
    const existing = await prisma.telegramAccount.findUnique({
      where: { chatId: chatIdStr },
    });

    if (existing) {
      await prisma.telegramAccount.update({
        where: { id: existing.id },
        data: {
          userId: linkRecord.userId,
          username: telegramUser.username || null,
          firstName: telegramUser.firstName || null,
          lastName: telegramUser.lastName || null,
          isConnected: true,
          connectedAt: new Date(),
        },
      });
    } else {
      const publicId = await nextPublicId('TG', 'telegramAccount');
      await prisma.telegramAccount.create({
        data: {
          publicId,
          userId: linkRecord.userId,
          chatId: chatIdStr,
          username: telegramUser.username || null,
          firstName: telegramUser.firstName || null,
          lastName: telegramUser.lastName || null,
          isConnected: true,
          connectedAt: new Date(),
        },
      });
    }

    logger.info(`[TelegramAccount] Successfully linked user ${linkRecord.userId} to Telegram Chat ID ${chatIdStr}`);

    return {
      success: true,
      message: 'Account linked successfully!',
      user: {
        id: linkRecord.user.id,
        email: linkRecord.user.email,
        role: linkRecord.user.role,
      },
    };
  }

  /**
   * Get Telegram connection status for a user
   */
  public static async getAccountStatus(userId: string): Promise<TelegramProfileStatus> {
    const accounts = await prisma.telegramAccount.findMany({
      where: { userId, isConnected: true },
      select: {
        chatId: true,
        username: true,
        firstName: true,
        lastName: true,
        connectedAt: true,
      },
    });

    return {
      isConnected: accounts.length > 0,
      accounts,
    };
  }

  /**
   * Unlink all Telegram accounts for a user
   */
  public static async unlinkUser(userId: string): Promise<boolean> {
    await prisma.telegramAccount.updateMany({
      where: { userId },
      data: { isConnected: false },
    });
    return true;
  }

  /**
   * Unlink Telegram account by Chat ID (e.g. via /stop command)
   */
  public static async unlinkByChatId(chatId: string | number): Promise<boolean> {
    const chatIdStr = String(chatId).trim();
    await prisma.telegramAccount.updateMany({
      where: { chatId: chatIdStr },
      data: { isConnected: false },
    });
    return true;
  }

  /**
   * Get all active Telegram chat IDs for a given user
   */
  public static async getConnectedChatIdsForUser(userId: string): Promise<string[]> {
    const accounts = await prisma.telegramAccount.findMany({
      where: { userId, isConnected: true },
      select: { chatId: true },
    });
    return accounts.map((a) => a.chatId);
  }

  /**
   * Find linked User for a given Telegram chat ID
   */
  public static async findUserByChatId(chatId: string | number) {
    const chatIdStr = String(chatId).trim();
    const account = await prisma.telegramAccount.findUnique({
      where: { chatId: chatIdStr },
      include: {
        user: {
          include: {
            customerProfile: true,
            providerProfile: {
              include: { businessProfile: true },
            },
          },
        },
      },
    });
    if (!account || !account.isConnected) return null;
    return account.user;
  }
}
