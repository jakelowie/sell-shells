import { getSupabaseClient } from "../config/supabase";
import {
  DatabaseOperationError,
  throwDatabaseError,
  type PageResult,
} from "../errors/database-error";
import type {
  ShippingFee,
  ShippingFeeInsert,
  ShippingFeeListQuery,
  ShippingFeeUpdate,
} from "../validation/shipping-fee";

export async function listShippingFees(
  query: ShippingFeeListQuery,
): Promise<PageResult<ShippingFee>> {
  let request = getSupabaseClient().from("shipping_fee").select("*", { count: "exact" });
  if (query.shipping_name !== undefined) request = request.eq("shipping_name", query.shipping_name);
  if (query.is_active !== undefined) request = request.eq("is_active", query.is_active);
  const { data, count, error } = await request
    .order(query.sort_by, { ascending: query.sort_order === "asc" })
    .range(query.offset, query.offset + query.limit - 1);
  throwDatabaseError(error);
  return { data: data ?? [], total: count ?? 0 };
}

export async function getShippingFee(id: string): Promise<ShippingFee | null> {
  const { data, error } = await getSupabaseClient()
    .from("shipping_fee")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwDatabaseError(error);
  return data;
}

export async function createShippingFee(input: ShippingFeeInsert): Promise<ShippingFee> {
  const { data, error } = await getSupabaseClient()
    .from("shipping_fee")
    .insert(input)
    .select("*")
    .single();
  throwDatabaseError(error);
  if (!data) throw new DatabaseOperationError("PGRST_NO_DATA");
  return data;
}

export async function updateShippingFee(
  id: string,
  input: ShippingFeeUpdate,
): Promise<ShippingFee | null> {
  const { data, error } = await getSupabaseClient()
    .from("shipping_fee")
    .update(input)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  throwDatabaseError(error);
  return data;
}

export async function deleteShippingFee(id: string): Promise<ShippingFee | null> {
  const { data, error } = await getSupabaseClient()
    .from("shipping_fee")
    .delete()
    .eq("id", id)
    .select("*")
    .maybeSingle();
  throwDatabaseError(error);
  return data;
}
