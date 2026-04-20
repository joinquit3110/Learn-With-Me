import mongoose, { type InferSchemaType } from "mongoose";

const { model, models, Schema } = mongoose;

const notebookEntrySchema = new Schema(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    classroomId: { type: Schema.Types.ObjectId, ref: "Classroom", required: true, index: true },
    exerciseId: { type: Schema.Types.ObjectId, ref: "Exercise", required: true, index: true },
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
    awardedBadge: { type: String, default: null },
  },
  { timestamps: true },
);

export type NotebookEntryDocument = InferSchemaType<typeof notebookEntrySchema> & {
  _id: mongoose.Types.ObjectId;
};

export const NotebookEntryModel =
  models.NotebookEntry || model("NotebookEntry", notebookEntrySchema);
