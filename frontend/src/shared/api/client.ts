import type { Page } from './types';

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
export const API_BASE_URL = (configuredBaseUrl || (import.meta.env.DEV ? '' : 'http://localhost:3000')).replace(/\/$/, '');

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) { const details = Array.isArray(body.details) ? `: ${body.details.join(', ')}` : ''; throw new Error(`${body.error || `Request failed (${response.status})`}${details}`); }
  return body as T;
}
export const list = <T,>(path: string, params: Record<string, string | number | boolean | undefined>) => {
  const query = new URLSearchParams(); Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== '') query.set(key, String(value)); });
  return request<Page<T>>(`${path}?${query}`);
};
export const record = <T,>(path: string) => request<{data:T}>(path);
export const mutate = <T,>(path: string, method: string, data?: unknown) => request<{data:T}>(path, {method, headers:{'Content-Type':'application/json'}, body: data === undefined ? undefined : JSON.stringify(data)});

