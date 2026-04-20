import mongoose, { type InferSchemaType } from "mongoose";

const { model, models, Schema } = mongoose;

import { errorTypes, submissionStatuses } from "../types/domain.js";

const hotspotSchema = new Schema(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    question: { type: String, required: true },
  },
  { _id: false },
);

const notebookDraftSchema = new Schema(
  {
    summary: { type: String, required: true },
    solvedStrategy: { type: String, required: true },
    ahaMoment: { type: String, required: true },
    timeline: { type: [String], default: [] },
    mistakes: {
      type: [
        new Schema(
          {
            stepTitle: { type: String, required: true },
            issue: { type: String, required: true },
            fix: { type: String, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { _id: false },
);

const feedbackSchema = new Schema(
  {
    status: { type: String, enum: submissionStatuses, required: true },
    shortFeedback: { type: String, required: true },
    socraticQuestion: { type: String, required: true },
    knowledgeReminder: { type: String, required: true },
    encouragingLine: { type: String, required: true },
    errorType: { type: String, enum: errorTypes, required: true },
    likelyStepIndex: { type: Number, required: true, default: 0 },
    validatedStepIndex: { type: Number, required: true, default: 0 },
    concepts: { type: [String], default: [] },
    guardrailReason: { type: String, default: null },
    hotspot: { type: hotspotSchema, default: null },
    teacherFlag: { type: Boolean, default: false },
    notebookDraft: { type: notebookDraftSchema, default: null },
  },
  { _id: false },
);

const attemptHistorySchema = new Schema(
  {
    answerText: { type: String, default: "" },
    extractedText: { type: String, default: "" },
    assetId: { type: Schema.Types.ObjectId, ref: "Asset", default: null },
    feedback: { type: feedbackSchema, required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const submissionSchema = new Schema(
  {
    exerciseId: { type: Schema.Types.ObjectId, ref: "Exercise", required: true, index: true },
    classroomId: { type: Schema.Types.ObjectId, ref: "Classroom", required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    latestAnswerText: { type: String, default: "" },
    latestAssetId: { type: Schema.Types.ObjectId, ref: "Asset", default: null },
    latestImageDataUrl: { type: String, default: null },
    extractedText: { type: String, default: "" },
    status: { type: String, enum: submissionStatuses, default: "incorrect" },
    attemptCount: { type: Number, default: 0 },
    wrongAttemptCount: { type: Number, default: 0 },
    bestValidatedStepIndex: { type: Number, default: 0 },
    lastFeedback: { type: feedbackSchema, default: null },
    teacherFlagged: { type: Boolean, default: false },
    sosTriggered: { type: Boolean, default: false },
    solvedAt: { type: Date, default: null },
    notebookEntryId: { type: Schema.Types.ObjectId, ref: "NotebookEntry", default: null },
    history: { type: [attemptHistorySchema], default: [] },
  },
  { timestamps: true },
);

submissionSchema.index({ exerciseId: 1, studentId: 1 }, { unique: true });

export type SubmissionDocument = InferSchemaType<typeof submissionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const SubmissionModel = models.Submission || model("Submission", submissionSchema);
