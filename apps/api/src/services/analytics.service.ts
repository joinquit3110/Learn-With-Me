import { ClassroomModel } from "../models/Classroom.js";
import { EnrollmentModel } from "../models/Enrollment.js";
import { ExerciseModel } from "../models/Exercise.js";
import { SubmissionModel } from "../models/Submission.js";
import { UserModel } from "../models/User.js";
import { serializeTriageFields } from "./submission.service.js";

const RELATED_LEARNER_LIMIT = 12;

function toId(value: unknown) {
  return String(value);
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function getClassroomAnalytics(classroomId: string) {
  const [classroom, enrollments, exercises] = await Promise.all([
    ClassroomModel.findById(classroomId).lean(),
    EnrollmentModel.find({ classroomId }).lean(),
    ExerciseModel.find({ classroomId }).lean(),
  ]);

  if (!classroom) {
    return null;
  }

  const activeStudentIds = enrollments.map((enrollment) => toId(enrollment.studentId));
  const activeStudentIdSet = new Set(activeStudentIds);
  const submissions = activeStudentIds.length
    ? await SubmissionModel.find({ classroomId, studentId: { $in: activeStudentIds } }).lean()
    : [];

  const students = activeStudentIds.length
    ? await UserModel.find({ _id: { $in: activeStudentIds } }).lean()
    : [];
  const studentMap = new Map(students.map((student) => [toId(student._id), student]));
  const enrollmentByStudentId = new Map(enrollments.map((enrollment) => [toId(enrollment.studentId), enrollment]));
  const exerciseMap = new Map(exercises.map((exercise) => [toId(exercise._id), exercise]));
  const classroomInfo = {
    id: toId(classroom._id),
    name: classroom.name,
    joinCode: classroom.joinCode,
  };

  const blindspotMap = new Map<
    string,
    {
      concept: string;
      stepTitle: string;
      count: number;
      relatedLearners: Array<{
        studentId: string;
        studentName: string;
        studentEmail: string;
        classroomId: string;
        classroomName: string;
        exerciseId: string;
        exerciseTitle: string;
        submissionId: string;
        status: string;
        wrongAttemptCount: number;
        attemptCount: number;
        lastAttemptAt: string | null;
        occurrences: number;
        enrollmentId: string;
        track: string;
      }>;
    }
  >();
  let incorrectEventCount = 0;

  for (const submission of submissions) {
    if (!activeStudentIdSet.has(toId(submission.studentId))) continue;

    const exercise = exerciseMap.get(toId(submission.exerciseId));
    const student = studentMap.get(toId(submission.studentId));
    const enrollment = enrollmentByStudentId.get(toId(submission.studentId));
    const occurrencesByBlindspot = new Map<string, number>();

    for (const attempt of submission.history ?? []) {
      if (attempt.feedback.status === "correct" || attempt.feedback.status === "guardrail") {
        continue;
      }

      const stepTitle =
        exercise?.solutionSteps?.[Math.max(0, attempt.feedback.likelyStepIndex - 1)]?.title ??
        "Problem setup";
      const concepts = attempt.feedback.concepts.length ? attempt.feedback.concepts : ["General reasoning"];

      for (const concept of concepts) {
        const key = `${stepTitle}::${concept}`;
        occurrencesByBlindspot.set(key, (occurrencesByBlindspot.get(key) ?? 0) + 1);
        incorrectEventCount += 1;

        if (!blindspotMap.has(key)) {
          blindspotMap.set(key, {
            concept,
            stepTitle,
            count: 0,
            relatedLearners: [],
          });
        }

        blindspotMap.get(key)!.count += 1;
      }
    }

    for (const [key, occurrences] of occurrencesByBlindspot) {
      const blindspot = blindspotMap.get(key);
      if (!blindspot || blindspot.relatedLearners.length >= RELATED_LEARNER_LIMIT) continue;

      blindspot.relatedLearners.push({
        studentId: toId(submission.studentId),
        studentName: student?.name ?? "Student",
        studentEmail: student?.email ?? "",
        classroomId: toId(classroom._id),
        classroomName: classroom.name,
        exerciseId: toId(submission.exerciseId),
        exerciseTitle: exercise?.title ?? "Exercise",
        submissionId: toId(submission._id),
        status: submission.status,
        ...serializeTriageFields(submission),
        wrongAttemptCount: submission.wrongAttemptCount,
        attemptCount: submission.attemptCount,
        lastAttemptAt: toIso(submission.updatedAt),
        occurrences,
        enrollmentId: enrollment ? toId(enrollment._id) : "",
        track: enrollment?.track ?? "core",
      });
    }
  }

  const blindspots = Array.from(blindspotMap.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, 10)
    .map((blindspot) => ({
      ...blindspot,
      percentage: incorrectEventCount === 0 ? 0 : Math.round((blindspot.count / incorrectEventCount) * 100),
    }));

  const isActiveFlaggedSubmission = (submission: (typeof submissions)[number]) =>
    submission.status !== "correct" &&
    !["resolved", "dismissed"].includes(submission.triageStatus ?? "open") &&
    (submission.teacherFlagged || submission.sosTriggered || ["open", "watching"].includes(submission.triageStatus ?? "open"));

  const flaggedSubmissions = submissions.filter(isActiveFlaggedSubmission);
  const sosSubmissions = flaggedSubmissions.filter((submission) => submission.sosTriggered || submission.status === "sos");
  const triageCounts = flaggedSubmissions.reduce(
    (counts, submission) => {
      const triageStatus = submission.triageStatus ?? "open";
      counts[triageStatus as keyof typeof counts] += 1;
      return counts;
    },
    { open: 0, watching: 0, resolved: 0, dismissed: 0 },
  );

  const exerciseMastery = exercises.map((exercise) => {
    const exerciseSubmissions = submissions.filter(
      (submission) => toId(submission.exerciseId) === toId(exercise._id),
    );
    const correctCount = exerciseSubmissions.filter((submission) => submission.status === "correct").length;

    return {
      exerciseId: toId(exercise._id),
      title: exercise.title,
      attempts: exerciseSubmissions.reduce((sum, submission) => sum + submission.attemptCount, 0),
      accuracy: exerciseSubmissions.length === 0 ? 0 : Math.round((correctCount / exerciseSubmissions.length) * 100),
    };
  });

  return {
    classroom: classroomInfo,
    totals: {
      students: enrollments.length,
      exercises: exercises.length,
      submissions: submissions.length,
      flagged: flaggedSubmissions.length,
      sos: sosSubmissions.length,
      triageActive: triageCounts.open,
      triageWatching: triageCounts.watching,
      triageResolved: triageCounts.resolved,
      triageDismissed: triageCounts.dismissed,
    },
    blindspots,
    mastery: exerciseMastery.sort((left, right) => right.attempts - left.attempts),
    flaggedCases: flaggedSubmissions.slice(0, 8).map((submission) => {
      const student = studentMap.get(toId(submission.studentId));
      const exercise = exerciseMap.get(toId(submission.exerciseId));
      const enrollment = enrollmentByStudentId.get(toId(submission.studentId));

      return {
        submissionId: toId(submission._id),
        exerciseId: toId(submission.exerciseId),
        exerciseTitle: exercise?.title ?? "Exercise",
        classroomId: toId(submission.classroomId),
        classroomName: classroom.name,
        studentId: toId(submission.studentId),
        studentName: student?.name ?? "Student",
        studentEmail: student?.email ?? "",
        enrollmentId: enrollment ? toId(enrollment._id) : "",
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
