import { getSupabaseClient } from "../config/supabase";
import { ApiError } from "../errors/api-error";
import { DatabaseOperationError, throwDatabaseError, type PageResult } from "../errors/database-error";
import type { StockInfo, StockInfoInsert, StockInfoListQuery, StockInfoUpdate } from "../validation/stock-info";

export function calculateTotalAvailable(stock: number | null | undefined, piecesPerStock: number | null | undefined, isPerSet: boolean): number | null {
  if (stock === null || stock === undefined || piecesPerStock === null || piecesPerStock === undefined) return null;
  if (isPerSet && piecesPerStock === 0) throw new ApiError(400, "shell_pcs_per_stock must be greater than zero for a per set stock type.");
  const total = isPerSet ? stock / piecesPerStock : stock * piecesPerStock;
  if (!Number.isFinite(total)) throw new ApiError(400, `shell_stock ${isPerSet ? "divided by" : "multiplied by"} shell_pcs_per_stock must be a finite number.`);
  return total;
}

async function isPerSetStockType(stockTypeId: string | null | undefined): Promise<boolean> {
  if (!stockTypeId) return false;
  const { data, error } = await getSupabaseClient()
                                .from("shell_stock_type")
                                .select("stock_name")
                                .eq("stock_id", stockTypeId)
                                .maybeSingle();
  throwDatabaseError(error);
  return data?.stock_name?.trim().toLocaleLowerCase().includes("set") ? true : false;
}

export async function listStockInfo(query: StockInfoListQuery): Promise<PageResult<StockInfo>> {
  let request = getSupabaseClient().from("shell_stocks_info").select("*", { count: "exact" });
  if (query.shell_id !== undefined) request = request.eq("shell_id", query.shell_id);
  if (query.shell_stock_id !== undefined) request = request.eq("shell_stock_id", query.shell_stock_id);
  const { data, count, error } = await request
    .order(query.sort_by, { ascending: query.sort_order === "asc" })
    .range(query.offset, query.offset + query.limit - 1);
  throwDatabaseError(error);
  return { data: data ?? [], total: count ?? 0 };
}

export async function getStockInfo(id: number): Promise<StockInfo | null> {
  const { data, error } = await getSupabaseClient().from("shell_stocks_info").select("*").eq("stock_info_id", id).maybeSingle();
  throwDatabaseError(error);
  return data;
}

export async function createStockInfo(input: StockInfoInsert): Promise<StockInfo> {
  const perSet = await isPerSetStockType(input.shell_stock_id);
  const payload = {
    ...input,
    shell_total_available: calculateTotalAvailable(input.shell_stock, input.shell_pcs_per_stock, perSet)
  };
  const { data, error } = await getSupabaseClient().from("shell_stocks_info").insert(payload).select("*").single();
  throwDatabaseError(error);
  if (!data) throw new DatabaseOperationError("PGRST_NO_DATA");
  return data;
}

export async function updateStockInfo(id: number, input: StockInfoUpdate): Promise<StockInfo | null> {
  const existing = await getStockInfo(id);
  if (!existing) return null;
  const shellStock = input.shell_stock !== undefined ? input.shell_stock : existing.shell_stock;
  const piecesPerStock = input.shell_pcs_per_stock !== undefined ? input.shell_pcs_per_stock : existing.shell_pcs_per_stock;
  const stockTypeId = input.shell_stock_id !== undefined ? input.shell_stock_id : existing.shell_stock_id;
  const perSet = await isPerSetStockType(stockTypeId);
  const payload = {
    ...input,
    shell_total_available: calculateTotalAvailable(shellStock, piecesPerStock, perSet)
  };
  const { data, error } = await getSupabaseClient().from("shell_stocks_info").update(payload).eq("stock_info_id", id).select("*").maybeSingle();
  throwDatabaseError(error);
  return data;
}

export async function deleteStockInfo(id: number): Promise<StockInfo | null> {
  const { data, error } = await getSupabaseClient().from("shell_stocks_info").delete().eq("stock_info_id", id).select("*").maybeSingle();
  throwDatabaseError(error);
  return data;
}
