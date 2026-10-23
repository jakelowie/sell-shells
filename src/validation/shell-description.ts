import { z } from "zod";
import { pageQuerySchema, timestampSchema, uuidSchema } from "./common";

export const shellDescriptionColumns = {
  shell_id: uuidSchema.optional(),
  created_at: timestampSchema.optional(),
  shell_name: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  deepness: z.string().nullable().optional(),
  from: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  is_deleted: z.boolean().nullable().optional(),
  shell_stock_type_id: uuidSchema.nullable().optional(),
  shell_type_id: uuidSchema.nullable().optional(),
  price: z.number().finite().nullable().optional(),
  locality_id: uuidSchema.nullable().optional(),
  shell_weight: z.string().max(80).nullable().optional(),
  shell_size: z.string().max(120).nullable().optional()
};

export const createShellDescriptionSchema = z.object(shellDescriptionColumns).strict();
export const updateShellDescriptionSchema = createShellDescriptionSchema.refine((value) => Object.keys(value).length > 0, "At least one field is required.");
export const listShellDescriptionsSchema = pageQuerySchema.extend({
  sort_by: z.enum(["created_at", "shell_name", "author", "deepness", "price", "locality_id", "shell_weight", "shell_size"]).default("created_at"),
  shell_name: z.string().optional(),
  author: z.string().optional(),
  locality_id: uuidSchema.optional(),
  price: z.coerce.number().finite().optional(),
  shell_weight: z.string().optional(),
  shell_stock_type_id: uuidSchema.optional(),
  shell_type_id: uuidSchema.optional(),
  include_deleted: z.enum(["true", "false"]).default("false").transform((value) => value === "true")
}).strict();

export type ShellDescription = Required<z.infer<typeof createShellDescriptionSchema>>;
export type ShellDescriptionInsert = z.infer<typeof createShellDescriptionSchema>;
export type ShellDescriptionUpdate = z.infer<typeof updateShellDescriptionSchema>;
export type ShellDescriptionListQuery = z.infer<typeof listShellDescriptionsSchema>;
