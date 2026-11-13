import { mutate, request } from "./client";
const base = "/api/admin/commerce";
export const getAdminCollection = (path: string) => request<{ data: any[] }>(`${base}/${path}`);
export const postAdmin = (path: string, data: unknown) =>
  mutate<any>(`${base}/${path}`, "POST", data);
export const patchAdmin = (path: string, data: unknown) =>
  mutate<any>(`${base}/${path}`, "PATCH", data);
export const getAdminPaged = (path: string, offset = 0) =>
  request<{ data: any[]; pagination: { total: number; offset: number; limit: number } }>(
    `${base}/${path}?limit=25&offset=${offset}`,
  );
export const getReturnEvidence = (id: string) =>
  request<{ data: any[] }>(`${base}/returns/${encodeURIComponent(id)}/evidence`);
