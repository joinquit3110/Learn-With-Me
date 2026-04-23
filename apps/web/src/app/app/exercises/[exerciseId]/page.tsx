"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock3,
  FileImage,
  FileText,
  Flag,
  NotebookPen,
  SendHorizonal,
  Sparkles,
  Target,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-context";
import { HotspotViewer } from "@/components/hotspot-viewer";
import { MathKeyboard } from "@/components/math-keyboard";
import { MathText } from "@/components/math-text";
import { Badge, Button, Card, EmptyState, LoadingPanel, SectionHeading } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/cn";
import type {
  AttachmentRecord,
  NotebookEntry,
  RewardSummary,
  StudentExercise,
  SubmissionRecord,
  TeacherExercise,
} from "@/lib/contracts";
import { sentenceCase } from "@/lib/labels";

interface ExerciseResponse {
  exercise: TeacherExercise | StudentExercise;
  submission: SubmissionRecord | null;
}

interface StudentSubmissionResponse {
  submission: SubmissionRecord | null;
  notebookEntry: NotebookEntry | null;
}

interface SubmitExerciseResponse {
  submission: SubmissionRecord;
  rewards: RewardSummary;
  notebookEntry: NotebookEntry | null;
}

function isTeacherExercise(exercise: TeacherExercise | StudentExercise): exercise is TeacherExercise {
  return "solutionSteps" in exercise;
}

function formatDue(value: string | null) {
  return value ? dayjs(value).format("DD MMM YYYY, HH:mm") : "No due date";
}

function statusTone(status: string) {
  if (status === "correct") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "sos") return "border-rose-200 bg-rose-50 text-rose-900";
  if (status === "guardrail") return "border-orange-200 bg-orange-50 text-orange-900";
  if (status === "needs_review") return "border-sky-200 bg-sky-50 text-sky-900";
  if (status === "incorrect") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function AttachmentPanel({
  attachment,
  title,
  hotspot,
}: {
  attachment: AttachmentRecord;
  title: string;
  hotspot?: SubmissionRecord["history"][number]["feedback"]["hotspot"] | null;
}) {
  if (attachment.kind === "image" && attachment.dataUrl) {
    if (hotspot) {
      return <HotspotViewer imageUrl={attachment.dataUrl} hotspot={hotspot} />;
    }

    return (
      <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-950/4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={attachment.dataUrl} alt={title} className="max-h-[360px] w-full object-contain" />
      </div>
    );
  }

  if (attachment.kind === "image") {
    return (
      <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <FileImage size={16} className="text-teal-700" />
          <span>{attachment.originalName}</span>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          The image was attached to this message, but the preview is unavailable in this view.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <FileText size={16} className="text-amber-700" />
        <span>{attachment.originalName}</span>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        PDF review is supported. Hotspot guidance is only available for image uploads.
      </p>
      {attachment.dataUrl ? (
        <a
          href={attachment.dataUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold !text-white [&_svg]:text-white"
        >
          Open PDF
        </a>
      ) : null}
    </div>
  );
}

export default function ExerciseDetailPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const conversationEndRef = useRef<HTMLDivElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const { refreshUser, token, user } = useAuth();
  const [answerText, setAnswerText] = useState("");
  const [selectedAttachment, setSelectedAttachment] = useState<File | null>(null);
  const [selectedAttachmentPreview, setSelectedAttachmentPreview] = useState<string | null>(null);
  const [lastRewards, setLastRewards] = useState<RewardSummary | null>(null);
  const [mathKeyboardOpen, setMathKeyboardOpen] = useState(false);

  const exerciseIdValue = params.exerciseId;
  const exerciseId = Array.isArray(exerciseIdValue) ? exerciseIdValue[0] : exerciseIdValue;

  const exerciseQuery = useQuery({
    queryKey: ["exercise", exerciseId],
    enabled: Boolean(token && user && exerciseId),
    queryFn: () => apiRequest<ExerciseResponse>(`/exercises/${exerciseId}`, { token }),
  });

  const submissionQuery = useQuery({
    queryKey: ["exercise-submission", exerciseId],
    enabled: Boolean(token && user?.role === "student" && exerciseId),
    queryFn: () =>
      apiRequest<StudentSubmissionResponse>(`/exercises/${exerciseId}/submission`, {
        token,
      }),
  });

  const exercise = exerciseQuery.data?.exercise;
  const submission =
    user?.role === "student"
      ? submissionQuery.data?.submission ?? exerciseQuery.data?.submission ?? null
      : exerciseQuery.data?.submission ?? null;
  const notebookEntry =
    user?.role === "student" ? submissionQuery.data?.notebookEntry ?? null : null;
  const historyMessageCount = submission?.history.length ?? 0;

  useEffect(() => {
    return () => {
      if (selectedAttachmentPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(selectedAttachmentPreview);
      }
    };
  }, [selectedAttachmentPreview]);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 240)}px`;
  }, [answerText]);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({
      behavior: historyMessageCount > 0 ? "smooth" : "auto",
      block: "end",
    });
  }, [historyMessageCount]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("answerText", answerText);

      if (selectedAttachment) {
        formData.append("attachment", selectedAttachment);
      }

      return apiRequest<SubmitExerciseResponse>(`/exercises/${exerciseId}/submit`, {
        method: "POST",
        token,
        formData,
      });
    },
    onSuccess: async (response) => {
      setLastRewards(response.rewards);
      setAnswerText("");
      clearSelectedAttachment();
      requestAnimationFrame(() => textareaRef.current?.focus());

      const xpLine =
        response.rewards.awardedXp > 0 ? ` +${response.rewards.awardedXp} XP.` : "";
      const statusMessage =
        response.submission.status === "correct"
          ? "Exercise solved."
          : response.submission.status === "sos"
            ? "Attempt reviewed. Pause and revisit the highlighted method."
            : response.submission.status === "guardrail"
              ? "Stay on the math problem and try again."
              : "Attempt saved.";

      toast.success(`${statusMessage}${xpLine}`);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["exercise", exerciseId] }),
        queryClient.invalidateQueries({ queryKey: ["exercise-submission", exerciseId] }),
        queryClient.invalidateQueries({ queryKey: ["classroom", response.submission.classroomId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["notebook"] }),
        refreshUser().catch(() => undefined),
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to submit your work.");
    },
  });

  function handleInsert(value: string) {
    const textarea = textareaRef.current;

    if (!textarea) {
      setAnswerText((current) => `${current}${value}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextValue = `${answerText.slice(0, start)}${value}${answerText.slice(end)}`;
    setAnswerText(nextValue);

    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + value.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  function handleAttachmentChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    if (selectedAttachmentPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(selectedAttachmentPreview);
    }

    setSelectedAttachment(file);
    setSelectedAttachmentPreview(file ? URL.createObjectURL(file) : null);
    event.target.value = "";
  }

  function clearSelectedAttachment() {
    if (selectedAttachmentPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(selectedAttachmentPreview);
    }

    setSelectedAttachment(null);
    setSelectedAttachmentPreview(null);
    if (galleryInputRef.current) {
      galleryInputRef.current.value = "";
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
  }

  if (!user) {
    return (
      <main className="p-6">
        <LoadingPanel label="Loading exercise..." />
      </main>
    );
  }

  if (exerciseQuery.isPending) {
    return (
      <main className="p-2 lg:p-4">
        <LoadingPanel label="Loading exercise..." />
      </main>
    );
  }

  if (exerciseQuery.isError || !exercise) {
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
          <p className="font-semibold text-rose-950">Unable to load this exercise</p>
          <p className="mt-2 text-sm text-rose-900/80">
            {exerciseQuery.error instanceof Error
              ? exerciseQuery.error.message
              : "The exercise could not be fetched right now."}
          </p>
        </Card>
      </main>
    );
  }

  if (user.role === "teacher" && !isTeacherExercise(exercise)) {
    return (
      <main className="p-6">
        <EmptyState
          title="Teacher view unavailable"
          description="Open this exercise using the teacher account that authored it."
        />
      </main>
    );
  }

  if (user.role === "teacher" && isTeacherExercise(exercise)) {
    return (
      <main className="space-y-6 p-2 lg:p-4">
        <Link
          href={`/app/classes/${exercise.classroomId}?edit=${exercise.id}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"
        >
          <ArrowLeft size={16} />
          Back to class and editor
        </Link>

        <Card className="overflow-hidden p-0">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6 p-6 sm:p-8">
              <SectionHeading
                eyebrow="Teacher Preview"
                title={exercise.title}
                description="This is the full teacher-side exercise payload that powers drafting, grading, SOS escalation, and notebook generation."
              />
              <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                <span
                  className={cn(
                    "rounded-full border px-3 py-1 font-semibold",
                    statusTone(exercise.status),
                  )}
                >
                  {sentenceCase(exercise.status)}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1">{exercise.classroomName ?? "Classroom"}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">{sentenceCase(exercise.difficulty)}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">
                  Track {sentenceCase(exercise.assignedTrack)}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1">{formatDue(exercise.dueAt)}</span>
              </div>
            </div>

            <div className="mesh-panel rounded-[28px] border-l border-slate-200/70 bg-slate-950/[0.025] p-6 sm:p-8">
              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {[
                  { label: "Steps", value: exercise.solutionSteps.length, icon: Target },
                  { label: "Status", value: sentenceCase(exercise.status), icon: CheckCircle2 },
                  {
                    label: "Updated",
                    value: dayjs(exercise.updatedAt ?? exercise.createdAt).format("DD MMM"),
                    icon: Clock3,
                  },
                ].map((stat) => (
                  <Card key={stat.label} className="border-slate-200/70 bg-white/80 p-5">
                    <stat.icon size={18} className="text-teal-700" />
                    <p className="mt-4 text-2xl font-semibold text-slate-950">{stat.value}</p>
                    <p className="mt-1 text-sm text-slate-600">{stat.label}</p>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.06fr_0.94fr]">
          <section className="space-y-4">
            <Card className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">Student Prompt</p>
                <MathText text={exercise.prompt} className="mt-3 text-sm text-slate-700" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">Teacher Theory</p>
                <MathText text={exercise.theory} className="mt-3 text-sm text-slate-700" />
              </div>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-800">Final Answer</p>
                <MathText text={exercise.finalAnswer} className="text-sm text-slate-700" />
              </Card>
              <Card className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-800">Teacher Rubric</p>
                <MathText text={exercise.rubric} className="text-sm text-slate-700" />
              </Card>
            </div>

            {exercise.sourceAttachments?.length ? (
              <Card className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-800">
                  Source Material
                </p>
                <div className="space-y-3">
                  {exercise.sourceAttachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex flex-wrap items-center gap-2 rounded-[24px] border border-slate-200/70 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                    >
                      {attachment.kind === "pdf" ? (
                        <FileText size={16} className="text-amber-700" />
                      ) : (
                        <FileImage size={16} className="text-teal-700" />
                      )}
                      <span>{attachment.originalName}</span>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}
          </section>

          <section className="space-y-4">
            <SectionHeading
              eyebrow="Coaching Steps"
              title="Hidden scaffolding"
              description="Students only see the prompt and theory. Everything below stays teacher-side."
            />

            {exercise.solutionSteps.map((step, index) => (
              <Card key={`${exercise.id}-step-${index}`} className="space-y-4 border-slate-200/70 bg-white/85">
                <div className="flex items-center justify-between gap-3">
                  <Badge>Step {index + 1}</Badge>
                  <span className="text-xs uppercase tracking-[0.24em] text-slate-500">
                    {step.misconceptionTags.length} misconception tags
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-slate-950">{step.title}</p>
                  <MathText text={step.explanation} className="mt-2 text-sm text-slate-600" />
                </div>
                <div className="rounded-[24px] border border-slate-200/70 bg-slate-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Expected answer</p>
                  <MathText text={step.expectedAnswer} className="mt-2 text-sm text-slate-700" />
                </div>
                <div className="rounded-[24px] border border-slate-200/70 bg-slate-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">SOS review snippet</p>
                  <MathText text={step.reviewSnippet} className="mt-2 text-sm text-slate-700" />
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[24px] border border-slate-200/70 bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Hint questions</p>
                    <div className="mt-3 space-y-2">
                      {step.hintQuestions.map((hint, hintIndex) => (
                        <div
                          key={`${exercise.id}-step-${index}-hint-${hintIndex}`}
                          className="rounded-2xl bg-white px-3 py-2 text-sm text-slate-700"
                        >
                          <MathText text={hint} className="text-sm text-slate-700" />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-slate-200/70 bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Misconception tags
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {step.misconceptionTags.map((tag) => (
                        <span
                          key={`${exercise.id}-step-${index}-tag-${tag}`}
                          className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </section>
        </div>
      </main>
    );
  }

  const studentExercise = exercise as StudentExercise;
  const selectedAttachmentKind =
    selectedAttachment?.type === "application/pdf" ? "pdf" : selectedAttachment ? "image" : null;
  const draftAttachment: AttachmentRecord | null =
    selectedAttachment && selectedAttachmentKind
      ? {
          id: "pending-upload",
          kind: selectedAttachmentKind,
          originalName: selectedAttachment.name,
          mimeType: selectedAttachment.type,
          sizeBytes: selectedAttachment.size,
          extractedText: "",
          dataUrl: selectedAttachmentPreview,
        }
      : null;
  const latestFeedback = submission?.lastFeedback ?? null;
  const validatedSteps = submission?.bestValidatedStepIndex ?? 0;
  const totalSteps = Math.max(studentExercise.stepCount, 1);
  const progressPercent = Math.min(100, Math.round((validatedSteps / totalSteps) * 100));
  const attemptHistory = submission?.history ?? [];
  const studentStatus = submission?.status ?? "not_started";
  const composerDisabled = submitMutation.isPending || (!answerText.trim() && !selectedAttachment);
  const latestAttempt = attemptHistory.at(-1) ?? null;
  const nextCheckpointIndex =
    studentStatus === "correct"
      ? totalSteps
      : Math.min(totalSteps, Math.max(1, latestFeedback?.likelyStepIndex ?? validatedSteps + 1));
  const coachCheckpointChip =
    studentStatus === "correct"
      ? `Solved ${totalSteps}/${totalSteps} checkpoints`
      : `Checkpoint ${nextCheckpointIndex}/${totalSteps}`;
  const coachProgressLine =
    validatedSteps > 0
      ? `I remember you already validated ${validatedSteps}/${totalSteps} checkpoint${validatedSteps === 1 ? "" : "s"}.`
      : "No checkpoint is validated yet. Start from checkpoint 1.";
  const openingCoachLine =
    studentStatus === "correct"
      ? "Great work, this exercise is already solved. We can still review any step you choose."
      : `Let's continue from where you left off. ${coachProgressLine}`;
  const openingCoachNextPrompt =
    latestFeedback?.socraticQuestion ||
    (studentStatus === "correct"
      ? "If you want a review, tell me which step feels least comfortable and upload that specific line."
      : `You are currently on checkpoint ${nextCheckpointIndex}/${totalSteps}. Share the exact line where you are stuck, and attach one image or PDF if helpful.`);

  return (
    <main className="space-y-6 p-2 pb-32 lg:p-4 lg:pb-40">
      <Link
        href={`/app/classes/${studentExercise.classroomId}`}
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"
      >
        <ArrowLeft size={16} />
        Back to classroom
      </Link>

      <Card className="overflow-hidden p-0">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6 p-6 sm:p-8">
            <SectionHeading
              eyebrow="Guided Exercise"
              title={studentExercise.title}
              description="Show your reasoning, upload a photo of your work if needed, and let the coach push the next mathematical move without revealing the answer."
            />
            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded-full bg-teal-50 px-3 py-1">{studentExercise.classroomName ?? "Classroom"}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">{sentenceCase(studentExercise.difficulty)}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">{formatDue(studentExercise.dueAt)}</span>
              <span
                className={cn(
                  "rounded-full border px-3 py-1 font-semibold",
                  statusTone(studentStatus),
                )}
              >
                {sentenceCase(studentStatus)}
              </span>
            </div>
          </div>

          <div className="mesh-panel rounded-[28px] border-l border-slate-200/70 bg-slate-950/[0.025] p-6 sm:p-8">
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {[
                { label: "Validated", value: `${validatedSteps}/${studentExercise.stepCount}`, icon: Target },
                { label: "Attempts", value: submission?.attemptCount ?? 0, icon: SendHorizonal },
                { label: "Progress", value: `${progressPercent}%`, icon: CheckCircle2 },
              ].map((stat) => (
                <Card key={stat.label} className="border-slate-200/70 bg-white/80 p-5">
                  <stat.icon size={18} className="text-teal-700" />
                  <p className="mt-4 text-3xl font-semibold text-slate-950">{stat.value}</p>
                  <p className="mt-1 text-sm text-slate-600">{stat.label}</p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.24fr_0.76fr]">
        <section className="space-y-5">
          <Card className="space-y-5 border-slate-200/70 bg-white/92">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">Problem</p>
              <MathText text={studentExercise.prompt} className="mt-3 text-sm text-slate-700" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">Theory Reminder</p>
              <MathText text={studentExercise.theory} className="mt-3 text-sm text-slate-700" />
            </div>
          </Card>

          <Card className="space-y-5 border-slate-200/70 bg-white/95">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Sparkles size={16} className="text-teal-700" />
              Chat with the coach
            </div>

            <div className="space-y-6">
              <div className="flex justify-start">
                <div className="max-w-[94%] rounded-[30px] bg-slate-950 px-5 py-5 text-white shadow-[0_24px_70px_-42px_rgba(15,23,42,0.8)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/65">AI coach</p>
                  <MathText
                    text={openingCoachLine}
                    className="mt-2 text-sm text-white/92"
                  />
                  <div className="mt-4 rounded-[24px] bg-white/8 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
                      What to do next
                    </p>
                    <MathText
                      text={openingCoachNextPrompt}
                      className="mt-2 text-sm text-white/88"
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/80">
                    <span className="rounded-full bg-white/10 px-3 py-1">{coachCheckpointChip}</span>
                    <span className="rounded-full bg-white/10 px-3 py-1">
                      One file per message
                    </span>
                    <span className="rounded-full bg-white/10 px-3 py-1">
                      Hotspot on image uploads
                    </span>
                  </div>
                </div>
              </div>

              {attemptHistory.length ? (
                attemptHistory.map((attempt, index) => (
                  <div key={`${studentExercise.id}-chat-attempt-${index}`} className="space-y-4">
                    <div className="flex justify-end">
                      <div className="max-w-[94%] rounded-[30px] border border-teal-200 bg-teal-50 px-5 py-4 text-slate-900">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">You</p>
                          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-teal-700/80">
                            {dayjs(attempt.createdAt).format("DD MMM, HH:mm")}
                          </span>
                        </div>
                        <MathText
                          text={attempt.answerText || "File uploaded without typed explanation."}
                          className="mt-2 text-sm text-slate-700"
                        />
                        {attempt.attachment ? (
                          <div className="mt-4 space-y-3">
                            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                              {attempt.attachment.kind === "pdf" ? (
                                <FileText size={14} className="text-amber-700" />
                              ) : (
                                <FileImage size={14} className="text-teal-700" />
                              )}
                              <span>{attempt.attachment.originalName}</span>
                            </div>
                            {attempt.attachment.kind === "image" && attempt.attachment.dataUrl ? (
                              <AttachmentPanel
                                attachment={attempt.attachment}
                                title="Student uploaded working"
                              />
                            ) : attempt.attachment.kind === "pdf" ? (
                              <AttachmentPanel
                                attachment={attempt.attachment}
                                title="Student uploaded PDF"
                              />
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex justify-start">
                      <div className="max-w-[94%] space-y-3">
                        <div className="rounded-[30px] border border-slate-200/80 bg-white px-5 py-4 text-slate-900 shadow-[0_24px_80px_-56px_rgba(15,23,42,0.45)]">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">AI coach</p>
                            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                              Attempt {index + 1}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                            <span
                              className={cn(
                                "rounded-full border px-3 py-1 font-semibold",
                                statusTone(attempt.feedback.status),
                              )}
                            >
                              {sentenceCase(attempt.feedback.status)}
                            </span>
                            <span className="rounded-full bg-slate-100 px-3 py-1">
                              Likely step {attempt.feedback.likelyStepIndex || 0}
                            </span>
                            <span className="rounded-full bg-slate-100 px-3 py-1">
                              Validated step {attempt.feedback.validatedStepIndex || 0}
                            </span>
                          </div>

                          <div className="mt-4 space-y-4">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                                Feedback
                              </p>
                              <MathText text={attempt.feedback.shortFeedback} className="mt-2 text-sm text-slate-700" />
                            </div>
                            <div className="rounded-[24px] border border-amber-200/80 bg-amber-50/75 px-4 py-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-900/70">
                                Think about this
                              </p>
                              <MathText text={attempt.feedback.socraticQuestion} className="mt-2 text-sm text-slate-700" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                                Reminder
                              </p>
                              <MathText text={attempt.feedback.knowledgeReminder} className="mt-2 text-sm text-slate-700" />
                            </div>
                            <MathText
                              text={attempt.feedback.encouragingLine}
                              className="text-sm font-medium text-teal-700"
                            />
                          </div>
                        </div>

                        {attempt.attachment?.kind === "image" &&
                        attempt.attachment.dataUrl &&
                        attempt.feedback.hotspot ? (
                          <AttachmentPanel
                            attachment={attempt.attachment}
                            title="Highlighted student working"
                            hotspot={attempt.feedback.hotspot}
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex justify-start">
                  <div className="max-w-[94%] rounded-[30px] border border-slate-200/80 bg-white px-5 py-4 text-slate-900">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">AI coach</p>
                    <MathText
                      text={
                        studentStatus === "correct"
                          ? "This exercise is already solved. If you want extra practice, send one step and I will coach your method without changing the solved status."
                          : `No messages yet in this attempt history. Start from checkpoint ${nextCheckpointIndex}/${totalSteps}, send your current line, and attach one image or PDF if needed.`
                      }
                      className="mt-2 text-sm text-slate-700"
                    />
                  </div>
                </div>
              )}

              <div ref={conversationEndRef} />
            </div>
          </Card>

          <div className="sticky bottom-3 z-20">
            <Card className="space-y-5 border-slate-200/80 bg-white/95 shadow-[0_32px_80px_-52px_rgba(15,23,42,0.55)] backdrop-blur-xl">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">Reply to coach</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Send one message at a time. This reply can include one image or PDF, and coach
                    progress memory will keep your checkpoint context when you return later.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    <Camera size={16} />
                    Take photo
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => galleryInputRef.current?.click()}
                  >
                    <Upload size={16} />
                    Attach image or PDF
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setMathKeyboardOpen((current) => !current)}
                  >
                    {mathKeyboardOpen ? "Hide math keyboard" : "Math keyboard"}
                  </Button>
                </div>
              </div>

              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleAttachmentChange}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleAttachmentChange}
              />

              {draftAttachment ? (
                <div className="space-y-4 rounded-[28px] border border-teal-200/80 bg-teal-50/70 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      {draftAttachment.kind === "pdf" ? (
                        <FileText size={14} className="text-amber-700" />
                      ) : (
                        <FileImage size={14} className="text-teal-700" />
                      )}
                      <span>{draftAttachment.originalName}</span>
                    </div>
                    <Button type="button" variant="ghost" onClick={clearSelectedAttachment}>
                      Remove file
                    </Button>
                  </div>
                  <AttachmentPanel
                    attachment={draftAttachment}
                    title="Attachment selected for the next student message"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  <FileImage size={16} className="text-teal-700" />
                  <span>No file attached to the next message yet</span>
                </div>
              )}

              <textarea
                ref={textareaRef}
                rows={4}
                value={answerText}
                onChange={(event) => setAnswerText(event.target.value)}
                placeholder="Example: I substituted x = 0 and drew the line through y = 6. Can you check this step?"
                className="min-h-[120px] max-h-[240px] w-full resize-none rounded-[30px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              />

              {mathKeyboardOpen ? (
                <div className="rounded-[28px] border border-slate-200/80 bg-slate-50 px-3 py-3">
                  <MathKeyboard onInsert={handleInsert} />
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-500">
                  Each reply can include one new image or PDF. Image replies can return hotspot coaching.
                </p>

                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setAnswerText("");
                      clearSelectedAttachment();
                    }}
                  >
                    Clear draft
                  </Button>
                  <Button type="button" disabled={composerDisabled} onClick={() => submitMutation.mutate()}>
                    <SendHorizonal size={16} />
                    {submitMutation.isPending ? "Submitting..." : "Send message"}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </section>

        <section className="space-y-4">
          <Card className="space-y-4 border-slate-200/70 bg-white/92">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Target size={16} className="text-teal-700" />
              Progress snapshot
            </div>
            <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
              {[
                { label: "Validated", value: `${validatedSteps}/${studentExercise.stepCount}`, icon: Target },
                { label: "Attempts", value: submission?.attemptCount ?? 0, icon: SendHorizonal },
                { label: "Progress", value: `${progressPercent}%`, icon: CheckCircle2 },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-[24px] border border-slate-200/70 bg-slate-50 px-4 py-4"
                >
                  <stat.icon size={16} className="text-teal-700" />
                  <p className="mt-3 text-3xl font-semibold text-slate-950">{stat.value}</p>
                  <p className="mt-1 text-sm text-slate-600">{stat.label}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-4 border-slate-200/70 bg-white/92">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Clock3 size={16} className="text-teal-700" />
              Quick reference
            </div>

            <div className="rounded-[24px] border border-slate-200/70 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Theory reminder
              </p>
              <MathText text={studentExercise.theory} className="mt-2 text-sm text-slate-700" />
            </div>

            <div className="rounded-[24px] border border-slate-200/70 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">Upload rules</p>
              <p className="mt-2 leading-6">
                Each reply can carry one new image or PDF. The camera button opens phone capture, and
                hotspot guidance appears only for image uploads where the wrong line is visible.
              </p>
            </div>
          </Card>

          {latestAttempt ? (
            <Card className="space-y-4 border-slate-200/70 bg-white/92">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Sparkles size={16} className="text-teal-700" />
                Latest AI focus
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                <span
                  className={cn(
                    "rounded-full border px-3 py-1 font-semibold",
                    statusTone(latestAttempt.feedback.status),
                  )}
                >
                  {sentenceCase(latestAttempt.feedback.status)}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1">
                  Step {latestAttempt.feedback.likelyStepIndex || 0}
                </span>
              </div>

              <MathText text={latestAttempt.feedback.shortFeedback} className="text-sm text-slate-700" />

              <div className="rounded-[24px] border border-amber-200/80 bg-amber-50/75 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-900/70">
                  Next question
                </p>
                <MathText
                  text={latestAttempt.feedback.socraticQuestion}
                  className="mt-2 text-sm text-slate-700"
                />
              </div>
            </Card>
          ) : null}

          {latestFeedback?.teacherFlag || latestFeedback?.status === "sos" ? (
            <Card className="space-y-3 border-rose-200 bg-rose-50/80">
              <div className="flex items-center gap-2 text-sm font-semibold text-rose-950">
                <Flag size={16} />
                Teacher follow-up recommended
              </div>
              <MathText
                text="This attempt triggered an SOS-style escalation. Revisit the theory reminder, then ask your teacher for live support if you stay stuck."
                className="text-sm text-rose-900"
              />
            </Card>
          ) : null}

          {lastRewards ? (
            <Card className="space-y-3 border-amber-200 bg-amber-50/80">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-950">
                <Sparkles size={16} />
                Rewards update
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-amber-950">
                <span className="rounded-full bg-white px-3 py-1">+{lastRewards.awardedXp} XP</span>
                <span className="rounded-full bg-white px-3 py-1">Level {lastRewards.level}</span>
                <span className="rounded-full bg-white px-3 py-1">Streak {lastRewards.streak}</span>
                {lastRewards.badgeAwarded ? (
                  <span className="rounded-full bg-white px-3 py-1">{lastRewards.badgeAwarded} badge</span>
                ) : null}
              </div>
            </Card>
          ) : null}

          {notebookEntry ? (
            <Card className="space-y-4 border-teal-200 bg-teal-50/70">
              <div className="flex items-center gap-2 text-sm font-semibold text-teal-950">
                <NotebookPen size={16} />
                Notebook capture
              </div>
              <div>
                <MathText text={notebookEntry.summary} className="font-semibold text-slate-950" />
                <MathText text={notebookEntry.ahaMoment} className="mt-2 text-sm text-slate-700" />
              </div>
              <div className="rounded-[24px] border border-teal-200/80 bg-white px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">Solved strategy</p>
                <MathText text={notebookEntry.solvedStrategy} className="mt-2 text-sm text-slate-700" />
              </div>
              {notebookEntry.awardedBadge ? <Badge>{notebookEntry.awardedBadge}</Badge> : null}
            </Card>
          ) : null}
        </section>
      </div>

    </main>
  );
}
