import { ClassroomModel } from "../models/Classroom.js";
import { EnrollmentModel } from "../models/Enrollment.js";
import { ExerciseModel } from "../models/Exercise.js";
import { NotebookEntryModel } from "../models/NotebookEntry.js";
import { SubmissionModel } from "../models/Submission.js";
import { UserModel } from "../models/User.js";
import { serializeUser } from "./auth.service.js";
import { getClassroomAnalytics } from "./analytics.service.js";
import {
  serializeClassroom,
  serializeExercise,
  serializeExerciseForStudent,
} from "./classroom.service.js";

import { serializeTriageFields } from "./submission.service.js";

function toId(value: unknown) {
  return String(value);
}

export async function getStudentDashboard(studentId: string) {
  const [student, enrollments, notebooks] = await Promise.all([
    UserModel.findById(studentId),
    EnrollmentModel.find({ studentId }).lean(),
    NotebookEntryModel.find({ studentId }).sort({ createdAt: -1 }).limit(12).lean(),
  ]);

  if (!student) {
    return null;
  }

  const classroomIds = enrollments.map((enrollment) => enrollment.classroomId);
  const [classrooms, exercises, submissions] = await Promise.all([
    ClassroomModel.find({ _id: { $in: classroomIds } }).lean(),
    ExerciseModel.find({ classroomId: { $in: classroomIds }, status: "published" }).lean(),
    SubmissionModel.find({ studentId, classroomId: { $in: classroomIds } }).lean(),
  ]);

  const trackByClassroomId = new Map(
    enrollments.map((enrollment) => [String(enrollment.classroomId), enrollment.track]),
  );
  const submissionByExerciseId = new Map(
    submissions.map((submission) => [String(submission.exerciseId), submission]),
  );

  const visibleExercises = exercises.filter((exercise) => {
    const studentTrack = trackByClassroomId.get(String(exercise.classroomId));
    return exercise.assignedTrack === "all" || exercise.assignedTrack === studentTrack;
  });

  const classes = classrooms.map((classroom) => {
    const classroomExercises = visibleExercises.filter(
      (exercise) => String(exercise.classroomId) === String(classroom._id),
    );
    const solvedCount = classroomExercises.filter(
      (exercise) => submissionByExerciseId.get(String(exercise._id))?.status === "correct",
    ).length;

    return {
      ...serializeClassroom(classroom),
      track: trackByClassroomId.get(String(classroom._id)) ?? "core",
      exerciseCount: classroomExercises.length,
      solvedCount,
    };
  });

  const pendingExercises = visibleExercises
    .filter((exercise) => submissionByExerciseId.get(String(exercise._id))?.status !== "correct")
    .sort((left, right) => {
      if (!left.dueAt && !right.dueAt) return 0;
      if (!left.dueAt) return 1;
      if (!right.dueAt) return -1;
      return left.dueAt.getTime() - right.dueAt.getTime();
    })
    .slice(0, 8)
    .map((exercise) => ({
      ...serializeExerciseForStudent(exercise),
      classroomName:
        classrooms.find((classroom) => String(classroom._id) === String(exercise.classroomId))?.name ??
        "Classroom",
      lastStatus: submissionByExerciseId.get(String(exercise._id))?.status ?? "not_started",
    }));

  return {
    profile: serializeUser(student),
    classes,
    pendingExercises,
    notebook: notebooks.map((entry) => ({
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
  };
}

export async function getTeacherDashboard(teacherId: string) {
  const [teacher, classrooms, exercises] = await Promise.all([
    UserModel.findById(teacherId),
    ClassroomModel.find({ teacherId }).lean(),
    ExerciseModel.find({ teacherId }).sort({ createdAt: -1 }).lean(),
  ]);

  if (!teacher) {
    return null;
  }

  const classroomIds = classrooms.map((classroom) => classroom._id);
  const enrollments = await EnrollmentModel.find({ classroomId: { $in: classroomIds } }).lean();
  const activeStudentIds = enrollments.map((enrollment) => toId(enrollment.studentId));
  const [flaggedSubmissions, analyticsList] = await Promise.all([
    activeStudentIds.length
      ? SubmissionModel.find({
          classroomId: { $in: classroomIds },
          studentId: { $in: activeStudentIds },
          status: { $ne: "correct" },
          triageStatus: { $nin: ["resolved", "dismissed"] },
          $or: [
            { teacherFlagged: true },
            { sosTriggered: true },
            { triageStatus: { $in: ["open", "watching"] } },
          ],
        })
          .sort({ sosTriggered: -1, teacherFlagged: -1, updatedAt: -1 })
          .limit(50)
          .lean()
      : [],
    Promise.all(classrooms.map((classroom) => getClassroomAnalytics(String(classroom._id)))),
  ]);

  const studentIds = Array.from(new Set(flaggedSubmissions.map((submission) => toId(submission.studentId))));
  const [students, flaggedExercises] = await Promise.all([
    studentIds.length ? UserModel.find({ _id: { $in: studentIds } }).lean() : [],
    flaggedSubmissions.length
      ? ExerciseModel.find({ _id: { $in: flaggedSubmissions.map((submission) => submission.exerciseId) } }).lean()
      : [],
  ]);
  const studentMap = new Map(students.map((student) => [toId(student._id), student]));
  const exerciseMap = new Map(flaggedExercises.map((exercise) => [toId(exercise._id), exercise]));
  const classroomMap = new Map(classrooms.map((classroom) => [toId(classroom._id), classroom]));
  const enrollmentByClassAndStudent = new Map(
    enrollments.map((enrollment) => [`${toId(enrollment.classroomId)}::${toId(enrollment.studentId)}`, enrollment]),
  );

  const studentCountByClassroom = new Map<string, number>();

  for (const enrollment of enrollments) {
    const key = String(enrollment.classroomId);
    studentCountByClassroom.set(key, (studentCountByClassroom.get(key) ?? 0) + 1);
  }

  const triageCounts = flaggedSubmissions.reduce(
    (counts, submission) => {
      const triageStatus = submission.triageStatus ?? "open";
      counts[triageStatus as keyof typeof counts] += 1;
      return counts;
    },
    { open: 0, watching: 0, resolved: 0, dismissed: 0 },
  );

  return {
    profile: serializeUser(teacher),
    classes: classrooms.map((classroom) => ({
      ...serializeClassroom(classroom),
      studentCount: studentCountByClassroom.get(String(classroom._id)) ?? 0,
      exerciseCount: exercises.filter(
        (exercise) => String(exercise.classroomId) === String(classroom._id),
      ).length,
    })),
    recentExercises: exercises.slice(0, 10).map(serializeExercise),
    analytics: analyticsList.filter(Boolean),
    signalCounts: {
      active: triageCounts.open,
      watching: triageCounts.watching,
      resolved: triageCounts.resolved,
      dismissed: triageCounts.dismissed,
    },
    flaggedSubmissions: flaggedSubmissions.map((submission) => {
      const classroom = classroomMap.get(toId(submission.classroomId));
      const student = studentMap.get(toId(submission.studentId));
      const exercise = exerciseMap.get(toId(submission.exerciseId));
      const enrollment = enrollmentByClassAndStudent.get(`${toId(submission.classroomId)}::${toId(submission.studentId)}`);

      return {
        id: String(submission._id),
        exerciseId: String(submission.exerciseId),
        exerciseTitle: exercise?.title ?? "Exercise",
        classroomId: String(submission.classroomId),
        classroomName: classroom?.name ?? "Classroom",
        studentId: String(submission.studentId),
        studentName: student?.name ?? "Student",
        studentEmail: student?.email ?? "",
        enrollmentId: enrollment ? String(enrollment._id) : "",
        track: enrollment?.track ?? "core",
        status: submission.status,
        ...serializeTriageFields(submission),
        teacherFlagged: Boolean(submission.teacherFlagged),
        sosTriggered: Boolean(submission.sosTriggered),
        attemptCount: submission.attemptCount,
        wrongAttemptCount: submission.wrongAttemptCount,
        updatedAt: submission.updatedAt.toISOString(),
      };
    }),
  };
}
