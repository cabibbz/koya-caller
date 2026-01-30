/**
 * Authentication Types
 * 
 * Spec Reference: Part 10, Lines 1184-1207 (JWT app_metadata structure)
 */

import { User } from "@supabase/supabase-js";

/**
 * Extended User type with our custom app_metadata fields
 */
export interface KoyaUser extends User {
  app_metadata: {
    /** Business ID - used for RLS policies */
    tenant_id?: string;
    /** Subscription status */
    subscription_status?: "trial" | "active" | "past_due" | "canceled" | "unpaid";
    /** Stripe customer ID */
    stripe_customer_id?: string;
    /** Is admin user */
    is_admin?: boolean;
    /** Provider (for OAuth) */
    provider?: string;
    /** Other Supabase defaults */
    [key: string]: unknown;
  };
  user_metadata: {
    /** Business name captured at signup */
    business_name?: string;
    /** Phone number captured at signup */
    phone?: string;
    /** Full name (if provided) */
    full_name?: string;
    /** Avatar URL (if provided) */
    avatar_url?: string;
    /** Other metadata */
    [key: string]: unknown;
  };
}

/**
 * Session with typed user
 */
export interface KoyaSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: string;
  user: KoyaUser;
}

/**
 * Auth state for client-side hooks
 */
export interface AuthState {
  user: KoyaUser | null;
  session: KoyaSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  tenantId: string | null;
  isAdmin: boolean;
}

/**
 * Signup form data
 * Spec Reference: Part 4, Lines 172-176
 */
export interface SignupFormData {
  email: string;
  password: string;
  businessName: string;
  phone: string;
}

/**
 * Login form data
 */
export interface LoginFormData {
  email: string;
  password: string;
}

/**
 * Auth action result
 */
export interface AuthActionResult {
  success: boolean;
  error?: string;
  redirectTo?: string;
}
