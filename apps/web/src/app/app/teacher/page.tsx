"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BarChart3, BookOpenCheck, Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-context";
import { Button, Card, EmptyState, Input, SectionHeading, Select } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import type { SubmissionTriageStatus, TeacherDashboard } from "@/lib/contracts";
import { sentenceCase, titleCase } from "@/lib/labels";

type FlaggedSubmission = NonNullable<TeacherDashboard["flaggedSubmissions"]>[number];
type SignalTab = "active" | "sos" | "watching" | "resolved";
type SignalSort = "urgent" | "learners" | "errors" | "newest";

function getSubmissionUrgency(submission: FlaggedSubmission) {
  if (submission.sosTriggered || submission.status === "sos") return 4;
  if (submission.teacherFlagged || submission.status === "needs_review") return 3;
  if (submission.triageStatus === "watching") return 2;
  return 1;
}

function isResolvedSignal(submission: FlaggedSubmission) {
  return submission.triageStatus === "resolved" || submission.triageStatus === "dismissed";
}

function isCorrectSignal(submission: FlaggedSubmission) {
  return submission.status === "correct";
}

function isVisibleInTab(submission: FlaggedSubmission, tab: SignalTab) {
  const isResolved = isResolvedSignal(submission);
  const isCorrect = isCorrectSignal(submission);

  if (tab === "resolved") return isResolved;
  if (isCorrect || isResolved) return false;
  if (tab === "sos") return submission.sosTriggered || submission.status === "sos";
  if (tab === "watching") return submission.triageStatus === "watching";
  return submission.triageStatus !== "watching";
}

export default function TeacherDashboardPage() {
  const queryClient = useQueryClient();
  const { token, user } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [gradeBand, setGradeBand] = useState("");
  const [defaultTrack, setDefaultTrack] = useState<"core" | "extended">("core");
  const [signalClassFilter, setSignalClassFilter] = useState("all");
  const [signalExerciseFilter, setSignalExerciseFilter] = useState("all");
  const [signalSearch, setSignalSearch] = useState("");
  const [signalTab, setSignalTab] = useState<SignalTab>("active");
  const [signalSort, setSignalSort] = useState<SignalSort>("urgent");

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", "teacher"],
    enabled: Boolean(token && user?.role === "teacher"),
    queryFn: () => apiRequest<{ role: "teacher"; dashboard: TeacherDashboard | null }>("/dashboard", { token }),
  });

  const createClassMutation = useMutation({
    mutationFn: async () =>
      apiRequest("/classes", {
        method: "POST",
        token,
        body: { name: name.trim(), description: description.trim(), subject: subject.trim(), gradeBand: gradeBand.trim(), defaultTrack },
      }),
    onSuccess: () => {
      setName("");
      setDescription("");
      setSubject("");
      setGradeBand("");
      toast.success("Class created.");
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to create class."),
  });

  const triageMutation = useMutation({
    mutationFn: async ({ submissionId, status }: { submissionId: string; status: SubmissionTriageStatus }) =>
      apiRequest(`/dashboard/submissions/${submissionId}/triage`, {
        method: "PATCH",
        token,
        body: { status },
      }),
    onSuccess: () => {
      toast.success("Signal updated.");
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to update signal."),
  });

  const dashboard = dashboardQuery.data?.dashboard;
  const totalStudents = dashboard?.classes.reduce((sum, classroom) => sum + (classroom.studentCount ?? 0), 0) ?? 0;
  const totalExercises = dashboard?.classes.reduce((sum, classroom) => sum + (classroom.exerciseCount ?? 0), 0) ?? 0;
  const submissions = useMemo(() => dashboard?.flaggedSubmissions ?? [], [dashboard?.flaggedSubmissions]);

  const signalClassOptions = useMemo(() => {
    const options = new Map<string, string>();
    submissions.forEach((submission) => options.set(submission.classroomId, submission.classroomName));
    return Array.from(options, ([id, name]) => ({ id, name })).sort((left, right) => left.name.localeCompare(right.name));
  }, [submissions]);

  const signalExerciseOptions = useMemo(() => {
    const options = new Map<string, string>();
    submissions
      .filter((submission) => signalClassFilter === "all" || submission.classroomId === signalClassFilter)
      .forEach((submission) => options.set(submission.exerciseId, submission.exerciseTitle));
    return Array.from(options, ([id, title]) => ({ id, title })).sort((left, right) => left.title.localeCompare(right.title));
  }, [signalClassFilter, submissions]);

  const filteredSignals = useMemo(() => {
    const query = signalSearch.trim().toLowerCase();
    return submissions
      .filter((submission) => {
        const matchesTab = isVisibleInTab(submission, signalTab);
        const matchesClass = signalClassFilter === "all" || submission.classroomId === signalClassFilter;
        const matchesExercise = signalExerciseFilter === "all" || submission.exerciseId === signalExerciseFilter;
        const matchesSearch = !query || [submission.studentName, submission.studentEmail, submission.status, submission.triageStatus, submission.classroomName, submission.exerciseTitle, submission.triageNote].filter(Boolean).join(" ").toLowerCase().includes(query);
        return matchesTab && matchesClass && matchesExercise && matchesSearch;
      })
      .sort((left, right) => {
        if (signalSort === "learners") return left.classroomName.localeCompare(right.classroomName) || left.studentName.localeCompare(right.studentName);
        if (signalSort === "errors") return right.wrongAttemptCount - left.wrongAttemptCount || right.attemptCount - left.attemptCount;
        if (signalSort === "newest") return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
        return getSubmissionUrgency(right) - getSubmissionUrgency(left) || right.wrongAttemptCount - left.wrongAttemptCount;
      });
  }, [signalClassFilter, signalExerciseFilter, signalSearch, signalSort, signalTab, submissions]);

  const tabCounts = useMemo(() => ({
    active: submissions.filter((submission) => isVisibleInTab(submission, "active")).length,
    sos: submissions.filter((submission) => isVisibleInTab(submission, "sos")).length,
    watching: submissions.filter((submission) => isVisibleInTab(submission, "watching")).length,
    resolved: submissions.filter((submission) => isVisibleInTab(submission, "resolved")).length,
  }), [submissions]);

  if (user?.role !== "teacher") {
    return (
      <main className="p-6">
        <EmptyState title="Teacher account required" description="Switch to a teacher account to manage classes and author exercises." />
      </main>
    );
  }

  return (
    <main className="space-y-6 p-2 lg:p-4">
      <Card className="overflow-hidden p-0">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6 p-6 sm:p-8">
            <SectionHeading eyebrow="Teacher Overview" title="Build classes that coach, not just grade." description="Author structured exercises, let Gemini draft Socratic hints, and track where students keep breaking down." />
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
              <Input placeholder="Short description" value={description} onChange={(event) => setDescription(event.target.value)} />
              <Input placeholder="Subject, for example Mathematics" value={subject} onChange={(event) => setSubject(event.target.value)} />
              <Input placeholder="Grade band, for example Grades 9-10" value={gradeBand} onChange={(event) => setGradeBand(event.target.value)} />
              <Select value={defaultTrack} onChange={(event) => setDefaultTrack(event.target.value as "core" | "extended")}>
                <option value="core">Default track: Core</option>
                <option value="extended">Default track: Extended</option>
              </Select>
              <Button type="button" className="w-full justify-center" disabled={createClassMutation.isPending || !name.trim() || !subject.trim() || !gradeBand.trim()} onClick={() => createClassMutation.mutate()}>
                <Plus size={16} />
                {createClassMutation.isPending ? "Creating..." : "Create classroom"}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-4">
          <SectionHeading eyebrow="Active Classes" title="Your live classrooms" description="Jump into a class to author exercises, review the roster, and watch concept blind spots form." />
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
                  <Link href={`/app/classes/${classroom.id}`} className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold !text-white [&_svg]:text-white">
                    Open class
                    <ArrowRight size={16} />
                  </Link>
                </Card>
              ))}
            </div>
          ) : <EmptyState title="No classrooms yet" description="Create your first classroom to start enrolling students and publishing exercises." />}
        </section>

        <section className="space-y-4">
          <SectionHeading eyebrow="Signals inbox" title="Triage learner signals" description="Review active SOS and flagged submissions, mark what you are watching, and clear resolved cases from the default view." />
          {submissions.length ? (
            <Card className="border-slate-200/70 bg-white/85 p-3 sm:p-4">
              <div className="flex flex-wrap gap-2">
                {([
                  ["active", "Active"],
                  ["sos", "SOS"],
                  ["watching", "Watching"],
                  ["resolved", "Resolved"],
                ] as const).map(([tab, label]) => (
                  <button key={tab} type="button" onClick={() => setSignalTab(tab)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${signalTab === tab ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"}`}>
                    {label} {tabCounts[tab]}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Class<Select className="mt-2 normal-case tracking-normal" value={signalClassFilter} onChange={(event) => { setSignalClassFilter(event.target.value); setSignalExerciseFilter("all"); }}><option value="all">All classes</option>{signalClassOptions.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.name}</option>)}</Select></label>
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Exercise<Select className="mt-2 normal-case tracking-normal" value={signalExerciseFilter} onChange={(event) => setSignalExerciseFilter(event.target.value)}><option value="all">All exercises</option>{signalExerciseOptions.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.title}</option>)}</Select></label>
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Sort<Select className="mt-2 normal-case tracking-normal" value={signalSort} onChange={(event) => setSignalSort(event.target.value as SignalSort)}><option value="urgent">Most urgent</option><option value="learners">Most learners</option><option value="errors">Most errors</option><option value="newest">Newest</option></Select></label>
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Search<div className="relative mt-2"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><Input className="pl-9 normal-case tracking-normal" placeholder="Learner, class, exercise..." value={signalSearch} onChange={(event) => setSignalSearch(event.target.value)} /></div></label>
              </div>
              <div className="mt-3 max-h-[680px] space-y-2 overflow-y-auto pr-1 [scrollbar-color:#0f766e_#e2e8f0] [scrollbar-width:thin]">
                {filteredSignals.map((submission) => (
                  <div key={submission.id} className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-3 transition hover:border-teal-200 hover:bg-white">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-[11px] font-semibold text-teal-800">{titleCase(submission.triageStatus)}</span>
                          {submission.sosTriggered ? <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-semibold text-rose-800">SOS</span> : null}
                          {submission.teacherFlagged ? <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">Flagged</span> : null}
                          <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] text-slate-600">{submission.classroomName}</span>
                        </div>
                        <p className="mt-2 font-semibold text-slate-950">{submission.studentName} · {sentenceCase(submission.status)}</p>
                        <p className="mt-0.5 line-clamp-1 text-sm text-slate-600">{submission.exerciseTitle}</p>
                        <p className="mt-0.5 text-sm text-slate-600">{submission.wrongAttemptCount} wrong · {submission.attemptCount} attempts · {submission.studentEmail ?? "No email"}</p>
                        {submission.triageNote ? <p className="mt-1 rounded-2xl bg-white px-3 py-1 text-xs text-slate-600">{submission.triageNote}</p> : null}
                      </div>
                      <Link href={`/app/classes/${submission.classroomId}`} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold !text-white [&_svg]:text-white">Open class<ArrowRight size={14} /></Link>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {submission.triageStatus !== "watching" ? <Button type="button" variant="secondary" disabled={triageMutation.isPending} onClick={() => triageMutation.mutate({ submissionId: submission.id, status: "watching" })}>Mark watching</Button> : null}
                      {submission.triageStatus !== "resolved" ? <Button type="button" variant="secondary" disabled={triageMutation.isPending} onClick={() => triageMutation.mutate({ submissionId: submission.id, status: "resolved" })}>Resolve</Button> : null}
                      {submission.triageStatus !== "dismissed" ? <Button type="button" variant="ghost" disabled={triageMutation.isPending} onClick={() => triageMutation.mutate({ submissionId: submission.id, status: "dismissed" })}>Dismiss</Button> : null}
                      {submission.triageStatus === "resolved" || submission.triageStatus === "dismissed" ? <Button type="button" variant="secondary" disabled={triageMutation.isPending} onClick={() => triageMutation.mutate({ submissionId: submission.id, status: "open" })}>Reopen</Button> : null}
                    </div>
                  </div>
                ))}
                {!filteredSignals.length ? <EmptyState title="No matching signals" description="Try clearing a filter or switching tabs." /> : null}
              </div>
            </Card>
          ) : <EmptyState title="No signals yet" description="Active SOS and flagged submissions will appear here once students submit work." />}
        </section>
      </div>
    </main>
  );
}
