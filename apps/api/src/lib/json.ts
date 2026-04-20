import { AppError } from "./app-error.js";

export function extractJson<T>(rawText: string): T {
  const trimmed = rawText.trim();

  const directCandidates = [
    trimmed,
    trimmed.replace(/^```json\s*/i, "").replace(/```$/i, "").trim(),
    trimmed.replace(/^```\s*/i, "").replace(/```$/i, "").trim(),
  ];

  for (const candidate of directCandidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // Keep trying.
    }
  }

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");

  if (objectStart !== -1 && objectEnd !== -1 && objectEnd > objectStart) {
    const objectSlice = trimmed.slice(objectStart, objectEnd + 1);

    try {
      return JSON.parse(objectSlice) as T;
    } catch {
      // Fall through.
    }
  }

  throw new AppError("AI response was not valid JSON.", 502, { rawText });
}
