import { z } from "zod";
import { pageQuerySchema, timestampSchema, uuidSchema } from "./common";

export const shellStockTypeColumns = {
  stock_id: uuidSchema.optional(),
  created_at: timestampSchema.optional(),
  stock_name: z.string().nullable().optional()
};

export const createShellStockTypeSchema = z.object(shellStockTypeColumns).strict();
export const updateShellStockTypeSchema = createShellStockTypeSchema.refine((value) => Object.keys(value).length > 0, "At least one field is required.");
export const listShellStockTypesSchema = pageQuerySchema.extend({
  sort_by: z.enum(["created_at", "stock_name"]).default("created_at"),
  stock_name: z.string().optional()
}).strict();

export type ShellStockType = Required<z.infer<typeof createShellStockTypeSchema>>;
export type ShellStockTypeInsert = z.infer<typeof createShellStockTypeSchema>;
export type ShellStockTypeUpdate = z.infer<typeof updateShellStockTypeSchema>;
export type ShellStockTypeListQuery = z.infer<typeof listShellStockTypesSchema>;
