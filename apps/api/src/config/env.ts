import { existsSync } from "node:fs";
import { resolve } from "node:path";

import dotenv from "dotenv";
import { z } from "zod";

const candidateEnvFiles = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), ".env.local"),
  resolve(process.cwd(), "apps/api/.env"),
  resolve(process.cwd(), "apps/api/.env.local"),
  resolve(process.cwd(), "../../.env"),
  resolve(process.cwd(), "../../.env.local"),
];

const appLocalEnvFiles = [resolve(process.cwd(), ".env.local"), resolve(process.cwd(), "apps/api/.env.local")];

const aiProviderEnvKeys = [
  "AI_PROVIDER",
  "OPENAI_BASE_URL",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "OPENAI_FALLBACK_MODELS",
  "OPENAI_COMPATIBLE_BASE_URL",
  "OPENAI_COMPATIBLE_API_KEY",
  "OPENAI_COMPATIBLE_MODEL",
  "AI_API_KEY",
  "AI_MODEL",
] as const;

type AiProviderEnvKey = (typeof aiProviderEnvKeys)[number];

type EnvConflict = {
  key: AiProviderEnvKey;
  envFile: string;
  fileValue: string;
  previousValue: string;
  overridden: boolean;
};

const loadedEnvFiles: string[] = [];
const aiProviderEnvConflicts: EnvConflict[] = [];

for (const file of candidateEnvFiles) {
  if (existsSync(file)) {
    dotenv.config({ path: file, override: false });
    loadedEnvFiles.push(file);
  }
}

const isTest =
  process.env.NODE_ENV === "test" ||
  process.env.VITEST === "true" ||
  process.argv.join(" ").includes("vitest");

const isProduction = process.env.NODE_ENV === "production";

function maskSecret(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return "<missing>";
  }

  if (normalized.length <= 8) {
    return `${normalized.slice(0, 2)}***${normalized.slice(-2)}`;
  }

  return `${normalized.slice(0, 4)}***${normalized.slice(-4)}`;
}

function maskEnvValue(key: string, value: string) {
  return key.includes("KEY") || key.includes("SECRET") || key.includes("TOKEN") ? maskSecret(value) : value;
}

function applyLocalAiProviderOverrides() {
  if (isProduction) {
    return;
  }

  for (const file of appLocalEnvFiles) {
    if (!existsSync(file)) {
      continue;
    }

    const parsedLocalEnv = dotenv.config({ path: file, processEnv: {}, quiet: true }).parsed ?? {};

    for (const key of aiProviderEnvKeys) {
      const fileValue = parsedLocalEnv[key];

      if (fileValue === undefined) {
        continue;
      }

      const previousValue = process.env[key];

      if (previousValue !== undefined && previousValue !== fileValue) {
        aiProviderEnvConflicts.push({
          key,
          envFile: file,
          fileValue: maskEnvValue(key, fileValue),
          previousValue: maskEnvValue(key, previousValue),
          overridden: true,
        });
      }

      process.env[key] = fileValue;
    }
  }
}

applyLocalAiProviderOverrides();

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  AI_DIAGNOSTICS_LOG: z.enum(["true", "false"]).default("false"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_URL: z.string().url().default("http://localhost:3000"),
  MONGODB_URI: z
    .string()
    .min(1, "MONGODB_URI is required")
    .default("mongodb://127.0.0.1:27017/learn-with-me-test"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters").default("test-secret-123456"),
  AI_PROVIDER: z.literal("openai-compatible").default("openai-compatible"),
  OPENAI_BASE_URL: z.string().url().default("https://shopmmo.id.vn/v1"),
  OPENAI_API_KEY: z.string().default(""),
  OPENAI_MODEL: z.string().default("cx/gpt-5.5"),
  OPENAI_FALLBACK_MODELS: z.string().default(""),
  UPLOAD_MAX_MB: z.coerce.number().int().positive().default(6),
});

const openAiApiKey = process.env.OPENAI_API_KEY ?? process.env.OPENAI_COMPATIBLE_API_KEY ?? process.env.AI_API_KEY;

const parsed = envSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  AI_DIAGNOSTICS_LOG: process.env.AI_DIAGNOSTICS_LOG,
  API_PORT: process.env.API_PORT ?? process.env.PORT,
  WEB_URL: process.env.WEB_URL,
  MONGODB_URI: process.env.MONGODB_URI ?? (isTest ? "mongodb://127.0.0.1:27017/learn-with-me-test" : undefined),
  JWT_SECRET: process.env.JWT_SECRET ?? (isTest ? "test-secret-123456" : undefined),
  AI_PROVIDER: process.env.AI_PROVIDER,
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL ?? process.env.OPENAI_COMPATIBLE_BASE_URL,
  OPENAI_API_KEY: openAiApiKey?.trim(),
  OPENAI_MODEL: process.env.OPENAI_MODEL ?? process.env.OPENAI_COMPATIBLE_MODEL ?? process.env.AI_MODEL,
  OPENAI_FALLBACK_MODELS: process.env.OPENAI_FALLBACK_MODELS,
  UPLOAD_MAX_MB: process.env.UPLOAD_MAX_MB,
});

if (!parsed.success) {
  throw new Error(parsed.error.issues.map((issue) => issue.message).join("; "));
}

export const env = parsed.data;

export function getAiRuntimeDiagnostics() {
  return {
    aiProvider: env.AI_PROVIDER,
    openAiBaseUrl: env.OPENAI_BASE_URL,
    openAiModel: env.OPENAI_MODEL,
    openAiApiKey: {
      present: Boolean(env.OPENAI_API_KEY.trim()),
      masked: maskSecret(env.OPENAI_API_KEY),
      length: env.OPENAI_API_KEY.trim().length,
      source:
        process.env.OPENAI_API_KEY !== undefined
          ? "OPENAI_API_KEY"
          : process.env.OPENAI_COMPATIBLE_API_KEY !== undefined
            ? "OPENAI_COMPATIBLE_API_KEY"
            : process.env.AI_API_KEY !== undefined
              ? "AI_API_KEY"
              : null,
    },
    loadedEnvFiles,
    aiProviderEnvConflicts,
  };
}
