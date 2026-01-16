/**
 * API Middleware Utilities
 * Shared middleware for API routes
 */

import { NextRequest, NextResponse } from "next/server";
import { API_CONFIG } from "@/lib/config";
import { errors } from "./responses";
import { logError } from "@/lib/logging";

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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
  "Access-Control-Max-Age": "86400",
};

/**
 * Handle CORS preflight request
 */
export function handleCors(request: NextRequest): NextResponse | null {
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }
  return null;
}

/**
 * Add CORS headers to response
 */
export function withCors(response: NextResponse): NextResponse {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
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
      if (methodError) return withCors(methodError);
    }

    try {
      // Execute handler
      let response = await handler(request, context);

      // Add standard headers
      response = withApiHeaders(response);
      response = withCors(response);

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
      return withCors(errors.internalError());
    }
  };
}
