import { z } from "zod";
import { pageQuerySchema, timestampSchema, uuidSchema } from "./common";

const numericSchema = z.number().finite().nullable().optional();

export const stockInfoColumns = {
  stock_info_id: z.number().int().safe().optional(),
  created_at: timestampSchema.optional(),
  shell_id: uuidSchema.nullable().optional(),
  shell_stock_id: uuidSchema.nullable().optional(),
  shell_stock: numericSchema,
  shell_pcs_per_stock: numericSchema,
  shell_total_available: numericSchema
};

export const createStockInfoSchema = z.object(stockInfoColumns).strict();
export const updateStockInfoSchema = createStockInfoSchema.refine((value) => Object.keys(value).length > 0, "At least one field is required.");
export const listStockInfoSchema = pageQuerySchema.extend({
  sort_by: z.enum(["stock_info_id", "created_at", "shell_stock", "shell_pcs_per_stock", "shell_total_available"]).default("created_at"),
  shell_id: uuidSchema.optional(),
  shell_stock_id: uuidSchema.optional()
}).strict();

export type StockInfo = Required<z.infer<typeof createStockInfoSchema>>;
export type StockInfoInsert = z.infer<typeof createStockInfoSchema>;
export type StockInfoUpdate = z.infer<typeof updateStockInfoSchema>;
export type StockInfoListQuery = z.infer<typeof listStockInfoSchema>;
