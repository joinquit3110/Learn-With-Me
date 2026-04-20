"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, BarChart3, BookOpenCheck, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-context";
import { Button, Card, EmptyState, Input, SectionHeading, Select } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import type { TeacherDashboard } from "@/lib/contracts";
import { sentenceCase } from "@/lib/labels";

export default function TeacherDashboardPage() {
  const queryClient = useQueryClient();
  const { token, user } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [gradeBand, setGradeBand] = useState("");
  const [defaultTrack, setDefaultTrack] = useState<"core" | "extended">("core");

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", "teacher"],
    enabled: Boolean(token && user?.role === "teacher"),
    queryFn: () =>
      apiRequest<{ role: "teacher"; dashboard: TeacherDashboard | null }>("/dashboard", {
        token,
      }),
  });

  const createClassMutation = useMutation({
    mutationFn: async () =>
      apiRequest("/classes", {
        method: "POST",
        token,
        body: {
          name: name.trim(),
          description: description.trim(),
          subject: subject.trim(),
          gradeBand: gradeBand.trim(),
          defaultTrack,
        },
      }),
    onSuccess: () => {
      setName("");
      setDescription("");
      setSubject("");
      setGradeBand("");
      toast.success("Class created.");
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to create class.");
    },
  });

  if (user?.role !== "teacher") {
    return (
      <main className="p-6">
        <EmptyState
          title="Teacher account required"
          description="Switch to a teacher account to manage classes and author exercises."
        />
      </main>
    );
  }

  const dashboard = dashboardQuery.data?.dashboard;
  const totalStudents = dashboard?.classes.reduce((sum, classroom) => sum + (classroom.studentCount ?? 0), 0) ?? 0;
  const totalExercises =
    dashboard?.classes.reduce((sum, classroom) => sum + (classroom.exerciseCount ?? 0), 0) ?? 0;
  const blindspots =
    dashboard?.analytics
      .flatMap((analytics) => analytics.blindspots)
      .sort((left, right) => right.count - left.count)
      .slice(0, 6) ?? [];

  return (
    <main className="space-y-6 p-2 lg:p-4">
      <Card className="overflow-hidden p-0">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6 p-6 sm:p-8">
            <SectionHeading
              eyebrow="Teacher Overview"
              title="Build classes that coach, not just grade."
              description="Author structured exercises, let Gemini draft Socratic hints, and track where students keep breaking down."
            />

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "Classes", value: dashboard?.classes.length ?? 0, icon: Users },
                { label: "Students", value: totalStudents, icon: BookOpenCheck },
                { label: "Exercises", value: totalExercises, icon: BarChart3 },
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
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-700">Create class</p>
            <div className="mt-4 space-y-3">
              <Input placeholder="Class name" value={name} onChange={(event) => setName(event.target.value)} />
              <Input
                placeholder="Short description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
              <Input
                placeholder="Subject, for example Mathematics"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
              <Input
                placeholder="Grade band, for example Grades 9-10"
                value={gradeBand}
                onChange={(event) => setGradeBand(event.target.value)}
              />
              <Select
                value={defaultTrack}
                onChange={(event) => setDefaultTrack(event.target.value as "core" | "extended")}
              >
                <option value="core">Default track: Core</option>
                <option value="extended">Default track: Extended</option>
              </Select>
              <Button
                type="button"
                className="w-full justify-center"
                disabled={createClassMutation.isPending || !name.trim() || !subject.trim() || !gradeBand.trim()}
                onClick={() => createClassMutation.mutate()}
              >
                <Plus size={16} />
                {createClassMutation.isPending ? "Creating..." : "Create classroom"}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-4">
          <SectionHeading
            eyebrow="Active Classes"
            title="Your live classrooms"
            description="Jump into a class to author exercises, review the roster, and watch concept blind spots form."
          />

          {dashboard?.classes.length ? (
            <div className="grid gap-4">
              {dashboard.classes.map((classroom) => (
                <Card key={classroom.id} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-display text-2xl text-slate-950">{classroom.name}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{classroom.description || "No description yet."}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                      <span className="rounded-full bg-teal-50 px-3 py-1">Join code {classroom.joinCode}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">{classroom.subject}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">{classroom.gradeBand}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">{classroom.studentCount ?? 0} students</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">{classroom.exerciseCount ?? 0} exercises</span>
                    </div>
                  </div>

                  <Link
                    href={`/app/classes/${classroom.id}`}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold !text-white [&_svg]:text-white"
                  >
                    Open class
                    <ArrowRight size={16} />
                  </Link>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No classrooms yet"
              description="Create your first classroom to start enrolling students and publishing exercises."
            />
          )}
        </section>

        <section className="space-y-4">
          <SectionHeading
            eyebrow="Signals"
            title="Where learners are getting stuck"
            description="Blind spots update from student attempts, so you can reteach the exact concept causing friction."
          />

          {blindspots.length ? (
            <div className="space-y-3">
              {blindspots.map((blindspot) => (
                <Card key={`${blindspot.stepTitle}-${blindspot.concept}`} className="border-slate-200/70 bg-white/85">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-950">{blindspot.concept}</p>
                      <p className="mt-1 text-sm text-slate-600">{blindspot.stepTitle}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold text-slate-950">{blindspot.percentage}%</p>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        {blindspot.count} errors
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No analytics yet"
              description="Once students submit work, classroom blind spots and mastery heatmaps will appear here."
            />
          )}

          <Card className="border-rose-200 bg-rose-50/80">
            <div className="flex items-center gap-2 text-sm font-semibold text-rose-900">
              <AlertTriangle size={16} />
              Flagged learners
            </div>
            <div className="mt-4 space-y-3">
              {dashboard?.flaggedSubmissions.length ? (
                dashboard.flaggedSubmissions.slice(0, 5).map((submission) => (
                  <div key={submission.id} className="rounded-2xl border border-rose-200/80 bg-white/70 px-4 py-3 text-sm">
                    <p className="font-semibold text-slate-950">{sentenceCase(submission.status)}</p>
                    <p className="mt-1 text-slate-600">{submission.wrongAttemptCount} repeated wrong attempts</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-rose-900/70">No learners are currently flagged for escalation.</p>
              )}
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}
