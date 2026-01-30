/**
 * Database Helpers - Auth Events
 * Security logging for failed authentication detection and brute force prevention
 *
 * Uses admin client to bypass RLS as auth events are system-level security data.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { logError, logWarning } from "@/lib/logging";

// =============================================================================
// Types
// =============================================================================

export type AuthEventType = "login_success" | "login_failed" | "lockout";

export interface AuthEvent {
  id: string;
  email: string;
  event_type: AuthEventType;
  ip_address: string | null;
  user_agent: string | null;
  failure_reason: string | null;
  created_at: string;
}

export interface LogAuthEventParams {
  email: string;
  eventType: AuthEventType;
  ipAddress?: string | null;
  userAgent?: string | null;
  failureReason?: string | null;
}

// =============================================================================
// Lockout Configuration
// =============================================================================

/** Number of failed attempts before lockout */
export const LOCKOUT_THRESHOLD = 10;

/** Time window in minutes for counting failures */
export const LOCKOUT_WINDOW_MINUTES = 15;

/** Number of failures before sending an alert */
export const ALERT_THRESHOLD = 5;

// =============================================================================
// Auth Event Logging
// =============================================================================

/**
 * Log an authentication event to the database
 *
 * @param params - Event parameters
 * @returns The created auth event or null on error
 */
export async function logAuthEvent(
  params: LogAuthEventParams
): Promise<AuthEvent | null> {
  const { email, eventType, ipAddress, userAgent, failureReason } = params;

  try {
    const supabase = createAdminClient();

    // Using 'as any' to bypass Supabase type system until DB types are regenerated
    // The auth_events table is created via migration but types aren't updated yet
    const { data, error } = await (supabase as any)
      .from("auth_events")
      .insert({
        email: email.toLowerCase().trim(),
        event_type: eventType,
        ip_address: ipAddress || null,
        user_agent: userAgent ? userAgent.substring(0, 500) : null, // Truncate long user agents
        failure_reason: failureReason || null,
      })
      .select()
      .single();

    if (error) {
      logError("Auth Events", `Failed to log auth event: ${error.message}`);
      return null;
    }

    return data as AuthEvent;
  } catch (error) {
    logError("Auth Events", error);
    return null;
  }
}

// =============================================================================
// Failure Counting & Lockout Detection
// =============================================================================

/**
 * Get the count of recent login failures for an email
 *
 * @param email - The email address to check
 * @param minutes - Time window in minutes (default: 15)
 * @returns Number of failures in the time window
 */
export async function getRecentFailures(
  email: string,
  minutes: number = LOCKOUT_WINDOW_MINUTES
): Promise<number> {
  try {
    const supabase = createAdminClient();

    // Use the database function for efficient counting
    // Using 'as any' to bypass type system until DB types are regenerated
    const { data, error } = await (supabase as any).rpc("count_recent_auth_failures", {
      p_email: email.toLowerCase().trim(),
      p_minutes: minutes,
    });

    if (error) {
      logError("Auth Events", `Failed to count failures: ${error.message}`);
      // Fail open - don't block users if we can't count
      return 0;
    }

    return data as number;
  } catch (error) {
    logError("Auth Events", error);
    return 0;
  }
}

/**
 * Check if an account is locked due to too many failed attempts
 *
 * An account is considered locked if there have been 10+ failed
 * login attempts in the last 15 minutes.
 *
 * @param email - The email address to check
 * @returns true if account is locked, false otherwise
 */
export async function isAccountLocked(email: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();

    // Use the database function for efficient check
    // Using 'as any' to bypass type system until DB types are regenerated
    const { data, error } = await (supabase as any).rpc("is_account_locked", {
      p_email: email.toLowerCase().trim(),
    });

    if (error) {
      logError("Auth Events", `Failed to check lockout: ${error.message}`);
      // Fail open - don't block users if we can't check
      return false;
    }

    return data as boolean;
  } catch (error) {
    logError("Auth Events", error);
    return false;
  }
}

/**
 * Check if we should send a suspicious activity alert
 *
 * @param email - The email address to check
 * @returns true if alert should be sent (5+ failures)
 */
export async function shouldSendAlert(email: string): Promise<boolean> {
  const failures = await getRecentFailures(email, LOCKOUT_WINDOW_MINUTES);
  // Send alert when reaching exactly the threshold (to avoid duplicate alerts)
  return failures === ALERT_THRESHOLD;
}

// =============================================================================
// Admin Functions
// =============================================================================

/**
 * Get recent auth events for admin dashboard
 *
 * @param limit - Maximum number of events to return
 * @param offset - Number of events to skip
 * @returns Array of auth events
 */
export async function getRecentAuthEvents(
  limit: number = 50,
  offset: number = 0
): Promise<AuthEvent[]> {
  try {
    const supabase = createAdminClient();

    // Using 'as any' to bypass type system until DB types are regenerated
    const { data, error } = await (supabase as any)
      .from("auth_events")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logError("Auth Events", `Failed to fetch events: ${error.message}`);
      return [];
    }

    return (data || []) as AuthEvent[];
  } catch (error) {
    logError("Auth Events", error);
    return [];
  }
}

/**
 * Get auth events for a specific email (for investigating suspicious activity)
 *
 * @param email - The email address to look up
 * @param limit - Maximum number of events to return
 * @returns Array of auth events for the email
 */
export async function getAuthEventsByEmail(
  email: string,
  limit: number = 100
): Promise<AuthEvent[]> {
  try {
    const supabase = createAdminClient();

    // Using 'as any' to bypass type system until DB types are regenerated
    const { data, error } = await (supabase as any)
      .from("auth_events")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      logError("Auth Events", `Failed to fetch events by email: ${error.message}`);
      return [];
    }

    return (data || []) as AuthEvent[];
  } catch (error) {
    logError("Auth Events", error);
    return [];
  }
}

/**
 * Get suspicious patterns - emails with multiple recent failures
 *
 * @param minFailures - Minimum number of failures to be considered suspicious
 * @param hours - Time window in hours (default: 24)
 * @returns Array of suspicious email entries
 */
export async function getSuspiciousPatterns(
  minFailures: number = 3,
  hours: number = 24
): Promise<Array<{ email: string; failure_count: number; last_attempt: string }>> {
  try {
    const supabase = createAdminClient();

    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    // Using 'as any' to bypass type system until DB types are regenerated
    const { data, error } = await (supabase as any)
      .from("auth_events")
      .select("email, created_at")
      .eq("event_type", "login_failed")
      .gte("created_at", cutoffTime);

    if (error) {
      logError("Auth Events", `Failed to fetch suspicious patterns: ${error.message}`);
      return [];
    }

    // Group by email and count failures
    const emailCounts: Record<string, { count: number; lastAttempt: string }> = {};

    for (const event of (data || []) as Array<{ email: string; created_at: string }>) {
      const existing = emailCounts[event.email];
      if (existing) {
        existing.count++;
        if (event.created_at > existing.lastAttempt) {
          existing.lastAttempt = event.created_at;
        }
      } else {
        emailCounts[event.email] = { count: 1, lastAttempt: event.created_at };
      }
    }

    // Filter and format results
    const suspicious: Array<{ email: string; failure_count: number; last_attempt: string }> = [];

    for (const email of Object.keys(emailCounts)) {
      const { count, lastAttempt } = emailCounts[email];
      if (count >= minFailures) {
        suspicious.push({
          email,
          failure_count: count,
          last_attempt: lastAttempt,
        });
      }
    }

    // Sort by failure count descending
    suspicious.sort((a, b) => b.failure_count - a.failure_count);

    return suspicious;
  } catch (error) {
    logError("Auth Events", error);
    return [];
  }
}

/**
 * Manually unlock an account by clearing recent failure events
 * Note: This doesn't delete events, just marks them as resolved
 * For actual deletion, use clearAuthEventsForEmail
 *
 * @param email - The email address to unlock
 * @returns true if successful
 */
export async function unlockAccount(email: string): Promise<boolean> {
  try {
    // Log that admin unlocked the account
    await logAuthEvent({
      email,
      eventType: "login_success", // Log as success to reset the failure window
      failureReason: "admin_unlock",
    });

    logWarning("Auth Events", `Account manually unlocked: ${email}`);
    return true;
  } catch (error) {
    logError("Auth Events", error);
    return false;
  }
}

/**
 * Clear auth events older than specified days (for data retention)
 *
 * @param daysToKeep - Number of days of events to keep (default: 90)
 * @returns Number of deleted events
 */
export async function cleanupOldAuthEvents(daysToKeep: number = 90): Promise<number> {
  try {
    const supabase = createAdminClient();

    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();

    // Using 'as any' to bypass type system until DB types are regenerated
    const { data, error } = await (supabase as any)
      .from("auth_events")
      .delete()
      .lt("created_at", cutoffDate)
      .select("id");

    if (error) {
      logError("Auth Events", `Failed to cleanup old events: ${error.message}`);
      return 0;
    }

    return data?.length || 0;
  } catch (error) {
    logError("Auth Events", error);
    return 0;
  }
}
