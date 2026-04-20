import { z } from "zod";

const apiErrorSchema = z.object({
  message: z.string().default("Unknown API error"),
  details: z.unknown().optional(),
  issues: z.unknown().optional(),
});

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api").replace(
  /\/$/,
  "",
);

export class ApiError extends Error {
  status: number;

  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  token?: string | null;
  body?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
}

function formatValidationIssue(issues: unknown) {
  if (!Array.isArray(issues) || issues.length === 0) {
    return null;
  }

  const firstIssue = issues[0];

  if (!firstIssue || typeof firstIssue !== "object") {
    return null;
  }

  const issue = firstIssue as Record<string, unknown>;
  const path = Array.isArray(issue.path) ? issue.path.join(".") : "";
  const code = typeof issue.code === "string" ? issue.code : "";

  if (path === "name" && code === "too_small") {
    return "Name must be at least 2 characters.";
  }

  if (path === "email") {
    return "Enter a valid email address.";
  }

  if (path === "password" && code === "too_small") {
    return "Password must be at least 8 characters.";
  }

  return typeof issue.message === "string" ? issue.message : null;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.formData ? {} : { "Content-Type": "application/json" }),
    },
    body: options.formData
      ? options.formData
      : options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
    signal: options.signal,
  });

  if (!response.ok) {
    const maybeError = apiErrorSchema.safeParse(await response.json().catch(() => null));
    const validationMessage =
      maybeError.success ? formatValidationIssue(maybeError.data.issues) : null;
    const details =
      maybeError.success ? (maybeError.data.details ?? maybeError.data.issues) : undefined;

    throw new ApiError(
      maybeError.success
        ? validationMessage ?? maybeError.data.message
        : `Request failed with status ${response.status}`,
      response.status,
      details,
    );
  }

  return (await response.json()) as T;
}
