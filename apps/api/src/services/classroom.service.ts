import { customAlphabet } from "nanoid";

import { AppError } from "../lib/app-error.js";
import { ClassroomModel } from "../models/Classroom.js";
import { EnrollmentModel } from "../models/Enrollment.js";
import { ExerciseModel } from "../models/Exercise.js";
import type { AssignedTrack, LearningTrack, UserRole } from "../types/domain.js";

const joinCodeAlphabet = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

export function getExerciseSourceAssetIds(exercise: {
  sourceAssetIds?: Array<unknown> | null;
  sourceAssetId?: unknown | null;
}) {
  const sourceAssetIds = Array.isArray(exercise.sourceAssetIds)
    ? exercise.sourceAssetIds.map((assetId) => String(assetId))
    : [];

  if (sourceAssetIds.length > 0) {
    return sourceAssetIds;
  }

  return exercise.sourceAssetId ? [String(exercise.sourceAssetId)] : [];
}

export function serializeExercise(exercise: {
  _id: unknown;
  classroomId: unknown;
  teacherId: unknown;
  sourceAssetIds?: Array<unknown> | null;
  sourceAssetId?: unknown | null;
  title: string;
  prompt: string;
  theory: string;
  rubric: string;
  finalAnswer: string;
  difficulty: LearningTrack;
  assignedTrack: AssignedTrack;
  status: "draft" | "published";
  dueAt?: Date | null;
  solutionSteps?: Array<{
    title: string;
    explanation: string;
    expectedAnswer: string;
    hintQuestions: string[];
    misconceptionTags: string[];
    reviewSnippet: string;
  }>;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  const sourceAttachmentIds = getExerciseSourceAssetIds(exercise);

  return {
    id: String(exercise._id),
    classroomId: String(exercise.classroomId),
    teacherId: String(exercise.teacherId),
    sourceAttachmentIds,
    sourceAttachmentId: sourceAttachmentIds[0] ?? null,
    title: exercise.title,
    prompt: exercise.prompt,
    theory: exercise.theory,
    rubric: exercise.rubric,
    finalAnswer: exercise.finalAnswer,
    difficulty: exercise.difficulty,
    assignedTrack: exercise.assignedTrack,
    status: exercise.status,
    dueAt: exercise.dueAt ? exercise.dueAt.toISOString() : null,
    solutionSteps: exercise.solutionSteps ?? [],
    createdAt: exercise.createdAt?.toISOString() ?? null,
    updatedAt: exercise.updatedAt?.toISOString() ?? null,
  };
}

export function serializeExerciseForStudent(exercise: {
  _id: unknown;
  classroomId: unknown;
  teacherId: unknown;
  title: string;
  prompt: string;
  theory: string;
  difficulty: LearningTrack;
  assignedTrack: AssignedTrack;
  status: "draft" | "published";
  dueAt?: Date | null;
  solutionSteps?: Array<unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: String(exercise._id),
    classroomId: String(exercise.classroomId),
    teacherId: String(exercise.teacherId),
    title: exercise.title,
    prompt: exercise.prompt,
    theory: exercise.theory,
    difficulty: exercise.difficulty,
    assignedTrack: exercise.assignedTrack,
    status: exercise.status,
    dueAt: exercise.dueAt ? exercise.dueAt.toISOString() : null,
    stepCount: exercise.solutionSteps?.length ?? 0,
    createdAt: exercise.createdAt?.toISOString() ?? null,
    updatedAt: exercise.updatedAt?.toISOString() ?? null,
  };
}

export function serializeClassroom(classroom: {
  _id: unknown;
  teacherId: unknown;
  name: string;
  description: string;
  subject: string;
  gradeBand: string;
  joinCode: string;
  defaultTrack: LearningTrack;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: String(classroom._id),
    teacherId: String(classroom.teacherId),
    name: classroom.name,
    description: classroom.description,
    subject: classroom.subject,
    gradeBand: classroom.gradeBand,
    joinCode: classroom.joinCode,
    defaultTrack: classroom.defaultTrack,
    createdAt: classroom.createdAt?.toISOString() ?? null,
    updatedAt: classroom.updatedAt?.toISOString() ?? null,
  };
}

export async function generateUniqueJoinCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const joinCode = joinCodeAlphabet();
    const existingClassroom = await ClassroomModel.findOne({ joinCode });

    if (!existingClassroom) {
      return joinCode;
    }
  }

  throw new AppError("Unable to generate a unique class code right now. Please retry.", 500);
}

export async function getTeacherClassroomOrThrow(classroomId: string, teacherId: string) {
  const classroom = await ClassroomModel.findOne({ _id: classroomId, teacherId });

  if (!classroom) {
    throw new AppError("Classroom not found.", 404);
  }

  return classroom;
}

export async function getAccessibleClassroomOrThrow(
  classroomId: string,
  userId: string,
  role: UserRole,
) {
  const classroom = await ClassroomModel.findById(classroomId);

  if (!classroom) {
    throw new AppError("Classroom not found.", 404);
  }

  if (role === "teacher") {
    if (String(classroom.teacherId) !== userId) {
      throw new AppError("You do not have access to this classroom.", 403);
    }

    return {
      classroom,
      track: null,
    };
  }

  const enrollment = await EnrollmentModel.findOne({
    classroomId,
    studentId: userId,
  });

  if (!enrollment) {
    throw new AppError("You are not enrolled in this classroom.", 403);
  }

  return {
    classroom,
    track: enrollment.track,
  };
}

export async function getExerciseWithAccessOrThrow(exerciseId: string, userId: string, role: UserRole) {
  const exercise = await ExerciseModel.findById(exerciseId);

  if (!exercise) {
    throw new AppError("Exercise not found.", 404);
  }

  const access = await getAccessibleClassroomOrThrow(String(exercise.classroomId), userId, role);

  if (
    role === "student" &&
    exercise.assignedTrack !== "all" &&
    exercise.assignedTrack !== access.track
  ) {
    throw new AppError("This exercise is not assigned to your track.", 403);
  }

  return {
    exercise,
    classroom: access.classroom,
    studentTrack: access.track,
  };
}
