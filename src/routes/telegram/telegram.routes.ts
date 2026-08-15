import { Router } from 'express';
import { TelegramController } from '../../controllers/telegram/telegram.controller';
import { authenticate } from '../../middlewares/auth.middlerware';
import { asyncHandler } from '../../middlewares/async-handler.middlerware';

const router = Router();

// Public Webhook endpoint for Telegram servers
router.post('/webhook', asyncHandler(TelegramController.handleWebhook));

// Authenticated User Profile Endpoints
router.post('/connect', authenticate, asyncHandler(TelegramController.connect));
router.get('/status', authenticate, asyncHandler(TelegramController.getStatus));
router.delete('/unlink', authenticate, asyncHandler(TelegramController.unlink));

export default router;
