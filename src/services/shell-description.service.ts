import { getSupabaseClient } from "../config/supabase";
import { DatabaseOperationError, throwDatabaseError, type PageResult } from "../errors/database-error";
import type { ShellDescription, ShellDescriptionInsert, ShellDescriptionListQuery, ShellDescriptionUpdate } from "../validation/shell-description";

export async function listShellDescriptions(query: ShellDescriptionListQuery): Promise<PageResult<ShellDescription>> {
  let request = getSupabaseClient().from("shell_description").select("*", { count: "exact" });
  if (!query.include_deleted) request = request.or("is_deleted.is.null,is_deleted.eq.false");
  if (query.shell_name !== undefined) request = request.eq("shell_name", query.shell_name);
  if (query.author !== undefined) request = request.eq("author", query.author);
  if (query.locality_id !== undefined) request = request.eq("locality_id", query.locality_id);
  if (query.price !== undefined) request = request.eq("price", query.price);
  if (query.shell_stock_type_id !== undefined) request = request.eq("shell_stock_type_id", query.shell_stock_type_id);
  if (query.shell_type_id !== undefined) request = request.eq("shell_type_id", query.shell_type_id);
  const { data, count, error } = await request
    .order(query.sort_by, { ascending: query.sort_order === "asc" })
    .range(query.offset, query.offset + query.limit - 1);
  throwDatabaseError(error);
  return { data: data ?? [], total: count ?? 0 };
}

export async function getShellDescription(id: string): Promise<ShellDescription | null> {
  const { data, error } = await getSupabaseClient().from("shell_description")
    .select("*").eq("shell_id", id).or("is_deleted.is.null,is_deleted.eq.false").maybeSingle();
  throwDatabaseError(error);
  return data;
}

export async function createShellDescription(input: ShellDescriptionInsert): Promise<ShellDescription> {
  const { data, error } = await getSupabaseClient().from("shell_description")
    .insert(input).select("*").single();
  throwDatabaseError(error);
  if (!data) throw new DatabaseOperationError("PGRST_NO_DATA");
  return data;
}

export async function updateShellDescription(id: string, input: ShellDescriptionUpdate): Promise<ShellDescription | null> {
  const { data, error } = await getSupabaseClient().from("shell_description")
    .update(input).eq("shell_id", id).or("is_deleted.is.null,is_deleted.eq.false").select("*").maybeSingle();
  throwDatabaseError(error);
  return data;
}

export async function deleteShellDescription(id: string): Promise<ShellDescription | null> {
  const { data, error } = await getSupabaseClient().from("shell_description")
    .update({ is_deleted: true }).eq("shell_id", id).or("is_deleted.is.null,is_deleted.eq.false").select("*").maybeSingle();
  throwDatabaseError(error);
  return data;
}
