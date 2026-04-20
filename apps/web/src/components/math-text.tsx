"use client";

import katex from "katex";

import { cn } from "@/lib/cn";

type MathToken =
  | {
      type: "text";
      value: string;
    }
  | {
      type: "math";
      value: string;
      displayMode: boolean;
    };

const bareMathPattern =
  /\\(?:frac|sqrt|pi|theta|alpha|beta|gamma|sin|cos|tan|log|ln)[A-Za-z0-9(){}\\]*|[A-Za-z0-9().{}\\]+(?:\s*(?:=|<=|>=|<|>|[+\-*/^])\s*[A-Za-z0-9().{}\\]+)+/g;

function findClosingDelimiter(value: string, start: number, delimiter: string) {
  let cursor = start;

  while (cursor < value.length) {
    const nextIndex = value.indexOf(delimiter, cursor);

    if (nextIndex < 0) {
      return -1;
    }

    if (value[nextIndex - 1] !== "\\") {
      return nextIndex;
    }

    cursor = nextIndex + delimiter.length;
  }

  return -1;
}

function tokenizeMath(value: string) {
  const tokens: MathToken[] = [];
  let cursor = 0;

  while (cursor < value.length) {
    const startIndex = (() => {
      const candidates = [
        value.indexOf("$$", cursor),
        value.indexOf("\\[", cursor),
        value.indexOf("\\(", cursor),
        value.indexOf("$", cursor),
      ].filter((index) => index >= 0);

      return candidates.length > 0 ? Math.min(...candidates) : -1;
    })();

    if (startIndex < 0) {
      tokens.push({ type: "text", value: value.slice(cursor) });
      break;
    }

    if (startIndex > cursor) {
      tokens.push({ type: "text", value: value.slice(cursor, startIndex) });
    }

    const startsWith = (delimiter: string) => value.startsWith(delimiter, startIndex);

    if (startsWith("$$")) {
      const endIndex = findClosingDelimiter(value, startIndex + 2, "$$");

      if (endIndex > startIndex + 2) {
        tokens.push({
          type: "math",
          value: value.slice(startIndex + 2, endIndex).trim(),
          displayMode: true,
        });
        cursor = endIndex + 2;
        continue;
      }
    }

    if (startsWith("\\[")) {
      const endIndex = findClosingDelimiter(value, startIndex + 2, "\\]");

      if (endIndex > startIndex + 2) {
        tokens.push({
          type: "math",
          value: value.slice(startIndex + 2, endIndex).trim(),
          displayMode: true,
        });
        cursor = endIndex + 2;
        continue;
      }
    }

    if (startsWith("\\(")) {
      const endIndex = findClosingDelimiter(value, startIndex + 2, "\\)");

      if (endIndex > startIndex + 2) {
        tokens.push({
          type: "math",
          value: value.slice(startIndex + 2, endIndex).trim(),
          displayMode: false,
        });
        cursor = endIndex + 2;
        continue;
      }
    }

    if (startsWith("$") && !startsWith("$$") && value[startIndex - 1] !== "\\") {
      const endIndex = findClosingDelimiter(value, startIndex + 1, "$");

      if (endIndex > startIndex + 1) {
        tokens.push({
          type: "math",
          value: value.slice(startIndex + 1, endIndex).trim(),
          displayMode: false,
        });
        cursor = endIndex + 1;
        continue;
      }
    }

    tokens.push({ type: "text", value: value[startIndex] });
    cursor = startIndex + 1;
  }

  return tokens
    .flatMap((token) => (token.type === "text" ? tokenizeBareMathText(token.value) : token))
    .filter((token) => token.value.length > 0);
}

function looksBareMathCandidate(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return false;
  }

  if (/^\\(?:frac|sqrt|pi|theta|alpha|beta|gamma|sin|cos|tan|log|ln)\b/i.test(normalized)) {
    return true;
  }

  if (!/[A-Za-z0-9]/.test(normalized)) {
    return false;
  }

  if (!(/[\d=^/<>]/.test(normalized) || /(?:\d[^A-Za-z]*\(|\)[^A-Za-z]*\d)/.test(normalized))) {
    return false;
  }

  const nonMathWords = (normalized.match(/[A-Za-z]{2,}/g) ?? []).filter(
    (word) => !["sqrt", "frac", "pi", "theta", "alpha", "beta", "gamma", "sin", "cos", "tan", "log", "ln"].includes(word.toLowerCase()),
  );

  return nonMathWords.length <= 1;
}

function tokenizeBareMathText(value: string): MathToken[] {
  const tokens: MathToken[] = [];
  let cursor = 0;

  for (const match of value.matchAll(bareMathPattern)) {
    const candidate = match[0];
    const index = match.index ?? 0;

    if (!looksBareMathCandidate(candidate)) {
      continue;
    }

    if (index > cursor) {
      tokens.push({ type: "text", value: value.slice(cursor, index) });
    }

    tokens.push({
      type: "math",
      value: candidate.trim(),
      displayMode: false,
    });
    cursor = index + candidate.length;
  }

  if (cursor < value.length) {
    tokens.push({ type: "text", value: value.slice(cursor) });
  }

  return tokens.length > 0 ? tokens : [{ type: "text", value }];
}

function renderKatex(value: string, displayMode: boolean) {
  try {
    return katex.renderToString(value, {
      displayMode,
      throwOnError: false,
      strict: "ignore",
      output: "html",
      trust: false,
    });
  } catch {
    return null;
  }
}

export function MathText({
  text,
  className,
}: {
  text?: string | null;
  className?: string;
}) {
  const normalized = text?.replace(/\r/g, "").trim();

  if (!normalized) {
    return null;
  }

  const paragraphs = normalized.split(/\n{2,}/).filter(Boolean);

  return (
    <div className={cn("space-y-3", className)}>
      {paragraphs.map((paragraph, paragraphIndex) => {
        const lines = paragraph.split("\n");

        return (
          <p
            key={`math-paragraph-${paragraphIndex}`}
            className="whitespace-pre-wrap break-words leading-[1.8]"
          >
            {lines.map((line, lineIndex) => (
              <span key={`math-line-${paragraphIndex}-${lineIndex}`}>
                {tokenizeMath(line).map((token, tokenIndex) => {
                  if (token.type === "text") {
                    return (
                      <span key={`math-token-${paragraphIndex}-${lineIndex}-${tokenIndex}`}>
                        {token.value}
                      </span>
                    );
                  }

                  const rendered = renderKatex(token.value, token.displayMode);

                  if (!rendered) {
                    return (
                      <span key={`math-token-${paragraphIndex}-${lineIndex}-${tokenIndex}`}>
                        {token.displayMode ? `$$${token.value}$$` : `$${token.value}$`}
                      </span>
                    );
                  }

                  return (
                    <span
                      key={`math-token-${paragraphIndex}-${lineIndex}-${tokenIndex}`}
                      className={cn(
                        "align-middle",
                        token.displayMode && "my-3 block overflow-x-auto overflow-y-hidden",
                      )}
                      dangerouslySetInnerHTML={{ __html: rendered }}
                    />
                  );
                })}
                {lineIndex < lines.length - 1 ? <br /> : null}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
