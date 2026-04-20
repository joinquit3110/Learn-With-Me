import mongoose, { type InferSchemaType } from "mongoose";

const { model, models, Schema } = mongoose;

import { assignedTracks, learningTracks } from "../types/domain.js";

const exerciseStepSchema = new Schema(
  {
    title: { type: String, required: true },
    explanation: { type: String, required: true },
    expectedAnswer: { type: String, required: true },
    hintQuestions: { type: [String], default: [] },
    misconceptionTags: { type: [String], default: [] },
    reviewSnippet: { type: String, default: "" },
  },
  { _id: false },
);

const exerciseSchema = new Schema(
  {
    classroomId: { type: Schema.Types.ObjectId, ref: "Classroom", required: true, index: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sourceAssetIds: { type: [{ type: Schema.Types.ObjectId, ref: "Asset" }], default: [] },
    sourceAssetId: { type: Schema.Types.ObjectId, ref: "Asset", default: null },
    title: { type: String, required: true, trim: true },
    prompt: { type: String, required: true },
    theory: { type: String, required: true },
    finalAnswer: { type: String, required: true },
    rubric: { type: String, required: true },
    solutionSteps: { type: [exerciseStepSchema], default: [] },
    difficulty: { type: String, enum: learningTracks, default: "core" },
    assignedTrack: { type: String, enum: assignedTracks, default: "all" },
    dueAt: { type: Date, default: null },
    status: { type: String, enum: ["draft", "published"], default: "published" },
  },
  { timestamps: true },
);

export type ExerciseDocument = InferSchemaType<typeof exerciseSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ExerciseModel = models.Exercise || model("Exercise", exerciseSchema);
