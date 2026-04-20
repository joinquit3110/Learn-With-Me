import { Router } from "express";

import { asyncHandler } from "../lib/async-handler.js";
import { requireAuth } from "../middleware/auth.js";
import { getStudentDashboard, getTeacherDashboard } from "../services/dashboard.service.js";

export const dashboardRouter = Router();

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
