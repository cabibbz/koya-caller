/**
 * Authentication Middleware for API Routes
 *
 * Provides reusable authentication wrappers to eliminate code duplication
 * across 90+ API routes. Composes with existing rate limiting middleware.
 *
 * Usage:
 * - withAuth: Dashboard routes requiring authenticated user + business
 * - withAdminAuth: Admin routes requiring admin user check
 * - withOptionalAuth: Routes that work with or without authentication
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { errors, success } from "@/lib/api/responses";
import { logError } from "@/lib/logging";
import {
  withDashboardRateLimit,
  withPublicRateLimit,
  type ApiHandler,
} from "@/lib/rate-limit/middleware";
import type { Business } from "@/types";

// =============================================================================
// SUPABASE CLIENT TYPE
// =============================================================================

/**
 * Type for the Supabase client returned by createClient
 * Using Awaited<ReturnType<>> to infer the exact type
 */
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// =============================================================================
// TYPES
// =============================================================================

/**
 * Authenticated user from Supabase
 */
export interface AuthUser {
  id: string;
  email: string;
  phone?: string | null;
  app_metadata: {
    is_admin?: boolean;
    [key: string]: unknown;
  };
  user_metadata: Record<string, unknown>;
}

/**
 * Context passed to authenticated handlers
 */
export interface AuthContext {
  user: AuthUser;
  supabase: SupabaseServerClient;
}

/**
 * Context passed to handlers requiring business access
 */
export interface BusinessAuthContext extends AuthContext {
  business: Business;
}

/**
 * Context passed to admin handlers
 */
export interface AdminAuthContext extends AuthContext {
  isAdmin: true;
}

/**
 * Context for optional auth handlers
 */
export interface OptionalAuthContext {
  user: AuthUser | null;
  supabase: SupabaseServerClient;
}

/**
 * Handler type for routes requiring authentication + business
 */
export type AuthenticatedHandler<TContext = unknown> = (
  request: NextRequest,
  context: BusinessAuthContext,
  routeContext?: TContext
) => Promise<NextResponse> | NextResponse;

/**
 * Handler type for admin routes
 */
export type AdminHandler<TContext = unknown> = (
  request: NextRequest,
  context: AdminAuthContext,
  routeContext?: TContext
) => Promise<NextResponse> | NextResponse;

/**
 * Handler type for routes with optional authentication
 */
export type OptionalAuthHandler<TContext = unknown> = (
  request: NextRequest,
  context: OptionalAuthContext,
  routeContext?: TContext
) => Promise<NextResponse> | NextResponse;

/**
 * Options for authentication middleware
 */
export interface AuthMiddlewareOptions {
  /** Apply rate limiting (default: true) */
  rateLimit?: boolean;
  /** Custom error message for unauthorized */
  unauthorizedMessage?: string;
  /** Custom error message for business not found */
  businessNotFoundMessage?: string;
  /** Custom error message for forbidden */
  forbiddenMessage?: string;
}

/**
 * Result of authentication check
 */
type AuthResult =
  | { success: true; user: AuthUser; supabase: SupabaseServerClient }
  | { success: false; error: NextResponse };

/**
 * Result of business lookup
 */
type BusinessResult =
  | { success: true; business: Business }
  | { success: false; error: NextResponse };

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Get authenticated user from Supabase
 */
async function getAuthenticatedUser(
  options: AuthMiddlewareOptions = {}
): Promise<AuthResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: errors.unauthorized(
          options.unauthorizedMessage ?? "Authentication required"
        ),
      };
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email ?? "",
      phone: user.phone,
      app_metadata: user.app_metadata ?? {},
      user_metadata: user.user_metadata ?? {},
    };

    return { success: true, user: authUser, supabase };
  } catch (error) {
    logError("Auth Middleware - getAuthenticatedUser", error);
    return {
      success: false,
      error: errors.internalError("Authentication check failed"),
    };
  }
}

/**
 * Get business for authenticated user
 */
async function getBusinessForUser(
  userId: string,
  options: AuthMiddlewareOptions = {}
): Promise<BusinessResult> {
  try {
    const business = await getBusinessByUserId(userId);

    if (!business) {
      return {
        success: false,
        error: errors.notFound(
          options.businessNotFoundMessage ?? "Business"
        ),
      };
    }

    return { success: true, business };
  } catch (error) {
    logError("Auth Middleware - getBusinessForUser", error);
    return {
      success: false,
      error: errors.internalError("Failed to fetch business"),
    };
  }
}

/**
 * Check if user is admin
 */
function isUserAdmin(user: AuthUser): boolean {
  return user.app_metadata?.is_admin === true;
}

// =============================================================================
// MIDDLEWARE WRAPPERS
// =============================================================================

/**
 * Middleware for dashboard routes that require authenticated user + business
 *
 * Handles:
 * - Supabase client creation
 * - User authentication check
 * - Business lookup by user ID
 * - Error responses using standardized format
 *
 * @example
 * ```ts
 * // In app/api/dashboard/calls/route.ts
 * async function handleGet(
 *   request: NextRequest,
 *   { user, business, supabase }: BusinessAuthContext
 * ) {
 *   const calls = await getCallsByBusinessId(business.id);
 *   return success({ calls });
 * }
 *
 * export const GET = withAuth(handleGet);
 * ```
 */
export function withAuth<TContext = unknown>(
  handler: AuthenticatedHandler<TContext>,
  options: AuthMiddlewareOptions = {}
): ApiHandler<TContext> {
  const { rateLimit = true } = options;

  const wrappedHandler: ApiHandler<TContext> = async (
    request: NextRequest,
    routeContext?: TContext
  ): Promise<Response> => {
    // Authenticate user
    const authResult = await getAuthenticatedUser(options);
    if (!authResult.success) {
      return authResult.error;
    }

    const { user, supabase } = authResult;

    // Get user's business
    const businessResult = await getBusinessForUser(user.id, options);
    if (!businessResult.success) {
      return businessResult.error;
    }

    const { business } = businessResult;

    // Create context and call handler
    const context: BusinessAuthContext = {
      user,
      business,
      supabase,
    };

    try {
      return await handler(request, context, routeContext);
    } catch (error) {
      logError("withAuth Handler", error);
      return errors.internalError("An unexpected error occurred");
    }
  };

  // Apply rate limiting if enabled
  if (rateLimit) {
    return withDashboardRateLimit(wrappedHandler);
  }

  return wrappedHandler;
}

/**
 * Middleware for admin routes that require admin user check
 *
 * Handles:
 * - Supabase client creation
 * - User authentication check
 * - Admin status verification from app_metadata
 * - Error responses using standardized format
 *
 * @example
 * ```ts
 * // In app/api/admin/customers/route.ts
 * async function handleGet(
 *   request: NextRequest,
 *   { user, supabase, isAdmin }: AdminAuthContext
 * ) {
 *   const customers = await getAllCustomers();
 *   return success({ customers });
 * }
 *
 * export const GET = withAdminAuth(handleGet);
 * ```
 */
export function withAdminAuth<TContext = unknown>(
  handler: AdminHandler<TContext>,
  options: AuthMiddlewareOptions = {}
): ApiHandler<TContext> {
  const { rateLimit = true } = options;

  const wrappedHandler: ApiHandler<TContext> = async (
    request: NextRequest,
    routeContext?: TContext
  ): Promise<Response> => {
    // Authenticate user
    const authResult = await getAuthenticatedUser(options);
    if (!authResult.success) {
      return authResult.error;
    }

    const { user, supabase } = authResult;

    // Check admin status
    if (!isUserAdmin(user)) {
      return errors.forbidden(
        options.forbiddenMessage ?? "Admin access required"
      );
    }

    // Create context and call handler
    const context: AdminAuthContext = {
      user,
      supabase,
      isAdmin: true,
    };

    try {
      return await handler(request, context, routeContext);
    } catch (error) {
      logError("withAdminAuth Handler", error);
      return errors.internalError("An unexpected error occurred");
    }
  };

  // Apply rate limiting if enabled (use dashboard rate limit for admin)
  if (rateLimit) {
    return withDashboardRateLimit(wrappedHandler);
  }

  return wrappedHandler;
}

/**
 * Middleware for routes that work with or without authentication
 *
 * Handles:
 * - Supabase client creation
 * - Optional user authentication (no error if not authenticated)
 * - Passes null user if not authenticated
 *
 * @example
 * ```ts
 * // In app/api/public/services/route.ts
 * async function handleGet(
 *   request: NextRequest,
 *   { user, supabase }: OptionalAuthContext
 * ) {
 *   if (user) {
 *     // Return personalized data
 *     return success({ services: await getUserServices(user.id) });
 *   }
 *   // Return public data
 *   return success({ services: await getPublicServices() });
 * }
 *
 * export const GET = withOptionalAuth(handleGet);
 * ```
 */
export function withOptionalAuth<TContext = unknown>(
  handler: OptionalAuthHandler<TContext>,
  options: AuthMiddlewareOptions = {}
): ApiHandler<TContext> {
  const { rateLimit = true } = options;

  const wrappedHandler: ApiHandler<TContext> = async (
    request: NextRequest,
    routeContext?: TContext
  ): Promise<Response> => {
    let user: AuthUser | null = null;
    let supabase: SupabaseServerClient;

    try {
      supabase = await createClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
        user = {
          id: authUser.id,
          email: authUser.email ?? "",
          phone: authUser.phone,
          app_metadata: authUser.app_metadata ?? {},
          user_metadata: authUser.user_metadata ?? {},
        };
      }
    } catch (error) {
      logError("withOptionalAuth - Supabase client creation", error);
      // Continue without auth - this is optional auth after all
      supabase = await createClient();
    }

    // Create context and call handler
    const context: OptionalAuthContext = {
      user,
      supabase,
    };

    try {
      return await handler(request, context, routeContext);
    } catch (error) {
      logError("withOptionalAuth Handler", error);
      return errors.internalError("An unexpected error occurred");
    }
  };

  // Apply public rate limiting if enabled (more permissive than dashboard)
  if (rateLimit) {
    return withPublicRateLimit(wrappedHandler);
  }

  return wrappedHandler;
}

// =============================================================================
// COMPOSITION UTILITIES
// =============================================================================

/**
 * Compose multiple middleware functions
 *
 * @example
 * ```ts
 * const handler = compose(
 *   withCsrfProtection,
 *   withAuth
 * )(myHandler);
 * ```
 */
export function compose<T extends ApiHandler>(
  ...middlewares: Array<(handler: T) => T>
): (handler: T) => T {
  return (handler: T) =>
    middlewares.reduceRight((acc, middleware) => middleware(acc), handler);
}

/**
 * Create an authenticated handler with custom rate limiting
 *
 * @example
 * ```ts
 * export const GET = withAuth(handleGet, { rateLimit: false });
 * // Then apply custom rate limiting:
 * export const POST = withAIGenerationRateLimit(withAuth(handlePost, { rateLimit: false }));
 * ```
 */

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Extract business ID from authenticated context or request params
 * Useful for routes that can operate on different businesses (admin routes)
 */
export function getBusinessIdFromContext(
  context: BusinessAuthContext,
  overrideId?: string | null
): string {
  return overrideId ?? context.business.id;
}

/**
 * Check if user owns the specified business
 */
export function userOwnsBusiness(
  user: AuthUser,
  business: Business
): boolean {
  return business.user_id === user.id;
}

/**
 * Check if user can access business (owner or admin)
 */
export function canAccessBusiness(
  user: AuthUser,
  business: Business
): boolean {
  return userOwnsBusiness(user, business) || isUserAdmin(user);
}

/**
 * Verify resource belongs to business before operations
 * Returns error response if verification fails, null if OK
 */
export function verifyResourceOwnership<T extends { business_id: string }>(
  resource: T | null,
  businessId: string,
  resourceName: string = "Resource"
): NextResponse | null {
  if (!resource) {
    return errors.notFound(resourceName);
  }

  if (resource.business_id !== businessId) {
    return errors.forbidden(`Not authorized to access this ${resourceName.toLowerCase()}`);
  }

  return null;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard to check if context has business
 */
export function hasBusinessContext(
  context: AuthContext | BusinessAuthContext
): context is BusinessAuthContext {
  return "business" in context && context.business !== undefined;
}

/**
 * Type guard to check if context is admin
 */
export function isAdminContext(
  context: AuthContext | AdminAuthContext
): context is AdminAuthContext {
  return "isAdmin" in context && context.isAdmin === true;
}

/**
 * Type guard to check if user is authenticated in optional auth context
 */
export function isAuthenticated(
  context: OptionalAuthContext
): context is AuthContext {
  return context.user !== null;
}

// =============================================================================
// RE-EXPORTS FOR CONVENIENCE
// =============================================================================

// Note: ApiHandler is already exported from ./middleware.ts via the barrel export
// Re-exporting errors and success for convenience when using auth middleware
export { errors, success } from "@/lib/api/responses";
