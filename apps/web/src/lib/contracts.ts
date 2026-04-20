export type Role = "teacher" | "student";
export type Track = "core" | "extended";
export type AssignedTrack = "all" | Track;
export type SubmissionStatus =
  | "correct"
  | "incorrect"
  | "guardrail"
  | "sos"
  | "needs_review"
  | "not_started";

export interface UserStats {
  xp: number;
  level: number;
  streak: number;
  badges: string[];
  lastActiveDate: string | null;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarSeed: string;
  stats: UserStats;
}

export interface ClassroomSummary {
  id: string;
  teacherId: string;
  name: string;
  description: string;
  subject: string;
  gradeBand: string;
  joinCode: string;
  defaultTrack: Track;
  createdAt: string | null;
  updatedAt: string | null;
  track?: Track;
  studentCount?: number;
  exerciseCount?: number;
  solvedCount?: number;
}

export interface ExerciseStep {
  title: string;
  explanation: string;
  expectedAnswer: string;
  hintQuestions: string[];
  misconceptionTags: string[];
  reviewSnippet: string;
}

export interface AttachmentRecord {
  id: string;
  kind: "image" | "pdf";
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  extractedText: string;
  dataUrl: string | null;
}

export interface TeacherExercise {
  id: string;
  classroomId: string;
  teacherId: string;
  sourceAttachmentIds?: string[];
  sourceAttachments?: AttachmentRecord[];
  sourceAttachmentId?: string | null;
  sourceAttachment?: AttachmentRecord | null;
  title: string;
  prompt: string;
  theory: string;
  rubric: string;
  finalAnswer: string;
  difficulty: Track;
  assignedTrack: AssignedTrack;
  status: "draft" | "published";
  dueAt: string | null;
  solutionSteps: ExerciseStep[];
  createdAt: string | null;
  updatedAt: string | null;
  classroomName?: string;
}

export interface StudentExercise {
  id: string;
  classroomId: string;
  teacherId: string;
  title: string;
  prompt: string;
  theory: string;
  difficulty: Track;
  assignedTrack: AssignedTrack;
  status: "draft" | "published";
  dueAt: string | null;
  stepCount: number;
  createdAt: string | null;
  updatedAt: string | null;
  classroomName?: string;
  studentTrack?: Track | null;
  submissionStatus?: SubmissionStatus;
  attemptCount?: number;
  lastStatus?: SubmissionStatus;
}

export type ExerciseRecord = TeacherExercise | StudentExercise;

export interface FeedbackHotspot {
  x: number;
  y: number;
  width: number;
  height: number;
  question: string;
}

export interface SubmissionFeedback {
  status: Exclude<SubmissionStatus, "not_started">;
  shortFeedback: string;
  socraticQuestion: string;
  knowledgeReminder: string;
  encouragingLine: string;
  errorType: string;
  likelyStepIndex: number;
  validatedStepIndex: number;
  concepts: string[];
  guardrailReason?: string | null;
  teacherFlag: boolean;
  hotspot?: FeedbackHotspot | null;
}

export interface SubmissionAttempt {
  answerText: string;
  extractedText: string;
  createdAt: string;
  attachment?: AttachmentRecord | null;
  feedback: SubmissionFeedback;
}

export interface SubmissionRecord {
  id: string;
  exerciseId: string;
  classroomId: string;
  studentId: string;
  latestAnswerText: string;
  latestAttachment: AttachmentRecord | null;
  latestImageDataUrl: string | null;
  extractedText: string;
  status: Exclude<SubmissionStatus, "not_started">;
  attemptCount: number;
  wrongAttemptCount: number;
  bestValidatedStepIndex: number;
  teacherFlagged: boolean;
  sosTriggered: boolean;
  notebookEntryId: string | null;
  solvedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  lastFeedback: SubmissionFeedback | null;
  history: SubmissionAttempt[];
}

export interface RewardSummary {
  awardedXp: number;
  badgeAwarded: string | null;
  streak: number;
  level: number;
  xp: number;
  bestValidatedStepIndex: number;
}

export interface NotebookEntry {
  id: string;
  exerciseId: string;
  classroomId: string;
  summary: string;
  solvedStrategy: string;
  ahaMoment: string;
  timeline: string[];
  mistakes: Array<{
    stepTitle: string;
    issue: string;
    fix: string;
  }>;
  awardedBadge: string | null;
  createdAt: string;
}

export interface ClassroomBlindspot {
  concept: string;
  stepTitle: string;
  count: number;
  percentage: number;
}

export interface ClassroomAnalytics {
  classroom: {
    id: string;
    name: string;
    joinCode: string;
  };
  totals: {
    students: number;
    exercises: number;
    submissions: number;
    flagged: number;
    sos: number;
  };
  blindspots: ClassroomBlindspot[];
  mastery: Array<{
    exerciseId: string;
    title: string;
    attempts: number;
    accuracy: number;
  }>;
  flaggedCases: Array<{
    submissionId: string;
    exerciseTitle: string;
    studentName: string;
    status: string;
    wrongAttemptCount: number;
    updatedAt: string;
  }>;
}

export interface StudentDashboard {
  profile: PublicUser;
  classes: ClassroomSummary[];
  pendingExercises: StudentExercise[];
  notebook: NotebookEntry[];
}

export interface TeacherDashboard {
  profile: PublicUser;
  classes: ClassroomSummary[];
  recentExercises: TeacherExercise[];
  analytics: ClassroomAnalytics[];
  flaggedSubmissions: Array<{
    id: string;
    exerciseId: string;
    classroomId: string;
    studentId: string;
    status: string;
    wrongAttemptCount: number;
    updatedAt: string;
  }>;
}

export interface TeacherClassroomDetail {
  classroom: ClassroomSummary;
  exercises: TeacherExercise[];
  roster: Array<{
    enrollmentId: string;
    track: Track;
    student: PublicUser | null;
    solvedCount: number;
    flaggedCount: number;
  }>;
  analytics: ClassroomAnalytics | null;
}

export interface StudentClassroomDetail {
  classroom: ClassroomSummary;
  track: Track;
  exercises: StudentExercise[];
}
