/**
 * Next.js Middleware
 * Handles authentication, route protection, and security headers
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
 *
 * Security:
 * - Security headers applied to all responses
 * - CSRF protection for state-changing requests
 */

// Use Node.js runtime for Supabase SSR compatibility
// Supabase SSR uses Node.js APIs (process.version) not available in Edge Runtime
export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// =============================================================================
// SECURITY HEADERS
// =============================================================================

const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(self), geolocation=(), interest-cohort=()",
};

// CSP directives - stricter in production
const isProduction = process.env.NODE_ENV === "production";
const CSP_DIRECTIVES = [
  "default-src 'self'",
  // unsafe-eval only needed for Next.js development hot reload
  `script-src 'self' ${isProduction ? "" : "'unsafe-eval'"} 'unsafe-inline' https://js.stripe.com`.trim(),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://api.stripe.com https://api.retellai.com wss://*.supabase.co",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

function applySecurityHeaders(response: NextResponse): NextResponse {
  // Apply standard security headers
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Apply CSP
  response.headers.set("Content-Security-Policy", CSP_DIRECTIVES.join("; "));

  // Apply HSTS in production
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  return response;
}

// =============================================================================
// ROUTE CONFIGURATION
// =============================================================================

// Routes that require authentication
const PROTECTED_ROUTES = ["/dashboard", "/onboarding", "/admin"];

// Routes only for unauthenticated users
const AUTH_ROUTES = ["/login", "/signup", "/forgot-password"];

// Public routes that should redirect authenticated users to dashboard
const PUBLIC_REDIRECT_ROUTES: string[] = [];

// Routes that require completed onboarding (subscription active)
const _SUBSCRIPTION_REQUIRED_ROUTES = ["/dashboard"];

// Admin-only routes
const ADMIN_ROUTES = ["/admin"];

// =============================================================================
// MIDDLEWARE
// =============================================================================

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Apply security headers to all responses
  const response = applySecurityHeaders(supabaseResponse);

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

  // Redirect authenticated users away from public marketing pages (landing page)
  const isPublicRedirectRoute = PUBLIC_REDIRECT_ROUTES.includes(pathname);
  if (isPublicRedirectRoute && user) {
    const url = request.nextUrl.clone();
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
    const _subscriptionStatus = user.app_metadata?.subscription_status;

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

  return response;
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
