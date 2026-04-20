"use client";

import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";

import { useAuth } from "@/components/auth-context";
import { MathText } from "@/components/math-text";
import { Badge, Card, EmptyState, SectionHeading } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import type { NotebookEntry } from "@/lib/contracts";

export default function NotebookPage() {
  const { token, user } = useAuth();

  const notebookQuery = useQuery({
    queryKey: ["notebook"],
    enabled: Boolean(token && user?.role === "student"),
    queryFn: () => apiRequest<{ entries: NotebookEntry[] }>("/notebook", { token }),
  });

  if (user?.role !== "student") {
    return (
      <main className="p-6">
        <EmptyState
          title="Notebook is student-only"
          description="Switch to a student account to review saved solutions and reflection notes."
        />
      </main>
    );
  }

  const entries = notebookQuery.data?.entries ?? [];

  return (
    <main className="space-y-6 p-2 lg:p-4">
      <SectionHeading
        eyebrow="Digital Notebook"
        title="Revision pages built from your actual thinking"
        description="Each entry captures what you fixed, why it was wrong, and the sequence that finally worked."
      />

      {entries.length ? (
        <div className="grid gap-4">
          {entries.map((entry) => (
            <Card key={entry.id} className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <MathText text={entry.summary} className="font-display text-3xl text-slate-950" />
                  <p className="mt-2 text-sm text-slate-500">
                    Saved {dayjs(entry.createdAt).format("DD MMM YYYY, HH:mm")}
                  </p>
                </div>
                {entry.awardedBadge ? <Badge>{entry.awardedBadge}</Badge> : null}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[24px] border border-slate-200/70 bg-slate-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">Solved Strategy</p>
                  <MathText text={entry.solvedStrategy} className="mt-3 text-sm text-slate-700" />
                </div>
                <div className="rounded-[24px] border border-amber-200/70 bg-amber-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-800">Aha Moment</p>
                  <MathText text={entry.ahaMoment} className="mt-3 text-sm text-amber-950" />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-[24px] border border-slate-200/70 bg-white/80 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Timeline</p>
                  <div className="mt-3 space-y-2">
                    {entry.timeline.map((moment, index) => (
                      <div key={`${entry.id}-moment-${index}`} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <MathText text={moment} className="text-sm text-slate-700" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200/70 bg-white/80 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Mistakes Repaired</p>
                  <div className="mt-3 space-y-3">
                    {entry.mistakes.length ? (
                      entry.mistakes.map((mistake, index) => (
                        <div
                          key={`${entry.id}-mistake-${index}`}
                          className="rounded-2xl border border-slate-200/70 bg-slate-50 px-4 py-3 text-sm"
                        >
                          <p className="font-semibold text-slate-950">{mistake.stepTitle}</p>
                          <MathText text={mistake.issue} className="mt-2 text-slate-600" />
                          <MathText text={mistake.fix} className="mt-2 text-teal-700" />
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-600">No explicit mistakes were recorded for this solution.</p>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No notebook entries yet"
          description="Solve your first exercise and Learn With Me will archive the corrected reasoning here."
        />
      )}
    </main>
  );
}
