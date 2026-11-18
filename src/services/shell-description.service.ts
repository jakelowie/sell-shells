import { getSupabaseClient } from "../config/supabase";
import {
  DatabaseOperationError,
  throwDatabaseError,
  type PageResult,
} from "../errors/database-error";
import type {
  ShellDescription,
  ShellDescriptionInsert,
  ShellDescriptionListQuery,
  ShellDescriptionRecord,
  ShellDescriptionUpdate,
} from "../validation/shell-description";

async function attachRelationships(records: ShellDescription[]): Promise<ShellDescriptionRecord[]> {
  const client = getSupabaseClient();
  const localityIds = [
    ...new Set(records.flatMap((row) => (row.locality_id ? [row.locality_id] : []))),
  ];
  const stockTypeIds = [
    ...new Set(
      records.flatMap((row) => (row.shell_stock_type_id ? [row.shell_stock_type_id] : [])),
    ),
  ];
  const shellTypeIds = [
    ...new Set(records.flatMap((row) => (row.shell_type_id ? [row.shell_type_id] : []))),
  ];
  const shippingIds = [
    ...new Set(records.flatMap((row) => (row.shipping_id ? [row.shipping_id] : []))),
  ];

  const [localities, stockTypes, shellTypes, shippingFees] = await Promise.all([
    localityIds.length
      ? client
          .from("shell_locality")
          .select("locality_id,created_at,locality")
          .in("locality_id", localityIds)
      : Promise.resolve({ data: [], error: null }),
    stockTypeIds.length
      ? client
          .from("shell_stock_type")
          .select("stock_id,created_at,stock_name")
          .in("stock_id", stockTypeIds)
      : Promise.resolve({ data: [], error: null }),
    shellTypeIds.length
      ? client
          .from("shell_type")
          .select("type_id,created_at,shell_type_name")
          .in("type_id", shellTypeIds)
      : Promise.resolve({ data: [], error: null }),
    shippingIds.length
      ? client
          .from("shipping_fee")
          .select("id,created_at,shipping_name,shipping_fee,is_active")
          .in("id", shippingIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  throwDatabaseError(localities.error);
  throwDatabaseError(stockTypes.error);
  throwDatabaseError(shellTypes.error);
  throwDatabaseError(shippingFees.error);

  const localityById = new Map((localities.data ?? []).map((row) => [row.locality_id, row]));
  const stockTypeById = new Map((stockTypes.data ?? []).map((row) => [row.stock_id, row]));
  const shellTypeById = new Map((shellTypes.data ?? []).map((row) => [row.type_id, row]));
  const shippingFeeById = new Map((shippingFees.data ?? []).map((row) => [row.id, row]));
  return records.map((row) => ({
    ...row,
    shell_locality: row.locality_id ? (localityById.get(row.locality_id) ?? null) : null,
    shell_stock_type: row.shell_stock_type_id
      ? (stockTypeById.get(row.shell_stock_type_id) ?? null)
      : null,
    shell_type: row.shell_type_id ? (shellTypeById.get(row.shell_type_id) ?? null) : null,
    shipping_fee: row.shipping_id ? (shippingFeeById.get(row.shipping_id) ?? null) : null,
  }));
}

export async function listShellDescriptions(
  query: ShellDescriptionListQuery,
): Promise<PageResult<ShellDescriptionRecord>> {
  let request = getSupabaseClient().from("shell_description").select("*", { count: "exact" });
  if (!query.include_deleted) request = request.or("is_deleted.is.null,is_deleted.eq.false");
  if (query.shell_name !== undefined) request = request.eq("shell_name", query.shell_name);
  if (query.author !== undefined) request = request.eq("author", query.author);
  if (query.locality_id !== undefined) request = request.eq("locality_id", query.locality_id);
  if (query.price !== undefined) request = request.eq("price", query.price);
  if (query.shell_weight !== undefined) request = request.eq("shell_weight", query.shell_weight);
  if (query.shell_size !== undefined) request = request.eq("shell_size", query.shell_size);
  if (query.shell_stock_type_id !== undefined)
    request = request.eq("shell_stock_type_id", query.shell_stock_type_id);
  if (query.shell_type_id !== undefined) request = request.eq("shell_type_id", query.shell_type_id);
  if (query.shipping_id !== undefined) request = request.eq("shipping_id", query.shipping_id);
  const { data, count, error } = await request
    .order(query.sort_by, { ascending: query.sort_order === "asc" })
    .range(query.offset, query.offset + query.limit - 1);
  throwDatabaseError(error);
  return { data: await attachRelationships(data ?? []), total: count ?? 0 };
}

export async function getShellDescription(id: string): Promise<ShellDescriptionRecord | null> {
  const { data, error } = await getSupabaseClient()
    .from("shell_description")
    .select("*")
    .eq("shell_id", id)
    .or("is_deleted.is.null,is_deleted.eq.false")
    .maybeSingle();
  throwDatabaseError(error);
  return data ? (await attachRelationships([data]))[0] : null;
}

export async function createShellDescription(
  input: ShellDescriptionInsert,
): Promise<ShellDescriptionRecord> {
  const { data, error } = await getSupabaseClient()
    .from("shell_description")
    .insert(input)
    .select("*")
    .single();
  throwDatabaseError(error);
  if (!data) throw new DatabaseOperationError("PGRST_NO_DATA");
  return (await attachRelationships([data]))[0];
}

export async function updateShellDescription(
  id: string,
  input: ShellDescriptionUpdate,
): Promise<ShellDescriptionRecord | null> {
  const { data, error } = await getSupabaseClient()
    .from("shell_description")
    .update(input)
    .eq("shell_id", id)
    .or("is_deleted.is.null,is_deleted.eq.false")
    .select("*")
    .maybeSingle();
  throwDatabaseError(error);
  return data ? (await attachRelationships([data]))[0] : null;
}

export async function deleteShellDescription(id: string): Promise<ShellDescriptionRecord | null> {
  const { data, error } = await getSupabaseClient()
    .from("shell_description")
    .update({ is_deleted: true })
    .eq("shell_id", id)
    .or("is_deleted.is.null,is_deleted.eq.false")
    .select("*")
    .maybeSingle();
  throwDatabaseError(error);
  return data ? (await attachRelationships([data]))[0] : null;
}
