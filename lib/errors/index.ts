/**
 * Koya Caller - Error Handling Utilities
 * Session 23: Error Handling & Fallbacks
 *
 * Centralized error handling for:
 * - Retell API failures
 * - Twilio provisioning failures
 * - Calendar token expiration
 * - Claude API failures
 *
 * Logs to system_logs table for admin visibility
 */

import { createAdminClient } from "@/lib/supabase/admin";

// =============================================================================
// Error Types
// =============================================================================

export type ErrorCategory =
  | "retell"
  | "twilio"
  | "stripe"
  | "calendar"
  | "claude"
  | "webhook"
  | "api"
  | "database";

export type ErrorLevel = "error" | "warning" | "info";

export interface SystemError {
  level: ErrorLevel;
  category: ErrorCategory;
  message: string;
  details?: Record<string, unknown>;
  businessId?: string;
  callId?: string;
}

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryIf?: (error: unknown) => boolean;
}

// =============================================================================
// Error Logging
// =============================================================================

/**
 * Log an error to the system_logs table
 */
export async function logSystemError(error: SystemError): Promise<void> {
  try {
    const supabase = createAdminClient();

    await (supabase as any).from("system_logs").insert({
      level: error.level,
      category: error.category,
      message: error.message,
      details: error.details || null,
      business_id: error.businessId || null,
      call_id: error.callId || null,
    });

    // Error handled silently
  } catch {
    // Don't throw - logging failures shouldn't break the app
  }
}

/**
 * Log a warning to the system_logs table
 */
export async function logSystemWarning(
  category: ErrorCategory,
  message: string,
  details?: Record<string, unknown>,
  businessId?: string
): Promise<void> {
  await logSystemError({
    level: "warning",
    category,
    message,
    details,
    businessId,
  });
}

/**
 * Log info to the system_logs table
 */
export async function logSystemInfo(
  category: ErrorCategory,
  message: string,
  details?: Record<string, unknown>,
  businessId?: string
): Promise<void> {
  await logSystemError({
    level: "info",
    category,
    message,
    details,
    businessId,
  });
}

// =============================================================================
// Retry Logic
// =============================================================================

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with exponential backoff retry
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    retryIf = () => true,
  } = options;

  let lastError: unknown;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !retryIf(error)) {
        throw error;
      }

      await sleep(delay);
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError;
}

// =============================================================================
// Retell Error Handling
// =============================================================================

export interface RetellError {
  code?: string;
  message: string;
  status?: number;
}

/**
 * Check if an error is a Retell API error
 */
export function isRetellError(error: unknown): error is RetellError {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  );
}

/**
 * Check if a Retell error is retryable
 */
export function isRetellRetryable(error: unknown): boolean {
  if (!isRetellError(error)) return false;

  // Retry on rate limits and server errors
  const status = (error as any).status;
  if (status === 429) return true; // Rate limited
  if (status >= 500 && status < 600) return true; // Server errors

  return false;
}

/**
 * Handle Retell API failure
 */
export async function handleRetellFailure(
  error: unknown,
  context: { businessId?: string; callId?: string; action: string }
): Promise<void> {
  const message = isRetellError(error) ? error.message : String(error);

  await logSystemError({
    level: "error",
    category: "retell",
    message: `Retell ${context.action} failed: ${message}`,
    details: {
      action: context.action,
      error: message,
      code: isRetellError(error) ? error.code : undefined,
    },
    businessId: context.businessId,
    callId: context.callId,
  });
}

// =============================================================================
// Twilio Error Handling
// =============================================================================

export interface TwilioError {
  code?: number;
  message: string;
  moreInfo?: string;
  status?: number;
}

/**
 * Check if an error is a Twilio API error
 */
export function isTwilioError(error: unknown): error is TwilioError {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    ("code" in error || "status" in error)
  );
}

/**
 * Check if a Twilio error is retryable
 */
export function isTwilioRetryable(error: unknown): boolean {
  if (!isTwilioError(error)) return false;

  // Twilio-specific retryable codes
  const retryableCodes = [
    20429, // Rate limit
    31005, // Connection error
    31200, // Temporary failure
    31486, // Busy line
  ];

  if (error.code && retryableCodes.includes(error.code)) return true;

  // Also retry on 5xx status codes
  if (error.status && error.status >= 500 && error.status < 600) return true;

  return false;
}

/**
 * Handle Twilio provisioning failure
 */
export async function handleTwilioProvisioningFailure(
  error: unknown,
  context: { businessId?: string; phoneNumber?: string; action: string }
): Promise<void> {
  const message = isTwilioError(error) ? error.message : String(error);

  await logSystemError({
    level: "error",
    category: "twilio",
    message: `Twilio ${context.action} failed: ${message}`,
    details: {
      action: context.action,
      phoneNumber: context.phoneNumber,
      error: message,
      code: isTwilioError(error) ? error.code : undefined,
      moreInfo: isTwilioError(error) ? error.moreInfo : undefined,
    },
    businessId: context.businessId,
  });
}

// =============================================================================
// Claude Error Handling
// =============================================================================

export interface ClaudeError {
  type?: string;
  message: string;
  status?: number;
}

/**
 * Check if an error is a Claude API error
 */
export function isClaudeError(error: unknown): error is ClaudeError {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  );
}

/**
 * Check if a Claude error is retryable
 */
export function isClaudeRetryable(error: unknown): boolean {
  if (!isClaudeError(error)) return false;

  // Retry on overloaded and rate limit errors
  const type = (error as any).type;
  if (type === "overloaded_error") return true;
  if (type === "rate_limit_error") return true;

  // Also retry on 5xx status codes
  const status = (error as any).status;
  if (status && status >= 500 && status < 600) return true;

  return false;
}

/**
 * Handle Claude API failure
 */
export async function handleClaudeFailure(
  error: unknown,
  context: { businessId?: string; action: string }
): Promise<void> {
  const message = isClaudeError(error) ? error.message : String(error);

  await logSystemError({
    level: "error",
    category: "claude",
    message: `Claude ${context.action} failed: ${message}`,
    details: {
      action: context.action,
      error: message,
      type: isClaudeError(error) ? error.type : undefined,
    },
    businessId: context.businessId,
  });
}

// =============================================================================
// Calendar Error Handling
// =============================================================================

export interface CalendarError {
  code?: string;
  message: string;
  status?: number;
}

/**
 * Check if a calendar error indicates token expiration
 */
export function isTokenExpiredError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const message = (error as any).message?.toLowerCase() || "";
  const code = (error as any).code;

  // Google Calendar token expiration
  if (code === "invalid_grant") return true;
  if (message.includes("token has been expired")) return true;
  if (message.includes("token has been revoked")) return true;

  // Outlook token expiration
  if (code === "InvalidAuthenticationToken") return true;
  if (message.includes("access token has expired")) return true;

  return false;
}

/**
 * Handle calendar token expiration
 */
export async function handleCalendarTokenExpiration(
  error: unknown,
  context: { businessId: string; provider: "google" | "outlook" }
): Promise<void> {
  await logSystemError({
    level: "warning",
    category: "calendar",
    message: `Calendar token expired for ${context.provider}`,
    details: {
      provider: context.provider,
      error: isClaudeError(error) ? error.message : String(error),
    },
    businessId: context.businessId,
  });

  // Clear tokens to force re-authentication
  const supabase = createAdminClient();
  await (supabase as any)
    .from("calendar_integrations")
    .update({
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", context.businessId);
}

// =============================================================================
// Webhook Error Handling
// =============================================================================

/**
 * Handle webhook processing failure
 */
export async function handleWebhookFailure(
  error: unknown,
  context: {
    provider: string;
    eventType?: string;
    businessId?: string;
  }
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);

  await logSystemError({
    level: "error",
    category: "webhook",
    message: `Webhook from ${context.provider} failed: ${message}`,
    details: {
      provider: context.provider,
      eventType: context.eventType,
      error: message,
    },
    businessId: context.businessId,
  });
}

// =============================================================================
// Fallback Utilities
// =============================================================================

/**
 * Execute with fallback - try main function, fall back to backup on failure
 */
export async function withFallback<T>(
  main: () => Promise<T>,
  fallback: () => Promise<T>,
  options?: { logCategory?: ErrorCategory; logMessage?: string }
): Promise<T> {
  try {
    return await main();
  } catch (error) {
    if (options?.logCategory) {
      await logSystemWarning(
        options.logCategory,
        options.logMessage || "Main function failed, using fallback",
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
    return await fallback();
  }
}

/**
 * Execute with timeout
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  errorMessage = "Operation timed out"
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}
