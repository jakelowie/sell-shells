import { mutate, request, record } from "./client";
import type { DeliveryAddress, ShopCart, ShopConfig, ShopOrder, ShopOrderSummary } from "./types";

const TOKEN_KEY = "sell-shells.shop-session.v1";
let sessionRequest: Promise<string> | undefined;

function readToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function saveToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* The in-memory session continues to work for this page view. */
  }
  volatileToken = token;
}

let volatileToken: string | null = null;

function forgetToken(token: string): void {
  if (volatileToken === token) volatileToken = null;
  try {
    if (window.localStorage.getItem(TOKEN_KEY) === token) window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Clearing in-memory state still lets this page start a fresh session.
  }
}

async function getToken(): Promise<string> {
  const existing = volatileToken ?? readToken();
  if (existing) return existing;
  if (!sessionRequest) {
    sessionRequest = mutate<{ session_id: string; token: string }>("/api/shop/sessions", "POST")
      .then(({ data }) => {
        saveToken(data.token);
        return data.token;
      })
      .finally(() => {
        sessionRequest = undefined;
      });
  }
  return sessionRequest;
}

async function shopRequest<T>(
  path: string,
  init?: RequestInit,
  mayRecoverSession = true,
): Promise<T> {
  const token = await getToken();
  const headers = new Headers(init?.headers);
  headers.set("X-Shop-Token", token);
  try {
    return await request<T>(path, { ...init, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const invalidSession =
      message.includes("Shop session is invalid") ||
      message.includes("A valid shop session token is required") ||
      message.includes("Shop session token is invalid");
    if (!mayRecoverSession || !invalidSession) throw error;

    // Browser storage can outlive a cleared/replaced shop_sessions table.
    // Drop only the token that failed, create a new capability, then retry once.
    forgetToken(token);
    return shopRequest<T>(path, init, false);
  }
}

function signalCartChanged(): void {
  window.dispatchEvent(new Event("shop-cart-updated"));
}

export function getShopConfig() {
  return record<ShopConfig>("/api/shop/config");
}

export async function getShopCart(): Promise<ShopCart> {
  const result = await shopRequest<{ data: ShopCart }>("/api/shop/cart");
  return result.data;
}

export async function getShopAvailability(shellIds: string[]): Promise<Record<string, number>> {
  if (!shellIds.length) return {};
  const query = new URLSearchParams({ ids: shellIds.join(",") });
  const result = await request<{ data: Record<string, number> }>(`/api/shop/availability?${query}`);
  return result.data;
}

export async function addShopCartItem(shellId: string, quantity: number): Promise<ShopCart> {
  const result = await shopRequest<{ data: ShopCart }>("/api/shop/cart/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shell_id: shellId, quantity }),
  });
  signalCartChanged();
  return result.data;
}

export async function updateShopCartItem(shellId: string, quantity: number): Promise<ShopCart> {
  const result = await shopRequest<{ data: ShopCart }>(
    `/api/shop/cart/items/${encodeURIComponent(shellId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    },
  );
  signalCartChanged();
  return result.data;
}

export async function removeShopCartItem(shellId: string): Promise<ShopCart> {
  const result = await shopRequest<{ data: ShopCart }>(
    `/api/shop/cart/items/${encodeURIComponent(shellId)}`,
    { method: "DELETE" },
  );
  signalCartChanged();
  return result.data;
}

export async function submitFeedback(input: { order_id: string; feedback_message: string }) {
  return shopRequest<{ data: any }>("/api/customer/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
export async function listFeedback(limit = 20, offset = 0) {
  return shopRequest<{ data: any[]; pagination: { limit: number; offset: number; total: number } }>(
    `/api/customer/feedback?limit=${limit}&offset=${offset}`,
  );
}
export async function submitContactInquiry(input: {
  customer_name: string;
  email: string;
  order_id?: string;
  subject: string;
  message: string;
}) {
  const result = await shopRequest<{ data: any }>("/api/customer/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return result.data;
}
export async function submitReturnRequest(input: {
  order_id: string;
  reason: string;
  details: string;
  requested_resolution: "refund" | "replacement" | "other";
}) {
  return shopRequest<{ data: any }>("/api/customer/returns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
export async function listReturnRequests() {
  return shopRequest<{ data: any[] }>("/api/customer/returns");
}
export async function uploadReturnEvidence(returnId: string, file: File) {
  const form = new FormData();
  form.append("image", file);
  return shopRequest<{ data: any }>(
    `/api/customer/returns/${encodeURIComponent(returnId)}/evidence`,
    { method: "POST", body: form },
  );
}
export async function requestInvoice(order_id: string) {
  return shopRequest<{ data: any }>("/api/customer/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order_id }),
  });
}
export async function listInvoiceRequests() {
  return shopRequest<{ data: any[] }>("/api/customer/invoices");
}
export async function listShippingOptions(country?: string) {
  const query = country ? `?country=${encodeURIComponent(country)}` : "";
  return request<{ data: any[] }>(`/api/customer/shipping${query}`);
}
export async function getPublicStoreSettings() {
  return request<{ data: any }>("/api/customer/settings");
}
export async function validateDiscount(code: string, subtotal: number) {
  return shopRequest<{
    data: { code: string; discount_amount: number; subtotal: number; eligible_subtotal: number };
  }>("/api/customer/discounts/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, subtotal }),
  });
}

export async function createShopOrder(input: {
  idempotency_key: string;
  discount_code?: string;
  shipping_rate_id: string;
  shipping_country_code: string;
  customer: { name: string; email: string; phone: string };
  delivery_address: DeliveryAddress;
}): Promise<ShopOrder> {
  const result = await shopRequest<{ data: ShopOrder }>("/api/shop/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  signalCartChanged();
  return result.data;
}

export async function captureShopOrder(orderId: string): Promise<ShopOrder> {
  const result = await shopRequest<{ data: ShopOrder }>(
    `/api/shop/orders/${encodeURIComponent(orderId)}/capture`,
    { method: "POST" },
  );
  return result.data;
}

export async function getShopOrder(orderId: string): Promise<ShopOrder> {
  const result = await shopRequest<{ data: ShopOrder }>(
    `/api/shop/orders/${encodeURIComponent(orderId)}`,
  );
  return result.data;
}

export async function getShopOrders(): Promise<{
  data: ShopOrderSummary[];
  pagination: { limit: number; offset: number; total: number };
}> {
  return shopRequest<{
    data: ShopOrderSummary[];
    pagination: { limit: number; offset: number; total: number };
  }>("/api/shop/orders?limit=50&offset=0");
}
