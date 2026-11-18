import { z } from "zod";
import { pageQuerySchema } from "./common";

const shippingFeeFields = {
  shipping_name: z.string().nullable().optional(),
  shipping_fee: z.number().finite().nullable().optional(),
  is_active: z.boolean().nullable().optional(),
};

export const createShippingFeeSchema = z.object(shippingFeeFields).strict();
export const updateShippingFeeSchema = createShippingFeeSchema.refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required.",
);

export const listShippingFeesSchema = pageQuerySchema
  .extend({
    sort_by: z
      .enum(["created_at", "shipping_name", "shipping_fee", "is_active"])
      .default("created_at"),
    shipping_name: z.string().optional(),
    is_active: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  })
  .strict();

export type ShippingFee = {
  id: string;
  created_at: string;
  shipping_name: string | null;
  shipping_fee: number | null;
  is_active: boolean | null;
};
export type ShippingFeeInsert = z.infer<typeof createShippingFeeSchema>;
export type ShippingFeeUpdate = z.infer<typeof updateShippingFeeSchema>;
export type ShippingFeeListQuery = z.infer<typeof listShippingFeesSchema>;
