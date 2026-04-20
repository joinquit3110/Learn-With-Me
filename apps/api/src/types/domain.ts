export const userRoles = ["teacher", "student"] as const;
export type UserRole = (typeof userRoles)[number];

export const learningTracks = ["core", "extended"] as const;
export type LearningTrack = (typeof learningTracks)[number];

export const assignedTracks = ["all", ...learningTracks] as const;
export type AssignedTrack = (typeof assignedTracks)[number];

export const attachmentKinds = ["image", "pdf"] as const;
export type AttachmentKind = (typeof attachmentKinds)[number];

export const submissionStatuses = [
  "correct",
  "incorrect",
  "guardrail",
  "sos",
  "needs_review",
] as const;
export type SubmissionStatus = (typeof submissionStatuses)[number];

export const errorTypes = [
  "formula",
  "reasoning",
  "calculation",
  "notation",
  "off_topic",
  "prompt_injection",
  "unknown",
] as const;
export type ErrorType = (typeof errorTypes)[number];

export interface AiHotspot {
  x: number;
  y: number;
  width: number;
  height: number;
  question: string;
}

export interface MistakeInsight {
  stepTitle: string;
  issue: string;
  fix: string;
}

export interface NotebookDraft {
  summary: string;
  solvedStrategy: string;
  ahaMoment: string;
  timeline: string[];
  mistakes: MistakeInsight[];
}

export interface SubmissionFeedback {
  status: SubmissionStatus;
  shortFeedback: string;
  socraticQuestion: string;
  knowledgeReminder: string;
  encouragingLine: string;
  errorType: ErrorType;
  likelyStepIndex: number;
  validatedStepIndex: number;
  concepts: string[];
  guardrailReason?: string | undefined;
  hotspot?: AiHotspot | null | undefined;
  teacherFlag: boolean;
  notebookDraft?: NotebookDraft | undefined;
}

export interface ExerciseStepDraft {
  title: string;
  explanation: string;
  expectedAnswer: string;
  hintQuestions: string[];
  misconceptionTags: string[];
  reviewSnippet: string;
}

export interface TeacherCopilotDraft {
  title: string;
  summary: string;
  suggestedPrompt: string;
  suggestedTheory: string;
  suggestedFinalAnswer: string;
  rubric: string;
  steps: ExerciseStepDraft[];
}
