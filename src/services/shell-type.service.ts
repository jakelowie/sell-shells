import { getSupabaseClient } from "../config/supabase";
import { DatabaseOperationError, throwDatabaseError, type PageResult } from "../errors/database-error";
import type { ShellType, ShellTypeInsert, ShellTypeListQuery, ShellTypeUpdate } from "../validation/shell-type";

export async function listShellTypes(query: ShellTypeListQuery): Promise<PageResult<ShellType>> {
  let request = getSupabaseClient().from("shell_type").select("*", { count: "exact" });
  if (query.shell_type_name !== undefined) request = request.eq("shell_type_name", query.shell_type_name);
  const { data, count, error } = await request
    .order(query.sort_by, { ascending: query.sort_order === "asc" })
    .range(query.offset, query.offset + query.limit - 1);
  throwDatabaseError(error);
  return { data: data ?? [], total: count ?? 0 };
}

export async function getShellType(id: string): Promise<ShellType | null> {
  const { data, error } = await getSupabaseClient().from("shell_type").select("*").eq("type_id", id).maybeSingle();
  throwDatabaseError(error);
  return data;
}

export async function createShellType(input: ShellTypeInsert): Promise<ShellType> {
  const { data, error } = await getSupabaseClient().from("shell_type").insert(input).select("*").single();
  throwDatabaseError(error);
  if (!data) throw new DatabaseOperationError("PGRST_NO_DATA");
  return data;
}

export async function updateShellType(id: string, input: ShellTypeUpdate): Promise<ShellType | null> {
  const { data, error } = await getSupabaseClient().from("shell_type").update(input).eq("type_id", id).select("*").maybeSingle();
  throwDatabaseError(error);
  return data;
}

export async function deleteShellType(id: string): Promise<ShellType | null> {
  const { data, error } = await getSupabaseClient().from("shell_type").delete().eq("type_id", id).select("*").maybeSingle();
  throwDatabaseError(error);
  return data;
}
