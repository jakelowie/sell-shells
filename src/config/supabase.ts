import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AsyncLocalStorage } from "node:async_hooks";
import type { Database } from "../models/database";

let client: SupabaseClient<Database> | undefined;
let storageClient: SupabaseClient<Database> | undefined;
let commerceClient: SupabaseClient<Database> | undefined;
const requestClient = new AsyncLocalStorage<SupabaseClient<Database>>();

/** Returns the server-side Supabase client using the project's publishable key. */
export function getSupabaseClient(): SupabaseClient<Database> {
  const scopedClient = requestClient.getStore();
  if (scopedClient) return scopedClient;
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

/** Creates a request-scoped client so Supabase RLS sees the caller's access token. */
export function createUserSupabaseClient(accessToken: string): SupabaseClient<Database> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in your .env file.");
  }
  return createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

/** Keeps concurrent Express requests isolated while existing services use the shared accessor. */
export function runWithUserSupabaseClient(client: SupabaseClient<Database>, callback: () => void): void {
  requestClient.run(client, callback);
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

/** Uses the server-only Supabase secret key for guest carts and orders. */
export function getSupabaseCommerceClient(): SupabaseClient<Database> {
  if (commerceClient) return commerceClient;

  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("Supabase commerce is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.");
  }

  commerceClient = createClient<Database>(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  return commerceClient;
}
