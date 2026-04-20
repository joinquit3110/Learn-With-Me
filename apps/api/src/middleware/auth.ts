import type { NextFunction, Request, Response } from "express";

import { AppError } from "../lib/app-error.js";
import { verifyAuthToken } from "../lib/jwt.js";
import type { UserRole } from "../types/domain.js";

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const authorizationHeader = req.header("authorization");

  if (!authorizationHeader?.startsWith("Bearer ")) {
    next(new AppError("Authentication required.", 401));
    return;
  }

  const token = authorizationHeader.replace("Bearer ", "").trim();

  try {
    req.auth = verifyAuthToken(token);
    next();
  } catch {
    next(new AppError("Invalid or expired token.", 401));
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      next(new AppError("Authentication required.", 401));
      return;
    }

    if (!roles.includes(req.auth.role)) {
      next(new AppError("You do not have permission to access this resource.", 403));
      return;
    }

    next();
  };
}
