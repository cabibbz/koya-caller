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
import { headers } from "next/headers";

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

  if (data.password.length < 8) {
    return {
      success: false,
      error: "Password must be at least 8 characters.",
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
    return {
      success: false,
      error: signUpError.message,
    };
  }

  if (!authData.user) {
    return {
      success: false,
      error: "Failed to create account. Please try again.",
    };
  }

  // Create business record and set tenant_id
  // This must be done with admin client to set app_metadata
  const adminClient = createAdminClient();

  // Insert into users table
  // Note: Using type assertion due to Supabase generic type inference limitations
  const { error: userInsertError } = await adminClient
    .from("users")
    .insert({
      id: authData.user.id,
      email: data.email,
      phone: formatPhoneNumber(data.phone),
    } as any);

  if (userInsertError) {
    // Don't fail signup, user can still proceed
  }

  // Create business record
  // Schema: businesses table from Session 2 (Part 9, Lines 876-907)
  // Note: Using type assertion due to Supabase generic type inference limitations
  const { data: businessData, error: businessError } = await adminClient
    .from("businesses")
    .insert({
      user_id: authData.user.id,
      name: data.businessName,
      onboarding_step: 1, // Starting onboarding
      subscription_status: "onboarding",
    } as any)
    .select("id")
    .single() as { data: { id: string } | null; error: any };

  if (businessError || !businessData) {
    return {
      success: false,
      error: "Failed to create business. Please contact support.",
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
        subscription_status: "trial", // Start in trial mode
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
 */
export async function login(data: LoginData): Promise<AuthResult> {
  const ip = await getClientIP();
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

  const supabase = await createClient();

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });

  if (error) {
    return {
      success: false,
      error: "Invalid email or password.",
    };
  }

  revalidatePath("/", "layout");

  // Determine redirect based on user status
  const tenantId = authData.user?.app_metadata?.tenant_id;
  const subscriptionStatus = authData.user?.app_metadata?.subscription_status;

  if (!tenantId) {
    // User hasn't completed initial setup
    return {
      success: true,
      redirectTo: "/onboarding",
    };
  }

  // Check if they're a paid subscriber
  if (subscriptionStatus === "active" || subscriptionStatus === "trialing") {
    return {
      success: true,
      redirectTo: "/dashboard",
    };
  }

  // User has business but hasn't subscribed yet
  return {
    success: true,
    redirectTo: "/onboarding",
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
  if (!newPassword || newPassword.length < 8) {
    return {
      success: false,
      error: "Password must be at least 8 characters.",
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
