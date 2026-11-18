import { list, mutate, record } from "./client";
import type { Page, ShippingFee } from "./types";

export function listShippingFees(
  options: {
    limit?: number;
    offset?: number;
    is_active?: boolean;
    shipping_name?: string;
  } = {},
) {
  return list<ShippingFee>("/api/shipping-fees", {
    limit: options.limit ?? 100,
    offset: options.offset ?? 0,
    sort_by: "shipping_name",
    sort_order: "asc",
    is_active: options.is_active,
    shipping_name: options.shipping_name,
  });
}

export async function getAllShippingFees(options: { activeOnly?: boolean } = {}) {
  const firstPage = await listShippingFees({ is_active: options.activeOnly ? true : undefined });
  const pageCount = Math.ceil(
    Math.max(0, firstPage.pagination.total - firstPage.data.length) / 100,
  );
  const remaining = await Promise.all(
    Array.from({ length: pageCount }, (_, index) =>
      listShippingFees({
        limit: 100,
        offset: (index + 1) * 100,
        is_active: options.activeOnly ? true : undefined,
      }),
    ),
  );
  return [...firstPage.data, ...remaining.flatMap((page: Page<ShippingFee>) => page.data)];
}

export function getShippingFee(id: string) {
  return record<ShippingFee>(`/api/shipping-fees/${encodeURIComponent(id)}`);
}

export function createShippingFee(input: {
  shipping_name: string;
  shipping_fee: number;
  is_active: boolean;
}) {
  return mutate<ShippingFee>("/api/shipping-fees", "POST", input);
}

export function updateShippingFee(
  id: string,
  input: { shipping_name: string; shipping_fee: number; is_active: boolean },
) {
  return mutate<ShippingFee>(`/api/shipping-fees/${encodeURIComponent(id)}`, "PATCH", input);
}

export function deleteShippingFee(id: string) {
  return mutate<ShippingFee>(`/api/shipping-fees/${encodeURIComponent(id)}`, "DELETE");
}
