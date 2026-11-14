import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = Boolean(url && key);

/**
 * True when the page was opened from a "reset your password" email link.
 * Read once, when this file first loads in the browser, because the Supabase client
 * signs the person in and removes the link's details from the address as soon as it starts.
 */
export const openedFromResetLink =
  typeof window !== "undefined" && /(^|[#?&])type=recovery(&|$)/.test(window.location.hash + window.location.search);

let client: SupabaseClient | null = null;

/** Browser Supabase client. The publishable key is safe in the browser: Row Level Security protects the data. */
export function supabase(): SupabaseClient {
  if (!url || !key) throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  if (!client) client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}
