import { describe, expect, it } from "vitest";

import { extractJson } from "./json.js";

describe("extractJson", () => {
  it("parses direct JSON", () => {
    expect(extractJson<{ ok: boolean }>('{"ok":true}')).toEqual({ ok: true });
  });

  it("parses fenced JSON", () => {
    expect(extractJson<{ answer: number }>("```json\n{\"answer\":42}\n```")).toEqual({
      answer: 42,
    });
  });
});
