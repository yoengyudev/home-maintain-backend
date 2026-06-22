import 'dotenv/config';
import { z } from 'zod';

const rawEnvironmentSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PORT: z.coerce.number().int().positive().max(65_535).default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CLIENT_ORIGINS: z.string().min(1, 'CLIENT_ORIGINS is required'),
});

const parsed = rawEnvironmentSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', z.treeifyError(parsed.error));
  throw new Error('Invalid environment configuration');
}

const clientOrigins = parsed.data.CLIENT_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (clientOrigins.length === 0) {
  throw new Error('CLIENT_ORIGINS must contain at least one origin');
}

export const env = Object.freeze({
  databaseUrl: parsed.data.DATABASE_URL,
  port: parsed.data.PORT,
  nodeEnv: parsed.data.NODE_ENV,
  clientOrigins,
});

export type Environment = typeof env;
