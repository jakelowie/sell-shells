import { request } from "./client";
import { mutate } from "./client";
import type { ShopOrder } from "./types";

export type AdminOrderSummary = Pick<
  ShopOrder,
  | "order_id"
  | "order_number"
  | "order_status"
  | "payment_status"
  | "customer_name"
  | "customer_email"
  | "customer_phone"
  | "currency"
  | "subtotal"
  | "delivery_fee"
  | "total"
  | "expires_at"
  | "created_at"
  | "fulfillment_status"
  | "tracking_number"
  | "estimated_delivery_at"
>;

export function listAdminOrders(limit = 50, offset = 0) {
  return request<{
    data: AdminOrderSummary[];
    pagination: { limit: number; offset: number; total: number };
  }>(`/api/admin/orders?limit=${limit}&offset=${offset}`);
}

export function getAdminOrder(orderId: string) {
  return request<{ data: ShopOrder }>(`/api/admin/orders/${encodeURIComponent(orderId)}`);
}
export function updateAdminFulfillment(
  orderId: string,
  input: {
    status: string;
    remarks?: string;
    courier_id?: string;
    tracking_number?: string;
    estimated_delivery_at?: string;
  },
) {
  return mutate<any>(
    `/api/admin/commerce/orders/${encodeURIComponent(orderId)}/status`,
    "PATCH",
    input,
  );
}
export function getAdminOrderHistory(orderId: string) {
  return request<{ data: any[] }>(
    `/api/admin/commerce/orders/${encodeURIComponent(orderId)}/history`,
  );
}
