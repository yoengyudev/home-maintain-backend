import { Request, Response } from 'express';
import { TelegramAccountService } from '../../services/telegram/telegram-account.service';
import { TelegramCommandRouter } from '../../services/telegram/telegram-command-router';
import { logger } from '../../utils/logger.util';

export class TelegramController {
  /**
   * POST /api/me/telegram/connect
   * Generates a 10-minute one-time link token and returns the bot deep-link URL.
   */
  public static async connect(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    try {
      const result = await TelegramAccountService.generateLinkToken(userId);
      res.status(200).json({
        success: true,
        data: {
          url: result.url,
          token: result.token,
          expiresAt: result.expiresAt,
        },
      });
    } catch (error) {
      logger.error('[TelegramController] connect error:', error);
      res.status(500).json({ success: false, message: 'Failed to generate connection link' });
    }
  }

  /**
   * GET /api/me/telegram
   * Returns current Telegram account connection status.
   */
  public static async getStatus(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    try {
      const status = await TelegramAccountService.getAccountStatus(userId);
      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error('[TelegramController] getStatus error:', error);
      res.status(500).json({ success: false, message: 'Failed to get Telegram status' });
    }
  }

  /**
   * DELETE /api/me/telegram
   * Unlinks all Telegram accounts for the authenticated user.
   */
  public static async unlink(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    try {
      await TelegramAccountService.unlinkUser(userId);
      res.status(200).json({
        success: true,
        message: 'Telegram disconnected successfully',
      });
    } catch (error) {
      logger.error('[TelegramController] unlink error:', error);
      res.status(500).json({ success: false, message: 'Failed to disconnect Telegram' });
    }
  }

  /**
   * POST /telegram/webhook
   * Handles incoming updates from Telegram Webhook.
   */
  public static async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      // Return 200 immediately to Telegram
      res.status(200).json({ ok: true });
      // Process update asynchronously
      void TelegramCommandRouter.handleUpdate(req.body);
    } catch (error) {
      logger.error('[TelegramController] webhook error:', error);
    }
  }
}
