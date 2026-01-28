/**
 * Standardized API Response Utilities
 * Consistent response format across all API routes
 */

import { NextResponse } from "next/server";
import { API_CONFIG } from "@/lib/config";

// =============================================================================
// RESPONSE TYPES
// =============================================================================

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// =============================================================================
// ERROR CODES
// =============================================================================

export enum ErrorCode {
  // Client errors (4xx)
  BAD_REQUEST = "BAD_REQUEST",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  METHOD_NOT_ALLOWED = "METHOD_NOT_ALLOWED",
  CONFLICT = "CONFLICT",
  UNPROCESSABLE_ENTITY = "UNPROCESSABLE_ENTITY",
  RATE_LIMITED = "RATE_LIMITED",

  // Server errors (5xx)
  INTERNAL_ERROR = "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  GATEWAY_TIMEOUT = "GATEWAY_TIMEOUT",

  // Business logic errors
  VALIDATION_ERROR = "VALIDATION_ERROR",
  AUTHENTICATION_REQUIRED = "AUTHENTICATION_REQUIRED",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
  RESOURCE_EXISTS = "RESOURCE_EXISTS",
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  QUOTA_EXCEEDED = "QUOTA_EXCEEDED",
  FEATURE_DISABLED = "FEATURE_DISABLED",

  // External service errors
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
  PAYMENT_FAILED = "PAYMENT_FAILED",
  WEBHOOK_FAILED = "WEBHOOK_FAILED",
}

// Map error codes to HTTP status codes
const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  [ErrorCode.BAD_REQUEST]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.METHOD_NOT_ALLOWED]: 405,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.UNPROCESSABLE_ENTITY]: 422,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.GATEWAY_TIMEOUT]: 504,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.AUTHENTICATION_REQUIRED]: 401,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
  [ErrorCode.RESOURCE_EXISTS]: 409,
  [ErrorCode.RESOURCE_NOT_FOUND]: 404,
  [ErrorCode.QUOTA_EXCEEDED]: 429,
  [ErrorCode.FEATURE_DISABLED]: 403,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
  [ErrorCode.PAYMENT_FAILED]: 402,
  [ErrorCode.WEBHOOK_FAILED]: 400,
};

// =============================================================================
// RESPONSE HELPERS
// =============================================================================

/**
 * Create a successful API response
 */
export function success<T>(
  data: T,
  meta?: ApiSuccessResponse["meta"]
): NextResponse<ApiSuccessResponse<T>> {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
  };

  if (meta) {
    response.meta = meta;
  }

  return NextResponse.json(response, {
    status: 200,
    headers: {
      "X-API-Version": API_CONFIG.version,
    },
  });
}

/**
 * Create a successful response for resource creation
 */
export function created<T>(data: T): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    { success: true, data } as ApiSuccessResponse<T>,
    {
      status: 201,
      headers: {
        "X-API-Version": API_CONFIG.version,
      },
    }
  );
}

/**
 * Create a successful response for sensitive data (prevents caching)
 * Use for API keys, secrets, tokens, etc.
 */
export function successSensitive<T>(
  data: T,
  meta?: ApiSuccessResponse["meta"]
): NextResponse<ApiSuccessResponse<T>> {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
  };

  if (meta) {
    response.meta = meta;
  }

  return NextResponse.json(response, {
    status: 200,
    headers: {
      "X-API-Version": API_CONFIG.version,
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}

/**
 * Create a successful response with no content
 */
export function noContent(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "X-API-Version": API_CONFIG.version,
    },
  });
}

/**
 * Create an error API response
 */
export function error(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
  const status = ERROR_STATUS_MAP[code] || 500;

  const response: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (details) {
    response.error.details = details;
  }

  return NextResponse.json(response, {
    status,
    headers: {
      "X-API-Version": API_CONFIG.version,
    },
  });
}

// =============================================================================
// CONVENIENCE ERROR HELPERS
// =============================================================================

export const errors = {
  badRequest: (message = "Bad request", details?: Record<string, unknown>) =>
    error(ErrorCode.BAD_REQUEST, message, details),

  unauthorized: (message = "Authentication required") =>
    error(ErrorCode.UNAUTHORIZED, message),

  forbidden: (message = "Access denied") =>
    error(ErrorCode.FORBIDDEN, message),

  notFound: (resource = "Resource") =>
    error(ErrorCode.NOT_FOUND, `${resource} not found`),

  methodNotAllowed: (allowed: string[]) =>
    error(ErrorCode.METHOD_NOT_ALLOWED, `Method not allowed. Use: ${allowed.join(", ")}`),

  conflict: (message = "Resource already exists") =>
    error(ErrorCode.CONFLICT, message),

  validationError: (message: string, details?: Record<string, unknown>) =>
    error(ErrorCode.VALIDATION_ERROR, message, details),

  rateLimited: (retryAfter?: number) =>
    error(ErrorCode.RATE_LIMITED, "Too many requests. Please try again later.", {
      retryAfter,
    }),

  internalError: (message = "An unexpected error occurred") =>
    error(ErrorCode.INTERNAL_ERROR, message),

  serviceUnavailable: (service?: string) =>
    error(
      ErrorCode.SERVICE_UNAVAILABLE,
      service ? `${service} is temporarily unavailable` : "Service temporarily unavailable"
    ),

  quotaExceeded: (resource = "quota") =>
    error(ErrorCode.QUOTA_EXCEEDED, `${resource} exceeded`),

  featureDisabled: (feature: string) =>
    error(ErrorCode.FEATURE_DISABLED, `${feature} is not enabled`),

  externalServiceError: (service: string, details?: Record<string, unknown>) =>
    error(ErrorCode.EXTERNAL_SERVICE_ERROR, `${service} error`, details),

  paymentFailed: (message = "Payment failed") =>
    error(ErrorCode.PAYMENT_FAILED, message),
};

// =============================================================================
// PAGINATION HELPERS
// =============================================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export function parsePagination(
  searchParams: URLSearchParams
): Required<PaginationParams> {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    API_CONFIG.pagination.maxLimit,
    Math.max(1, parseInt(searchParams.get("limit") || String(API_CONFIG.pagination.defaultLimit), 10))
  );

  return { page, limit };
}

export function paginationMeta(
  page: number,
  limit: number,
  total: number
): ApiSuccessResponse["meta"] {
  return {
    page,
    limit,
    total,
    hasMore: page * limit < total,
  };
}

// =============================================================================
// REQUEST VALIDATION
// =============================================================================

/**
 * Validate required fields in request body
 */
export function validateRequired<T extends Record<string, unknown>>(
  body: T,
  required: (keyof T)[]
): { valid: boolean; missing: string[] } {
  const missing = required.filter(
    (field) => body[field] === undefined || body[field] === null || body[field] === ""
  );

  return {
    valid: missing.length === 0,
    missing: missing as string[],
  };
}
