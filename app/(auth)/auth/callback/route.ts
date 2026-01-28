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

/**
 * Validate redirect path to prevent open redirect attacks
 * Only allows relative paths that start with / and don't contain protocol markers
 */
function validateRedirectPath(path: string | null): string {
  const defaultPath = "/dashboard";

  if (!path) {
    return defaultPath;
  }

  // Must start with a single forward slash (not //)
  if (!path.startsWith("/") || path.startsWith("//")) {
    return defaultPath;
  }

  // Must not contain protocol markers
  if (path.includes("://") || path.includes("\\")) {
    return defaultPath;
  }

  // Must not contain encoded characters that could bypass checks
  const decoded = decodeURIComponent(path);
  if (decoded !== path && (decoded.includes("://") || decoded.startsWith("//"))) {
    return defaultPath;
  }

  // Only allow alphanumeric, /, -, _, ., ?, =, &
  const safePathRegex = /^\/[a-zA-Z0-9\-_./?=&]*$/;
  if (!safePathRegex.test(path)) {
    return defaultPath;
  }

  return path;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = validateRedirectPath(searchParams.get("next"));
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
          // User confirmed email but no business created yet
          return NextResponse.redirect(`${origin}/welcome`);
        }

        // Check if onboarding is completed
        const { data: business } = await supabase
          .from("businesses")
          .select("onboarding_completed_at")
          .eq("id", tenantId)
          .single();

        // Type assertion needed since the schema may not include this column
        const businessData = business as { onboarding_completed_at?: string | null } | null;
        if (!businessData?.onboarding_completed_at) {
          // User has business but hasn't completed onboarding
          // Show welcome page with options to start now or later
          return NextResponse.redirect(`${origin}/welcome`);
        }

        // User is fully set up - go to dashboard or requested page
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
