import { AppError } from "../lib/app-error.js";
import { getBangkokDateStamp } from "../lib/date.js";
import { UserModel } from "../models/User.js";
import type { SubmissionFeedback } from "../types/domain.js";

interface RewardInput {
  userId: string;
  currentBestValidatedStepIndex: number;
  wrongAttemptCount: number;
  totalSteps: number;
  wasSolvedBefore: boolean;
  feedback: SubmissionFeedback;
}

function calculateLevel(xp: number) {
  return Math.max(1, Math.floor(xp / 120) + 1);
}

function getYesterdayStamp(dateStamp: string) {
  const date = new Date(`${dateStamp}T00:00:00+07:00`);
  date.setUTCDate(date.getUTCDate() - 1);
  return getBangkokDateStamp(date);
}

export async function applyRewards(input: RewardInput) {
  const user = await UserModel.findById(input.userId);

  if (!user) {
    throw new AppError("Student account not found.", 404);
  }

  const targetValidatedStepIndex =
    input.feedback.status === "correct"
      ? input.totalSteps
      : Math.min(input.totalSteps, Math.max(0, input.feedback.validatedStepIndex));

  const gainedSteps = Math.max(0, targetValidatedStepIndex - input.currentBestValidatedStepIndex);
  let awardedXp = gainedSteps * 15;

  if (input.feedback.status === "correct" && !input.wasSolvedBefore) {
    awardedXp += 30;
  }

  const todayStamp = getBangkokDateStamp();
  const yesterdayStamp = getYesterdayStamp(todayStamp);
  const lastActiveDate = user.stats.lastActiveDate;

  if (lastActiveDate !== todayStamp) {
    user.stats.streak = lastActiveDate === yesterdayStamp ? user.stats.streak + 1 : 1;
    user.stats.lastActiveDate = todayStamp;
  }

  if (awardedXp > 0) {
    user.stats.xp += awardedXp;
    user.stats.level = calculateLevel(user.stats.xp);
  }

  let badgeAwarded: string | null = null;
  const deservesPerseverance =
    input.feedback.status === "correct" &&
    input.wrongAttemptCount >= 3 &&
    !user.stats.badges.includes("Perseverance");

  if (deservesPerseverance) {
    user.stats.badges.push("Perseverance");
    badgeAwarded = "Perseverance";
  }

  await user.save();

  return {
    awardedXp,
    badgeAwarded,
    streak: user.stats.streak,
    level: user.stats.level,
    xp: user.stats.xp,
    bestValidatedStepIndex: Math.max(
      input.currentBestValidatedStepIndex,
      targetValidatedStepIndex,
    ),
  };
}
