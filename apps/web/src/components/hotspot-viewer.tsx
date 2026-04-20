"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";

import type { FeedbackHotspot } from "@/lib/contracts";

import { MathText } from "./math-text";
import { Card } from "./ui";

export function HotspotViewer({
  imageUrl,
  hotspot,
}: {
  imageUrl: string;
  hotspot: FeedbackHotspot;
}) {
  const [revealed, setRevealed] = useState(false);
  const left = `${hotspot.x * 100}%`;
  const top = `${hotspot.y * 100}%`;
  const width = `${hotspot.width * 100}%`;
  const height = `${hotspot.height * 100}%`;

  return (
    <Card className="overflow-hidden p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
        <AlertTriangle size={16} className="text-orange-600" />
        Focus on the highlighted line
      </div>

      <div className="relative overflow-hidden rounded-[26px] border border-slate-200 bg-slate-950/4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="Student work upload" className="w-full object-contain" />
        <div
          className="pointer-events-none absolute rounded-[18px] border-2 border-orange-500/90 bg-orange-500/12 shadow-[0_0_0_12px_rgba(249,115,22,0.08)]"
          style={{
            left,
            top,
            width,
            height,
          }}
        />
        <button
          type="button"
          aria-label="Reveal coaching question"
          onClick={() => setRevealed((current) => !current)}
          className="absolute h-5 w-5 rounded-full bg-orange-500 shadow-[0_0_0_12px_rgba(249,115,22,0.16)] outline-none transition hover:scale-110 focus-visible:ring-2 focus-visible:ring-orange-500 animate-pulse"
          style={{
            left: `calc(${left} + ${width} / 2 - 0.5rem)`,
            top: `calc(${top} + ${height} / 2 - 0.5rem)`,
          }}
        />
      </div>

      <div className="mt-4 rounded-3xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-950">
        <MathText
          text={
            revealed
              ? hotspot.question
              : "Tap the pulsing marker to reveal the exact coaching question for this line."
          }
          className="text-sm text-orange-950"
        />
      </div>
    </Card>
  );
}
