import { mutate, request, record } from './client';
import type { DeliveryAddress, ShopCart, ShopConfig, ShopOrder, ShopOrderSummary } from './types';

const TOKEN_KEY = 'sell-shells.shop-session.v1';
let sessionRequest: Promise<string> | undefined;

function readToken(): string | null {
  try { return window.localStorage.getItem(TOKEN_KEY); }
  catch { return null; }
}

function saveToken(token: string): void {
  try { window.localStorage.setItem(TOKEN_KEY, token); }
  catch { /* The in-memory session continues to work for this page view. */ }
  volatileToken = token;
}

let volatileToken: string | null = null;

async function getToken(): Promise<string> {
  const existing = volatileToken ?? readToken();
  if (existing) return existing;
  if (!sessionRequest) {
    sessionRequest = mutate<{ session_id: string; token: string }>('/api/shop/sessions', 'POST')
      .then(({ data }) => { saveToken(data.token); return data.token; })
      .finally(() => { sessionRequest = undefined; });
  }
  return sessionRequest;
}

async function shopRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken();
  const headers = new Headers(init?.headers);
  headers.set('X-Shop-Token', token);
  return request<T>(path, { ...init, headers });
}

function signalCartChanged(): void {
  window.dispatchEvent(new Event('shop-cart-updated'));
}

export function getShopConfig() {
  return record<ShopConfig>('/api/shop/config');
}

export async function getShopCart(): Promise<ShopCart> {
  const result = await shopRequest<{ data: ShopCart }>('/api/shop/cart');
  return result.data;
}

export async function getShopAvailability(shellIds: string[]): Promise<Record<string, number>> {
  if (!shellIds.length) return {};
  const query = new URLSearchParams({ ids: shellIds.join(',') });
  const result = await request<{ data: Record<string, number> }>(`/api/shop/availability?${query}`);
  return result.data;
}

export async function addShopCartItem(shellId: string, quantity: number): Promise<ShopCart> {
  const result = await shopRequest<{ data: ShopCart }>('/api/shop/cart/items', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shell_id: shellId, quantity })
  });
  signalCartChanged();
  return result.data;
}

export async function updateShopCartItem(shellId: string, quantity: number): Promise<ShopCart> {
  const result = await shopRequest<{ data: ShopCart }>(`/api/shop/cart/items/${encodeURIComponent(shellId)}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity })
  });
  signalCartChanged();
  return result.data;
}

export async function removeShopCartItem(shellId: string): Promise<ShopCart> {
  const result = await shopRequest<{ data: ShopCart }>(`/api/shop/cart/items/${encodeURIComponent(shellId)}`, { method: 'DELETE' });
  signalCartChanged();
  return result.data;
}

export async function createShopOrder(input: {
  idempotency_key: string;
  customer: { name: string; email: string; phone: string };
  delivery_address: DeliveryAddress;
}): Promise<ShopOrder> {
  const result = await shopRequest<{ data: ShopOrder }>('/api/shop/orders', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input)
  });
  signalCartChanged();
  return result.data;
}

export async function captureShopOrder(orderId: string): Promise<ShopOrder> {
  const result = await shopRequest<{ data: ShopOrder }>(`/api/shop/orders/${encodeURIComponent(orderId)}/capture`, { method: 'POST' });
  return result.data;
}

export async function getShopOrder(orderId: string): Promise<ShopOrder> {
  const result = await shopRequest<{ data: ShopOrder }>(`/api/shop/orders/${encodeURIComponent(orderId)}`);
  return result.data;
}

export async function getShopOrders(): Promise<{ data: ShopOrderSummary[]; pagination: { limit: number; offset: number; total: number } }> {
  return shopRequest<{ data: ShopOrderSummary[]; pagination: { limit: number; offset: number; total: number } }>('/api/shop/orders?limit=50&offset=0');
}
