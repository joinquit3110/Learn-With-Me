"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, FileImage, FileText, Sparkles, Trash2, Upload, Wand2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { apiRequest } from "@/lib/api";
import type { AttachmentRecord, TeacherExercise } from "@/lib/contracts";

import { Badge, Button, Card, Input, Select, Textarea } from "./ui";

interface ExerciseEditorProps {
  token: string;
  classId: string;
  editingExercise?: TeacherExercise | null;
  onSaved?: () => void;
  onCancel?: () => void;
}

interface EditableStep {
  title: string;
  explanation: string;
  expectedAnswer: string;
  reviewSnippet: string;
  hintQuestions: string[];
  misconceptionTags: string[];
}

interface ExerciseFormState {
  sourceAttachmentIds: string[];
  sourceAttachments: AttachmentRecord[];
  title: string;
  prompt: string;
  theory: string;
  finalAnswer: string;
  rubric: string;
  difficulty: "core" | "extended";
  assignedTrack: "all" | "core" | "extended";
  status: "draft" | "published";
  dueAt: string;
  solutionSteps: EditableStep[];
}

interface PendingSourceFile {
  id: string;
  file: File;
  previewUrl: string | null;
}

function blankStep(): EditableStep {
  return {
    title: "",
    explanation: "",
    expectedAnswer: "",
    reviewSnippet: "",
    hintQuestions: [""],
    misconceptionTags: [""],
  };
}

function blankForm(): ExerciseFormState {
  return {
    sourceAttachmentIds: [],
    sourceAttachments: [],
    title: "",
    prompt: "",
    theory: "",
    finalAnswer: "",
    rubric: "",
    difficulty: "core",
    assignedTrack: "all",
    status: "published",
    dueAt: "",
    solutionSteps: [blankStep(), blankStep()],
  };
}

function toFormState(exercise: TeacherExercise): ExerciseFormState {
  return {
    sourceAttachmentIds:
      exercise.sourceAttachmentIds && exercise.sourceAttachmentIds.length > 0
        ? exercise.sourceAttachmentIds
        : exercise.sourceAttachmentId
          ? [exercise.sourceAttachmentId]
          : [],
    sourceAttachments:
      exercise.sourceAttachments && exercise.sourceAttachments.length > 0
        ? exercise.sourceAttachments
        : exercise.sourceAttachment
          ? [exercise.sourceAttachment]
          : [],
    title: exercise.title,
    prompt: exercise.prompt,
    theory: exercise.theory,
    finalAnswer: exercise.finalAnswer,
    rubric: exercise.rubric,
    difficulty: exercise.difficulty,
    assignedTrack: exercise.assignedTrack,
    status: exercise.status,
    dueAt: exercise.dueAt ? exercise.dueAt.slice(0, 16) : "",
    solutionSteps: exercise.solutionSteps.length > 0 ? exercise.solutionSteps : [blankStep()],
  };
}

function formatAttachmentSize(sizeBytes: number) {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (sizeBytes >= 1024) {
    return `${Math.round(sizeBytes / 1024)} KB`;
  }

  return `${sizeBytes} B`;
}

function fileFingerprint(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function attachmentFingerprint(attachment: AttachmentRecord) {
  return `${attachment.originalName}:${attachment.sizeBytes}:${attachment.mimeType}`;
}

function createPendingSourceFile(file: File): PendingSourceFile {
  return {
    id: fileFingerprint(file),
    file,
    previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
  };
}

function revokePendingSourceFiles(files: PendingSourceFile[]) {
  for (const file of files) {
    if (file.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(file.previewUrl);
    }
  }
}

export function ExerciseEditor({
  token,
  classId,
  editingExercise,
  onSaved,
  onCancel,
}: ExerciseEditorProps) {
  const queryClient = useQueryClient();
  const [pending, startTransition] = useTransition();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const pendingSourceFilesRef = useRef<PendingSourceFile[]>([]);
  const [form, setForm] = useState<ExerciseFormState>(() =>
    editingExercise ? toFormState(editingExercise) : blankForm(),
  );
  const [pendingSourceFiles, setPendingSourceFiles] = useState<PendingSourceFile[]>([]);

  useEffect(() => {
    pendingSourceFilesRef.current = pendingSourceFiles;
  }, [pendingSourceFiles]);

  useEffect(() => {
    return () => {
      revokePendingSourceFiles(pendingSourceFilesRef.current);
    };
  }, []);

  function clearPendingSourceFiles() {
    setPendingSourceFiles((current) => {
      revokePendingSourceFiles(current);
      return [];
    });
  }

  function resetEditorState() {
    clearPendingSourceFiles();
    setForm(editingExercise ? toFormState(editingExercise) : blankForm());
  }

  const aiDraftMutation = useMutation({
    mutationFn: async () => {
      if (pendingSourceFiles.length > 0) {
        const formData = new FormData();
        formData.append("prompt", form.prompt);
        formData.append("theory", form.theory);
        formData.append("finalAnswer", form.finalAnswer);
        formData.append("difficulty", form.difficulty);

        for (const sourceAttachmentId of form.sourceAttachmentIds) {
          formData.append("sourceAttachmentIds", sourceAttachmentId);
        }

        for (const pendingSourceFile of pendingSourceFiles) {
          formData.append("attachments", pendingSourceFile.file);
        }

        return apiRequest<{
          draft: {
            title: string;
            summary: string;
            suggestedPrompt: string;
            suggestedTheory: string;
            suggestedFinalAnswer: string;
            rubric: string;
            steps: EditableStep[];
          };
          sourceAttachmentIds: string[];
          sourceAttachmentId: string | null;
          sourceAttachments: AttachmentRecord[];
          sourceAttachment: AttachmentRecord | null;
        }>("/exercises/ai-draft", {
          method: "POST",
          token,
          formData,
        });
      }

      return apiRequest<{
        draft: {
          title: string;
          summary: string;
          suggestedPrompt: string;
          suggestedTheory: string;
          suggestedFinalAnswer: string;
          rubric: string;
          steps: EditableStep[];
        };
        sourceAttachmentIds: string[];
        sourceAttachmentId: string | null;
        sourceAttachments: AttachmentRecord[];
        sourceAttachment: AttachmentRecord | null;
      }>("/exercises/ai-draft", {
        method: "POST",
        token,
        body: {
          prompt: form.prompt,
          theory: form.theory,
          finalAnswer: form.finalAnswer,
          difficulty: form.difficulty,
          sourceAttachmentIds: form.sourceAttachmentIds,
        },
      });
    },
    onSuccess: (response) => {
      setForm((current) => ({
        ...current,
        title: response.draft.title || current.title,
        prompt: response.draft.suggestedPrompt || current.prompt,
        theory: response.draft.suggestedTheory || current.theory,
        finalAnswer: response.draft.suggestedFinalAnswer || current.finalAnswer,
        rubric: response.draft.rubric || current.rubric,
        solutionSteps: response.draft.steps,
        sourceAttachmentIds: response.sourceAttachmentIds,
        sourceAttachments: response.sourceAttachments,
      }));
      clearPendingSourceFiles();
      toast.success("AI draft generated. Review every step before publishing.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to generate draft.");
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (pendingSourceFiles.length > 0) {
        throw new Error(
          "Run AI Co-pilot once after selecting new source files so they can be uploaded and attached to the exercise.",
        );
      }

      const body = {
        classroomId: classId,
        sourceAttachmentIds: form.sourceAttachmentIds,
        title: form.title,
        prompt: form.prompt,
        theory: form.theory,
        finalAnswer: form.finalAnswer,
        rubric: form.rubric,
        difficulty: form.difficulty,
        assignedTrack: form.assignedTrack,
        status: form.status,
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
        solutionSteps: form.solutionSteps.map((step) => ({
          ...step,
          hintQuestions: step.hintQuestions.filter(Boolean),
          misconceptionTags: step.misconceptionTags.filter(Boolean),
        })),
      };

      if (editingExercise) {
        return apiRequest(`/exercises/${editingExercise.id}`, {
          method: "PUT",
          token,
          body,
        });
      }

      return apiRequest("/exercises", {
        method: "POST",
        token,
        body,
      });
    },
    onSuccess: () => {
      toast.success(editingExercise ? "Exercise updated." : "Exercise created.");
      void queryClient.invalidateQueries({ queryKey: ["classroom", classId] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      startTransition(() => {
        resetEditorState();
        onSaved?.();
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to save exercise.");
    },
  });

  function updateStep(index: number, updater: (current: EditableStep) => EditableStep) {
    setForm((current) => ({
      ...current,
      solutionSteps: current.solutionSteps.map((step, stepIndex) =>
        stepIndex === index ? updater(step) : step,
      ),
    }));
  }

  function handleSourceFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    setPendingSourceFiles((current) => {
      const existingFingerprints = new Set(current.map((file) => file.id));
      const savedFingerprints = new Set(form.sourceAttachments.map((attachment) => attachmentFingerprint(attachment)));
      const nextFiles = files
        .filter((file) => !existingFingerprints.has(fileFingerprint(file)))
        .filter((file) => !savedFingerprints.has(`${file.name}:${file.size}:${file.type}`))
        .map((file) => createPendingSourceFile(file));

      return [...current, ...nextFiles];
    });

    event.target.value = "";
  }

  function removePendingSourceFile(pendingSourceFileId: string) {
    setPendingSourceFiles((current) => {
      const remainingFiles = current.filter((file) => file.id !== pendingSourceFileId);
      const removedFiles = current.filter((file) => file.id === pendingSourceFileId);
      revokePendingSourceFiles(removedFiles);
      return remainingFiles;
    });
  }

  function removeSavedSourceAttachment(sourceAttachmentId: string) {
    setForm((current) => ({
      ...current,
      sourceAttachmentIds: current.sourceAttachmentIds.filter((attachmentId) => attachmentId !== sourceAttachmentId),
      sourceAttachments: current.sourceAttachments.filter((attachment) => attachment.id !== sourceAttachmentId),
    }));
  }

  function clearAllSourceAttachments() {
    clearPendingSourceFiles();
    setForm((current) => ({
      ...current,
      sourceAttachmentIds: [],
      sourceAttachments: [],
    }));
  }

  const currentSavedSourceAttachments = form.sourceAttachments;

  return (
    <Card className="space-y-5 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-700">
            Teacher Authoring
          </p>
          <h3 className="font-display text-3xl text-slate-950">
            {editingExercise ? "Refine Exercise" : "Create New Exercise"}
          </h3>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => aiDraftMutation.mutate()}
            disabled={
              aiDraftMutation.isPending ||
              (!form.prompt &&
                !form.theory &&
                !form.finalAnswer &&
                pendingSourceFiles.length === 0 &&
                form.sourceAttachmentIds.length === 0)
            }
          >
            <Wand2 size={16} />
            {aiDraftMutation.isPending ? "Generating..." : "AI Co-pilot"}
          </Button>
          {editingExercise ? (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel edit
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Input
          placeholder="Exercise title"
          value={form.title}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <Select
            value={form.difficulty}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                difficulty: event.target.value as ExerciseFormState["difficulty"],
              }))
            }
          >
            <option value="core">Core</option>
            <option value="extended">Extended</option>
          </Select>
          <Select
            value={form.assignedTrack}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                assignedTrack: event.target.value as ExerciseFormState["assignedTrack"],
              }))
            }
          >
            <option value="all">All tracks</option>
            <option value="core">Core only</option>
            <option value="extended">Extended only</option>
          </Select>
          <Select
            value={form.status}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                status: event.target.value as ExerciseFormState["status"],
              }))
            }
          >
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </Select>
        </div>
      </div>

      <Textarea
        rows={6}
        placeholder="Student-facing prompt"
        value={form.prompt}
        onChange={(event) => setForm((current) => ({ ...current, prompt: event.target.value }))}
      />

      <div className="rounded-[28px] border border-slate-200/70 bg-slate-50 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">AI source material</p>
            <p className="mt-1 text-sm text-slate-600">
              Upload multiple worksheet photos, answer keys, or PDFs. AI will combine them to draft
              the prompt, theory, final answer, and coaching steps.
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              New local files are uploaded the moment you run AI Co-pilot. Saved source files stay
              attached until you remove them.
            </p>
          </div>
          {currentSavedSourceAttachments.length > 0 || pendingSourceFiles.length > 0 ? (
            <Button type="button" variant="ghost" onClick={clearAllSourceAttachments}>
              Clear all sources
            </Button>
          ) : null}
        </div>

        <input
          ref={uploadInputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={handleSourceFileChange}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleSourceFileChange}
        />

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="secondary"
            className="justify-center"
            onClick={() => cameraInputRef.current?.click()}
          >
            <Camera size={16} />
            Take photo
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="justify-center"
            onClick={() => uploadInputRef.current?.click()}
          >
            <Upload size={16} />
            Upload images or PDFs
          </Button>
        </div>

        {currentSavedSourceAttachments.length > 0 ? (
          <div className="mt-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Saved source files
            </p>
            <div className="grid gap-3">
              {currentSavedSourceAttachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="rounded-[24px] border border-slate-200 bg-white px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        {attachment.kind === "pdf" ? (
                          <FileText size={16} className="text-amber-700" />
                        ) : (
                          <FileImage size={16} className="text-teal-700" />
                        )}
                        <span>{attachment.originalName}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          {attachment.kind.toUpperCase()}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          {formatAttachmentSize(attachment.sizeBytes)}
                        </span>
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-900">
                          Attached to exercise
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-rose-700 hover:bg-rose-50"
                      onClick={() => removeSavedSourceAttachment(attachment.id)}
                    >
                      <Trash2 size={16} />
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {pendingSourceFiles.length > 0 ? (
          <div className="mt-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Local files waiting for AI upload
            </p>
            <div className="grid gap-3">
              {pendingSourceFiles.map((pendingSourceFile) => (
                <div
                  key={pendingSourceFile.id}
                  className="rounded-[24px] border border-teal-200 bg-white px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        {pendingSourceFile.file.type === "application/pdf" ? (
                          <FileText size={16} className="text-amber-700" />
                        ) : (
                          <FileImage size={16} className="text-teal-700" />
                        )}
                        <span>{pendingSourceFile.file.name}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          {pendingSourceFile.file.type === "application/pdf" ? "PDF" : "IMAGE"}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          {formatAttachmentSize(pendingSourceFile.file.size)}
                        </span>
                        <span className="rounded-full bg-teal-50 px-3 py-1 text-teal-800">
                          Run AI Co-pilot to attach
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-rose-700 hover:bg-rose-50"
                      onClick={() => removePendingSourceFile(pendingSourceFile.id)}
                    >
                      <Trash2 size={16} />
                      Remove
                    </Button>
                  </div>

                  {pendingSourceFile.previewUrl ? (
                    <div className="mt-4 overflow-hidden rounded-[24px] border border-slate-200 bg-slate-950/4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={pendingSourceFile.previewUrl}
                        alt="Teacher source preview"
                        className="max-h-72 w-full object-contain"
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {currentSavedSourceAttachments.length === 0 && pendingSourceFiles.length === 0 ? (
          <div className="mt-4 flex items-center gap-2 rounded-[24px] border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-600">
            <Upload size={16} className="text-slate-400" />
            <span>No source file selected yet</span>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Textarea
          rows={7}
          placeholder="Teacher theory reference"
          value={form.theory}
          onChange={(event) => setForm((current) => ({ ...current, theory: event.target.value }))}
        />
        <div className="grid gap-4">
          <Input
            placeholder="Final answer"
            value={form.finalAnswer}
            onChange={(event) =>
              setForm((current) => ({ ...current, finalAnswer: event.target.value }))
            }
          />
          <Input
            type="datetime-local"
            value={form.dueAt}
            onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))}
          />
          <Textarea
            rows={4}
            placeholder="Teacher rubric"
            value={form.rubric}
            onChange={(event) => setForm((current) => ({ ...current, rubric: event.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Solution choreography</p>
            <p className="text-sm text-slate-600">
              These steps stay teacher-side and power hinting, grading, notebooking, and analytics.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setForm((current) => ({
                ...current,
                solutionSteps: [...current.solutionSteps, blankStep()],
              }))
            }
          >
            <Sparkles size={16} />
            Add step
          </Button>
        </div>

        <div className="space-y-4">
          {form.solutionSteps.map((step, index) => (
            <Card key={`step-${index}`} className="space-y-3 border-slate-200/80 p-4">
              <div className="flex items-center justify-between">
                <Badge>Step {index + 1}</Badge>
                {form.solutionSteps.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-rose-700 hover:bg-rose-50"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        solutionSteps: current.solutionSteps.filter((_, stepIndex) => stepIndex !== index),
                      }))
                    }
                  >
                    Remove
                  </Button>
                ) : null}
              </div>

              <Input
                placeholder="Step title"
                value={step.title}
                onChange={(event) =>
                  updateStep(index, (current) => ({ ...current, title: event.target.value }))
                }
              />
              <Textarea
                rows={4}
                placeholder="Explanation"
                value={step.explanation}
                onChange={(event) =>
                  updateStep(index, (current) => ({
                    ...current,
                    explanation: event.target.value,
                  }))
                }
              />
              <Input
                placeholder="Expected intermediate answer"
                value={step.expectedAnswer}
                onChange={(event) =>
                  updateStep(index, (current) => ({
                    ...current,
                    expectedAnswer: event.target.value,
                  }))
                }
              />
              <Input
                placeholder="Review snippet for SOS escalation"
                value={step.reviewSnippet}
                onChange={(event) =>
                  updateStep(index, (current) => ({
                    ...current,
                    reviewSnippet: event.target.value,
                  }))
                }
              />
              <Textarea
                rows={3}
                placeholder="Hint questions, one per line"
                value={step.hintQuestions.join("\n")}
                onChange={(event) =>
                  updateStep(index, (current) => ({
                    ...current,
                    hintQuestions: event.target.value.split("\n"),
                  }))
                }
              />
              <Input
                placeholder="Misconception tags, comma separated"
                value={step.misconceptionTags.join(", ")}
                onChange={(event) =>
                  updateStep(index, (current) => ({
                    ...current,
                    misconceptionTags: event.target.value.split(",").map((item) => item.trim()),
                  }))
                }
              />
            </Card>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || pending}
        >
          {saveMutation.isPending ? "Saving..." : editingExercise ? "Update exercise" : "Publish exercise"}
        </Button>
        <Button type="button" variant="secondary" onClick={resetEditorState}>
          Reset form
        </Button>
      </div>
    </Card>
  );
}
