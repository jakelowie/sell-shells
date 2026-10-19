import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { getSupabaseCommerceClient } from "../config/supabase";
import { ApiError } from "../errors/api-error";
import { throwDatabaseError } from "../errors/database-error";
import type { Json, ShopOrder } from "../models/database";
import type { CreateOrderInput } from "../validation/shop";
import { capturePayPalOrder, createPayPalOrder, getPayPalOrder, getPayPalSettings, getPublicShopConfig, validatePayPalOrder, verifyPayPalWebhook } from "./paypal.service";

const cartSchema = z.object({
  cart_id: z.string().uuid().nullable(),
  items: z.array(z.object({
    shell_id: z.string().uuid(),
    quantity: z.number().int(),
    shell_name: z.string().nullable(),
    price: z.number().nullable(),
    is_deleted: z.boolean().nullable(),
    available: z.number()
  }))
});
const orderBundleSchema = z.object({
  order: z.object({
    order_id: z.string().uuid(), order_number: z.string(), session_id: z.string().uuid(), cart_id: z.string().uuid(),
    idempotency_key: z.string().uuid(), order_status: z.enum(["pending", "paid", "failed", "cancelled", "refunded"]),
    payment_status: z.enum(["pending", "captured", "failed", "cancelled", "refunded"]),
    customer_name: z.string(), customer_email: z.string(), customer_phone: z.string(), delivery_address: z.unknown(),
    currency: z.string(), subtotal: z.number(), delivery_fee: z.number(), total: z.number(), paypal_order_id: z.string().nullable(),
    paypal_capture_id: z.string().nullable(), capture_request_id: z.string().uuid(), payment_metadata: z.unknown().nullable(),
    expires_at: z.string(), created_at: z.string(), updated_at: z.string()
  }),
  items: z.array(z.object({
    order_item_id: z.string().uuid(), order_id: z.string().uuid(), shell_id: z.string().uuid().nullable(),
    shell_name: z.string(), quantity: z.number().int(), unit_price: z.number(), line_total: z.number(), created_at: z.string()
  }))
});

type OrderBundle = z.infer<typeof orderBundleSchema>;

function parseCart(value: Json | null): z.infer<typeof cartSchema> {
  const result = cartSchema.safeParse(value);
  if (!result.success) throw new ApiError(502, "Cart data is temporarily unavailable.");
  return result.data;
}

function parseOrderBundle(value: Json | null): OrderBundle {
  const result = orderBundleSchema.safeParse(value);
  if (!result.success) throw new ApiError(502, "Order data is temporarily unavailable.");
  return result.data;
}

export async function createGuestSession(): Promise<{ session_id: string; token: string }> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data, error } = await getSupabaseCommerceClient()
    .from("shop_sessions")
    .insert({ token_hash: tokenHash })
    .select("session_id")
    .single();
  throwDatabaseError(error);
  if (!data) throw new ApiError(503, "Could not start a shopping session.");
  return { session_id: data.session_id, token };
}

export function getShopConfig() {
  return getPublicShopConfig();
}

export async function getAvailability(shellIds: string[]): Promise<Record<string, number>> {
  const { data, error } = await getSupabaseCommerceClient().rpc("shop_available_quantities", { p_shell_ids: shellIds });
  throwDatabaseError(error);
  const result = z.record(z.string(), z.number().finite().nonnegative()).safeParse(data);
  if (!result.success) throw new ApiError(502, "Availability data is temporarily unavailable.");
  return Object.fromEntries(shellIds.map(id => [id, result.data[id] ?? 0]));
}

export async function getCart(sessionId: string) {
  const { data, error } = await getSupabaseCommerceClient().rpc("shop_cart_snapshot", { p_session_id: sessionId });
  throwDatabaseError(error);
  return parseCart(data);
}

export async function setCartItem(sessionId: string, shellId: string, quantity: number) {
  const { data, error } = await getSupabaseCommerceClient().rpc("shop_set_cart_item", {
    p_session_id: sessionId, p_shell_id: shellId, p_quantity: quantity
  });
  throwDatabaseError(error);
  return parseCart(data);
}

export async function addCartItem(sessionId: string, shellId: string, quantity: number) {
  const { data, error } = await getSupabaseCommerceClient().rpc("shop_add_cart_item", {
    p_session_id: sessionId, p_shell_id: shellId, p_quantity: quantity
  });
  throwDatabaseError(error);
  return parseCart(data);
}

export async function removeCartItem(sessionId: string, shellId: string) {
  const client = getSupabaseCommerceClient();
  const { data: cart, error: cartError } = await client.from("shop_carts")
    .select("cart_id").eq("session_id", sessionId).eq("status", "active").maybeSingle();
  throwDatabaseError(cartError);
  if (cart) {
    const { error } = await client.from("shop_cart_items").delete().eq("cart_id", cart.cart_id).eq("shell_id", shellId);
    throwDatabaseError(error);
    const { error: updateError } = await client.from("shop_carts").update({ updated_at: new Date().toISOString() }).eq("cart_id", cart.cart_id);
    throwDatabaseError(updateError);
  }
  return getCart(sessionId);
}

async function findOwnedOrder(sessionId: string, orderId: string): Promise<ShopOrder | null> {
  const { data, error } = await getSupabaseCommerceClient().from("shop_orders")
    .select("*").eq("session_id", sessionId).eq("order_id", orderId).maybeSingle();
  throwDatabaseError(error);
  return data;
}

async function getOrderItems(orderId: string) {
  const { data, error } = await getSupabaseCommerceClient().from("shop_order_items")
    .select("*").eq("order_id", orderId).order("created_at", { ascending: true });
  throwDatabaseError(error);
  return data ?? [];
}

export async function createOrder(sessionId: string, input: CreateOrderInput) {
  const settings = getPayPalSettings();
  if (!settings.checkoutEnabled || !settings.currency) throw new ApiError(503, "Checkout is not configured. Set PayPal credentials and PAYPAL_CURRENCY on the server.");

  const { data, error } = await getSupabaseCommerceClient().rpc("shop_create_order", {
    p_session_id: sessionId,
    p_idempotency_key: input.idempotency_key,
    p_customer_name: input.customer.name,
    p_customer_email: input.customer.email,
    p_customer_phone: input.customer.phone,
    p_delivery_address: input.delivery_address as Json,
    p_currency: settings.currency,
    p_delivery_fee: settings.deliveryFee,
    p_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
  });
  throwDatabaseError(error);
  const bundle = parseOrderBundle(data);
  const order = bundle.order as ShopOrder;
  if (order.expires_at <= new Date().toISOString() && order.payment_status === "pending") {
    throw new ApiError(409, "This checkout attempt expired. Add the items to your cart again to restart checkout.");
  }

  if (!order.paypal_order_id) {
    // The idempotency key makes retries of a timed-out PayPal request safe.
    const paypalOrder = await createPayPalOrder({
      orderId: order.order_id,
      orderNumber: order.order_number,
      total: order.total,
      currency: order.currency,
      requestId: order.idempotency_key
    });
    const { data: updated, error: updateError } = await getSupabaseCommerceClient().from("shop_orders")
      .update({ paypal_order_id: paypalOrder.id, payment_metadata: { paypal_order_status: paypalOrder.status } })
      .eq("order_id", order.order_id).eq("session_id", sessionId).select("*").single();
    throwDatabaseError(updateError);
    if (!updated) throw new ApiError(502, "PayPal order was created but could not be linked to the local order. Retry with the same idempotency key.");
    return { ...updated, items: bundle.items };
  }
  return { ...order, items: bundle.items };
}

export async function captureOrder(sessionId: string, orderId: string) {
  const order = await findOwnedOrder(sessionId, orderId);
  if (!order) throw new ApiError(404, "Order not found.");
  if (order.payment_status === "captured") return { ...order, items: await getOrderItems(order.order_id) };
  if (order.payment_status !== "pending" || !order.paypal_order_id) throw new ApiError(409, "This order is not awaiting PayPal payment.");
  if (new Date(order.expires_at).getTime() <= Date.now()) throw new ApiError(409, "This checkout has expired. Start a new order from your cart.");

  const capture = await capturePayPalOrder({
    paypalOrderId: order.paypal_order_id,
    localOrderId: order.order_id,
    requestId: order.capture_request_id,
    expectedAmount: order.total,
    currency: order.currency
  });
  const { data, error } = await getSupabaseCommerceClient().from("shop_orders").update({
    order_status: "paid",
    payment_status: "captured",
    paypal_capture_id: capture.captureId,
    payment_metadata: { capture_amount: capture.amount, capture_currency: capture.currency }
  }).eq("order_id", order.order_id).eq("session_id", sessionId).eq("payment_status", "pending").select("*").maybeSingle();
  throwDatabaseError(error);
  const saved = data ?? await findOwnedOrder(sessionId, orderId);
  if (!saved || saved.payment_status !== "captured") throw new ApiError(409, "PayPal captured the payment, but the order status could not be reconciled. Contact the store with the order number.");
  return { ...saved, items: await getOrderItems(saved.order_id) };
}

export async function getOwnedOrder(sessionId: string, orderId: string) {
  const order = await findOwnedOrder(sessionId, orderId);
  if (!order) throw new ApiError(404, "Order not found.");
  return { ...order, items: await getOrderItems(order.order_id) };
}

export async function listOwnedOrders(sessionId: string, limit = 20, offset = 0) {
  const { data, count, error } = await getSupabaseCommerceClient().from("shop_orders")
    .select("order_id, order_number, order_status, payment_status, currency, subtotal, delivery_fee, total, expires_at, created_at", { count: "exact" })
    .eq("session_id", sessionId).order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  throwDatabaseError(error);
  return { data: data ?? [], pagination: { limit, offset, total: count ?? 0 } };
}

/** Staff-only order listing; the route must enforce an admin or superadmin role. */
export async function listAdminOrders(limit = 50, offset = 0) {
  const { data, count, error } = await getSupabaseCommerceClient().from("shop_orders")
    .select("order_id, order_number, order_status, payment_status, customer_name, customer_email, customer_phone, currency, subtotal, delivery_fee, total, expires_at, created_at", { count: "exact" })
    .order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  throwDatabaseError(error);
  return { data: data ?? [], pagination: { limit, offset, total: count ?? 0 } };
}

/** Staff-only order detail; the route must enforce an admin or superadmin role. */
export async function getAdminOrder(orderId: string) {
  const { data, error } = await getSupabaseCommerceClient().from("shop_orders").select("*").eq("order_id", orderId).maybeSingle();
  throwDatabaseError(error);
  if (!data) throw new ApiError(404, "Order not found.");
  return { ...data, items: await getOrderItems(data.order_id) };
}

export async function processPayPalWebhook(headers: Record<string, string | undefined>, event: unknown): Promise<void> {
  if (!await verifyPayPalWebhook(headers, event)) throw new ApiError(400, "PayPal webhook signature is invalid.");
  const payload = z.object({
    event_type: z.string(),
    resource: z.object({
      id: z.string().optional(),
      status: z.string().optional(),
      amount: z.object({ currency_code: z.string().optional(), value: z.string().optional() }).optional(),
      supplementary_data: z.object({ related_ids: z.object({ order_id: z.string().optional() }).optional() }).optional()
    }).passthrough()
  }).passthrough().safeParse(event);
  if (!payload.success) throw new ApiError(400, "PayPal webhook payload is invalid.");
  const resource = payload.data.resource;
  const paypalOrderId = resource.supplementary_data?.related_ids?.order_id;
  if (!paypalOrderId) return;

  const client = getSupabaseCommerceClient();
  const { data: order, error } = await client.from("shop_orders").select("*").eq("paypal_order_id", paypalOrderId).maybeSingle();
  throwDatabaseError(error);
  if (!order) return;

  if (payload.data.event_type === "PAYMENT.CAPTURE.COMPLETED") {
    if (order.payment_status === "captured") return;
    if (order.payment_status !== "pending") return;
    const paypalOrder = await getPayPalOrder(paypalOrderId);
    const verified = validatePayPalOrder(paypalOrder, {
      paypalOrderId,
      localOrderId: order.order_id,
      expectedAmount: order.total,
      currency: order.currency,
      requireCompleted: true
    });
    const { error: updateError } = await client.from("shop_orders").update({
      order_status: "paid", payment_status: "captured", paypal_capture_id: verified.captureId,
      payment_metadata: { source: "verified_paypal_webhook", capture_amount: verified.amount, capture_currency: verified.currency }
    }).eq("order_id", order.order_id).eq("payment_status", "pending");
    throwDatabaseError(updateError);
  } else if (payload.data.event_type === "PAYMENT.CAPTURE.DENIED" && order.payment_status === "pending") {
    const { error: updateError } = await client.from("shop_orders").update({ order_status: "failed", payment_status: "failed" })
      .eq("order_id", order.order_id).eq("payment_status", "pending");
    throwDatabaseError(updateError);
  } else if (payload.data.event_type === "PAYMENT.CAPTURE.REFUNDED" &&
    order.payment_status === "captured" && resource.id === order.paypal_capture_id) {
    const { error: updateError } = await client.from("shop_orders").update({
      order_status: "refunded", payment_status: "refunded", payment_metadata: { source: "verified_paypal_webhook" }
    }).eq("order_id", order.order_id).eq("payment_status", "captured");
    throwDatabaseError(updateError);
  }
}
