"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  CheckCircle2,
  Clock3,
  FileImage,
  FileText,
  MessageSquareText,
  PencilLine,
  Sparkles,
  Target,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/components/auth-context";
import { ExerciseEditor } from "@/components/exercise-editor";
import { MathText } from "@/components/math-text";
import { Badge, Button, Card, EmptyState, LoadingPanel, SectionHeading } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { AttachmentRecord, StudentClassroomDetail, TeacherClassroomDetail, TeacherStudentHistoryCopilotResponse, TeacherStudentHistoryResponse } from "@/lib/contracts";
import { sentenceCase } from "@/lib/labels";

type ClassroomDetail = TeacherClassroomDetail | StudentClassroomDetail;

function isTeacherDetail(detail: ClassroomDetail): detail is TeacherClassroomDetail {
  return "roster" in detail;
}

function formatDue(value: string | null) {
  return value ? dayjs(value).format("DD MMM YYYY, HH:mm") : "No due date";
}

function exerciseStatusTone(status: "draft" | "published") {
  return status === "published"
    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : "border-amber-200 bg-amber-50 text-amber-900";
}

function submissionStatusTone(status: string) {
  if (status === "correct") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "sos") return "border-rose-200 bg-rose-50 text-rose-900";
  if (status === "guardrail") return "border-orange-200 bg-orange-50 text-orange-900";
  if (status === "needs_review") return "border-sky-200 bg-sky-50 text-sky-900";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function BlindspotLearners({ learners }: { learners: NonNullable<TeacherClassroomDetail["analytics"]>["blindspots"][number]["relatedLearners"] }) {
  return (
    <div className="pointer-events-none absolute left-3 right-3 top-[calc(100%-0.25rem)] z-[80] hidden overflow-hidden rounded-[22px] border border-teal-100 bg-white/95 p-2 text-xs shadow-[0_28px_90px_-28px_rgba(15,23,42,0.55)] ring-1 ring-slate-950/5 backdrop-blur group-hover:block group-focus-within:block">
      <div className="max-h-72 space-y-1 overflow-y-auto pr-1 [scrollbar-color:#0f766e_#e2e8f0] [scrollbar-width:thin]">
        {learners.length ? learners.map((learner) => (
          <div key={`${learner.submissionId}-${learner.studentId}`} className="rounded-2xl bg-slate-50 px-3 py-2">
            <p className="font-semibold text-slate-950">{learner.studentName} · {learner.classroomName}</p>
            <p className="mt-1 text-slate-600">{learner.exerciseTitle} · {sentenceCase(learner.status)}</p>
            <p className="mt-1 text-slate-500">{learner.occurrences} occurrence(s) · {learner.wrongAttemptCount}/{learner.attemptCount} wrong attempts</p>
          </div>
        )) : <p className="p-2 text-slate-600">No learner details available.</p>}
      </div>
    </div>
  );
}

function HistoryAttachment({ attachment }: { attachment: AttachmentRecord }) {
  if (attachment.kind === "image" && attachment.dataUrl) {
    return (
      <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-950/4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={attachment.dataUrl} alt={attachment.originalName} className="max-h-[320px] w-full object-contain" />
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white/80 px-4 py-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        {attachment.kind === "pdf" ? <FileText size={16} className="text-amber-700" /> : <FileImage size={16} className="text-teal-700" />}
        <span>{attachment.originalName}</span>
      </div>
      <p className="mt-2 text-sm text-slate-600">{attachment.kind === "pdf" ? "PDF uploaded by the learner." : "Image uploaded by the learner."}</p>
      {attachment.dataUrl ? (
        <a href={attachment.dataUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold !text-white">
          Open {attachment.kind === "pdf" ? "PDF" : "file"}
        </a>
      ) : null}
    </div>
  );
}

export default function ClassroomDetailPage() {
  const queryClient = useQueryClient();
  const params = useParams();
  const searchParams = useSearchParams();
  const { token, user } = useAuth();
  const [manualEditingExerciseId, setManualEditingExerciseId] = useState<string | null | undefined>(
    undefined,
  );
  const [historyStudentId, setHistoryStudentId] = useState<string | null>(null);
  const [kickTarget, setKickTarget] = useState<TeacherClassroomDetail["roster"][number] | null>(null);
  const [historyExerciseId, setHistoryExerciseId] = useState<string | null>(null);
  const [inlineNotice, setInlineNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  const classIdValue = params.classId;
  const classId = Array.isArray(classIdValue) ? classIdValue[0] : classIdValue;

  const classroomQuery = useQuery({
    queryKey: ["classroom", classId],
    enabled: Boolean(token && user && classId),
    queryFn: () => apiRequest<ClassroomDetail>(`/classes/${classId}`, { token }),
  });

  const detail = classroomQuery.data;
  const historyQuery = useQuery({
    queryKey: ["teacher-student-history", classId, historyStudentId],
    enabled: Boolean(token && classId && historyStudentId),
    queryFn: () => apiRequest<TeacherStudentHistoryResponse>(`/classes/${classId}/students/${historyStudentId}/history`, { token }),
  });
  const copilotMutation = useMutation({
    mutationFn: (exerciseId: string) => apiRequest<TeacherStudentHistoryCopilotResponse>(`/classes/${classId}/students/${historyStudentId}/history/copilot`, { method: "POST", token, body: { exerciseId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["teacher-student-history", classId, historyStudentId] });
    },
  });
  const kickMutation = useMutation({
    mutationFn: (enrollmentId: string) => apiRequest(`/classes/${classId}/enrollments/${enrollmentId}`, { method: "DELETE", token }),
    onSuccess: () => {
      setKickTarget(null);
      setInlineNotice({ tone: "success", message: "Student removed from class. Their submissions and history are preserved." });
      void queryClient.invalidateQueries({ queryKey: ["classroom", classId] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => setInlineNotice({ tone: "error", message: error instanceof Error ? error.message : "Unable to kick student." }),
  });
  const historyGroups = historyQuery.data?.groups ?? [];
  const selectedHistoryGroup =
    historyGroups.find((group) => group.exerciseId === historyExerciseId) ?? historyGroups[0] ?? null;

  const requestedEditId = searchParams.get("edit");
  const teacherDetail = detail && isTeacherDetail(detail) ? detail : null;
  const activeEditingExerciseId =
    manualEditingExerciseId === undefined ? requestedEditId : manualEditingExerciseId;
  const editingExercise =
    teacherDetail?.exercises.find((exercise) => exercise.id === activeEditingExerciseId) ?? null;

  if (!user) {
    return (
      <main className="p-6">
        <LoadingPanel label="Loading classroom..." />
      </main>
    );
  }

  if (classroomQuery.isPending) {
    return (
      <main className="p-2 lg:p-4">
        <LoadingPanel label="Loading classroom..." />
      </main>
    );
  }

  if (classroomQuery.isError || !detail) {
    return (
      <main className="space-y-4 p-2 lg:p-4">
        <Link
          href={user.role === "teacher" ? "/app/teacher" : "/app/student"}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"
        >
          <ArrowLeft size={16} />
          Back to workspace
        </Link>
        <Card className="border-rose-200 bg-rose-50/80">
          <p className="font-semibold text-rose-950">Unable to load this classroom</p>
          <p className="mt-2 text-sm text-rose-900/80">
            {classroomQuery.error instanceof Error
              ? classroomQuery.error.message
              : "The classroom could not be fetched right now."}
          </p>
        </Card>
      </main>
    );
  }

  if (user.role === "teacher" && !teacherDetail) {
    return (
      <main className="p-6">
        <EmptyState
          title="Teacher access required"
          description="Switch to the teacher account that owns this classroom to manage it."
        />
      </main>
    );
  }

  if (user.role === "teacher" && teacherDetail) {
    const publishedCount = teacherDetail.exercises.filter((exercise) => exercise.status === "published").length;
    const analytics = teacherDetail.analytics;

    return (
      <main className="space-y-6 p-2 lg:p-4">
        {inlineNotice ? (
          <div className={cn("fixed right-4 top-4 z-[90] max-w-sm rounded-[22px] border px-4 py-3 text-sm font-semibold shadow-2xl", inlineNotice.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-rose-200 bg-rose-50 text-rose-950")}>
            <div className="flex items-start justify-between gap-3">
              <span>{inlineNotice.message}</span>
              <button type="button" className="text-xs uppercase tracking-[0.18em] opacity-70" onClick={() => setInlineNotice(null)}>Close</button>
            </div>
          </div>
        ) : null}
        <Link href="/app/teacher" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
          <ArrowLeft size={16} />
          Back to teacher overview
        </Link>

        <Card className="overflow-hidden p-0">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6 p-6 sm:p-8">
              <SectionHeading
                eyebrow="Classroom Control"
                title={teacherDetail.classroom.name}
                description={
                  teacherDetail.classroom.description ||
                  "Use this class space to author guided exercises, monitor patterns, and coach learners in context."
                }
              />

              <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="rounded-full bg-teal-50 px-3 py-1">Join code {teacherDetail.classroom.joinCode}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">{teacherDetail.classroom.subject}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">{teacherDetail.classroom.gradeBand}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">
                  Default track {sentenceCase(teacherDetail.classroom.defaultTrack)}
                </span>
              </div>
            </div>

            <div className="mesh-panel rounded-[28px] border-l border-slate-200/70 bg-slate-950/[0.025] p-6 sm:p-8">
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  {
                    label: "Students",
                    value: teacherDetail.roster.length,
                    icon: Users,
                  },
                  {
                    label: "Exercises",
                    value: teacherDetail.exercises.length,
                    icon: BookOpenText,
                  },
                  {
                    label: "Published",
                    value: publishedCount,
                    icon: CheckCircle2,
                  },
                  {
                    label: "Flagged",
                    value: analytics?.totals.flagged ?? 0,
                    icon: AlertTriangle,
                  },
                ].map((stat) => (
                  <Card key={stat.label} className="border-slate-200/70 bg-white/80 p-5">
                    <stat.icon size={18} className="text-teal-700" />
                    <p className="mt-4 text-4xl font-semibold text-slate-950">{stat.value}</p>
                    <p className="mt-1 text-sm text-slate-600">{stat.label}</p>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
          <section className="space-y-4">
            <SectionHeading
              eyebrow="Authoring"
              title={editingExercise ? "Refine the selected exercise" : "Create the next guided exercise"}
              description="The editor feeds classroom analytics, Socratic feedback, SOS escalation, and the student notebook."
            />

            <ExerciseEditor
              key={editingExercise?.id ?? "new"}
              token={token!}
              classId={classId!}
              editingExercise={editingExercise}
              onSaved={() => setManualEditingExerciseId(null)}
              onCancel={() => setManualEditingExerciseId(null)}
            />

            <SectionHeading
              eyebrow="Exercise Bank"
              title="Published and draft work"
              description="Open any exercise to preview the teacher-side structure or load it back into the editor."
            />

            {teacherDetail.exercises.length ? (
              <div className="space-y-4">
                {teacherDetail.exercises.map((exercise) => (
                  <Card
                    key={exercise.id}
                    className={cn(
                      "border-slate-200/70 bg-white/85",
                      editingExercise?.id === exercise.id && "border-teal-300 shadow-[0_24px_70px_-48px_rgba(13,148,136,0.65)]",
                    )}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <MathText text={exercise.title} className="font-display text-2xl text-slate-950" />
                        <div className="mt-2 max-h-24 overflow-hidden">
                          <MathText text={exercise.prompt} className="text-sm leading-6 text-slate-600" />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                          <span
                            className={cn(
                              "rounded-full border px-3 py-1 font-semibold",
                              exerciseStatusTone(exercise.status),
                            )}
                          >
                            {sentenceCase(exercise.status)}
                          </span>
                          <span className="rounded-full bg-slate-100 px-3 py-1">
                            {sentenceCase(exercise.difficulty)}
                          </span>
                          <span className="rounded-full bg-slate-100 px-3 py-1">
                            Track {sentenceCase(exercise.assignedTrack)}
                          </span>
                          <span className="rounded-full bg-slate-100 px-3 py-1">
                            {exercise.solutionSteps.length} steps
                          </span>
                          <span className="rounded-full bg-slate-100 px-3 py-1">{formatDue(exercise.dueAt)}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setManualEditingExerciseId(exercise.id)}
                        >
                          <PencilLine size={16} />
                          Edit
                        </Button>
                        <Link
                          href={`/app/exercises/${exercise.id}`}
                          className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold !text-white [&_svg]:text-white"
                        >
                          Preview
                          <ArrowRight size={16} />
                        </Link>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No exercises yet"
                description="Create the first exercise for this class and publish it when the scaffolding is ready."
              />
            )}
          </section>

          <section className="space-y-4">
            <SectionHeading
              eyebrow="Class Signals"
              title="Roster and blind spots"
              description="Watch who is progressing, who is stuck, and which concept keeps breaking down."
            />

            <Card className="space-y-4 border-slate-200/70 bg-white/85">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Users size={16} className="text-teal-700" />
                Student roster
              </div>
              {teacherDetail.roster.length ? (
                <div className="space-y-3 overflow-visible">
                  {teacherDetail.roster.map((entry) => (
                    <div
                      key={entry.enrollmentId}
                      className="rounded-[24px] border border-slate-200/70 bg-slate-50 px-4 py-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-950">{entry.student?.name ?? "Unknown student"}</p>
                          <p className="mt-1 text-sm text-slate-600">{entry.student?.email ?? "No email available"}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge className="border-slate-200 bg-white text-slate-800">
                            {sentenceCase(entry.track)}
                          </Badge>
                          {entry.student ? (
                            <Button type="button" variant="secondary" onClick={() => { setHistoryStudentId(entry.student!.id); setHistoryExerciseId(null); }}>
                              <MessageSquareText size={14} />
                              History
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="secondary"
                            className="!border-rose-300 !bg-rose-50 !text-rose-800 shadow-sm hover:!border-rose-400 hover:!bg-rose-100 hover:!text-rose-900 disabled:!border-rose-200 disabled:!bg-rose-50 disabled:!text-rose-700 disabled:opacity-70 [&_svg]:text-current"
                            disabled={kickMutation.isPending}
                            onClick={() => setKickTarget(entry)}
                          >
                            <Trash2 size={14} />
                            Remove
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                        <span className="rounded-full bg-white px-3 py-1">{entry.solvedCount} solved</span>
                        <span className="rounded-full bg-white px-3 py-1">{entry.flaggedCount} flagged</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600">No students have joined this classroom yet.</p>
              )}
            </Card>

            <Card className="relative z-20 space-y-4 border-slate-200/70 bg-white/85">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Target size={16} className="text-teal-700" />
                Blind spots
              </div>
              {analytics?.blindspots.length ? (
                <div className="space-y-3">
                  {analytics.blindspots.slice(0, 6).map((blindspot) => (
                    <div
                      key={`${blindspot.stepTitle}-${blindspot.concept}`}
                      className="group relative z-0 rounded-[24px] border border-slate-200/70 bg-slate-50 px-4 py-4 transition hover:z-[70] hover:border-teal-200 hover:bg-white hover:shadow-[0_24px_80px_-55px_rgba(15,23,42,0.6)]"
                      tabIndex={0}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-950">{blindspot.concept}</p>
                          <p className="mt-1 text-sm text-slate-600">{blindspot.stepTitle}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-semibold text-slate-950">{blindspot.percentage}%</p>
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                            {blindspot.count} errors
                          </p>
                        </div>
                      </div>
                      <BlindspotLearners learners={blindspot.relatedLearners ?? []} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600">Blind spots appear once students start submitting work.</p>
              )}
            </Card>

            <Card className="relative z-0 space-y-4 border-slate-200/70 bg-white/85">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Sparkles size={16} className="text-teal-700" />
                Exercise mastery
              </div>
              {analytics?.mastery.length ? (
                <div className="space-y-3">
                  {analytics.mastery.slice(0, 5).map((item) => (
                    <div
                      key={item.exerciseId}
                      className="rounded-[24px] border border-slate-200/70 bg-slate-50 px-4 py-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-950">{item.title}</p>
                          <p className="mt-1 text-sm text-slate-600">{item.attempts} attempts recorded</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-semibold text-slate-950">{item.accuracy}%</p>
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">accuracy</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600">Mastery rates will show once attempts are logged.</p>
              )}
            </Card>

            <Card className="space-y-4 border-rose-200 bg-rose-50/80">
              <div className="flex items-center gap-2 text-sm font-semibold text-rose-950">
                <AlertTriangle size={16} />
                Flagged cases
              </div>
              {analytics?.flaggedCases.length ? (
                <div className="space-y-3">
                  {analytics.flaggedCases.slice(0, 5).map((caseItem) => (
                    <div
                      key={caseItem.submissionId}
                      className="rounded-[24px] border border-rose-200/80 bg-white/80 px-4 py-4"
                    >
                      <p className="font-semibold text-slate-950">{caseItem.studentName}</p>
                      <p className="mt-1 text-sm text-slate-600">{caseItem.exerciseTitle}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span
                          className={cn(
                            "rounded-full border px-3 py-1 font-semibold",
                            submissionStatusTone(caseItem.status),
                          )}
                        >
                          {sentenceCase(caseItem.status)}
                        </span>
                        <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-900">
                          {caseItem.wrongAttemptCount} repeated wrong attempts
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-rose-900/75">No active SOS or teacher-flagged cases right now.</p>
              )}
            </Card>
          </section>
        </div>
        {kickTarget ? (
          <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={() => setKickTarget(null)}>
            <Card className="w-full max-w-md border-rose-200 bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
              <p className="font-display text-2xl text-slate-950">Remove learner?</p>
              <p className="mt-2 text-sm text-slate-600">Remove {kickTarget.student?.name ?? "this student"} from the class. Their submissions and chat history stay preserved.</p>
              <div className="mt-5 flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setKickTarget(null)}>Cancel</Button>
                <Button type="button" className="bg-rose-600 text-white hover:bg-rose-700" disabled={kickMutation.isPending} onClick={() => kickMutation.mutate(kickTarget.enrollmentId)}>
                  {kickMutation.isPending ? "Removing..." : "Remove"}
                </Button>
              </div>
            </Card>
          </div>
        ) : null}
        {historyStudentId ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={() => { setHistoryStudentId(null); setHistoryExerciseId(null); copilotMutation.reset(); }}>
            <Card className="max-h-[88vh] w-full max-w-5xl overflow-hidden border-slate-200 bg-white p-0 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
              <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 p-5 backdrop-blur">
                <SectionHeading eyebrow="Student chat history" title={historyQuery.data?.student?.name ?? "Chat history"} description="Sanitized teacher view." />
                <Button type="button" variant="secondary" onClick={() => { setHistoryStudentId(null); setHistoryExerciseId(null); copilotMutation.reset(); }}>Close</Button>
              </div>
              <div className="max-h-[calc(88vh-104px)] overflow-y-auto p-5 [scrollbar-color:#0f766e_#e2e8f0] [scrollbar-width:thin]">
                {(() => {
                  const groups = historyGroups;
                  const selectedGroup = selectedHistoryGroup;
                  const savedCopilot = selectedGroup?.copilot ?? null;
                  const visibleCopilot = copilotMutation.data ?? savedCopilot;

                  return (
                    <>
                      <div className="sticky top-0 z-10 -mx-5 -mt-5 border-b border-slate-200 bg-white/95 p-5 backdrop-blur">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Selected exercise</p>
                            <MathText text={selectedGroup?.exerciseTitle ?? "Choose a history thread"} className="mt-1 font-semibold text-slate-950" />
                          </div>
                          <Button type="button" onClick={() => selectedGroup && copilotMutation.mutate(selectedGroup.exerciseId)} disabled={copilotMutation.isPending || !selectedGroup}>
                            <Sparkles size={16} />
                            {copilotMutation.isPending ? "Analyzing..." : visibleCopilot ? "Re-summarize" : "AI-Copilot"}
                          </Button>
                        </div>
                      </div>
                      {historyQuery.isPending ? <LoadingPanel label="Loading sanitized history..." /> : null}
                      {groups.length ? (
                        <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.6fr]">
                          <aside className="space-y-2 lg:sticky lg:top-24 lg:self-start">
                            {groups.map((group) => (
                              <button
                                key={group.submissionId}
                                type="button"
                                onClick={() => { setHistoryExerciseId(group.exerciseId); copilotMutation.reset(); }}
                                className={cn(
                                  "w-full rounded-[24px] border px-4 py-4 text-left transition",
                                  selectedGroup?.exerciseId === group.exerciseId
                                    ? "border-teal-300 bg-teal-50 shadow-[0_20px_60px_-45px_rgba(13,148,136,0.75)]"
                                    : "border-slate-200 bg-slate-50 hover:border-teal-200 hover:bg-white",
                                )}
                              >
                                <MathText text={group.exerciseTitle} className="font-semibold text-slate-950" />
                                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-600">
                                  <span className={cn("rounded-full border px-2.5 py-1 font-semibold", submissionStatusTone(group.status))}>{sentenceCase(group.status)}</span>
                                  <span className="rounded-full bg-white px-2.5 py-1">{group.attemptCount} attempts</span>
                                  <span className="rounded-full bg-white px-2.5 py-1">{group.wrongAttemptCount} wrong</span>
                                  {group.copilot ? <span className="rounded-full bg-teal-100 px-2.5 py-1 font-semibold text-teal-800">Saved copilot</span> : null}
                                </div>
                                <p className="mt-2 text-xs text-slate-500">Updated {dayjs(group.updatedAt).format("DD MMM YYYY, HH:mm")}</p>
                              </button>
                            ))}
                          </aside>
                          <div className="space-y-4">
                            {visibleCopilot ? (
                              <Card className="border-teal-200 bg-teal-50/70">
                                <MathText text={visibleCopilot.summary} className="font-semibold text-slate-950" />
                                {visibleCopilot.warning ? <MathText text={visibleCopilot.warning} className="mt-2 text-sm text-amber-800" /> : null}
                                {["progress", "blockers", "teacherMoves"].map((key) => (
                                  <div key={key} className="mt-3">
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-800">{sentenceCase(key)}</p>
                                    <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
                                      {(visibleCopilot[key as "progress" | "blockers" | "teacherMoves"] as string[]).map((item) => (
                                        <li key={item}><MathText text={item} /></li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </Card>
                            ) : null}
                            {selectedGroup ? (
                              <Card className="border-slate-200/70 bg-slate-50/80">
                                <p className="font-display text-xl text-slate-950">{selectedGroup.exerciseTitle}</p>
                                <p className="mt-1 text-sm text-slate-600">{sentenceCase(selectedGroup.status)} · {selectedGroup.history.length} visible message(s)</p>
                                <div className="mt-4 space-y-5">
                                  {selectedGroup.history.map((attempt, index) => (
                          <div key={attempt.createdAt} className="space-y-3">
                            <div className="flex justify-end">
                              <div className="max-w-[94%] rounded-[30px] border border-teal-200 bg-teal-50 px-5 py-4 text-slate-900">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">Student</p>
                                  <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-teal-700/80">{dayjs(attempt.createdAt).format("DD MMM, HH:mm")}</span>
                                </div>
                                <MathText text={attempt.answerText || "File uploaded without typed explanation."} className="mt-2 text-sm text-slate-700" />
                                {attempt.attachment ? <div className="mt-4"><HistoryAttachment attachment={attempt.attachment} /></div> : null}
                              </div>
                            </div>
                            <div className="flex justify-start">
                              <div className="max-w-[94%] rounded-[30px] border border-slate-200/80 bg-white px-5 py-4 text-slate-900 shadow-[0_24px_80px_-56px_rgba(15,23,42,0.45)]">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">AI coach</p>
                                  <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Attempt {index + 1}</span>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                                  <span className={cn("rounded-full border px-3 py-1 font-semibold", submissionStatusTone(attempt.feedback.status))}>{sentenceCase(attempt.feedback.status)}</span>
                                  <span className="rounded-full bg-slate-100 px-3 py-1">Likely step {attempt.feedback.likelyStepIndex || 0}</span>
                                  <span className="rounded-full bg-slate-100 px-3 py-1">Validated step {attempt.feedback.validatedStepIndex || 0}</span>
                                </div>
                                <div className="mt-4 space-y-4">
                                  <MathText text={attempt.feedback.shortFeedback} className="text-sm text-slate-700" />
                                  <div className="rounded-[24px] border border-amber-200/80 bg-amber-50/75 px-4 py-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-900/70">Think about this</p>
                                    <MathText text={attempt.feedback.socraticQuestion} className="mt-2 text-sm text-slate-700" />
                                  </div>
                                  <MathText text={attempt.feedback.knowledgeReminder} className="text-sm text-slate-700" />
                                  <MathText text={attempt.feedback.encouragingLine} className="text-sm font-medium text-teal-700" />
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                                </div>
                              </Card>
                            ) : null}
                          </div>
                        </div>
                      ) : historyQuery.data ? (
                        <EmptyState title="No history yet" description="This student has no sanitized chat history in this class yet." />
                      ) : null}
                    </>
                  );
                })()}
              </div>
            </Card>
          </div>
        ) : null}
      </main>
    );
  }

  const studentDetail = detail as StudentClassroomDetail;
  const solvedCount = studentDetail.exercises.filter((exercise) => exercise.submissionStatus === "correct").length;
  const pendingCount = studentDetail.exercises.length - solvedCount;

  return (
    <main className="space-y-6 p-2 lg:p-4">
      <Link href="/app/student" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
        <ArrowLeft size={16} />
        Back to student workspace
      </Link>

      <Card className="overflow-hidden p-0">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6 p-6 sm:p-8">
            <SectionHeading
              eyebrow="Classroom Practice"
              title={studentDetail.classroom.name}
              description={
                studentDetail.classroom.description ||
                "Continue solving the class exercises below and let the AI nudge your reasoning step by step."
              }
            />

            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded-full bg-teal-50 px-3 py-1">{studentDetail.classroom.subject}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">{studentDetail.classroom.gradeBand}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">
                Your track {sentenceCase(studentDetail.track)}
              </span>
            </div>
          </div>

          <div className="mesh-panel rounded-[28px] border-l border-slate-200/70 bg-slate-950/[0.025] p-6 sm:p-8">
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {[
                { label: "Exercises", value: studentDetail.exercises.length, icon: BookOpenText },
                { label: "Solved", value: solvedCount, icon: CheckCircle2 },
                { label: "Pending", value: pendingCount, icon: Clock3 },
              ].map((stat) => (
                <Card key={stat.label} className="border-slate-200/70 bg-white/80 p-5">
                  <stat.icon size={18} className="text-teal-700" />
                  <p className="mt-4 text-4xl font-semibold text-slate-950">{stat.value}</p>
                  <p className="mt-1 text-sm text-slate-600">{stat.label}</p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <section className="space-y-4">
        <SectionHeading
          eyebrow="Assigned Work"
          title="Exercises visible to your track"
          description="Drafts stay hidden, and assignments respect the Core or Extended grouping chosen by your teacher."
        />

        {studentDetail.exercises.length ? (
          <div className="grid gap-4">
            {studentDetail.exercises.map((exercise) => (
              <Card key={exercise.id} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <MathText text={exercise.title} className="font-display text-2xl text-slate-950" />
                  <div className="mt-2 max-h-24 overflow-hidden">
                    <MathText text={exercise.prompt} className="text-sm leading-6 text-slate-600" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded-full bg-slate-100 px-3 py-1">{sentenceCase(exercise.difficulty)}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      {exercise.stepCount} coaching steps
                    </span>
                    <span
                      className={cn(
                        "rounded-full border px-3 py-1 font-semibold",
                        submissionStatusTone(exercise.submissionStatus ?? "not_started"),
                      )}
                    >
                      {sentenceCase(exercise.submissionStatus ?? "not_started")}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      {exercise.attemptCount ?? 0} attempts
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">{formatDue(exercise.dueAt)}</span>
                  </div>
                </div>

                <Link
                  href={`/app/exercises/${exercise.id}`}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold !text-white [&_svg]:text-white"
                >
                  {exercise.submissionStatus === "correct" ? "Review" : "Continue"}
                  <ArrowRight size={16} />
                </Link>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No exercises published yet"
            description="Your teacher has not published work for this classroom yet. Check back soon."
          />
        )}
      </section>
    </main>
  );
}
