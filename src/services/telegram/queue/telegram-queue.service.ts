import { logger } from '../../../utils/logger.util';
import { telegramBotService } from '../telegram-bot.service';
import { SendMessageOptions, SendPhotoOptions } from '../telegram-bot.types';

export interface TelegramJob {
  id: string;
  chatId: string | number;
  type: 'text' | 'photo';
  text: string;
  photoUrl?: string;
  options?: SendMessageOptions | SendPhotoOptions;
  retries: number;
  maxRetries: number;
  createdAt: number;
}

export class TelegramQueueService {
  private static instance: TelegramQueueService;
  private queue: TelegramJob[] = [];
  private isProcessing = false;
  private jobCounter = 0;

  private constructor() {
    // Singleton
  }

  public static getInstance(): TelegramQueueService {
    if (!TelegramQueueService.instance) {
      TelegramQueueService.instance = new TelegramQueueService();
    }
    return TelegramQueueService.instance;
  }

  /**
   * Enqueue a text message to be delivered asynchronously
   */
  public enqueueMessage(
    chatId: string | number,
    text: string,
    options?: SendMessageOptions,
    maxRetries = 3
  ): void {
    if (!chatId || !text) return;
    this.jobCounter += 1;
    this.queue.push({
      id: `job_${Date.now()}_${this.jobCounter}`,
      chatId,
      type: 'text',
      text,
      options,
      retries: 0,
      maxRetries,
      createdAt: Date.now(),
    });
    this.triggerProcessing();
  }

  /**
   * Enqueue a photo message to be delivered asynchronously
   */
  public enqueuePhoto(
    chatId: string | number,
    photoUrl: string,
    options?: SendPhotoOptions,
    maxRetries = 3
  ): void {
    if (!chatId || !photoUrl) return;
    this.jobCounter += 1;
    this.queue.push({
      id: `job_${Date.now()}_${this.jobCounter}`,
      chatId,
      type: 'photo',
      text: options?.caption || '',
      photoUrl,
      options,
      retries: 0,
      maxRetries,
      createdAt: Date.now(),
    });
    this.triggerProcessing();
  }

  /**
   * Start worker processing loop if not already running
   */
  private triggerProcessing(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;
    void this.processLoop();
  }

  private async processLoop(): Promise<void> {
    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;

      try {
        if (job.type === 'photo' && job.photoUrl) {
          const res = await telegramBotService.sendPhoto(
            job.chatId,
            job.photoUrl,
            job.options as SendPhotoOptions
          );
          if (!res && job.retries < job.maxRetries) {
            this.handleRetry(job);
          }
        } else {
          const res = await telegramBotService.sendMessage(
            job.chatId,
            job.text,
            job.options as SendMessageOptions
          );
          if (!res && job.retries < job.maxRetries) {
            this.handleRetry(job);
          }
        }
      } catch (err) {
        logger.warn(`[TelegramQueue] Error processing job ${job.id}:`, err);
        if (job.retries < job.maxRetries) {
          this.handleRetry(job);
        }
      }

      // Small delay between messages to respect Telegram rate limits (~30 msg/sec limit)
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    this.isProcessing = false;
  }

  private handleRetry(job: TelegramJob): void {
    job.retries += 1;
    const backoffMs = Math.min(1000 * Math.pow(2, job.retries), 10000);
    logger.info(`[TelegramQueue] Retrying job ${job.id} (attempt ${job.retries}/${job.maxRetries}) in ${backoffMs}ms`);
    setTimeout(() => {
      this.queue.push(job);
      this.triggerProcessing();
    }, backoffMs);
  }
}

export const telegramQueueService = TelegramQueueService.getInstance();
