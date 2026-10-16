import { getSupabaseClient } from "../config/supabase";
import { throwDatabaseError } from "../errors/database-error";
import type { AppRole, UserRole } from "../models/database";

export async function listUserRoles(): Promise<UserRole[]> {
  const { data, error } = await getSupabaseClient()
    .from("user_roles")
    .select("user_id,email,role,created_at,updated_at")
    .order("email", { ascending: true });
  throwDatabaseError(error);
  return data ?? [];
}

export async function assignUserRole(userId: string, role: AppRole): Promise<UserRole | null> {
  const { data, error } = await getSupabaseClient()
    .rpc("assign_user_role", { target_user_id: userId, new_role: role });
  throwDatabaseError(error);
  return data ?? null;
}
