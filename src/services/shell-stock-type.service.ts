import { getSupabaseClient } from "../config/supabase";
import { DatabaseOperationError, throwDatabaseError, type PageResult } from "../errors/database-error";
import type { ShellStockType, ShellStockTypeInsert, ShellStockTypeListQuery, ShellStockTypeUpdate } from "../validation/shell-stock-type";

export async function listShellStockTypes(query: ShellStockTypeListQuery): Promise<PageResult<ShellStockType>> {
  let request = getSupabaseClient().from("shell_stock_type").select("*", { count: "exact" });
  if (query.stock_name !== undefined) request = request.eq("stock_name", query.stock_name);
  const { data, count, error } = await request
    .order(query.sort_by, { ascending: query.sort_order === "asc" })
    .range(query.offset, query.offset + query.limit - 1);
  throwDatabaseError(error);
  return { data: data ?? [], total: count ?? 0 };
}

export async function getShellStockType(id: string): Promise<ShellStockType | null> {
  const { data, error } = await getSupabaseClient().from("shell_stock_type").select("*").eq("stock_id", id).maybeSingle();
  throwDatabaseError(error);
  return data;
}

export async function createShellStockType(input: ShellStockTypeInsert): Promise<ShellStockType> {
  const { data, error } = await getSupabaseClient().from("shell_stock_type").insert(input).select("*").single();
  throwDatabaseError(error);
  if (!data) throw new DatabaseOperationError("PGRST_NO_DATA");
  return data;
}

export async function updateShellStockType(id: string, input: ShellStockTypeUpdate): Promise<ShellStockType | null> {
  const { data, error } = await getSupabaseClient().from("shell_stock_type").update(input).eq("stock_id", id).select("*").maybeSingle();
  throwDatabaseError(error);
  return data;
}

export async function deleteShellStockType(id: string): Promise<ShellStockType | null> {
  const { data, error } = await getSupabaseClient().from("shell_stock_type").delete().eq("stock_id", id).select("*").maybeSingle();
  throwDatabaseError(error);
  return data;
}
