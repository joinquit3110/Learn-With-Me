import { Router } from "express";
import { z } from "zod";

import { asyncHandler } from "../lib/async-handler.js";
import { AppError } from "../lib/app-error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { AssetModel } from "../models/Asset.js";
import { ClassroomModel } from "../models/Classroom.js";
import { EnrollmentModel } from "../models/Enrollment.js";
import { ExerciseModel } from "../models/Exercise.js";
import { SubmissionModel } from "../models/Submission.js";
import { UserModel } from "../models/User.js";
import { serializeUser } from "../services/auth.service.js";
import { getClassroomAnalytics } from "../services/analytics.service.js";
import { serializeAttachment } from "../services/asset.service.js";
import { generateTeacherStudentHistoryCopilot } from "../services/ai.service.js";
import {
  generateUniqueJoinCode,
  getAccessibleClassroomOrThrow,
  getExerciseSourceAssetIds,
  getTeacherClassroomOrThrow,
  serializeClassroom,
  serializeExercise,
  serializeExerciseForStudent,
} from "../services/classroom.service.js";

const createClassSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(600).default(""),
  subject: z.string().trim().min(2).max(120).default("Mathematics"),
  gradeBand: z.string().trim().min(2).max(80).default("General"),
  defaultTrack: z.enum(["core", "extended"]).default("core"),
});

const joinClassSchema = z.object({
  joinCode: z.string().min(4).max(12),
  track: z.enum(["core", "extended"]).optional(),
});

export const classroomRouter = Router();

classroomRouter.use(requireAuth);

classroomRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (req.auth!.role === "teacher") {
      const classrooms = await ClassroomModel.find({ teacherId: req.auth!.sub }).lean();
      const classroomIds = classrooms.map((classroom) => classroom._id);
      const [enrollments, exercises] = await Promise.all([
        EnrollmentModel.find({ classroomId: { $in: classroomIds } }).lean(),
        ExerciseModel.find({ classroomId: { $in: classroomIds } }).lean(),
      ]);

      const studentCountByClassroom = new Map<string, number>();
      const exerciseCountByClassroom = new Map<string, number>();

      for (const enrollment of enrollments) {
        const key = String(enrollment.classroomId);
        studentCountByClassroom.set(key, (studentCountByClassroom.get(key) ?? 0) + 1);
      }

      for (const exercise of exercises) {
        const key = String(exercise.classroomId);
        exerciseCountByClassroom.set(key, (exerciseCountByClassroom.get(key) ?? 0) + 1);
      }

      res.json({
        classes: classrooms.map((classroom) => ({
          ...serializeClassroom(classroom),
          studentCount: studentCountByClassroom.get(String(classroom._id)) ?? 0,
          exerciseCount: exerciseCountByClassroom.get(String(classroom._id)) ?? 0,
        })),
      });
      return;
    }

    const enrollments = await EnrollmentModel.find({ studentId: req.auth!.sub }).lean();
    const classroomIds = enrollments.map((enrollment) => enrollment.classroomId);
    const [classrooms, exercises, submissions] = await Promise.all([
      ClassroomModel.find({ _id: { $in: classroomIds } }).lean(),
      ExerciseModel.find({ classroomId: { $in: classroomIds }, status: "published" }).lean(),
      SubmissionModel.find({ studentId: req.auth!.sub, classroomId: { $in: classroomIds } }).lean(),
    ]);

    const trackByClassroomId = new Map(
      enrollments.map((enrollment) => [String(enrollment.classroomId), enrollment.track]),
    );
    const submissionByExerciseId = new Map(
      submissions.map((submission) => [String(submission.exerciseId), submission]),
    );

    res.json({
      classes: classrooms.map((classroom) => {
        const visibleExercises = exercises.filter((exercise) => {
          const track = trackByClassroomId.get(String(classroom._id));
          return (
            String(exercise.classroomId) === String(classroom._id) &&
            (exercise.assignedTrack === "all" || exercise.assignedTrack === track)
          );
        });

        return {
          ...serializeClassroom(classroom),
          track: trackByClassroomId.get(String(classroom._id)) ?? "core",
          exerciseCount: visibleExercises.length,
          solvedCount: visibleExercises.filter(
            (exercise) => submissionByExerciseId.get(String(exercise._id))?.status === "correct",
          ).length,
        };
      }),
    });
  }),
);

classroomRouter.post(
  "/",
  requireRole("teacher"),
  asyncHandler(async (req, res) => {
    const payload = createClassSchema.parse(req.body);
    const joinCode = await generateUniqueJoinCode();

    const classroom = await ClassroomModel.create({
      teacherId: req.auth!.sub,
      name: payload.name,
      description: payload.description,
      subject: payload.subject,
      gradeBand: payload.gradeBand,
      defaultTrack: payload.defaultTrack,
      joinCode,
    });

    res.status(201).json({
      classroom: serializeClassroom(classroom),
    });
  }),
);

classroomRouter.post(
  "/join",
  requireRole("student"),
  asyncHandler(async (req, res) => {
    const payload = joinClassSchema.parse(req.body);
    const classroom = await ClassroomModel.findOne({
      joinCode: payload.joinCode.trim().toUpperCase(),
    });

    if (!classroom) {
      throw new AppError("Classroom code not found.", 404);
    }

    const existingEnrollment = await EnrollmentModel.findOne({
      classroomId: classroom._id,
      studentId: req.auth!.sub,
    });

    if (existingEnrollment) {
      throw new AppError("You have already joined this classroom.", 409);
    }

    const enrollment = await EnrollmentModel.create({
      classroomId: classroom._id,
      studentId: req.auth!.sub,
      track: payload.track ?? classroom.defaultTrack,
    });

    res.status(201).json({
      classroom: serializeClassroom(classroom),
      enrollment: {
        id: String(enrollment._id),
        track: enrollment.track,
      },
    });
  }),
);

classroomRouter.get(
  "/:classroomId/analytics",
  requireRole("teacher"),
  asyncHandler(async (req, res) => {
    const classroomId = z.string().parse(req.params.classroomId);
    await getTeacherClassroomOrThrow(classroomId, req.auth!.sub);
    const analytics = await getClassroomAnalytics(classroomId);
    res.json({ analytics });
  }),
);

const historyQuerySchema = z.object({
  exerciseId: z.string().trim().min(1).optional(),
  limit: z.preprocess(
    (value) => (value === undefined || value === null || value === "" ? undefined : value),
    z.coerce.number().int().min(1).max(100).default(50),
  ),
});

const historyCopilotBodySchema = z.object({
  exerciseId: z.string().min(1),
});

type LeanAttempt = {
  answerText: string;
  extractedText: string;
  assetId?: unknown;
  createdAt: Date;
  feedback: {
    status: string;
    shortFeedback: string;
    socraticQuestion: string;
    knowledgeReminder: string;
    encouragingLine: string;
    errorType: string;
    likelyStepIndex: number;
    validatedStepIndex: number;
    concepts: string[];
    teacherFlag: boolean;
    hotspot?: unknown;
  };
};
type TeacherHistoryCopilot = {
  summary: string;
  progress: string[];
  blockers: string[];
  teacherMoves: string[];
  suggestedNextPrompt: string;
  source: "ai" | "fallback";
  warning: string | null;
  generatedAt?: Date;
};

type LeanSubmission = { history?: LeanAttempt[]; teacherHistoryCopilot?: TeacherHistoryCopilot | null };

function sanitizeTeacherHistorySubmission(
  submission: LeanSubmission,
  attachmentById: Map<string, ReturnType<typeof serializeAttachment>>,
) {
  const cleanHistory = (submission.history ?? [])
    .filter((attempt: LeanAttempt) => attempt.feedback.status !== "guardrail")
    .map((attempt: LeanAttempt) => ({
      answerText: attempt.answerText,
      extractedText: attempt.extractedText,
      createdAt: attempt.createdAt.toISOString(),
      attachment: attempt.assetId ? attachmentById.get(String(attempt.assetId)) ?? null : null,
      feedback: {
        status: attempt.feedback.status,
        shortFeedback: attempt.feedback.shortFeedback,
        socraticQuestion: attempt.feedback.socraticQuestion,
        knowledgeReminder: attempt.feedback.knowledgeReminder,
        encouragingLine: attempt.feedback.encouragingLine,
        errorType: attempt.feedback.errorType,
        likelyStepIndex: attempt.feedback.likelyStepIndex,
        validatedStepIndex: attempt.feedback.validatedStepIndex,
        concepts: attempt.feedback.concepts,
        teacherFlag: attempt.feedback.teacherFlag,
        hotspot: attempt.feedback.hotspot,
      },
    }));

  return cleanHistory;
}

async function getTeacherStudentHistoryPayload(input: {
  classroomId: string;
  studentId: string;
  teacherId: string;
  exerciseId?: string;
  limit: number;
}) {
  const classroom = await getTeacherClassroomOrThrow(input.classroomId, input.teacherId);
  const enrollment = await EnrollmentModel.findOne({ classroomId: input.classroomId, studentId: input.studentId }).lean();

  if (!enrollment) {
    throw new AppError("Student is not actively enrolled in this classroom.", 404);
  }

  const [student, exercises, submissions] = await Promise.all([
    UserModel.findById(input.studentId).lean(),
    ExerciseModel.find({ classroomId: input.classroomId }).lean(),
    SubmissionModel.find({
      classroomId: input.classroomId,
      studentId: input.studentId,
      ...(input.exerciseId ? { exerciseId: input.exerciseId } : {}),
    })
      .sort({ updatedAt: -1 })
      .limit(input.limit)
      .lean(),
  ]);

  const historyAssetIds = Array.from(
    new Set(
      submissions.flatMap((submission: LeanSubmission) =>
        (submission.history ?? [])
          .filter((attempt: LeanAttempt) => attempt.feedback.status !== "guardrail" && attempt.assetId)
          .map((attempt: LeanAttempt) => String(attempt.assetId)),
      ),
    ),
  );
  const historyAssets = historyAssetIds.length
    ? await AssetModel.find({ _id: { $in: historyAssetIds }, purpose: "submission_work" }).lean()
    : [];
  const attachmentById = new Map(
    historyAssets.map((asset) => [String(asset._id), serializeAttachment(asset, { includeDataUrl: true })]),
  );

  const exerciseMap = new Map(exercises.map((exercise) => [String(exercise._id), exercise]));
  const groups = submissions.map((submission) => ({
    submissionId: String(submission._id),
    exerciseId: String(submission.exerciseId),
    exerciseTitle: exerciseMap.get(String(submission.exerciseId))?.title ?? "Exercise",
    status: submission.status,
    attemptCount: submission.attemptCount,
    wrongAttemptCount: submission.wrongAttemptCount,
    teacherFlagged: Boolean(submission.teacherFlagged),
    sosTriggered: Boolean(submission.sosTriggered),
    updatedAt: submission.updatedAt.toISOString(),
    copilot: submission.teacherHistoryCopilot
      ? {
          summary: submission.teacherHistoryCopilot.summary,
          progress: submission.teacherHistoryCopilot.progress,
          blockers: submission.teacherHistoryCopilot.blockers,
          teacherMoves: submission.teacherHistoryCopilot.teacherMoves,
          suggestedNextPrompt: submission.teacherHistoryCopilot.suggestedNextPrompt,
          source: submission.teacherHistoryCopilot.source,
          warning: submission.teacherHistoryCopilot.warning,
          generatedAt: submission.teacherHistoryCopilot.generatedAt?.toISOString() ?? null,
        }
      : null,
    history: sanitizeTeacherHistorySubmission(submission, attachmentById) ?? [],
  }));

  return {
    classroom: serializeClassroom(classroom),
    enrollment: { id: String(enrollment._id), track: enrollment.track },
    student: student ? serializeUser(student) : null,
    groups,
  };
}

classroomRouter.delete(
  "/:classroomId/enrollments/:enrollmentId",
  requireRole("teacher"),
  asyncHandler(async (req, res) => {
    const classroomId = z.string().parse(req.params.classroomId);
    const enrollmentId = z.string().parse(req.params.enrollmentId);
    await getTeacherClassroomOrThrow(classroomId, req.auth!.sub);

    const deleted = await EnrollmentModel.findOneAndDelete({ _id: enrollmentId, classroomId });
    if (!deleted) {
      throw new AppError("Enrollment not found.", 404);
    }

    res.json({ ok: true, enrollmentId });
  }),
);

classroomRouter.get(
  "/:classroomId/students/:studentId/history",
  requireRole("teacher"),
  asyncHandler(async (req, res) => {
    const classroomId = z.string().parse(req.params.classroomId);
    const studentId = z.string().parse(req.params.studentId);
    const query = historyQuerySchema.parse(req.query);
    const payload = await getTeacherStudentHistoryPayload({
      classroomId,
      studentId,
      teacherId: req.auth!.sub,
      ...(query.exerciseId ? { exerciseId: query.exerciseId } : {}),
      limit: query.limit,
    });

    res.json(payload);
  }),
);

classroomRouter.post(
  "/:classroomId/students/:studentId/history/copilot",
  requireRole("teacher"),
  asyncHandler(async (req, res) => {
    const classroomId = z.string().parse(req.params.classroomId);
    const studentId = z.string().parse(req.params.studentId);
    const query = historyQuerySchema.parse(req.query);
    const body = historyCopilotBodySchema.parse(req.body ?? {});
    const payload = await getTeacherStudentHistoryPayload({
      classroomId,
      studentId,
      teacherId: req.auth!.sub,
      exerciseId: body.exerciseId,
      limit: query.limit,
    });
    const copilot = await generateTeacherStudentHistoryCopilot({
      studentName: payload.student?.name ?? "Student",
      classroomName: payload.classroom.name,
      history: payload.groups.map((group) => ({
        exerciseTitle: group.exerciseTitle,
        status: group.status,
        attemptCount: group.attemptCount,
        wrongAttemptCount: group.wrongAttemptCount,
        attempts: group.history.map((attempt: ReturnType<typeof sanitizeTeacherHistorySubmission>[number]) => ({
          answerText: attempt.answerText,
          extractedText: attempt.extractedText,
          coachReply: [attempt.feedback.shortFeedback, attempt.feedback.socraticQuestion].filter(Boolean).join(" "),
          status: attempt.feedback.status,
          concepts: attempt.feedback.concepts,
          createdAt: attempt.createdAt,
        })),
      })),
    });

    const latestGroup = payload.groups[0];

    const generatedAt = new Date();

    if (latestGroup) {
      await SubmissionModel.updateOne(
        { _id: latestGroup.submissionId, classroomId, studentId },
        {
          $set: {
            teacherHistoryCopilot: {
              ...copilot,
              generatedAt,
            },
          },
        },
      );
    }

    res.json({ ...copilot, generatedAt: generatedAt.toISOString() });
  }),
);

classroomRouter.get(
  "/:classroomId",
  asyncHandler(async (req, res) => {
    const classroomId = z.string().parse(req.params.classroomId);
    const access = await getAccessibleClassroomOrThrow(
      classroomId,
      req.auth!.sub,
      req.auth!.role,
    );

    const exercises = await ExerciseModel.find({ classroomId }).sort({ createdAt: -1 }).lean();

    if (req.auth!.role === "teacher") {
      const [enrollments, students, submissions, analytics] = await Promise.all([
        EnrollmentModel.find({ classroomId }).lean(),
        UserModel.find({
          _id: {
            $in: (
              await EnrollmentModel.find({ classroomId }).distinct("studentId")
            ).map((id) => id),
          },
        }).lean(),
        SubmissionModel.find({ classroomId }).lean(),
        getClassroomAnalytics(classroomId),
      ]);

      const studentById = new Map(students.map((student) => [String(student._id), student]));
      const sourceAssetIds = Array.from(
        new Set(exercises.flatMap((exercise) => getExerciseSourceAssetIds(exercise))),
      );
      const sourceAssets = sourceAssetIds.length
        ? await AssetModel.find({ _id: { $in: sourceAssetIds } }).lean()
        : [];
      const sourceAssetById = new Map(
        sourceAssets.map((asset) => [String(asset._id), serializeAttachment(asset)]),
      );

      res.json({
        classroom: serializeClassroom(access.classroom),
        exercises: exercises.map((exercise) => {
          const exerciseSourceAssetIds = getExerciseSourceAssetIds(exercise);
          const sourceAttachments = exerciseSourceAssetIds.flatMap((assetId) => {
            const sourceAttachment = sourceAssetById.get(assetId);
            return sourceAttachment ? [sourceAttachment] : [];
          });

          return {
            ...serializeExercise(exercise),
            sourceAttachments,
            sourceAttachment: sourceAttachments[0] ?? null,
          };
        }),
        roster: enrollments.map((enrollment) => {
          const student = studentById.get(String(enrollment.studentId));
          const studentSubmissions = submissions.filter(
            (submission) => String(submission.studentId) === String(enrollment.studentId),
          );

          return {
            enrollmentId: String(enrollment._id),
            track: enrollment.track,
            student: student ? serializeUser(student) : null,
            solvedCount: studentSubmissions.filter((submission) => submission.status === "correct").length,
            flaggedCount: studentSubmissions.filter((submission) => submission.teacherFlagged).length,
          };
        }),
        analytics,
      });
      return;
    }

    const submissions = await SubmissionModel.find({
      classroomId,
      studentId: req.auth!.sub,
    }).lean();
    const submissionByExerciseId = new Map(
      submissions.map((submission) => [String(submission.exerciseId), submission]),
    );

    const visibleExercises = exercises.filter(
      (exercise) => exercise.assignedTrack === "all" || exercise.assignedTrack === access.track,
    );

    res.json({
      classroom: serializeClassroom(access.classroom),
      track: access.track,
      exercises: visibleExercises.map((exercise) => ({
        ...serializeExerciseForStudent(exercise),
        submissionStatus: submissionByExerciseId.get(String(exercise._id))?.status ?? "not_started",
        attemptCount: submissionByExerciseId.get(String(exercise._id))?.attemptCount ?? 0,
      })),
    });
  }),
);
