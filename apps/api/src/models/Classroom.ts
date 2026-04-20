import mongoose, { type InferSchemaType } from "mongoose";

const { model, models, Schema } = mongoose;

import { learningTracks } from "../types/domain.js";

const classroomSchema = new Schema(
  {
    teacherId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    subject: { type: String, default: "Mathematics" },
    gradeBand: { type: String, default: "General" },
    joinCode: { type: String, required: true, unique: true, index: true },
    defaultTrack: { type: String, enum: learningTracks, default: "core" },
  },
  { timestamps: true },
);

export type ClassroomDocument = InferSchemaType<typeof classroomSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ClassroomModel = models.Classroom || model("Classroom", classroomSchema);
