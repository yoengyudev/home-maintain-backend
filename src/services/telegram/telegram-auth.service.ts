import * as crypto from 'crypto';
import { prisma } from '../../database/prisma.client';
import { AccountStatus, DevicePlatform, UserRole } from '../../generated/prisma/enums';
import { isCustomerRole } from '../../helper/check-role.helper';
import {
  createCustomerSession,
  formatCustomerAuthUser,
  upsertFcmToken,
} from '../../helper/customer/auth.helper';
import { signCustomerAccessToken, signCustomerRefreshToken } from '../../utils/jwt.util';
import { nextPublicId } from '../../utils/public-id.util';
import { Env } from '../../config/env.config';
import { logger } from '../../utils/logger.util';
import type { Lang } from '../../i18n/messages';
import { t } from '../../i18n/translate';
import { BadRequestException, UnauthorizedException } from '../../utils/app-error.util';

export interface TelegramAuthInitResult {
  token: string;
  url: string;
  botUsername: string;
  expiresAt: Date;
}

export interface TelegramAuthCheckResult {
  status: 'PENDING' | 'EXPIRED' | 'AUTHENTICATED';
  user?: ReturnType<typeof formatCustomerAuthUser>;
  accessToken?: string;
  refreshToken?: string;
}

export class TelegramAuthService {
  /**
   * Initializes a 10-minute Telegram authentication session.
   */
  public static async initSession(): Promise<TelegramAuthInitResult> {
    const token = `auth_${crypto.randomBytes(16).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'fix_it_home_bot';

    await prisma.telegramAuthSession.create({
      data: {
        token,
        status: 'PENDING',
        expiresAt,
      },
    });

    const url = `https://t.me/${botUsername}?start=${token}`;

    return {
      token,
      url,
      botUsername,
      expiresAt,
    };
  }

  /**
   * Confirms the session when user clicks /start in Telegram Bot.
   */
  public static async confirmSession(
    token: string,
    telegramUser: {
      chatId: string | number;
      username?: string;
      firstName?: string;
      lastName?: string;
    }
  ): Promise<{ success: boolean; message: string }> {
    const chatIdStr = String(telegramUser.chatId);

    const session = await prisma.telegramAuthSession.findUnique({
      where: { token },
    });

    if (!session) {
      return { success: false, message: 'Invalid authentication session.' };
    }

    if (session.expiresAt < new Date()) {
      await prisma.telegramAuthSession.update({
        where: { id: session.id },
        data: { status: 'EXPIRED' },
      });
      return { success: false, message: 'Authentication session expired.' };
    }

    await prisma.telegramAuthSession.update({
      where: { id: session.id },
      data: {
        status: 'CONFIRMED',
        chatId: chatIdStr,
        username: telegramUser.username || null,
        firstName: telegramUser.firstName || null,
        lastName: telegramUser.lastName || null,
      },
    });

    return {
      success: true,
      message: 'Login confirmed successfully! You can now return to the app.',
    };
  }

  /**
   * Checks the status of a Telegram authentication session and issues JWT tokens if confirmed.
   */
  public static async checkSession(
    token: string,
    device: {
      fcmToken?: string;
      platform?: DevicePlatform;
      deviceName?: string;
    },
    lang: Lang
  ): Promise<TelegramAuthCheckResult> {
    const session = await prisma.telegramAuthSession.findUnique({
      where: { token },
    });

    if (!session) {
      return { status: 'EXPIRED' };
    }

    if (session.status === 'EXPIRED' || (session.expiresAt < new Date() && session.status === 'PENDING')) {
      return { status: 'EXPIRED' };
    }

    if (session.status === 'PENDING') {
      return { status: 'PENDING' };
    }

    if (session.status === 'CONFIRMED' && session.chatId) {
      const chatIdStr = session.chatId;

      // 1. Check if TelegramAccount exists
      let telegramAccount = await prisma.telegramAccount.findUnique({
        where: { chatId: chatIdStr },
        include: {
          user: {
            include: { customerProfile: true },
          },
        },
      });

      let user = telegramAccount?.user;

      if (!user) {
        // Create new Customer User for this Telegram Account
        const fullName = [session.firstName, session.lastName].filter(Boolean).join(' ').trim()
          || session.username
          || `Telegram User ${chatIdStr.slice(-4)}`;
        const email = `tg_${chatIdStr}@telegram.fixithome.internal`;

        user = await prisma.$transaction(async (tx) => {
          const publicId = await nextPublicId('TG', 'telegramAccount');

          const newUser = await tx.user.create({
            data: {
              email,
              publicId: crypto.randomUUID(),
              role: UserRole.CUSTOMER,
              accountStatus: AccountStatus.ACTIVE,
              emailVerifiedAt: new Date(),
              customerProfile: {
                create: {
                  publicId: crypto.randomUUID(),
                  fullName,
                },
              },
              telegramAccounts: {
                create: {
                  publicId,
                  chatId: chatIdStr,
                  username: session.username,
                  firstName: session.firstName,
                  lastName: session.lastName,
                  isConnected: true,
                  connectedAt: new Date(),
                },
              },
            },
            include: {
              customerProfile: true,
            },
          });

          return newUser;
        });
      } else {
        // Ensure user is an active customer
        if (!isCustomerRole(user.role)) {
          throw new UnauthorizedException(t('CUSTOMER_INVALID_CREDENTIALS', lang));
        }
        if (user.accountStatus !== AccountStatus.ACTIVE) {
          throw new UnauthorizedException(t('CUSTOMER_ACCOUNT_DISABLED', lang));
        }

        // Update TelegramAccount profile info
        if (telegramAccount) {
          await prisma.telegramAccount.update({
            where: { id: telegramAccount.id },
            data: {
              username: session.username || telegramAccount.username,
              firstName: session.firstName || telegramAccount.firstName,
              lastName: session.lastName || telegramAccount.lastName,
              isConnected: true,
            },
          });
        }
      }

      // Mark session as consumed
      await prisma.telegramAuthSession.update({
        where: { id: session.id },
        data: {
          status: 'CONSUMED',
          userId: user.id,
        },
      });

      // Issue customer session and tokens
      const sessionId = crypto.randomUUID();
      const tokenPayload = {
        userId: user.id,
        role: user.role,
        sid: sessionId,
      };

      const accessToken = signCustomerAccessToken(tokenPayload);
      const refreshToken = signCustomerRefreshToken(tokenPayload);

      await createCustomerSession({
        userId: user.id,
        sessionId,
        refreshToken,
      });

      if (device.fcmToken) {
        await upsertFcmToken({
          userId: user.id,
          token: device.fcmToken,
          platform: device.platform,
          deviceName: device.deviceName,
        });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { lastSignedInAt: new Date() },
      });

      return {
        status: 'AUTHENTICATED',
        user: formatCustomerAuthUser(user as any),
        accessToken,
        refreshToken,
      };
    }

    return { status: 'EXPIRED' };
  }
}
