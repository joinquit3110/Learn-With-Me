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
