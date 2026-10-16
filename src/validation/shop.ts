import { z } from "zod";
import { uuidSchema } from "./common";

const cleanText = (min: number, max: number) => z.string().trim().min(min).max(max);

export const shopTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, "Shop session token is invalid.");
export const cartItemSchema = z.object({
  shell_id: uuidSchema,
  quantity: z.number().int().min(1).max(100)
}).strict();
export const orderIdSchema = uuidSchema;
export const availabilityQuerySchema = z.object({
  ids: z.string().min(1).max(3700).transform(value => value.split(",")).pipe(z.array(uuidSchema).min(1).max(100))
}).strict();

export const deliveryAddressSchema = z.object({
  street_address: cleanText(3, 200),
  city: cleanText(2, 100),
  province: cleanText(2, 100),
  postal_code: cleanText(2, 20),
  country: cleanText(2, 100),
  address_details: z.string().trim().max(500).optional().default("")
}).strict();

export const createOrderSchema = z.object({
  idempotency_key: uuidSchema,
  customer: z.object({
    name: cleanText(2, 120),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().min(7).max(30).regex(/^\+?[0-9().\-\s]+$/, "Enter a valid contact number.")
      .refine(value => value.replace(/\D/g, "").length >= 7, "Enter at least 7 digits for the contact number.")
  }).strict(),
  delivery_address: deliveryAddressSchema
}).strict();

export type DeliveryAddress = z.infer<typeof deliveryAddressSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
