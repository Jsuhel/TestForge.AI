/**
 * Browser Supabase client.
 *
 * Credentials come from NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 * (the publishable key — safe to expose, access is gated by RLS policies).
 * When either is missing or malformed the app silently runs local-only
 * (IndexedDB), exactly as it did before Supabase existed.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

let client: SupabaseClient | null = null;

/** True when both env vars look usable; guards every cloud call. */
export function isSupabaseConfigured(): boolean {
  return (
    /^https:\/\/[^\s\/]+\.[^\s\/]+\/?$/.test(SUPABASE_URL) &&
    SUPABASE_PUBLISHABLE_KEY.length > 20
  );
}

/** Lazily-created singleton — never call before isSupabaseConfigured(). */
export function getSupabase(): SupabaseClient {
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  return client;
}

/**
 * Remote calls must never hang the UI — a stalled network would block
 * hydration and leave the dashboard stuck on the loading state. Every cloud
 * operation is raced against this timeout and falls back to local storage.
 */
export function withTimeout<T>(promise: PromiseLike<T>, ms = 6000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Supabase request timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
