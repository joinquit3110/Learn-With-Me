"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, Flame, NotebookPen, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-context";
import { MathText } from "@/components/math-text";
import { Button, Card, EmptyState, Input, SectionHeading, Select } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import type { ClassroomSummary, StudentDashboard } from "@/lib/contracts";
import { sentenceCase } from "@/lib/labels";

export default function StudentDashboardPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { token, user } = useAuth();
  const [joinCode, setJoinCode] = useState("");
  const [joinTrack, setJoinTrack] = useState<"default" | "core" | "extended">("default");

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", "student"],
    enabled: Boolean(token && user?.role === "student"),
    queryFn: () =>
      apiRequest<{ role: "student"; dashboard: StudentDashboard | null }>("/dashboard", {
        token,
      }),
  });

  const joinClassMutation = useMutation({
    mutationFn: async () =>
      apiRequest<{ classroom: ClassroomSummary }>("/classes/join", {
        method: "POST",
        token,
        body: {
          joinCode,
          ...(joinTrack === "default" ? {} : { track: joinTrack }),
        },
      }),
    onSuccess: (response) => {
      setJoinCode("");
      setJoinTrack("default");
      toast.success("Classroom joined.");
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      router.push(`/app/classes/${response.classroom.id}`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to join the classroom.");
    },
  });

  if (user?.role !== "student") {
    return (
      <main className="p-6">
        <EmptyState
          title="Student account required"
          description="Switch to a student account to practice exercises and build your notebook."
        />
      </main>
    );
  }

  const dashboard = dashboardQuery.data?.dashboard;

  return (
    <main className="space-y-6 p-2 lg:p-4">
      <Card className="overflow-hidden p-0">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6 p-6 sm:p-8">
            <SectionHeading
              eyebrow="Student Workspace"
              title="Practice until the logic clicks."
              description="Submit text or handwritten images, receive step-wise Socratic nudges, and turn each solved task into a revision notebook."
            />

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "XP", value: dashboard?.profile.stats.xp ?? 0, icon: Sparkles },
                { label: "Streak", value: dashboard?.profile.stats.streak ?? 0, icon: Flame },
                { label: "Badges", value: dashboard?.profile.stats.badges.length ?? 0, icon: BadgeCheck },
              ].map((stat) => (
                <Card key={stat.label} className="border-slate-200/70 bg-white/85 p-5">
                  <stat.icon size={18} className="text-teal-700" />
                  <p className="mt-5 text-4xl font-semibold text-slate-950">{stat.value}</p>
                  <p className="mt-1 text-sm text-slate-600">{stat.label}</p>
                </Card>
              ))}
            </div>
          </div>

          <div className="mesh-panel rounded-[28px] border-l border-slate-200/70 bg-slate-950/[0.025] p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-700">Join a class</p>
            <h2 className="mt-3 font-display text-4xl text-slate-950">Enter a live classroom</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Paste your teacher&apos;s join code, choose a track if needed, and your assigned exercises will
              appear immediately.
            </p>

            <div className="mt-6 space-y-3">
              <Input
                placeholder="Class join code"
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              />
              <Select
                value={joinTrack}
                onChange={(event) =>
                  setJoinTrack(event.target.value as "default" | "core" | "extended")
                }
              >
                <option value="default">Use teacher default track</option>
                <option value="core">Join as Core</option>
                <option value="extended">Join as Extended</option>
              </Select>
              <Button
                type="button"
                className="w-full justify-center"
                disabled={joinClassMutation.isPending || !joinCode.trim()}
                onClick={() => joinClassMutation.mutate()}
              >
                {joinClassMutation.isPending ? "Joining..." : "Join classroom"}
                <ArrowRight size={16} />
              </Button>
            </div>

            <div className="mt-6 rounded-[24px] border border-slate-200/70 bg-white/75 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-800">Notebook-ready wins</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Every solved exercise stores your corrected reasoning, past mistakes, and the insight that fixed
                them, so revision becomes faster before exams.
              </p>
              <Link
                href="/app/notebook"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold !text-white [&_svg]:text-white"
              >
                Open notebook
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-4">
          <SectionHeading
            eyebrow="Today's Focus"
            title="Pending practice"
            description="Resume the next exercise from any enrolled class. The AI remembers your prior attempts and adapts feedback accordingly."
          />

          {dashboard?.pendingExercises.length ? (
            <div className="grid gap-4">
              {dashboard.pendingExercises.map((exercise) => (
                <Card key={exercise.id} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <MathText text={exercise.title} className="font-display text-2xl text-slate-950" />
                    <div className="mt-2 max-h-24 overflow-hidden">
                      <MathText text={exercise.prompt} className="text-sm leading-6 text-slate-600" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                      <span className="rounded-full bg-teal-50 px-3 py-1">{exercise.classroomName}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">{exercise.difficulty}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">
                        {sentenceCase(exercise.lastStatus, "Not started")}
                      </span>
                    </div>
                  </div>

                  <Link
                    href={`/app/exercises/${exercise.id}`}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold !text-white [&_svg]:text-white"
                  >
                    Continue
                    <ArrowRight size={16} />
                  </Link>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nothing pending"
              description="Join a classroom or wait for your teacher to publish new exercises."
            />
          )}
        </section>

        <section className="space-y-4">
          <SectionHeading
            eyebrow="Recent Notebook"
            title="What you've already learned"
            description="Review the reasoning patterns you have already fixed so the same mistake doesn't come back."
          />

          {dashboard?.notebook.length ? (
            <div className="space-y-3">
              {dashboard.notebook.slice(0, 5).map((entry) => (
                <Card key={entry.id} className="border-slate-200/70 bg-white/85">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 rounded-2xl bg-amber-100 p-2 text-amber-900">
                      <NotebookPen size={16} />
                    </div>
                    <div>
                      <MathText text={entry.summary} className="font-semibold text-slate-950" />
                      <MathText text={entry.ahaMoment} className="mt-2 text-sm leading-6 text-slate-600" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Notebook empty"
              description="Solve your first exercise and the notebook will start capturing your progress automatically."
            />
          )}
        </section>
      </div>

      <section className="space-y-4">
        <SectionHeading
          eyebrow="Classes"
          title="Your enrolled classrooms"
          description="Jump back into any class and continue solving assigned exercises."
        />

        {dashboard?.classes.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {dashboard.classes.map((classroom) => (
              <Link key={classroom.id} href={`/app/classes/${classroom.id}`}>
                <Card className="h-full border-slate-200/70 bg-white/85 transition hover:-translate-y-0.5 hover:shadow-[0_24px_80px_-48px_rgba(15,23,42,0.5)]">
                  <p className="font-display text-2xl text-slate-950">{classroom.name}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {classroom.description || "No description yet."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded-full bg-slate-100 px-3 py-1">{classroom.track}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      {classroom.solvedCount ?? 0}/{classroom.exerciseCount ?? 0} solved
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No classes joined"
            description="Ask your teacher for a class join code, then enter it above to unlock your exercises."
          />
        )}
      </section>
    </main>
  );
}
