import { Router } from "express";

import { asyncHandler } from "../lib/async-handler.js";
import { AppError } from "../lib/app-error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { NotebookEntryModel } from "../models/NotebookEntry.js";

export const notebookRouter = Router();

notebookRouter.use(requireAuth, requireRole("student"));

notebookRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const entries = await NotebookEntryModel.find({ studentId: req.auth!.sub })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      entries: entries.map((entry) => ({
        id: String(entry._id),
        exerciseId: String(entry.exerciseId),
        classroomId: String(entry.classroomId),
        summary: entry.summary,
        solvedStrategy: entry.solvedStrategy,
        ahaMoment: entry.ahaMoment,
        timeline: entry.timeline,
        mistakes: entry.mistakes,
        awardedBadge: entry.awardedBadge,
        createdAt: entry.createdAt.toISOString(),
      })),
    });
  }),
);

notebookRouter.get(
  "/:entryId",
  asyncHandler(async (req, res) => {
    const entry = await NotebookEntryModel.findOne({
      _id: req.params.entryId,
      studentId: req.auth!.sub,
    }).lean();

    if (!entry) {
      throw new AppError("Notebook entry not found.", 404);
    }

    res.json({
      entry: {
        id: String(entry._id),
        exerciseId: String(entry.exerciseId),
        classroomId: String(entry.classroomId),
        summary: entry.summary,
        solvedStrategy: entry.solvedStrategy,
        ahaMoment: entry.ahaMoment,
        timeline: entry.timeline,
        mistakes: entry.mistakes,
        awardedBadge: entry.awardedBadge,
        createdAt: entry.createdAt.toISOString(),
      },
    });
  }),
);
