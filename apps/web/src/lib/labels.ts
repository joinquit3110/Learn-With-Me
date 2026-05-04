export function formatEnumLabel(value?: string | null, fallback = "Unknown") {
  const normalized = typeof value === "string" ? value.trim() : "";
  const humanized = normalized.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return humanized || fallback;
}

export function sentenceCase(value?: string | null, fallback = "Unknown") {
  const label = formatEnumLabel(value, fallback);
  if (label.toUpperCase() === "SOS") return "SOS";
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function titleCase(value?: string | null, fallback = "Unknown") {
  return formatEnumLabel(value, fallback)
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      const upperWord = word.toUpperCase();
      if (upperWord === "SOS") return "SOS";
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ") || fallback;
}

export function upperLabel(value?: string | null, fallback = "UNKNOWN") {
  return formatEnumLabel(value, fallback).toUpperCase();
}
