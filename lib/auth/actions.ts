/**
 * Authentication Server Actions
 * 
 * Spec Reference:
 * - Part 4, Lines 172-176: Account Creation fields
 *   - Email
 *   - Password
 *   - Business name
 *   - Your phone number (for transfers & SMS alerts)
 * - Part 10, Lines 1200-1207: Setting tenant_id on signup
 */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logging";
import { headers } from "next/headers";
import {
  logAuthEvent,
  isAccountLocked,
  getRecentFailures,
  ALERT_THRESHOLD,
  LOCKOUT_THRESHOLD,
} from "@/lib/db/auth-events";
import { inngest } from "@/lib/inngest";

// =============================================================================
// Types
// =============================================================================

export interface SignupData {
  email: string;
  password: string;
  businessName: string;
  phone: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  redirectTo?: string;
}

// =============================================================================
// Rate Limiting (Session 6: Upstash Redis)
// =============================================================================

import { checkRateLimit } from "@/lib/rate-limit";

async function getClientIP(): Promise<string> {
  const headersList = await headers();
  const forwarded = headersList.get("x-forwarded-for");
  const realIp = headersList.get("x-real-ip");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  if (realIp) {
    return realIp;
  }
  return "unknown";
}

async function getUserAgent(): Promise<string | null> {
  const headersList = await headers();
  return headersList.get("user-agent");
}

// =============================================================================
// Signup Action
// =============================================================================

/**
 * Sign up a new user and create their business
 * 
 * Flow:
 * 1. Validate input
 * 2. Check rate limit
 * 3. Create auth user
 * 4. Create business record
 * 5. Set tenant_id in user's app_metadata
 * 6. Redirect to onboarding
 */
export async function signup(data: SignupData): Promise<AuthResult> {
  const ip = await getClientIP();
  const rateLimitResult = await checkRateLimit("auth", ip);

  if (!rateLimitResult.success) {
    return {
      success: false,
      error: `Too many attempts. Please try again in ${rateLimitResult.retryAfter} seconds.`,
    };
  }

  // Validate input
  if (!data.email || !data.password || !data.businessName || !data.phone) {
    return {
      success: false,
      error: "All fields are required.",
    };
  }

  // Strong password policy: min 12 chars, uppercase, lowercase, number, special char
  const passwordValidation = validatePassword(data.password);
  if (!passwordValidation.valid) {
    return {
      success: false,
      error: passwordValidation.error,
    };
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email)) {
    return {
      success: false,
      error: "Please enter a valid email address.",
    };
  }

  // Validate phone format (basic)
  const phoneDigits = data.phone.replace(/\D/g, "");
  if (phoneDigits.length < 10) {
    return {
      success: false,
      error: "Please enter a valid phone number.",
    };
  }

  const supabase = await createClient();

  // Create auth user
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      data: {
        // Store initial user data (readable but not for access control)
        business_name: data.businessName,
        phone: data.phone,
      },
    },
  });

  if (signUpError) {
    // Check for existing account errors
    if (signUpError.message.includes("already registered") ||
        signUpError.message.includes("already been registered") ||
        signUpError.message.includes("User already exists")) {
      return {
        success: false,
        error: "An account with this email already exists. Please log in instead.",
      };
    }
    return {
      success: false,
      error: signUpError.message,
    };
  }

  // Supabase may return a user without error but with identities = [] if email exists
  if (!authData.user || (authData.user.identities && authData.user.identities.length === 0)) {
    return {
      success: false,
      error: "An account with this email already exists. Please log in instead.",
    };
  }

  // Create business record and set tenant_id
  // This must be done with admin client to set app_metadata
  const adminClient = createAdminClient();

  // Insert into users table (required for businesses foreign key)
  // First, clean up any orphaned record from previous failed signup attempts
  await adminClient
    .from("users")
    .delete()
    .eq("email", data.email);

  // Also clean up any orphaned business records
  await adminClient
    .from("businesses")
    .delete()
    .eq("user_id", authData.user.id);

  // Now insert the user record
  const { error: userInsertError } = await adminClient
    .from("users")
    .insert({
      id: authData.user.id,
      email: data.email,
      phone: formatPhoneNumber(data.phone),
    } as any);

  if (userInsertError) {
    logError("Signup User Insert", userInsertError);
    // Check for duplicate email
    if (userInsertError.code === "23505" && userInsertError.message.includes("email")) {
      return {
        success: false,
        error: "An account with this email already exists. Please log in instead.",
      };
    }
    return {
      success: false,
      error: "Failed to create account. Please try again or contact support.",
    };
  }

  // Create business record with trial period
  // Schema: businesses table from Session 2 (Part 9, Lines 876-907)
  // Trial: 14 days from signup with 30 minutes limit
  // Note: Using type assertion due to Supabase generic type inference limitations
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14-day trial

  const { data: businessData, error: businessError } = await adminClient
    .from("businesses")
    .insert({
      user_id: authData.user.id,
      name: data.businessName,
      onboarding_step: 1, // Starting onboarding
      subscription_status: "trialing", // Start in trial mode
      trial_ends_at: trialEndsAt.toISOString(),
      trial_minutes_limit: 30, // 30 minutes included in trial
      trial_minutes_used: 0,
    } as any)
    .select("id")
    .single() as { data: { id: string } | null; error: any };

  if (businessError || !businessData) {
    logError("Signup Business Creation", businessError);
    // Check for foreign key violation (user doesn't exist)
    if (businessError?.code === "23503") {
      return {
        success: false,
        error: "An account with this email already exists. Please log in instead.",
      };
    }
    return {
      success: false,
      error: "Failed to create account. Please try again or contact support.",
    };
  }

  /**
   * Set tenant_id in user's app_metadata
   *
   * Spec Reference: Part 10, Lines 1200-1207
   * This is critical for RLS policies to work correctly
   */
  const { error: updateError } = await adminClient.auth.admin.updateUserById(
    authData.user.id,
    {
      app_metadata: {
        tenant_id: businessData.id,
        subscription_status: "trialing", // Start in trial mode
        trial_ends_at: trialEndsAt.toISOString(),
      },
    }
  );

  if (updateError) {
    return {
      success: false,
      error: "Failed to configure account. Please contact support.",
    };
  }

  revalidatePath("/", "layout");

  return {
    success: true,
    redirectTo: "/onboarding",
  };
}

// =============================================================================
// Login Action
// =============================================================================

/**
 * Log in an existing user
 *
 * Includes security logging for:
 * - Successful logins
 * - Failed login attempts with reason
 * - Account lockout after too many failures
 * - Alerts on suspicious activity
 */
export async function login(data: LoginData): Promise<AuthResult> {
  const ip = await getClientIP();
  const userAgent = await getUserAgent();
  const rateLimitResult = await checkRateLimit("auth", ip);

  if (!rateLimitResult.success) {
    return {
      success: false,
      error: `Too many attempts. Please try again in ${rateLimitResult.retryAfter} seconds.`,
    };
  }

  if (!data.email || !data.password) {
    return {
      success: false,
      error: "Email and password are required.",
    };
  }

  const normalizedEmail = data.email.toLowerCase().trim();

  // Check if account is locked due to too many failed attempts
  const locked = await isAccountLocked(normalizedEmail);
  if (locked) {
    // Log the lockout event
    await logAuthEvent({
      email: normalizedEmail,
      eventType: "lockout",
      ipAddress: ip,
      userAgent,
      failureReason: "account_locked",
    });

    return {
      success: false,
      error: "This account has been temporarily locked due to too many failed login attempts. Please try again in 15 minutes or reset your password.",
    };
  }

  const supabase = await createClient();

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });

  if (error) {
    // Check if email is not confirmed
    if (error.message === "Email not confirmed") {
      return {
        success: false,
        error: "Please verify your email address before signing in. Check your inbox for the confirmation link.",
      };
    }

    // Log the failed login attempt
    await logAuthEvent({
      email: normalizedEmail,
      eventType: "login_failed",
      ipAddress: ip,
      userAgent,
      failureReason: error.message === "Invalid login credentials"
        ? "invalid_credentials"
        : error.message,
    });

    // Check if we should send a suspicious activity alert
    const failureCount = await getRecentFailures(normalizedEmail);

    // Send alert when reaching the threshold
    if (failureCount === ALERT_THRESHOLD) {
      try {
        await inngest.send({
          name: "auth/suspicious-activity.detected",
          data: {
            email: normalizedEmail,
            failureCount,
            ipAddress: ip,
            userAgent,
            triggeredAt: new Date().toISOString(),
          },
        });
      } catch {
        // Don't fail login flow if alert fails
      }
    }

    // Check if this attempt caused a lockout
    if (failureCount >= LOCKOUT_THRESHOLD) {
      return {
        success: false,
        error: "This account has been temporarily locked due to too many failed login attempts. Please try again in 15 minutes or reset your password.",
      };
    }

    return {
      success: false,
      error: "Invalid email or password.",
    };
  }

  // Log successful login
  await logAuthEvent({
    email: normalizedEmail,
    eventType: "login_success",
    ipAddress: ip,
    userAgent,
  });

  revalidatePath("/", "layout");

  // Determine redirect based on user status
  const tenantId = authData.user?.app_metadata?.tenant_id;

  if (!tenantId) {
    // User hasn't completed initial setup
    return {
      success: true,
      redirectTo: "/welcome",
    };
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
    return {
      success: true,
      redirectTo: "/welcome",
    };
  }

  // User is fully set up - go to dashboard
  return {
    success: true,
    redirectTo: "/dashboard",
  };
}

// =============================================================================
// Logout Action
// =============================================================================

/**
 * Sign out the current user
 */
export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

// =============================================================================
// Password Reset Actions
// =============================================================================

/**
 * Request a password reset email
 */
export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const ip = await getClientIP();
  const rateLimitResult = await checkRateLimit("passwordReset", ip);

  if (!rateLimitResult.success) {
    return {
      success: false,
      error: `Too many attempts. Please try again in ${Math.ceil(rateLimitResult.retryAfter! / 60)} minutes.`,
    };
  }

  if (!email) {
    return {
      success: false,
      error: "Email is required.",
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
  });

  if (error) {
    // Don't reveal if email exists or not
    return {
      success: true, // Always return success to prevent email enumeration
    };
  }

  return {
    success: true,
  };
}

/**
 * Update password after reset
 */
export async function updatePassword(newPassword: string): Promise<AuthResult> {
  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.valid) {
    return {
      success: false,
      error: passwordValidation.error,
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    return {
      success: false,
      error: "Failed to update password. Please try again.",
    };
  }

  revalidatePath("/", "layout");

  return {
    success: true,
    redirectTo: "/dashboard",
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Validate password strength
 * Requirements: min 12 chars, uppercase, lowercase, number, special character
 */
function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password) {
    return { valid: false, error: "Password is required." };
  }

  if (password.length < 12) {
    return { valid: false, error: "Password must be at least 12 characters." };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one uppercase letter." };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one lowercase letter." };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one number." };
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one special character." };
  }

  // Check for common weak passwords
  const commonPasswords = [
    "password123!", "Password123!", "Welcome123!", "Qwerty123456!",
    "Admin123456!", "Letmein12345!", "Password1234!"
  ];
  if (commonPasswords.some(p => password.toLowerCase() === p.toLowerCase())) {
    return { valid: false, error: "This password is too common. Please choose a stronger password." };
  }

  return { valid: true };
}

/**
 * Format phone number to E.164 format
 * Input: (555) 123-4567 or 5551234567 or +1-555-123-4567
 * Output: +15551234567
 */
function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // If it starts with 1 and is 11 digits, it's already US format
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  // If it's 10 digits, assume US and add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // Otherwise return as-is with + prefix
  return `+${digits}`;
}

// =============================================================================
// Get Current User
// =============================================================================

/**
 * Get the current authenticated user
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Get the current user's business
 */
export async function getCurrentBusiness() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.app_metadata?.tenant_id) {
    return null;
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", user.app_metadata.tenant_id)
    .single();

  return business;
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<AuthResult> {
  const supabase = await createClient();
  
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  revalidatePath("/", "layout");
  
  return {
    success: true,
    redirectTo: "/login",
  };
}
