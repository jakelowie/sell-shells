export const API_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
