import mongoose, { type InferSchemaType } from "mongoose";

const { model, models, Schema } = mongoose;

import { userRoles } from "../types/domain.js";

const userStatsSchema = new Schema(
  {
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    streak: { type: Number, default: 0 },
    badges: { type: [String], default: [] },
    lastActiveDate: { type: String, default: null },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: { type: String, enum: userRoles, required: true },
    passwordHash: { type: String, required: true },
    avatarSeed: { type: String, required: true },
    stats: { type: userStatsSchema, default: () => ({}) },
  },
  { timestamps: true },
);

export type UserDocument = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };

export const UserModel = models.User || model("User", userSchema);
