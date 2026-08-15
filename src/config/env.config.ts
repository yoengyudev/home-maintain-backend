import "dotenv/config";
import { getEnv } from "../utils/get-env.util";


export const Env = {
    DATABASE_URL: getEnv("DATABASE_URL"),
    JWT_SECRET: getEnv("JWT_SECRET"),
    JWT_EXPIRATION_TIME: getEnv("JWT_EXPIRATION_TIME", "7d"),
    JWT_ACCESS_EXPIRES_IN: getEnv(
        "JWT_ACCESS_EXPIRES_IN",
        process.env.JWT_EXPIRATION_TIME ?? "7d"
    ),
    JWT_REFRESH_EXPIRES_IN: getEnv("JWT_REFRESH_EXPIRES_IN", "30d"),
    NODE_ENV: getEnv("NODE_ENV", "development"),
    PORT: getEnv("PORT", "8000"),
    FRONTEND_ORIGIN: getEnv("FRONTEND_ORIGIN"),
    TELEGRAM_BOT_TOKEN: getEnv("TELEGRAM_BOT_TOKEN", ""),
    TELEGRAM_DEFAULT_CHAT_ID: getEnv("TELEGRAM_DEFAULT_CHAT_ID", ""),
} as const;