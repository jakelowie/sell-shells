import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../models/database";

let client: SupabaseClient<Database> | undefined;
let storageClient: SupabaseClient<Database> | undefined;

/** Returns the server-side Supabase client using the project's publishable key. */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in your .env file."
    );
  }

  client = createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return client;
}

/** Uses the server-only secret key for private Storage operations. */
export function getSupabaseStorageClient(): SupabaseClient<Database> {
  if (storageClient) return storageClient;

  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.");
  }

  storageClient = createClient<Database>(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  return storageClient;
}
