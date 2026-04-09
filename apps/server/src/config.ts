import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  SERVER_NAME: z.string().default("Nexa"),
  UNIVERSITY_NAME: z.string().default("Your University"),
  SESSION_SECRET: z.string().default("nexa-dev-secret"),
  TELEGRAM_CLIENT_ID: z.string().optional(),
  TELEGRAM_CLIENT_SECRET: z.string().optional(),
  TELEGRAM_REDIRECT_URI: z.string().default("http://localhost:3001/api/auth/telegram/callback"),
  TELEGRAM_SCOPES: z.string().default("openid profile")
});

const env = envSchema.parse(process.env);

export const appConfig = {
  port: env.PORT,
  clientOrigin: env.CLIENT_ORIGIN,
  serverName: env.SERVER_NAME,
  universityName: env.UNIVERSITY_NAME,
  sessionSecret: env.SESSION_SECRET,
  telegramClientId: env.TELEGRAM_CLIENT_ID ?? "",
  telegramClientSecret: env.TELEGRAM_CLIENT_SECRET ?? "",
  telegramRedirectUri: env.TELEGRAM_REDIRECT_URI,
  telegramScopes: env.TELEGRAM_SCOPES,
  telegramEnabled: Boolean(env.TELEGRAM_CLIENT_ID && env.TELEGRAM_CLIENT_SECRET)
} as const;
