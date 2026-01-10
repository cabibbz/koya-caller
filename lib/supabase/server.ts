/**
 * Supabase Server Client
 * For Server Components, Server Actions, and Route Handlers
 * 
 * Spec Reference: Part 1, Line 45 (Database & Auth: Supabase)
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Database } from "@/types/supabase";

interface CookieConfig {
  name: string;
  value: string;
  options?: CookieOptions;
}

/**
 * Creates a Supabase client for server-side use
 * Handles cookie-based session management
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieConfig[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}

/**
 * Creates a Supabase admin client with service role key
 * ONLY use server-side for privileged operations (e.g., setting tenant_id)
 * 
 * Spec Reference: Part 10, Lines 1200-1207 (Setting tenant_id on signup)
 */
export function createAdminClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // Admin client doesn't need to set cookies
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

/**
 * Alias for createAdminClient - service role client for background jobs
 * Used by cron jobs and queue processors that don't have user context
 */
export const createServiceClient = createAdminClient;
