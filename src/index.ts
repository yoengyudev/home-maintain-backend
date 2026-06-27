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
const app = express();

const server = http.createServer(app);

app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(
    cors({
        origin: Env.FRONTEND_ORIGIN,
        credentials: true,
    })
);

app.use(route)

app.get(
  "/health",
  asyncHandler(async (req: Request, res: Response) => {
    return sendResponse(res, {
      statusCode: HTTPSTATUS.OK,
      message: "Server is running",
    });
  })
);

app.use(notFoundHandler);
app.use(errorHandler);

const startServer = async () => {
    await connectDatabase();

    server.listen(Env.PORT, () => {
        logger.info(`Server is running on port ${Env.PORT} in ${Env.NODE_ENV} mode`);
    });

    const shutdown = async (signal: string) => {
        logger.info(`${signal} received. Shutting down gracefully...`);
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