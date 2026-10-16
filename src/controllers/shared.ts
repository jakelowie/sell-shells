import type { Response } from "express";
import type { z } from "zod";
import { ApiError } from "../errors/api-error";
import { DatabaseOperationError } from "../errors/database-error";
import { StorageOperationError } from "../errors/storage-error";

export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const details = result.error.issues.map((issue) => {
      const path = issue.path.map(String).join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    });
    throw new ApiError(400, `Invalid ${label}.`, details);
  }
  return result.data;
}

export function sendError(response: Response, error: unknown): void {
  if (error instanceof ApiError) {
    response.status(error.status).json({ error: error.message, ...(error.details ? { details: error.details } : {}) });
    return;
  }
  if (error instanceof DatabaseOperationError) {
    let status = 500;
    let message = "The database could not complete the request.";
    if (error.code === "P0002") {
      status = 404;
      message = "The requested account role was not found.";
    } else if (error.code === "23505") {
      status = 409;
      message = "A record with a conflicting unique value already exists.";
    } else if (error.code === "23503") {
      status = 409;
      message = "The record references a missing row or is still referenced by another row.";
    } else if (["23502", "23514", "22P02", "22003", "22007"].includes(error.code)) {
      status = 400;
      message = "The record violates a database constraint or contains an invalid value.";
    } else if (error.code === "42501") {
      status = 403;
      message = "The database role is not permitted to perform this operation. Check the Supabase grants and row-level security policies.";
    } else if (error.code === "42P01" || error.code === "PGRST205") {
      status = 500;
      message = "The requested database table is unavailable. Check the table name and Supabase API schema configuration.";
    } else if (error.code === "PGRST204") {
      status = 400;
      message = "The request contains a column that is not available in the database schema.";
    } else if (error.code.startsWith("PGRST")) {
      status = 400;
      message = "Supabase could not process the database request.";
    }
    response.status(status).json({
      error: message,
      database: {
        code: error.code,
        message: error.databaseMessage,
        ...(error.details ? { details: error.details } : {}),
        ...(error.hint ? { hint: error.hint } : {})
      }
    });
    return;
  }
  if (error instanceof StorageOperationError) {
    response.status(502).json({
      error: `Could not ${error.operation} the image in Supabase Storage.`,
      storage: { message: error.storageMessage }
    });
    return;
  }
  if (error instanceof Error && error.message.includes("Supabase is not configured")) {
    response.status(503).json({ error: "Database is unavailable. Configure Supabase in .env." });
    return;
  }
  response.status(500).json({ error: "An unexpected database error occurred." });
}

export function throwNotFound(entity: string): never {
  throw new ApiError(404, `${entity} not found.`);
}
