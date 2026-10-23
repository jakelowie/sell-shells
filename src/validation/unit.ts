import { z } from "zod";
import { pageQuerySchema, uuidSchema } from "./common";

const unitName = z.string().trim().min(1).max(40).regex(/^[\p{L}\p{N} .-]+$/u, "Use letters, numbers, spaces, periods, or hyphens.");
export const unitSchema = z.object({
  id: uuidSchema.optional(),
  unit_name: unitName,
  measurement_for: z.enum(["size", "weight"])
}).strict();
export const unitUpdateSchema = z.object({
  unit_name: unitName.optional(),
  measurement_for: z.enum(["size", "weight"]).optional()
}).strict().refine(value => Object.keys(value).length > 0, "At least one field is required.");
export const unitListQuerySchema = pageQuerySchema.extend({
  sort_by: z.enum(["created_at", "unit_name", "measurement_for"]).default("created_at"),
  measurement_for: z.enum(["size", "weight"]).optional(),
  unit_name: z.string().trim().max(40).optional()
}).strict();
export type Unit = { id: string; created_at: string; unit_name: string | null; measurement_for: string | null };
export type UnitListQuery = z.infer<typeof unitListQuerySchema>;
