import "dotenv/config";
import { getEnv } from "../utils/get-env.util";


export const Env = {
    DATABASE_URL: getEnv("DATABASE_URL"),
    JWT_SECRET: getEnv("JWT_SECRET"),
    JWT_EXPIRATION_TIME: getEnv("JWT_EXPIRATION_TIME"),
    NODE_ENV: getEnv("NODE_ENV", "development"),
    PORT: getEnv("PORT", "8000"),
    FRONTEND_ORIGIN: getEnv("FRONTEND_ORIGIN"),
} as const;