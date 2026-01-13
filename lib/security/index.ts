/**
 * Security Utilities
 * Centralized security functions for the application
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// =============================================================================
// SECURITY HEADERS
// =============================================================================

export const SECURITY_HEADERS = {
  // Prevent clickjacking
  "X-Frame-Options": "DENY",

  // Prevent MIME type sniffing
  "X-Content-Type-Options": "nosniff",

  // Enable XSS filter
  "X-XSS-Protection": "1; mode=block",

  // Referrer policy
  "Referrer-Policy": "strict-origin-when-cross-origin",

  // Permissions policy (restrict sensitive APIs - allow microphone for demo calls)
  "Permissions-Policy": "camera=(), microphone=(self), geolocation=(), interest-cohort=()",

  // Content Security Policy (production - no unsafe-eval)
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://js.stripe.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://api.stripe.com https://api.retellai.com wss://*.supabase.co",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),

  // Strict Transport Security (HTTPS only)
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
} as const;

/**
 * Apply security headers to a response
 */
export function withSecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

// =============================================================================
// CSRF PROTECTION
// =============================================================================

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Generate a CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
}

/**
 * Validate CSRF token from request
 */
export function validateCsrfToken(request: NextRequest): boolean {
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const headerToken = request.headers.get(CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken) {
    return false;
  }

  // Use timing-safe comparison
  return timingSafeEqual(cookieToken, headerToken);
}

/**
 * Create a response with CSRF token cookie
 * Note: httpOnly must be false so JavaScript can read the token
 * and include it in the x-csrf-token header for validation
 */
export function withCsrfToken(response: NextResponse): NextResponse {
  const token = generateCsrfToken();

  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Must be readable by JavaScript to send in header
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60, // 1 hour
  });

  return response;
}

// =============================================================================
// TIMING-SAFE COMPARISON
// =============================================================================

/**
 * Timing-safe string comparison to prevent timing attacks
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  return crypto.timingSafeEqual(bufA, bufB);
}

// =============================================================================
// INPUT SANITIZATION
// =============================================================================

/**
 * Sanitize HTML to prevent XSS
 */
export function sanitizeHtml(input: string): string {
  const htmlEntities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
    "`": "&#x60;",
    "=": "&#x3D;",
  };

  return input.replace(/[&<>"'`=/]/g, (char) => htmlEntities[char]);
}

/**
 * Sanitize for SQL LIKE/ILIKE patterns
 */
export function sanitizeSqlPattern(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

/**
 * Sanitize filename to prevent path traversal
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/\.\./g, "") // Prevent path traversal
    .replace(/[/\\]/g, "") // Remove path separators
    .replace(/[^a-zA-Z0-9._-]/g, "_") // Only allow safe characters
    .slice(0, 255); // Limit length
}

/**
 * Sanitize URL path to prevent open redirects
 */
export function sanitizeRedirectUrl(url: string | null, defaultUrl = "/dashboard"): string {
  if (!url) return defaultUrl;

  // Must start with single forward slash
  if (!url.startsWith("/") || url.startsWith("//")) {
    return defaultUrl;
  }

  // Must not contain protocol markers
  if (url.includes("://") || url.includes("\\")) {
    return defaultUrl;
  }

  // Check for encoded bypass attempts
  try {
    const decoded = decodeURIComponent(url);
    if (decoded !== url && (decoded.includes("://") || decoded.startsWith("//"))) {
      return defaultUrl;
    }
  } catch {
    return defaultUrl;
  }

  // Only allow safe characters
  const safePathRegex = /^\/[a-zA-Z0-9\-_./?=&%]*$/;
  if (!safePathRegex.test(url)) {
    return defaultUrl;
  }

  return url;
}

/**
 * Sanitize and validate email
 */
export function sanitizeEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (!emailRegex.test(trimmed) || trimmed.length > 254) {
    return null;
  }

  return trimmed;
}

/**
 * Sanitize phone number
 */
export function sanitizePhone(phone: string): string | null {
  const cleaned = phone.replace(/\D/g, "");

  if (cleaned.length < 10 || cleaned.length > 15) {
    return null;
  }

  return cleaned;
}

// =============================================================================
// RATE LIMITING HELPERS
// =============================================================================

/**
 * Generate a rate limit key based on IP and optional user ID
 */
export function getRateLimitKey(request: NextRequest, prefix: string, userId?: string): string {
  const ip = getClientIp(request);
  const identifier = userId || ip || "unknown";
  return `${prefix}:${identifier}`;
}

/**
 * Get client IP from request
 */
export function getClientIp(request: NextRequest): string | null {
  // Check various headers in order of preference
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  return null;
}

// =============================================================================
// WEBHOOK SIGNATURE VERIFICATION
// =============================================================================

/**
 * Verify webhook signature using HMAC
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  algorithm: "sha256" | "sha1" = "sha256"
): boolean {
  const expectedSignature = crypto
    .createHmac(algorithm, secret)
    .update(payload)
    .digest("hex");

  // Handle signatures with prefixes (e.g., "sha256=...")
  const actualSignature = signature.includes("=")
    ? signature.split("=")[1]
    : signature;

  return timingSafeEqual(expectedSignature, actualSignature);
}

/**
 * Verify Stripe webhook signature
 */
export function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const parts = signature.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.split("=")[1];
  const v1Signature = parts.find((p) => p.startsWith("v1="))?.split("=")[1];

  if (!timestamp || !v1Signature) {
    return false;
  }

  // Check timestamp is within 5 minutes
  const timestampAge = Date.now() / 1000 - parseInt(timestamp);
  if (timestampAge > 300) {
    return false;
  }

  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  return timingSafeEqual(expectedSignature, v1Signature);
}

// =============================================================================
// SECURE TOKEN GENERATION
// =============================================================================

/**
 * Generate a secure random token
 */
export function generateSecureToken(length = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Generate a URL-safe token
 */
export function generateUrlSafeToken(length = 32): string {
  return crypto.randomBytes(length).toString("base64url");
}

/**
 * Hash a value using SHA-256
 */
export function hashValue(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validate UUID format
 */
export function isValidUuid(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Validate that a string contains only alphanumeric characters
 */
export function isAlphanumeric(value: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(value);
}

/**
 * Validate JSON string
 */
export function isValidJson(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check for common injection patterns
 */
export function containsInjectionPatterns(value: string): boolean {
  const patterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // onclick=, onload=, etc.
    /data:/i,
    /vbscript:/i,
    /expression\s*\(/i,
    /url\s*\(/i,
  ];

  return patterns.some((pattern) => pattern.test(value));
}

// =============================================================================
// AUDIT LOGGING
// =============================================================================

export interface AuditLogEntry {
  timestamp: string;
  action: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  severity: "info" | "warning" | "error" | "critical";
}

/**
 * Create an audit log entry
 */
export function createAuditLogEntry(
  request: NextRequest,
  action: string,
  options: Partial<AuditLogEntry> = {}
): AuditLogEntry {
  return {
    timestamp: new Date().toISOString(),
    action,
    ip: getClientIp(request) || undefined,
    userAgent: request.headers.get("user-agent") || undefined,
    severity: "info",
    ...options,
  };
}

// =============================================================================
// SENSITIVE DATA MASKING
// =============================================================================

/**
 * Mask sensitive data for logging
 */
export function maskSensitiveData(value: string, visibleChars = 4): string {
  if (value.length <= visibleChars * 2) {
    return "*".repeat(value.length);
  }

  const start = value.slice(0, visibleChars);
  const end = value.slice(-visibleChars);
  const masked = "*".repeat(Math.min(value.length - visibleChars * 2, 8));

  return `${start}${masked}${end}`;
}

/**
 * Mask email address
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return maskSensitiveData(email);

  const maskedLocal = local.length > 2
    ? `${local[0]}${"*".repeat(local.length - 2)}${local[local.length - 1]}`
    : "*".repeat(local.length);

  return `${maskedLocal}@${domain}`;
}

/**
 * Mask phone number
 */
export function maskPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length < 4) return "*".repeat(cleaned.length);

  return `${"*".repeat(cleaned.length - 4)}${cleaned.slice(-4)}`;
}
