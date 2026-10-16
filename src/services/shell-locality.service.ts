import { getSupabaseClient } from "../config/supabase";
import { DatabaseOperationError, throwDatabaseError, type PageResult } from "../errors/database-error";
import type { ShellLocality, ShellLocalityInsert, ShellLocalityListQuery, ShellLocalityUpdate } from "../validation/shell-locality";

export async function listShellLocalities(query: ShellLocalityListQuery): Promise<PageResult<ShellLocality>> {
  let request = getSupabaseClient().from("shell_locality").select("*", { count: "exact" });
  if (query.locality !== undefined) request = request.eq("locality", query.locality);
  const { data, count, error } = await request
    .order(query.sort_by, { ascending: query.sort_order === "asc" })
    .range(query.offset, query.offset + query.limit - 1);
  throwDatabaseError(error);
  return { data: data ?? [], total: count ?? 0 };
}

export async function getShellLocality(id: string): Promise<ShellLocality | null> {
  const { data, error } = await getSupabaseClient().from("shell_locality").select("*").eq("locality_id", id).maybeSingle();
  throwDatabaseError(error);
  return data;
}

export async function createShellLocality(input: ShellLocalityInsert): Promise<ShellLocality> {
  const { data, error } = await getSupabaseClient().from("shell_locality").insert(input).select("*").single();
  throwDatabaseError(error);
  if (!data) throw new DatabaseOperationError("PGRST_NO_DATA");
  return data;
}

export async function updateShellLocality(id: string, input: ShellLocalityUpdate): Promise<ShellLocality | null> {
  const { data, error } = await getSupabaseClient().from("shell_locality").update(input).eq("locality_id", id).select("*").maybeSingle();
  throwDatabaseError(error);
  return data;
}

export async function deleteShellLocality(id: string): Promise<ShellLocality | null> {
  const { data, error } = await getSupabaseClient().from("shell_locality").delete().eq("locality_id", id).select("*").maybeSingle();
  throwDatabaseError(error);
  return data;
}
