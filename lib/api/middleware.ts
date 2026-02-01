/**
 * API Middleware Utilities
 * Shared middleware for API routes
 */

import { NextRequest, NextResponse } from "next/server";
import { API_CONFIG } from "@/lib/config";
import { errors } from "./responses";
import { logError } from "@/lib/logging";
import { validateCsrfToken } from "@/lib/security";

// =============================================================================
// TYPES
// =============================================================================

export type ApiHandler = (
  request: NextRequest,
  context?: { params?: Record<string, string> }
) => Promise<NextResponse>;

export interface MiddlewareOptions {
  // Authentication
  requireAuth?: boolean;
  requireAdmin?: boolean;

  // CSRF protection
  requireCsrf?: boolean;

  // Rate limiting
  rateLimit?: keyof typeof API_CONFIG.rateLimits;

  // Request validation
  allowedMethods?: string[];

  // Deprecation
  deprecated?: boolean;
  deprecationMessage?: string;
  sunsetDate?: string;
}

// =============================================================================
// API VERSION HEADER
// =============================================================================

/**
 * Add standard API headers to response
 */
export function withApiHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-API-Version", API_CONFIG.version);
  response.headers.set("X-RateLimit-Limit", "60");
  return response;
}

// =============================================================================
// API VERSIONING
// =============================================================================

/**
 * Supported API versions
 */
export const API_VERSIONS = {
  v1: "v1",
} as const;

export type ApiVersion = keyof typeof API_VERSIONS;

/**
 * Get requested API version from request headers or path
 * Supports:
 * - X-API-Version header
 * - /api/v1/... path prefix (extracted by caller)
 * Defaults to v1 if not specified
 */
export function getRequestedApiVersion(request: NextRequest): ApiVersion {
  const headerVersion = request.headers.get("x-api-version");

  if (headerVersion && headerVersion in API_VERSIONS) {
    return headerVersion as ApiVersion;
  }

  // Default to v1
  return "v1";
}

/**
 * Check if requested version is supported
 */
export function isVersionSupported(version: string): version is ApiVersion {
  return version in API_VERSIONS;
}

/**
 * Middleware to validate API version
 */
export function withApiVersion(handler: ApiHandler): ApiHandler {
  return async (request, context) => {
    const version = getRequestedApiVersion(request);

    if (!isVersionSupported(version)) {
      return errors.badRequest(
        `Unsupported API version: ${version}. Supported versions: ${Object.keys(API_VERSIONS).join(", ")}`
      );
    }

    // Add version to response headers
    const response = await handler(request, context);
    response.headers.set("X-API-Version", version);

    return response;
  };
}

/**
 * Add deprecation headers to response
 */
export function withDeprecationHeaders(
  response: NextResponse,
  message?: string,
  sunsetDate?: string
): NextResponse {
  response.headers.set("Deprecation", "true");

  if (message) {
    response.headers.set("X-Deprecation-Notice", message);
  }

  if (sunsetDate) {
    response.headers.set("Sunset", sunsetDate);
  }

  return response;
}

// =============================================================================
// METHOD VALIDATION
// =============================================================================

/**
 * Validate HTTP method
 */
export function validateMethod(
  request: NextRequest,
  allowed: string[]
): NextResponse | null {
  const method = request.method.toUpperCase();

  if (!allowed.includes(method)) {
    const response = errors.methodNotAllowed(allowed);
    response.headers.set("Allow", allowed.join(", "));
    return response;
  }

  return null;
}

// =============================================================================
// REQUEST PARSING
// =============================================================================

/**
 * Safely parse JSON body
 */
export async function parseJsonBody<T = Record<string, unknown>>(
  request: NextRequest
): Promise<{ data: T | null; error: NextResponse | null }> {
  try {
    const contentType = request.headers.get("content-type");

    if (!contentType?.includes("application/json")) {
      return {
        data: null,
        error: errors.badRequest("Content-Type must be application/json"),
      };
    }

    const body = await request.json();
    return { data: body as T, error: null };
  } catch {
    return {
      data: null,
      error: errors.badRequest("Invalid JSON body"),
    };
  }
}

/**
 * Get authenticated user from request (placeholder - integrate with your auth)
 */
export async function getAuthUser(
  _request: NextRequest
): Promise<{ id: string; email: string; isAdmin: boolean } | null> {
  // This should integrate with your Supabase auth
  // For now, return null to indicate no auth
  return null;
}

// =============================================================================
// CORS
// =============================================================================

// Allowed origins for CORS - restrict to your actual domains
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.NEXT_PUBLIC_SITE_URL,
  "http://localhost:3000", // Development
  "http://localhost:3001",
].filter(Boolean) as string[];

/**
 * Get CORS headers for the given origin
 * Only exact matches are allowed - no subdomain wildcards for security
 */
function getCorsHeaders(origin: string | null): Record<string, string> {
  // Check if origin is allowed - exact matches only (no subdomain wildcards)
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0] || "";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key, X-CSRF-Token",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * Handle CORS preflight request
 */
export function handleCors(request: NextRequest): NextResponse | null {
  if (request.method === "OPTIONS") {
    const origin = request.headers.get("origin");
    return new NextResponse(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    });
  }
  return null;
}

/**
 * Add CORS headers to response
 */
export function withCors(response: NextResponse, request?: NextRequest): NextResponse {
  const origin = request?.headers.get("origin") || null;
  const corsHeaders = getCorsHeaders(origin);

  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

// =============================================================================
// TIMEOUT
// =============================================================================

/**
 * Wrap handler with timeout
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number = API_CONFIG.timeouts.default
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), ms)
    ),
  ]);
}

// =============================================================================
// ERROR BOUNDARY
// =============================================================================

/**
 * Wrap API handler with error boundary
 */
export function withErrorBoundary(handler: ApiHandler): ApiHandler {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      logError("API Error Boundary", error);

      if (error instanceof Error && error.message === "Request timeout") {
        return errors.serviceUnavailable("Request timed out");
      }

      return errors.internalError();
    }
  };
}

// =============================================================================
// COMPOSITE MIDDLEWARE
// =============================================================================

/**
 * Create API handler with middleware options
 */
export function createApiHandler(
  handler: ApiHandler,
  options: MiddlewareOptions = {}
): ApiHandler {
  return async (request, context) => {
    // Handle CORS preflight
    const corsResponse = handleCors(request);
    if (corsResponse) return corsResponse;

    // Validate method
    if (options.allowedMethods) {
      const methodError = validateMethod(request, options.allowedMethods);
      if (methodError) return withCors(methodError, request);
    }

    // Validate CSRF token for state-changing requests
    if (options.requireCsrf) {
      const method = request.method.toUpperCase();
      const stateChangingMethods = ["POST", "PUT", "PATCH", "DELETE"];

      if (stateChangingMethods.includes(method)) {
        if (!validateCsrfToken(request)) {
          return withCors(errors.forbidden("Invalid or missing CSRF token"), request);
        }
      }
    }

    try {
      // Execute handler
      let response = await handler(request, context);

      // Add standard headers
      response = withApiHeaders(response);
      response = withCors(response, request);

      // Add deprecation headers if needed
      if (options.deprecated) {
        response = withDeprecationHeaders(
          response,
          options.deprecationMessage,
          options.sunsetDate
        );
      }

      return response;
    } catch (error) {
      logError("API Handler", error);
      return withCors(errors.internalError(), request);
    }
  };
}

/**
 * Middleware wrapper for CSRF validation
 * Use this to wrap existing route handlers that need CSRF protection
 */
export function withCsrfProtection(handler: ApiHandler): ApiHandler {
  return async (request, context) => {
    const method = request.method.toUpperCase();
    const stateChangingMethods = ["POST", "PUT", "PATCH", "DELETE"];

    if (stateChangingMethods.includes(method)) {
      if (!validateCsrfToken(request)) {
        return errors.forbidden("Invalid or missing CSRF token");
      }
    }

    return handler(request, context);
  };
}
