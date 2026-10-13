import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const timestampSchema = z.string().datetime({ offset: true });

export const pageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sort_order: z.enum(["asc", "desc"]).default("desc")
}).strict();

export type PageQuery = z.infer<typeof pageQuerySchema>;
