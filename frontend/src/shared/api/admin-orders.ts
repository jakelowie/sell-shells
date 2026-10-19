import { request } from './client';
import type { ShopOrder } from './types';

export type AdminOrderSummary = Pick<ShopOrder,
  'order_id' | 'order_number' | 'order_status' | 'payment_status' | 'customer_name' | 'customer_email' | 'customer_phone' |
  'currency' | 'subtotal' | 'delivery_fee' | 'total' | 'expires_at' | 'created_at'>;

export function listAdminOrders(limit = 50, offset = 0) {
  return request<{ data: AdminOrderSummary[]; pagination: { limit: number; offset: number; total: number } }>(`/api/admin/orders?limit=${limit}&offset=${offset}`);
}

export function getAdminOrder(orderId: string) {
  return request<{ data: ShopOrder }>(`/api/admin/orders/${encodeURIComponent(orderId)}`);
}
