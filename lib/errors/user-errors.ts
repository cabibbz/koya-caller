/**
 * User-Friendly Error Messages
 * Maps technical errors to human-readable messages
 */

// =============================================================================
// ERROR MESSAGE MAPS
// =============================================================================

const DATABASE_ERROR_MESSAGES: Record<string, string> = {
  "PGRST116": "The requested item was not found.",
  "23505": "This item already exists.",
  "23503": "Cannot delete this item because it's being used elsewhere.",
  "23502": "Required information is missing.",
  "42501": "You don't have permission to perform this action.",
  "42P01": "System error. Please try again later.",
  "PGRST301": "Request was too large. Please reduce the size and try again.",
};

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "invalid_credentials": "Invalid email or password. Please try again.",
  "email_not_confirmed": "Please verify your email before signing in.",
  "user_not_found": "No account found with this email.",
  "user_already_exists": "An account with this email already exists.",
  "weak_password": "Password is too weak. Please use a stronger password.",
  "expired_token": "Your session has expired. Please sign in again.",
  "invalid_token": "Invalid verification link. Please request a new one.",
  "too_many_requests": "Too many attempts. Please wait a moment and try again.",
};

const NETWORK_ERROR_MESSAGES: Record<string, string> = {
  "ECONNREFUSED": "Unable to connect to the server. Please check your internet connection.",
  "ETIMEDOUT": "The request timed out. Please try again.",
  "ENOTFOUND": "Unable to reach the server. Please check your internet connection.",
  "NetworkError": "Network error. Please check your internet connection and try again.",
};

const _VALIDATION_ERROR_MESSAGES: Record<string, string> = {
  "invalid_email": "Please enter a valid email address.",
  "invalid_phone": "Please enter a valid phone number.",
  "invalid_url": "Please enter a valid URL.",
  "required_field": "This field is required.",
  "too_short": "This value is too short.",
  "too_long": "This value is too long.",
  "invalid_format": "The format is invalid.",
};

// =============================================================================
// ERROR CATEGORIES
// =============================================================================

export type ErrorCategory =
  | "auth"
  | "database"
  | "network"
  | "validation"
  | "permission"
  | "notFound"
  | "rateLimit"
  | "server"
  | "unknown";

export interface UserFriendlyError {
  message: string;
  category: ErrorCategory;
  action?: string;
  retryable: boolean;
}

// =============================================================================
// ERROR TRANSFORMATION
// =============================================================================

/**
 * Transform any error into a user-friendly message
 */
export function toUserFriendlyError(error: unknown): UserFriendlyError {
  // Handle null/undefined
  if (!error) {
    return {
      message: "An unexpected error occurred.",
      category: "unknown",
      retryable: true,
    };
  }

  // Handle Error objects
  if (error instanceof Error) {
    return parseErrorMessage(error.message, error.name);
  }

  // Handle string errors
  if (typeof error === "string") {
    return parseErrorMessage(error);
  }

  // Handle object errors with message property
  if (typeof error === "object" && "message" in error) {
    const code = "code" in error ? String(error.code) : undefined;
    return parseErrorMessage(String(error.message), code);
  }

  return {
    message: "An unexpected error occurred. Please try again.",
    category: "unknown",
    retryable: true,
  };
}

/**
 * Parse error message and code to create user-friendly error
 */
function parseErrorMessage(message: string, code?: string): UserFriendlyError {
  const lowerMessage = message.toLowerCase();

  // Check for auth errors
  if (code && AUTH_ERROR_MESSAGES[code]) {
    return {
      message: AUTH_ERROR_MESSAGES[code],
      category: "auth",
      retryable: code === "too_many_requests",
    };
  }

  // Check for database errors
  if (code && DATABASE_ERROR_MESSAGES[code]) {
    return {
      message: DATABASE_ERROR_MESSAGES[code],
      category: "database",
      retryable: false,
    };
  }

  // Check for network errors
  for (const [key, msg] of Object.entries(NETWORK_ERROR_MESSAGES)) {
    if (message.includes(key) || lowerMessage.includes(key.toLowerCase())) {
      return {
        message: msg,
        category: "network",
        action: "Check your internet connection",
        retryable: true,
      };
    }
  }

  // Check for common patterns
  if (lowerMessage.includes("unauthorized") || lowerMessage.includes("not authenticated")) {
    return {
      message: "Please sign in to continue.",
      category: "auth",
      action: "Sign in",
      retryable: false,
    };
  }

  if (lowerMessage.includes("forbidden") || lowerMessage.includes("not authorized")) {
    return {
      message: "You don't have permission to perform this action.",
      category: "permission",
      retryable: false,
    };
  }

  if (lowerMessage.includes("not found")) {
    return {
      message: "The requested item could not be found.",
      category: "notFound",
      retryable: false,
    };
  }

  if (lowerMessage.includes("rate limit") || lowerMessage.includes("too many")) {
    return {
      message: "Too many requests. Please wait a moment and try again.",
      category: "rateLimit",
      action: "Wait a moment",
      retryable: true,
    };
  }

  if (lowerMessage.includes("timeout") || lowerMessage.includes("timed out")) {
    return {
      message: "The request took too long. Please try again.",
      category: "network",
      retryable: true,
    };
  }

  if (lowerMessage.includes("validation") || lowerMessage.includes("invalid")) {
    return {
      message: "Please check your input and try again.",
      category: "validation",
      retryable: false,
    };
  }

  // Default server error
  return {
    message: "Something went wrong. Please try again later.",
    category: "server",
    retryable: true,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get user-friendly message from any error
 */
export function getUserErrorMessage(error: unknown): string {
  return toUserFriendlyError(error).message;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  return toUserFriendlyError(error).retryable;
}

/**
 * Get error category
 */
export function getErrorCategory(error: unknown): ErrorCategory {
  return toUserFriendlyError(error).category;
}

// =============================================================================
// TOAST HELPERS
// =============================================================================

export interface ToastError {
  title: string;
  description?: string;
  variant: "destructive";
}

/**
 * Convert error to toast notification
 */
export function errorToToast(error: unknown): ToastError {
  const userError = toUserFriendlyError(error);

  return {
    title: getCategoryTitle(userError.category),
    description: userError.message,
    variant: "destructive",
  };
}

function getCategoryTitle(category: ErrorCategory): string {
  switch (category) {
    case "auth":
      return "Authentication Error";
    case "permission":
      return "Permission Denied";
    case "notFound":
      return "Not Found";
    case "validation":
      return "Invalid Input";
    case "network":
      return "Connection Error";
    case "rateLimit":
      return "Too Many Requests";
    case "database":
    case "server":
      return "Server Error";
    default:
      return "Error";
  }
}
