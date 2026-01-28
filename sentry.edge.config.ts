/**
 * Sentry Edge Configuration
 * This file configures Sentry for Edge runtime (middleware, edge API routes)
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production, or if explicitly enabled in development
  enabled: process.env.NODE_ENV === "production" || process.env.SENTRY_ENABLED === "true",

  // Performance Monitoring - sample 10% of transactions in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

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

    return event;
  },
});
