/**
 * Next.js Middleware
 * Handles authentication and route protection
 * 
 * Spec Reference: 
 * - Part 4, Lines 198-199: Dashboard Access (Full dashboard unlocked after payment)
 * - Part 10, Lines 1184: JWT-based tenant isolation
 * 
 * Route Protection:
 * - /dashboard/* requires authenticated user with tenant_id
 * - /onboarding/* requires authenticated user
 * - /admin/* requires authenticated admin user
 * - Auth routes (/login, /signup) redirect if already logged in
 */

import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Routes that require authentication
const PROTECTED_ROUTES = ["/dashboard", "/onboarding", "/admin"];

// Routes only for unauthenticated users
const AUTH_ROUTES = ["/login", "/signup", "/forgot-password"];

// Routes that require completed onboarding (subscription active)
const SUBSCRIPTION_REQUIRED_ROUTES = ["/dashboard"];

// Admin-only routes
const ADMIN_ROUTES = ["/admin"];

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Check if current route requires auth
  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const isAdminRoute = ADMIN_ROUTES.some((route) => pathname.startsWith(route));

  // Redirect unauthenticated users away from protected routes
  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth routes
  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    // Check if user has completed onboarding (has tenant_id)
    const tenantId = user.app_metadata?.tenant_id;
    if (tenantId) {
      url.pathname = "/dashboard";
    } else {
      url.pathname = "/onboarding";
    }
    return NextResponse.redirect(url);
  }

  // Check admin access
  if (isAdminRoute && user) {
    const isAdmin = user.app_metadata?.is_admin === true;
    if (!isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  // Check subscription status for dashboard access
  if (pathname.startsWith("/dashboard") && user) {
    const tenantId = user.app_metadata?.tenant_id;
    const subscriptionStatus = user.app_metadata?.subscription_status;

    // User hasn't completed onboarding yet
    if (!tenantId) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }

    // Note: We allow trial users to access dashboard
    // The dashboard will show upgrade prompts for unpaid users
    // Full access is granted after subscription is active
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes that don't need session refresh
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
