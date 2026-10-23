import { getSupabaseClient } from "../config/supabase";
import { DatabaseOperationError, throwDatabaseError } from "../errors/database-error";
import type { Unit, UnitListQuery } from "../validation/unit";
import type { PageResult } from "../errors/database-error";

export async function listUnits(filters: UnitListQuery): Promise<PageResult<Unit>> {
  let query = getSupabaseClient().from("unit_of_measurement").select("*", { count: "exact" });
  if (filters.measurement_for) query = query.eq("measurement_for", filters.measurement_for);
  if (filters.unit_name) query = query.ilike("unit_name", `%${filters.unit_name}%`);
  const { data, count, error } = await query
    .order(filters.sort_by, { ascending: filters.sort_order === "asc" })
    .range(filters.offset, filters.offset + filters.limit - 1);
  throwDatabaseError(error);
  return { data: data ?? [], total: count ?? 0 };
}

export async function getUnit(id: string): Promise<Unit | null> {
  const { data, error } = await getSupabaseClient().from("unit_of_measurement").select("*").eq("id", id).maybeSingle();
  throwDatabaseError(error);
  return data;
}

async function ensureUnique(name: string, category: string, exceptId?: string) {
  let query = getSupabaseClient().from("unit_of_measurement").select("id").ilike("unit_name", name).eq("measurement_for", category);
  if (exceptId) query = query.neq("id", exceptId);
  const { data, error } = await query.limit(1).maybeSingle();
  throwDatabaseError(error);
  if (data) throw new DatabaseOperationError("23505", "A unit with this name already exists for this category.");
}

export async function createUnit(input: { unit_name: string; measurement_for: "size" | "weight" }): Promise<Unit> {
  await ensureUnique(input.unit_name, input.measurement_for);
  const { data, error } = await getSupabaseClient().from("unit_of_measurement").insert(input).select("*").single();
  throwDatabaseError(error);
  if (!data) throw new DatabaseOperationError("PGRST_NO_DATA");
  return data;
}

export async function updateUnit(id: string, input: { unit_name?: string; measurement_for?: "size" | "weight" }): Promise<Unit | null> {
  const { data: old, error: oldError } = await getSupabaseClient().from("unit_of_measurement").select("*").eq("id", id).maybeSingle();
  throwDatabaseError(oldError);
  if (!old) return null;
  const name = input.unit_name ?? old.unit_name ?? "";
  const category = input.measurement_for ?? old.measurement_for ?? "";
  await ensureUnique(name, category, id);
  const { data, error } = await getSupabaseClient().from("unit_of_measurement").update(input).eq("id", id).select("*").maybeSingle();
  throwDatabaseError(error);
  return data;
}

export async function deleteUnit(id: string): Promise<Unit | null> {
  // Unit labels are stored as part of free-text shell values, so deleting a catalog
  // entry never alters those values or breaks a relational reference.
  const { data, error } = await getSupabaseClient().from("unit_of_measurement").delete().eq("id", id).select("*").maybeSingle();
  throwDatabaseError(error);
  return data;
}
