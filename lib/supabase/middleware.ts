/**
 * Supabase Middleware Helper
 * Refreshes session and handles cookie synchronization
 * 
 * Spec Reference: Part 1, Line 45 (Database & Auth: Supabase)
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { Database } from "@/types/supabase";

interface CookieConfig {
  name: string;
  value: string;
  options?: CookieOptions;
}

/**
 * Updates the Supabase session in middleware
 * This runs on every request to keep the session fresh
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieConfig[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if needed
  // This is important for keeping the session alive
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabaseResponse, user };
}
