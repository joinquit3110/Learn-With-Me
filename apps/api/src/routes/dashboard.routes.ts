import { Router } from "express";
import { z } from "zod";

import { asyncHandler } from "../lib/async-handler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { getStudentDashboard, getTeacherDashboard } from "../services/dashboard.service.js";
import { updateTeacherSubmissionTriage } from "../services/submission.service.js";

export const dashboardRouter = Router();

const triageUpdateSchema = z.object({
  action: z.enum(["open", "watching", "resolved", "dismissed", "reopen"]).optional(),
  status: z.enum(["open", "watching", "resolved", "dismissed"]).optional(),
  note: z.string().trim().max(1000).optional(),
  snoozeUntil: z.string().datetime().nullable().optional(),
}).refine((payload) => payload.status || payload.action, {
  message: "Provide status or action.",
});

dashboardRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.auth!.role === "teacher") {
      const dashboard = await getTeacherDashboard(req.auth!.sub);
      res.json({ role: "teacher", dashboard });
      return;
    }

    const dashboard = await getStudentDashboard(req.auth!.sub);
    res.json({ role: "student", dashboard });
  }),
);

dashboardRouter.patch(
  "/submissions/:submissionId/triage",
  requireAuth,
  requireRole("teacher"),
  asyncHandler(async (req, res) => {
    const params = z.object({ submissionId: z.string().min(1) }).parse(req.params);
    const payload = triageUpdateSchema.parse(req.body);
    const requestedStatus = payload.status ?? payload.action;
    const status = requestedStatus === "reopen" ? "open" : requestedStatus!;
    const submission = await updateTeacherSubmissionTriage({
      submissionId: params.submissionId,
      teacherId: req.auth!.sub,
      status,
      ...(payload.note === undefined ? {} : { note: payload.note }),
      snoozeUntil: payload.snoozeUntil ? new Date(payload.snoozeUntil) : null,
    });

    res.json({ submission });
  }),
);
