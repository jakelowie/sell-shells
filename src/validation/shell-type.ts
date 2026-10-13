import { z } from "zod";
import { pageQuerySchema, timestampSchema, uuidSchema } from "./common";

export const shellTypeColumns = {
  type_id: uuidSchema.optional(),
  created_at: timestampSchema.optional(),
  shell_type_name: z.string().nullable().optional()
};

export const createShellTypeSchema = z.object(shellTypeColumns).strict();
export const updateShellTypeSchema = createShellTypeSchema.refine((value) => Object.keys(value).length > 0, "At least one field is required.");
export const listShellTypesSchema = pageQuerySchema.extend({
  sort_by: z.enum(["created_at", "shell_type_name"]).default("created_at"),
  shell_type_name: z.string().optional()
}).strict();

export type ShellType = Required<z.infer<typeof createShellTypeSchema>>;
export type ShellTypeInsert = z.infer<typeof createShellTypeSchema>;
export type ShellTypeUpdate = z.infer<typeof updateShellTypeSchema>;
export type ShellTypeListQuery = z.infer<typeof listShellTypesSchema>;
