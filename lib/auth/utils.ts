/**
 * Authentication Utilities
 * Shared utilities for authentication and authorization
 */

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

// =============================================================================
// TYPES
// =============================================================================

export interface AuthenticatedUser {
  id: string;
  email: string;
  tenantId: string | null;
  isAdmin: boolean;
  subscriptionStatus: string | null;
}

export interface AuthResult {
  user: AuthenticatedUser | null;
  error: string | null;
}

// =============================================================================
// USER EXTRACTION
// =============================================================================

/**
 * Extract authenticated user info from Supabase user
 */
export function extractUserInfo(user: User): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email || "",
    tenantId: user.app_metadata?.tenant_id || null,
    isAdmin: user.app_metadata?.is_admin === true,
    subscriptionStatus: user.app_metadata?.subscription_status || null,
  };
}

/**
 * Get authenticated user from request
 * Returns null if not authenticated
 */
export async function getAuthenticatedUser(): Promise<AuthResult> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return { user: null, error: error?.message || "Not authenticated" };
    }

    return { user: extractUserInfo(user), error: null };
  } catch (_error) {
    return { user: null, error: "Authentication check failed" };
  }
}

/**
 * Require authenticated user - redirects to login if not authenticated
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const { user, error: _error } = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

/**
 * Require authenticated user with tenant - redirects to onboarding if no tenant
 */
export async function requireTenant(): Promise<AuthenticatedUser> {
  const user = await requireAuth();

  if (!user.tenantId) {
    redirect("/onboarding");
  }

  return user;
}

/**
 * Require admin user - redirects to dashboard if not admin
 */
export async function requireAdmin(): Promise<AuthenticatedUser> {
  const user = await requireAuth();

  if (!user.isAdmin) {
    redirect("/dashboard");
  }

  return user;
}

// =============================================================================
// AUTHORIZATION CHECKS
// =============================================================================

/**
 * Check if user can access a specific tenant's data
 */
export function canAccessTenant(user: AuthenticatedUser, tenantId: string): boolean {
  // Admins can access any tenant
  if (user.isAdmin) return true;

  // Users can only access their own tenant
  return user.tenantId === tenantId;
}

/**
 * Check if user has active subscription
 */
export function hasActiveSubscription(user: AuthenticatedUser): boolean {
  return user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing";
}

/**
 * Check if user can perform admin actions
 */
export function canPerformAdminActions(user: AuthenticatedUser): boolean {
  return user.isAdmin === true;
}

// =============================================================================
// API ROUTE HELPERS
// =============================================================================

/**
 * Validate user authentication for API routes
 * Returns user info or throws error response
 */
export async function validateApiAuth(): Promise<AuthenticatedUser> {
  const { user, error: _error } = await getAuthenticatedUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}

/**
 * Validate admin access for API routes
 */
export async function validateApiAdmin(): Promise<AuthenticatedUser> {
  const user = await validateApiAuth();

  if (!user.isAdmin) {
    throw new Error("Forbidden");
  }

  return user;
}

/**
 * Validate tenant access for API routes
 */
export async function validateApiTenant(): Promise<AuthenticatedUser> {
  const user = await validateApiAuth();

  if (!user.tenantId) {
    throw new Error("Tenant required");
  }

  return user;
}
