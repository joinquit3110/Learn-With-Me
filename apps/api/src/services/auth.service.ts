import bcrypt from "bcryptjs";

import { AppError } from "../lib/app-error.js";
import { signAuthToken } from "../lib/jwt.js";
import { UserModel } from "../models/User.js";
import type { UserRole } from "../types/domain.js";

interface AuthInput {
  name?: string;
  email: string;
  password: string;
  role?: UserRole;
}

function createAvatarSeed(name: string, email: string) {
  return `${name.trim().toLowerCase().replace(/\s+/g, "-")}-${email.trim().toLowerCase()}`;
}

export function serializeUser(user: {
  _id: unknown;
  name: string;
  email: string;
  role: UserRole;
  avatarSeed: string;
  stats?: {
    xp?: number;
    level?: number;
    streak?: number;
    badges?: string[];
    lastActiveDate?: string | null;
  };
}) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    avatarSeed: user.avatarSeed,
    stats: {
      xp: user.stats?.xp ?? 0,
      level: user.stats?.level ?? 1,
      streak: user.stats?.streak ?? 0,
      badges: user.stats?.badges ?? [],
      lastActiveDate: user.stats?.lastActiveDate ?? null,
    },
  };
}

export async function registerUser(input: Required<Pick<AuthInput, "name" | "email" | "password" | "role">>) {
  const existingUser = await UserModel.findOne({ email: input.email.toLowerCase() });

  if (existingUser) {
    throw new AppError("An account with this email already exists.", 409);
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await UserModel.create({
    name: input.name.trim(),
    email: input.email.toLowerCase().trim(),
    role: input.role,
    passwordHash,
    avatarSeed: createAvatarSeed(input.name, input.email),
  });

  const publicUser = serializeUser(user);
  const token = signAuthToken({
    sub: publicUser.id,
    email: publicUser.email,
    role: publicUser.role,
    name: publicUser.name,
  });

  return {
    token,
    user: publicUser,
  };
}

export async function loginUser(input: Required<Pick<AuthInput, "email" | "password">>) {
  const user = await UserModel.findOne({ email: input.email.toLowerCase().trim() });

  if (!user) {
    throw new AppError("Invalid email or password.", 401);
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);

  if (!passwordMatches) {
    throw new AppError("Invalid email or password.", 401);
  }

  const publicUser = serializeUser(user);

  return {
    token: signAuthToken({
      sub: publicUser.id,
      email: publicUser.email,
      role: publicUser.role,
      name: publicUser.name,
    }),
    user: publicUser,
  };
}

export async function getCurrentUser(userId: string) {
  const user = await UserModel.findById(userId);

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  return serializeUser(user);
}
