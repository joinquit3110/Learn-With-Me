import { AppError } from "../lib/app-error.js";
import { AssetModel } from "../models/Asset.js";
import { NotebookEntryModel } from "../models/NotebookEntry.js";
import { SubmissionModel } from "../models/Submission.js";
import { evaluateStudentWork } from "./ai.service.js";
import {
  createAssetFromUpload,
  extractAttachmentText,
  getAttachmentKind,
  type UploadFileInput,
} from "./asset.service.js";
import { getExerciseSourceAssetIds, getExerciseWithAccessOrThrow } from "./classroom.service.js";
import { applyRewards } from "./user-stats.service.js";

function toBase64Payload(file: UploadFileInput, extractedText = "") {
  const kind = getAttachmentKind(file.mimetype);

  if (!kind) {
    throw new AppError("Only image and PDF uploads are supported.", 400);
  }

  return {
    kind,
    mimeType: file.mimetype,
    base64: file.buffer.toString("base64"),
    extractedText,
  };
}

export async function getStudentSubmission(exerciseId: string, studentId: string) {
  const submission = await SubmissionModel.findOne({ exerciseId, studentId }).lean();
  return submission;
}

export async function submitExerciseAttempt(input: {
  exerciseId: string;
  studentId: string;
  answerText: string;
  file?: UploadFileInput | null;
}) {
  const { exercise, classroom } = await getExerciseWithAccessOrThrow(
    input.exerciseId,
    input.studentId,
    "student",
  );

  if (exercise.status !== "published") {
    throw new AppError("This exercise is not published yet.", 400);
  }

  const existingSubmission =
    (await SubmissionModel.findOne({
      exerciseId: input.exerciseId,
      studentId: input.studentId,
    })) ??
    new SubmissionModel({
      exerciseId: exercise._id,
      classroomId: classroom._id,
      studentId: input.studentId,
    });

  const wasSolvedBefore = existingSubmission.status === "correct" || Boolean(existingSubmission.solvedAt);

  const previousAttemptsSummary = existingSubmission.history
    .slice(-4)
    .map(
      (attempt: {
        answerText?: string;
        feedback: {
          status: string;
          likelyStepIndex: number;
          validatedStepIndex: number;
          shortFeedback: string;
        };
      }) => {
        const normalizedAnswer = (attempt.answerText ?? "").trim().replace(/\s+/g, " ");
        const answerPreview = normalizedAnswer ? normalizedAnswer.slice(0, 180) : "(file-only)";

        return [
          `status=${attempt.feedback.status}`,
          `likelyStep=${attempt.feedback.likelyStepIndex}`,
          `validatedStep=${attempt.feedback.validatedStepIndex}`,
          `studentLine=${answerPreview}`,
          `feedback=${attempt.feedback.shortFeedback}`,
        ].join(" | ");
      },
    );
  const attachmentText = input.file ? await extractAttachmentText(input.file) : "";
  const combinedExtractedText = [input.answerText.trim(), attachmentText]
    .filter(Boolean)
    .join("\n\n")
    .trim();
  const sourceAssetIds = getExerciseSourceAssetIds(exercise);
  const sourceAssets = sourceAssetIds.length
    ? await AssetModel.find({ _id: { $in: sourceAssetIds } }).lean()
    : [];
  const sourceAssetById = new Map(sourceAssets.map((asset) => [String(asset._id), asset]));
  const teacherSourceText = sourceAssetIds
    .map((sourceAssetId) => sourceAssetById.get(sourceAssetId)?.extractedText?.trim() ?? "")
    .filter(Boolean)
    .join("\n\n---\n\n");

  const coachMemory = {
    bestValidatedStepIndex: existingSubmission.bestValidatedStepIndex,
    wasSolved: wasSolvedBefore,
    lastLikelyStepIndex: existingSubmission.lastFeedback?.likelyStepIndex ?? 0,
    lastSocraticQuestion: existingSubmission.lastFeedback?.socraticQuestion ?? "",
    recentAttempts: previousAttemptsSummary,
  };

  const feedback = await evaluateStudentWork({
    prompt: exercise.prompt,
    theory: exercise.theory,
    finalAnswer: exercise.finalAnswer,
    steps: exercise.solutionSteps,
    answerText: input.answerText,
    priorWrongAttempts: existingSubmission.wrongAttemptCount,
    previousAttemptsSummary,
    teacherSourceText,
    coachMemory,
    ...(input.file ? { attachment: toBase64Payload(input.file, attachmentText) } : {}),
  });

  const uploadedAsset = input.file
    ? await createAssetFromUpload({
        ownerId: input.studentId,
        purpose: "submission_work",
        file: input.file,
        extractedText: attachmentText,
      })
    : null;

  const totalSteps = Math.max(exercise.solutionSteps.length, 1);
  const rewardSummary = await applyRewards({
    userId: input.studentId,
    currentBestValidatedStepIndex: existingSubmission.bestValidatedStepIndex,
    wrongAttemptCount: existingSubmission.wrongAttemptCount,
    totalSteps,
    wasSolvedBefore,
    feedback,
  });

  existingSubmission.latestAnswerText = input.answerText.trim();
  existingSubmission.latestAssetId = uploadedAsset?._id ?? existingSubmission.latestAssetId;
  existingSubmission.latestImageDataUrl =
    uploadedAsset ? (uploadedAsset.kind === "image" ? uploadedAsset.dataUrl : null) : existingSubmission.latestImageDataUrl;
  existingSubmission.extractedText = combinedExtractedText;
  existingSubmission.status = feedback.status;
  existingSubmission.attemptCount += 1;
  existingSubmission.wrongAttemptCount +=
    feedback.status === "incorrect" || feedback.status === "sos" ? 1 : 0;
  existingSubmission.bestValidatedStepIndex = rewardSummary.bestValidatedStepIndex;
  existingSubmission.lastFeedback = feedback;
  existingSubmission.teacherFlagged = feedback.teacherFlag;
  existingSubmission.sosTriggered = feedback.status === "sos";
  existingSubmission.history.push({
    answerText: input.answerText.trim(),
    extractedText: combinedExtractedText,
    assetId: uploadedAsset?._id ?? null,
    feedback,
    createdAt: new Date(),
  });

  let notebookEntry = null;

  if (
    feedback.status === "correct" &&
    feedback.notebookDraft &&
    (!wasSolvedBefore || !existingSubmission.notebookEntryId)
  ) {
    notebookEntry =
      (existingSubmission.notebookEntryId
        ? await NotebookEntryModel.findById(existingSubmission.notebookEntryId)
        : null) ??
      new NotebookEntryModel({
        studentId: input.studentId,
        classroomId: classroom._id,
        exerciseId: exercise._id,
      });

    notebookEntry.summary = feedback.notebookDraft.summary;
    notebookEntry.solvedStrategy = feedback.notebookDraft.solvedStrategy;
    notebookEntry.ahaMoment = feedback.notebookDraft.ahaMoment;
    notebookEntry.timeline = feedback.notebookDraft.timeline;
    notebookEntry.mistakes = feedback.notebookDraft.mistakes;
    notebookEntry.awardedBadge = rewardSummary.badgeAwarded;
    await notebookEntry.save();

    existingSubmission.notebookEntryId = notebookEntry._id;
    existingSubmission.solvedAt = new Date();
    existingSubmission.teacherFlagged = false;
    existingSubmission.sosTriggered = false;
  }

  await existingSubmission.save();

  return {
    submission: existingSubmission.toObject(),
    rewardSummary,
    notebookEntry: notebookEntry?.toObject() ?? null,
  };
}
