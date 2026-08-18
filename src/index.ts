import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import http from "http";
import cors from "cors";
import { Env } from "./config/env.config";
import route from "./routes";
import { asyncHandler } from "./middlewares/async-handler.middlerware";
import { HTTPSTATUS } from "./config/http.config";
import { sendResponse } from "./utils/response.util";
import { Request, Response } from "express";
import { notFoundHandler } from "./middlewares/not-found.middlerware";
import { errorHandler } from "./middlewares/error.handler.middleware";
import connectDatabase from "./database/prisma.client";
import { logger } from "./utils/logger.util";
import { getLang } from "./utils/get-lang.util";
import { t } from "./i18n/translate";
import { attachBookingWebSocket } from "./websocket/booking-ws";
import { telegramBotService } from "./services/telegram/telegram-bot.service";
import { TelegramCommandRouter } from "./services/telegram/telegram-command-router";
import { InvoiceOverdueAlertService } from "./services/vendor/invoice-overdue-alert.service";
const app = express();

const server = http.createServer(app);

app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
    })
);
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// Support a comma-separated list in FRONTEND_ORIGIN.
const allowedOrigins = (Env.FRONTEND_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

function isOriginAllowed(origin: string | undefined): boolean {
    if (!origin) return true; // non-browser requests (curl, mobile apps, Postman)

    if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        return true;
    }

    // Automatically allow any localhost, 127.0.0.1, or local LAN IP on any port
    const isLocalOrLanOrigin =
        /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/.test(origin) ||
        /^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin);

    if (Env.NODE_ENV !== "production" || isLocalOrLanOrigin) {
        return true;
    }

    return false;
}

app.use(
    cors({
        origin(origin, callback) {
            if (isOriginAllowed(origin)) {
                callback(null, true);
                return;
            }
            callback(null, false);
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "Accept-Language",
            "x-device-token",
            "x-requested-with",
            "baggage",
            "sentry-trace",
        ],
        optionsSuccessStatus: 204,
    })
);

app.use(route)

app.get(
  "/health",
  asyncHandler(async (req: Request, res: Response) => {
    return sendResponse(res, {
      statusCode: HTTPSTATUS.OK,
      message: t("SERVER_RUNNING", getLang(req)),
    });
  })
);

app.use(notFoundHandler);
app.use(errorHandler);

const startServer = async () => {
    await connectDatabase();

    attachBookingWebSocket(server);

    if (telegramBotService.isConfigured()) {
        void telegramBotService.startPolling((update) => TelegramCommandRouter.handleUpdate(update));
    }

    // Start 24h overdue invoice alert recurring scheduler
    InvoiceOverdueAlertService.startScheduler();

    server.listen(Env.PORT, () => {
        logger.info(`Server is running on port ${Env.PORT} in ${Env.NODE_ENV} mode`);
    });

    const shutdown = async (signal: string) => {
        logger.info(`${signal} received. Shutting down gracefully...`);
        InvoiceOverdueAlertService.stopScheduler();
        telegramBotService.stopPolling();
        server.close(() => {
            logger.info("HTTP server closed.");
            process.exit(0);
        });
    };

    process.on("unhandledRejection", (reason) => {
        logger.error("Unhandled rejection:", reason);
    });

    process.on("uncaughtException", (error) => {
        logger.error("Uncaught exception:", error);
    });

    process.on("SIGINT", () => {
        void shutdown("SIGINT");
    });

    process.on("SIGTERM", () => {
        void shutdown("SIGTERM");
    });
};

void startServer();
