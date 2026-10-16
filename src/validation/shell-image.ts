import { z } from "zod";
import { pageQuerySchema, timestampSchema, uuidSchema } from "./common";

const nullableBoolean = z.preprocess((value: unknown) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean().nullable().optional());

export const shellImageColumns = {
  image_id: uuidSchema.optional(),
  created_at: timestampSchema.optional(),
  file_name: z.string().nullable().optional(),
  storage_path: z.string().nullable().optional(),
  is_main_image: nullableBoolean,
  shell_id: uuidSchema.nullable().optional()
};

export const createShellImageSchema = z.object(shellImageColumns).strict();
export const uploadShellImageSchema = z.object({
  shell_id: uuidSchema.nullable().optional(),
  is_main_image: nullableBoolean
}).strict();
export const updateShellImageSchema = z.object({
  file_name: z.string().nullable().optional(),
  is_main_image: nullableBoolean,
  shell_id: uuidSchema.nullable().optional()
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required.");
export const listShellImagesSchema = pageQuerySchema.extend({
  sort_by: z.enum(["created_at", "file_name", "is_main_image"]).default("created_at"),
  file_name: z.string().optional(),
  shell_id: uuidSchema.optional(),
  shell_ids: z.string().max(3700).transform(value => value.split(",")).pipe(z.array(uuidSchema).min(1).max(100)).optional(),
  is_main_image: z.enum(["true", "false"]).optional().transform((value) => value === undefined ? undefined : value === "true")
}).strict().refine(value => !(value.shell_id && value.shell_ids), "Use shell_id or shell_ids, not both.");

export type ShellImage = Required<z.infer<typeof createShellImageSchema>>;
export type ShellImageInsert = z.infer<typeof createShellImageSchema>;
export type ShellImageUpdate = z.infer<typeof updateShellImageSchema>;
export type ShellImageListQuery = z.infer<typeof listShellImagesSchema>;
export type ShellImageWithUrl = ShellImage & { image_url: string | null; image_url_expires_at: string | null };
