import { existsSync } from "node:fs";
import { resolve } from "node:path";

import dotenv from "dotenv";
import { z } from "zod";

const candidateEnvFiles = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), ".env.local"),
  resolve(process.cwd(), "../../.env"),
  resolve(process.cwd(), "../../.env.local"),
];

for (const file of candidateEnvFiles) {
  if (existsSync(file)) {
    dotenv.config({ path: file, override: false });
  }
}

const isTest =
  process.env.NODE_ENV === "test" ||
  process.env.VITEST === "true" ||
  process.argv.join(" ").includes("vitest");

const envSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_URL: z.string().url().default("http://localhost:3000"),
  MONGODB_URI: z
    .string()
    .min(1, "MONGODB_URI is required")
    .default("mongodb://127.0.0.1:27017/learn-with-me-test"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters").default("test-secret-123456"),
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required").default("test-gemini-key"),
  GEMINI_MODEL: z.string().min(1).default("gemini-2.0-flash"),
  GEMINI_FALLBACK_MODELS: z.string().default(""),
  UPLOAD_MAX_MB: z.coerce.number().int().positive().default(6),
});

const parsed = envSchema.safeParse({
  API_PORT: process.env.API_PORT ?? process.env.PORT,
  WEB_URL: process.env.WEB_URL,
  MONGODB_URI: process.env.MONGODB_URI ?? (isTest ? "mongodb://127.0.0.1:27017/learn-with-me-test" : undefined),
  JWT_SECRET: process.env.JWT_SECRET ?? (isTest ? "test-secret-123456" : undefined),
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? (isTest ? "test-gemini-key" : undefined),
  GEMINI_MODEL: process.env.GEMINI_MODEL,
  GEMINI_FALLBACK_MODELS: process.env.GEMINI_FALLBACK_MODELS,
  UPLOAD_MAX_MB: process.env.UPLOAD_MAX_MB,
});

if (!parsed.success) {
  throw new Error(parsed.error.issues.map((issue) => issue.message).join("; "));
}

export const env = parsed.data;
