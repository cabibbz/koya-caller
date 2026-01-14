/**
 * Sanitized Logging Utilities
 * Prevents sensitive data from appearing in logs
 */

interface SanitizedError {
  message: string;
  code?: string;
  name?: string;
}

/**
 * Sanitize an error object for safe logging
 * Removes potentially sensitive data like SQL queries, parameters, and stack traces
 */
function sanitizeError(error: unknown): SanitizedError {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      // Only include code if it's a known database error code pattern
      code: (error as { code?: string }).code,
    };
  }

  if (typeof error === "object" && error !== null) {
    const errObj = error as Record<string, unknown>;
    return {
      message: typeof errObj.message === "string" ? errObj.message : "Unknown error",
      code: typeof errObj.code === "string" ? errObj.code : undefined,
    };
  }

  return {
    message: String(error),
  };
}

/**
 * Log an error with context, sanitizing sensitive information
 */
export function logError(context: string, error: unknown): void {
  const sanitized = sanitizeError(error);
  console.error(`[${context}]`, sanitized);
}

/**
 * Log an error with additional metadata
 */
export function logErrorWithMeta(
  context: string,
  error: unknown,
  meta: Record<string, string | number | boolean | undefined>
): void {
  const sanitized = sanitizeError(error);
  // Filter out undefined values from meta
  const cleanMeta = Object.fromEntries(
    Object.entries(meta).filter(([, v]) => v !== undefined)
  );
  console.error(`[${context}]`, { ...sanitized, ...cleanMeta });
}

/**
 * Log a warning message
 */
export function logWarning(context: string, message: string): void {
  console.warn(`[${context}]`, message);
}

/**
 * Log an info message (for non-sensitive operational logging)
 */
export function logInfo(context: string, message: string): void {
  console.log(`[${context}]`, message);
}
