import { authClient } from "../auth/client";
import { API_URL } from "../config";

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const {
    data: { session },
  } = await authClient.auth.getSession();
  const headers = new Headers(init.headers);
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body as T;
}

export const paged = <T>(path: string, offset = 0, limit = 25) =>
  api<{ data: T[]; pagination: { limit: number; offset: number; total: number } }>(
    `${path}?limit=${limit}&offset=${offset}`,
  );
