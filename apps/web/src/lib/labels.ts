export function formatEnumLabel(value?: string | null, fallback = "Unknown") {
  const normalized = typeof value === "string" ? value.trim() : "";
  const humanized = normalized.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return humanized || fallback;
}

export function sentenceCase(value?: string | null, fallback = "Unknown") {
  const label = formatEnumLabel(value, fallback);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function upperLabel(value?: string | null, fallback = "UNKNOWN") {
  return formatEnumLabel(value, fallback).toUpperCase();
}
