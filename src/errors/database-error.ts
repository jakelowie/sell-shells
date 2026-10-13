import type { PostgrestError } from "@supabase/supabase-js";

export class DatabaseOperationError extends Error {
  constructor(
    readonly code: string,
    readonly databaseMessage = "Database returned no record.",
    readonly details: string | null = null,
    readonly hint: string | null = null
  ) {
    super("Database operation failed");
    this.name = "DatabaseOperationError";
  }
}

export function throwDatabaseError(error: PostgrestError | null): void {
  if (error) {
    throw new DatabaseOperationError(error.code, error.message, error.details, error.hint);
  }
}

export type PageResult<T> = {
  data: T[];
  total: number;
};
