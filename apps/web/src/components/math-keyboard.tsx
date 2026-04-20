"use client";

import { Sigma } from "lucide-react";

import { Button, Card } from "./ui";

const symbols = [
  { label: "x^2", value: "^2" },
  { label: "sqrt", value: "\\sqrt{}" },
  { label: "pi", value: "\\pi" },
  { label: "÷", value: "÷" },
  { label: "×", value: "×" },
  { label: "≤", value: "≤" },
  { label: "≥", value: "≥" },
  { label: "±", value: "±" },
  { label: "frac", value: "\\frac{}{}" },
  { label: "|x|", value: "\\left|x\\right|" },
];

export function MathKeyboard({ onInsert }: { onInsert: (value: string) => void }) {
  return (
    <Card className="border-slate-200/80 bg-white/85 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Sigma size={16} />
        Virtual Math Keyboard
      </div>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {symbols.map((symbol) => (
          <Button
            key={symbol.label}
            type="button"
            variant="secondary"
            className="rounded-2xl px-3 py-2 text-xs"
            onClick={() => onInsert(symbol.value)}
          >
            {symbol.label}
          </Button>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        LaTeX is supported in the chat. Wrap formulas with <code>$...$</code> or <code>$$...$$</code>.
      </p>
    </Card>
  );
}
