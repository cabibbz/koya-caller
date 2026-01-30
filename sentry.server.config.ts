/**
 * Sentry Server Configuration
 * This file configures Sentry for Node.js server-side code
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production, or if explicitly enabled in development
  enabled: process.env.NODE_ENV === "production" || process.env.SENTRY_ENABLED === "true",

  // Performance Monitoring - sample 10% of transactions in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Filter out noisy errors
  ignoreErrors: [
    // Network errors that are expected
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    // Cancelled requests
    "AbortError",
    "The operation was aborted",
  ],

  // Sanitize sensitive data
  beforeSend(event) {
    // Remove sensitive headers
    if (event.request?.headers) {
      delete event.request.headers["authorization"];
      delete event.request.headers["cookie"];
      delete event.request.headers["x-api-key"];
    }

    // Remove user IP addresses
    if (event.user) {
      delete event.user.ip_address;
    }

    // Scrub sensitive data from breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
        if (breadcrumb.data) {
          // Remove any potential secrets
          const sensitiveKeys = ["password", "token", "secret", "key", "auth"];
          for (const key of Object.keys(breadcrumb.data)) {
            if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
              breadcrumb.data[key] = "[REDACTED]";
            }
          }
        }
        return breadcrumb;
      });
    }

    return event;
  },
});
