import { ClassroomModel } from "../models/Classroom.js";
import { EnrollmentModel } from "../models/Enrollment.js";
import { ExerciseModel } from "../models/Exercise.js";
import { SubmissionModel } from "../models/Submission.js";
import { UserModel } from "../models/User.js";

export async function getClassroomAnalytics(classroomId: string) {
  const [classroom, enrollments, exercises, submissions] = await Promise.all([
    ClassroomModel.findById(classroomId).lean(),
    EnrollmentModel.find({ classroomId }).lean(),
    ExerciseModel.find({ classroomId }).lean(),
    SubmissionModel.find({ classroomId }).lean(),
  ]);

  if (!classroom) {
    return null;
  }

  const exerciseMap = new Map(exercises.map((exercise) => [String(exercise._id), exercise]));
  const incorrectEvents: Array<{ label: string; concept: string }> = [];
  const flaggedSubmissions = submissions.filter((submission) => submission.teacherFlagged);
  const sosSubmissions = submissions.filter((submission) => submission.sosTriggered);

  for (const submission of submissions) {
    for (const attempt of submission.history) {
      if (attempt.feedback.status === "correct") {
        continue;
      }

      const exercise = exerciseMap.get(String(submission.exerciseId));
      const stepTitle =
        exercise?.solutionSteps?.[Math.max(0, attempt.feedback.likelyStepIndex - 1)]?.title ??
        "Problem setup";

      if (attempt.feedback.concepts.length === 0) {
        incorrectEvents.push({
          label: stepTitle,
          concept: "General reasoning",
        });
        continue;
      }

      for (const concept of attempt.feedback.concepts) {
        incorrectEvents.push({
          label: stepTitle,
          concept,
        });
      }
    }
  }

  const blindspotMap = new Map<
    string,
    {
      concept: string;
      stepTitle: string;
      count: number;
    }
  >();

  for (const event of incorrectEvents) {
    const key = `${event.label}::${event.concept}`;
    const existing = blindspotMap.get(key);

    if (existing) {
      existing.count += 1;
      continue;
    }

    blindspotMap.set(key, {
      concept: event.concept,
      stepTitle: event.label,
      count: 1,
    });
  }

  const blindspots = Array.from(blindspotMap.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, 10)
    .map((blindspot) => ({
      ...blindspot,
      percentage:
        incorrectEvents.length === 0 ? 0 : Math.round((blindspot.count / incorrectEvents.length) * 100),
    }));

  const flaggedStudentIds = Array.from(
    new Set(flaggedSubmissions.map((submission) => String(submission.studentId))),
  );
  const flaggedStudents = await UserModel.find({ _id: { $in: flaggedStudentIds } }).lean();
  const flaggedStudentMap = new Map(flaggedStudents.map((student) => [String(student._id), student]));

  const exercisesById = new Map(exercises.map((exercise) => [String(exercise._id), exercise]));
  const exerciseMastery = exercises.map((exercise) => {
    const exerciseSubmissions = submissions.filter(
      (submission) => String(submission.exerciseId) === String(exercise._id),
    );
    const correctCount = exerciseSubmissions.filter((submission) => submission.status === "correct").length;

    return {
      exerciseId: String(exercise._id),
      title: exercise.title,
      attempts: exerciseSubmissions.reduce((sum, submission) => sum + submission.attemptCount, 0),
      accuracy:
        exerciseSubmissions.length === 0 ? 0 : Math.round((correctCount / exerciseSubmissions.length) * 100),
    };
  });

  return {
    classroom: {
      id: String(classroom._id),
      name: classroom.name,
      joinCode: classroom.joinCode,
    },
    totals: {
      students: enrollments.length,
      exercises: exercises.length,
      submissions: submissions.length,
      flagged: flaggedSubmissions.length,
      sos: sosSubmissions.length,
    },
    blindspots,
    mastery: exerciseMastery.sort((left, right) => right.attempts - left.attempts),
    flaggedCases: flaggedSubmissions.slice(0, 8).map((submission) => ({
      submissionId: String(submission._id),
      exerciseTitle: exercisesById.get(String(submission.exerciseId))?.title ?? "Exercise",
      studentName: flaggedStudentMap.get(String(submission.studentId))?.name ?? "Student",
      status: submission.status,
      wrongAttemptCount: submission.wrongAttemptCount,
      updatedAt: submission.updatedAt.toISOString(),
    })),
  };
}
