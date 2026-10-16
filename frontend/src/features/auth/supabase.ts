import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;

export function getAuthClient(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) {
    throw new Error('Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in frontend/.env.');
  }
  client = createClient(url, publishableKey, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
  });
  return client;
}
