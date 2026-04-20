import multer from "multer";
import { type Request, Router } from "express";
import { z } from "zod";

import { env } from "../config/env.js";
import { asyncHandler } from "../lib/async-handler.js";
import { AppError } from "../lib/app-error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { AssetModel } from "../models/Asset.js";
import { ExerciseModel } from "../models/Exercise.js";
import { NotebookEntryModel } from "../models/NotebookEntry.js";
import { generateTeacherCopilotDraft } from "../services/ai.service.js";
import {
  assertSupportedAttachmentMimeType,
  createAssetFromUpload,
  getOwnedAssetOrThrow,
  serializeAttachment,
  type SerializedAttachment,
  type UploadFileInput,
} from "../services/asset.service.js";
import {
  getExerciseWithAccessOrThrow,
  getExerciseSourceAssetIds,
  getTeacherClassroomOrThrow,
  serializeExercise,
  serializeExerciseForStudent,
} from "../services/classroom.service.js";
import { getStudentSubmission, submitExerciseAttempt } from "../services/submission.service.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.UPLOAD_MAX_MB * 1024 * 1024,
  },
});

const attachmentUpload = upload.fields([
  { name: "attachments", maxCount: 8 },
  { name: "attachment", maxCount: 1 },
  { name: "image", maxCount: 1 },
]);

const stepSchema = z.object({
  title: z.string().min(1),
  explanation: z.string().min(1),
  expectedAnswer: z.string().min(1),
  hintQuestions: z.array(z.string().min(1)).min(1),
  misconceptionTags: z.array(z.string().min(1)).default([]),
  reviewSnippet: z.string().min(1),
});

const optionalIdSchema = z.union([z.string().min(1), z.literal(""), z.null()]).optional();
const optionalIdArraySchema = z.preprocess(
  (value) => {
    if (Array.isArray(value)) {
      return value;
    }

    if (value === undefined || value === null) {
      return [];
    }

    return [value];
  },
  z.array(z.union([z.string(), z.null()])),
);

const exerciseInputSchema = z
  .object({
    classroomId: z.string().min(1),
    sourceAttachmentIds: optionalIdArraySchema.optional(),
    sourceAttachmentId: optionalIdSchema,
    title: z.string().min(2).max(160),
    prompt: z.string().min(10),
    theory: z.string().min(10),
    finalAnswer: z.string().min(1),
    rubric: z.string().min(10),
    solutionSteps: z.array(stepSchema).min(1),
    difficulty: z.enum(["core", "extended"]).default("core"),
    assignedTrack: z.enum(["all", "core", "extended"]).default("all"),
    dueAt: z.union([z.string().datetime(), z.literal(""), z.null()]).optional(),
    status: z.enum(["draft", "published"]).default("published"),
  })
  .transform((payload) => ({
    ...payload,
    sourceAttachmentIds: Array.from(
      new Set(
        [...(payload.sourceAttachmentIds ?? []), payload.sourceAttachmentId]
          .map((value) => (typeof value === "string" ? value.trim() : ""))
          .filter(Boolean),
      ),
    ),
  }));

const aiDraftInputSchema = z
  .object({
    prompt: z.string().max(12_000).optional().default(""),
    theory: z.string().max(12_000).optional().default(""),
    finalAnswer: z.string().max(1_200).optional().default(""),
    difficulty: z.enum(["core", "extended"]).default("core"),
    sourceAttachmentIds: optionalIdArraySchema.optional(),
    sourceAttachmentId: optionalIdSchema,
  })
  .transform((payload) => ({
    ...payload,
    prompt: payload.prompt.trim(),
    theory: payload.theory.trim(),
    finalAnswer: payload.finalAnswer.trim(),
    sourceAttachmentIds: Array.from(
      new Set(
        [...(payload.sourceAttachmentIds ?? []), payload.sourceAttachmentId]
          .map((value) => (typeof value === "string" ? value.trim() : ""))
          .filter(Boolean),
      ),
    ),
  }));

function pickUploadedFiles(req: Request): UploadFileInput[] {
  const files = req.files as
    | {
        [fieldname: string]: Express.Multer.File[] | undefined;
      }
    | undefined;

  return [...(files?.attachments ?? []), ...(files?.attachment ?? []), ...(files?.image ?? [])].map(
    (file) => ({
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalName: file.originalname,
      size: file.size,
    }),
  );
}

function toGeminiAttachment(asset: {
  kind: "image" | "pdf";
  mimeType: string;
  dataUrl: string;
  extractedText?: string;
}) {
  const [, base64 = ""] = asset.dataUrl.split(",", 2);

  return {
    kind: asset.kind,
    mimeType: asset.mimeType,
    base64,
    extractedText: asset.extractedText ?? "",
  };
}

function createLegacyImageAttachment(dataUrl: string): SerializedAttachment {
  const mimeMatch = /^data:([^;]+);base64,/.exec(dataUrl);

  return {
    id: "legacy-image",
    kind: "image",
    originalName: "Existing image upload",
    mimeType: mimeMatch?.[1] ?? "image/*",
    sizeBytes: 0,
    extractedText: "",
    dataUrl,
  };
}

async function serializeSubmission(submission: {
  _id: unknown;
  exerciseId: unknown;
  classroomId: unknown;
  studentId: unknown;
  latestAnswerText?: string;
  latestAssetId?: unknown | null;
  latestImageDataUrl?: string | null;
  extractedText?: string;
  status: string;
  attemptCount: number;
  wrongAttemptCount: number;
  bestValidatedStepIndex: number;
  teacherFlagged: boolean;
  sosTriggered: boolean;
  solvedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  lastFeedback?: {
    status: string;
    shortFeedback: string;
    socraticQuestion: string;
    knowledgeReminder: string;
    encouragingLine: string;
    errorType: string;
    likelyStepIndex: number;
    validatedStepIndex: number;
    concepts: string[];
    guardrailReason?: string | null;
    teacherFlag: boolean;
    hotspot?: {
      x: number;
      y: number;
      width: number;
      height: number;
      question: string;
    } | null;
  } | null;
  history: Array<{
    answerText: string;
    extractedText: string;
    assetId?: unknown | null;
    createdAt: Date;
    feedback: {
      status: string;
      shortFeedback: string;
      socraticQuestion: string;
      knowledgeReminder: string;
      encouragingLine: string;
      errorType: string;
      likelyStepIndex: number;
      validatedStepIndex: number;
      concepts: string[];
      guardrailReason?: string | null;
      teacherFlag: boolean;
      hotspot?: {
        x: number;
        y: number;
        width: number;
        height: number;
        question: string;
      } | null;
    };
  }>;
  notebookEntryId?: unknown | null;
}) {
  const assetIds = [
    ...(submission.latestAssetId ? [String(submission.latestAssetId)] : []),
    ...submission.history
      .map((attempt) => (attempt.assetId ? String(attempt.assetId) : null))
      .filter((value): value is string => Boolean(value)),
  ];

  const assets = assetIds.length
    ? await AssetModel.find({ _id: { $in: assetIds } }).lean()
    : [];
  const assetById = new Map(assets.map((asset) => [String(asset._id), asset]));
  const latestAsset =
    submission.latestAssetId != null
      ? assetById.get(String(submission.latestAssetId)) ?? null
      : null;
  const latestAttachment = latestAsset
    ? serializeAttachment(latestAsset, { includeDataUrl: true })
    : submission.latestImageDataUrl
      ? createLegacyImageAttachment(submission.latestImageDataUrl)
      : null;

  return {
    id: String(submission._id),
    exerciseId: String(submission.exerciseId),
    classroomId: String(submission.classroomId),
    studentId: String(submission.studentId),
    latestAnswerText: submission.latestAnswerText ?? "",
    latestAttachment,
    latestImageDataUrl:
      latestAttachment?.kind === "image" ? latestAttachment.dataUrl ?? null : null,
    extractedText: submission.extractedText ?? "",
    status: submission.status,
    attemptCount: submission.attemptCount,
    wrongAttemptCount: submission.wrongAttemptCount,
    bestValidatedStepIndex: submission.bestValidatedStepIndex,
    teacherFlagged: submission.teacherFlagged,
    sosTriggered: submission.sosTriggered,
    notebookEntryId: submission.notebookEntryId ? String(submission.notebookEntryId) : null,
    solvedAt: submission.solvedAt ? submission.solvedAt.toISOString() : null,
    createdAt: submission.createdAt?.toISOString() ?? null,
    updatedAt: submission.updatedAt?.toISOString() ?? null,
    lastFeedback: submission.lastFeedback ?? null,
    history: submission.history.map((attempt) => ({
      ...attempt,
      attachment:
        attempt.assetId && assetById.has(String(attempt.assetId))
          ? serializeAttachment(assetById.get(String(attempt.assetId))!, { includeDataUrl: true })
          : null,
      createdAt: attempt.createdAt.toISOString(),
    })),
  };
}

async function serializeTeacherExerciseWithSource(exercise: {
  _id: unknown;
  classroomId: unknown;
  teacherId: unknown;
  sourceAssetIds?: Array<unknown> | null;
  sourceAssetId?: unknown | null;
  title: string;
  prompt: string;
  theory: string;
  rubric: string;
  finalAnswer: string;
  difficulty: "core" | "extended";
  assignedTrack: "all" | "core" | "extended";
  status: "draft" | "published";
  dueAt?: Date | null;
  solutionSteps?: Array<{
    title: string;
    explanation: string;
    expectedAnswer: string;
    hintQuestions: string[];
    misconceptionTags: string[];
    reviewSnippet: string;
  }>;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  const baseExercise = serializeExercise(exercise);
  const sourceAssetIds = getExerciseSourceAssetIds(exercise);
  const sourceAssets = sourceAssetIds.length
    ? await AssetModel.find({ _id: { $in: sourceAssetIds } }).lean()
    : [];
  const sourceAssetById = new Map(sourceAssets.map((asset) => [String(asset._id), asset]));
  const sourceAttachments = sourceAssetIds.flatMap((assetId) => {
    const sourceAsset = sourceAssetById.get(assetId);
    return sourceAsset ? [serializeAttachment(sourceAsset)] : [];
  });

  return {
    ...baseExercise,
    sourceAttachments,
    sourceAttachment: sourceAttachments[0] ?? null,
  };
}

async function resolveTeacherSourceAssets(
  sourceAttachmentIds: string[],
  teacherId: string,
) {
  if (sourceAttachmentIds.length === 0) {
    return [];
  }

  return Promise.all(
    sourceAttachmentIds.map((sourceAttachmentId) =>
      getOwnedAssetOrThrow({
        assetId: sourceAttachmentId,
        ownerId: teacherId,
        purpose: "exercise_source",
      }),
    ),
  );
}

export const exerciseRouter = Router();

exerciseRouter.use(requireAuth);

exerciseRouter.post(
  "/ai-draft",
  requireRole("teacher"),
  attachmentUpload,
  asyncHandler(async (req, res) => {
    const payload = aiDraftInputSchema.parse(req.body);
    const uploadedFiles = pickUploadedFiles(req);

    for (const uploadedFile of uploadedFiles) {
      assertSupportedAttachmentMimeType(uploadedFile.mimetype);
    }

    const [existingSourceAssets, uploadedSourceAssets] = await Promise.all([
      resolveTeacherSourceAssets(payload.sourceAttachmentIds, req.auth!.sub),
      Promise.all(
        uploadedFiles.map((uploadedFile) =>
          createAssetFromUpload({
            ownerId: req.auth!.sub,
            purpose: "exercise_source",
            file: uploadedFile,
          }),
        ),
      ),
    ]);
    const sourceAssets = [...existingSourceAssets, ...uploadedSourceAssets];

    if (sourceAssets.length === 0) {
      if (payload.prompt.length < 10) {
        throw new AppError(
          "Provide a teacher prompt and reference theory, or upload an image/PDF source.",
          400,
        );
      }

      if (payload.theory.length < 10) {
        throw new AppError(
          "Provide a teacher prompt and reference theory, or upload an image/PDF source.",
          400,
        );
      }

      if (!payload.finalAnswer) {
        throw new AppError(
          "Provide a teacher prompt and reference theory, or upload an image/PDF source.",
          400,
        );
      }
    }

    const draft = await generateTeacherCopilotDraft({
      prompt: payload.prompt,
      theory: payload.theory,
      finalAnswer: payload.finalAnswer,
      difficulty: payload.difficulty,
      ...(sourceAssets.length > 0
        ? {
            attachments: sourceAssets.map((sourceAsset) => toGeminiAttachment(sourceAsset)),
          }
        : {}),
    });
    const serializedSourceAttachments = sourceAssets.map((sourceAsset) => serializeAttachment(sourceAsset));

    res.json({
      draft,
      sourceAttachmentIds: sourceAssets.map((sourceAsset) => String(sourceAsset._id)),
      sourceAttachmentId: sourceAssets[0] ? String(sourceAssets[0]._id) : null,
      sourceAttachments: serializedSourceAttachments,
      sourceAttachment: serializedSourceAttachments[0] ?? null,
    });
  }),
);

exerciseRouter.post(
  "/",
  requireRole("teacher"),
  asyncHandler(async (req, res) => {
    const payload = exerciseInputSchema.parse(req.body);
    await getTeacherClassroomOrThrow(payload.classroomId, req.auth!.sub);

    const sourceAssets = await resolveTeacherSourceAssets(payload.sourceAttachmentIds, req.auth!.sub);
    const sourceAssetIds = sourceAssets.map((sourceAsset) => sourceAsset._id);

    const exercise = await ExerciseModel.create({
      classroomId: payload.classroomId,
      teacherId: req.auth!.sub,
      sourceAssetIds,
      sourceAssetId: sourceAssetIds[0] ?? null,
      title: payload.title,
      prompt: payload.prompt,
      theory: payload.theory,
      finalAnswer: payload.finalAnswer,
      rubric: payload.rubric,
      solutionSteps: payload.solutionSteps,
      difficulty: payload.difficulty,
      assignedTrack: payload.assignedTrack,
      dueAt: payload.dueAt ? new Date(payload.dueAt) : null,
      status: payload.status,
    });

    res.status(201).json({
      exercise: serializeExercise(exercise),
    });
  }),
);

exerciseRouter.put(
  "/:exerciseId",
  requireRole("teacher"),
  asyncHandler(async (req, res) => {
    const payload = exerciseInputSchema.parse(req.body);
    const exercise = await ExerciseModel.findOne({
      _id: req.params.exerciseId,
      teacherId: req.auth!.sub,
    });

    if (!exercise) {
      throw new AppError("Exercise not found.", 404);
    }

    await getTeacherClassroomOrThrow(payload.classroomId, req.auth!.sub);
    const sourceAssets = await resolveTeacherSourceAssets(payload.sourceAttachmentIds, req.auth!.sub);
    const sourceAssetIds = sourceAssets.map((sourceAsset) => sourceAsset._id);

    exercise.classroomId = payload.classroomId as typeof exercise.classroomId;
    exercise.sourceAssetIds = sourceAssetIds as typeof exercise.sourceAssetIds;
    exercise.sourceAssetId = sourceAssetIds[0] ?? null;
    exercise.title = payload.title;
    exercise.prompt = payload.prompt;
    exercise.theory = payload.theory;
    exercise.finalAnswer = payload.finalAnswer;
    exercise.rubric = payload.rubric;
    exercise.solutionSteps = payload.solutionSteps;
    exercise.difficulty = payload.difficulty;
    exercise.assignedTrack = payload.assignedTrack;
    exercise.dueAt = payload.dueAt ? new Date(payload.dueAt) : null;
    exercise.status = payload.status;
    await exercise.save();

    res.json({
      exercise: serializeExercise(exercise),
    });
  }),
);

exerciseRouter.get(
  "/:exerciseId/submission",
  requireRole("student"),
  asyncHandler(async (req, res) => {
    const exerciseId = z.string().parse(req.params.exerciseId);
    const submission = await getStudentSubmission(exerciseId, req.auth!.sub);

    if (!submission) {
      res.json({ submission: null, notebookEntry: null });
      return;
    }

    const notebookEntry = submission.notebookEntryId
      ? await NotebookEntryModel.findById(submission.notebookEntryId).lean()
      : null;

    res.json({
      submission: await serializeSubmission(submission),
      notebookEntry: notebookEntry
        ? {
            id: String(notebookEntry._id),
            summary: notebookEntry.summary,
            solvedStrategy: notebookEntry.solvedStrategy,
            ahaMoment: notebookEntry.ahaMoment,
            timeline: notebookEntry.timeline,
            mistakes: notebookEntry.mistakes,
            awardedBadge: notebookEntry.awardedBadge,
            createdAt: notebookEntry.createdAt.toISOString(),
          }
        : null,
    });
  }),
);

exerciseRouter.post(
  "/:exerciseId/submit",
  requireRole("student"),
  attachmentUpload,
  asyncHandler(async (req, res) => {
    const exerciseId = z.string().parse(req.params.exerciseId);
    const answerText = z.string().max(12_000).parse(req.body.answerText ?? "");
    const uploadedFile = pickUploadedFiles(req)[0] ?? null;

    if (uploadedFile) {
      assertSupportedAttachmentMimeType(uploadedFile.mimetype);
    }

    const result = await submitExerciseAttempt({
      exerciseId,
      studentId: req.auth!.sub,
      answerText,
      file: uploadedFile,
    });

    res.json({
      submission: await serializeSubmission(result.submission),
      rewards: result.rewardSummary,
      notebookEntry: result.notebookEntry
        ? {
            id: String(result.notebookEntry._id),
            summary: result.notebookEntry.summary,
            solvedStrategy: result.notebookEntry.solvedStrategy,
            ahaMoment: result.notebookEntry.ahaMoment,
            timeline: result.notebookEntry.timeline,
            mistakes: result.notebookEntry.mistakes,
            awardedBadge: result.notebookEntry.awardedBadge,
            createdAt: result.notebookEntry.createdAt.toISOString(),
          }
        : null,
    });
  }),
);

exerciseRouter.get(
  "/:exerciseId",
  asyncHandler(async (req, res) => {
    const exerciseId = z.string().parse(req.params.exerciseId);
    const { exercise, classroom, studentTrack } = await getExerciseWithAccessOrThrow(
      exerciseId,
      req.auth!.sub,
      req.auth!.role,
    );

    const submission =
      req.auth!.role === "student"
        ? await getStudentSubmission(exerciseId, req.auth!.sub)
        : null;

    res.json({
      exercise: {
        ...(
          req.auth!.role === "teacher"
            ? await serializeTeacherExerciseWithSource(exercise)
            : serializeExerciseForStudent(exercise)
        ),
        classroomName: classroom.name,
        studentTrack,
      },
      submission: submission ? await serializeSubmission(submission) : null,
    });
  }),
);
