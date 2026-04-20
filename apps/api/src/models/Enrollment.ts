import mongoose, { type InferSchemaType } from "mongoose";

const { model, models, Schema } = mongoose;

import { learningTracks } from "../types/domain.js";

const enrollmentSchema = new Schema(
  {
    classroomId: { type: Schema.Types.ObjectId, ref: "Classroom", required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    track: { type: String, enum: learningTracks, default: "core" },
  },
  { timestamps: true },
);

enrollmentSchema.index({ classroomId: 1, studentId: 1 }, { unique: true });

export type EnrollmentDocument = InferSchemaType<typeof enrollmentSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const EnrollmentModel = models.Enrollment || model("Enrollment", enrollmentSchema);
