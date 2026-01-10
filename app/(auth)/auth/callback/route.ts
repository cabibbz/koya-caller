/**
 * Auth Callback Route Handler
 * Handles email confirmation and OAuth callbacks
 * 
 * This route is called after:
 * - User clicks email confirmation link
 * - OAuth provider redirects back
 * - Password reset link is clicked
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const type = searchParams.get("type");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check what type of callback this is
      if (type === "recovery") {
        // Password reset flow - redirect to reset password page
        return NextResponse.redirect(`${origin}/reset-password`);
      }

      // Get user to determine redirect
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const tenantId = user.app_metadata?.tenant_id;
        
        if (!tenantId) {
          // User confirmed email but hasn't completed onboarding
          return NextResponse.redirect(`${origin}/onboarding`);
        }

        // User is fully set up
        const forwardedHost = request.headers.get("x-forwarded-host");
        const isLocalEnv = process.env.NODE_ENV === "development";

        if (isLocalEnv) {
          return NextResponse.redirect(`${origin}${next}`);
        } else if (forwardedHost) {
          return NextResponse.redirect(`https://${forwardedHost}${next}`);
        } else {
          return NextResponse.redirect(`${origin}${next}`);
        }
      }
    }
  }

  // Something went wrong, redirect to error page
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
