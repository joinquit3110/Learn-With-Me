import mongoose, { type InferSchemaType } from "mongoose";

const { model, models, Schema } = mongoose;

const assetSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    purpose: {
      type: String,
      enum: ["exercise_source", "submission_work"],
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: ["image", "pdf"],
      required: true,
    },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    dataUrl: { type: String, required: true },
    extractedText: { type: String, default: "" },
  },
  { timestamps: true },
);

export type AssetDocument = InferSchemaType<typeof assetSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AssetModel = models.Asset || model("Asset", assetSchema);
