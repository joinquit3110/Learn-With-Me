import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { ZodError } from "zod";

import { AppError } from "../lib/app-error.js";

const { MongoError } = mongoose.mongo;

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof ZodError) {
    res.status(400).json({
      message: "Validation failed.",
      issues: error.issues,
    });
    return;
  }

  if (error instanceof mongoose.Error.ValidationError) {
    res.status(400).json({
      message: "Database validation failed.",
      issues: Object.values(error.errors).map((issue) => issue.message),
    });
    return;
  }

  if (error instanceof MongoError && error.code === 11000) {
    res.status(409).json({
      message: "A record with the same unique value already exists.",
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      message: error.message,
      details: error.details ?? null,
    });
    return;
  }

  console.error(error);
  res.status(500).json({
    message: "Unexpected server error.",
  });
}
