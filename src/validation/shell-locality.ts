import { z } from "zod";
import { pageQuerySchema, timestampSchema, uuidSchema } from "./common";

export const shellLocalityColumns = {
  locality_id: uuidSchema.optional(),
  created_at: timestampSchema.optional(),
  locality: z.string().nullable().optional()
};

export const createShellLocalitySchema = z.object(shellLocalityColumns).strict();
export const updateShellLocalitySchema = createShellLocalitySchema.refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required."
);
export const listShellLocalitiesSchema = pageQuerySchema.extend({
  sort_by: z.enum(["created_at", "locality"]).default("locality"),
  locality: z.string().optional()
}).strict();

export type ShellLocality = Required<z.infer<typeof createShellLocalitySchema>>;
export type ShellLocalityInsert = z.infer<typeof createShellLocalitySchema>;
export type ShellLocalityUpdate = z.infer<typeof updateShellLocalitySchema>;
export type ShellLocalityListQuery = z.infer<typeof listShellLocalitiesSchema>;
