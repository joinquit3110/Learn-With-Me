"use client";

import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  CheckCircle2,
  Clock3,
  PencilLine,
  Sparkles,
  Target,
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
import type { StudentClassroomDetail, TeacherClassroomDetail } from "@/lib/contracts";
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

export default function ClassroomDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { token, user } = useAuth();
  const [manualEditingExerciseId, setManualEditingExerciseId] = useState<string | null | undefined>(
    undefined,
  );

  const classIdValue = params.classId;
  const classId = Array.isArray(classIdValue) ? classIdValue[0] : classIdValue;

  const classroomQuery = useQuery({
    queryKey: ["classroom", classId],
    enabled: Boolean(token && user && classId),
    queryFn: () => apiRequest<ClassroomDetail>(`/classes/${classId}`, { token }),
  });

  const detail = classroomQuery.data;
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
                <div className="space-y-3">
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
                        <Badge className="border-slate-200 bg-white text-slate-800">
                          {sentenceCase(entry.track)}
                        </Badge>
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

            <Card className="space-y-4 border-slate-200/70 bg-white/85">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Target size={16} className="text-teal-700" />
                Blind spots
              </div>
              {analytics?.blindspots.length ? (
                <div className="space-y-3">
                  {analytics.blindspots.slice(0, 6).map((blindspot) => (
                    <div
                      key={`${blindspot.stepTitle}-${blindspot.concept}`}
                      className="rounded-[24px] border border-slate-200/70 bg-slate-50 px-4 py-4"
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
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600">Blind spots appear once students start submitting work.</p>
              )}
            </Card>

            <Card className="space-y-4 border-slate-200/70 bg-white/85">
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
