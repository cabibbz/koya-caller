/**
 * Sentry Client Configuration
 * This file configures Sentry for the browser/client-side
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production, or if explicitly enabled in development
  enabled: process.env.NODE_ENV === "production" || process.env.SENTRY_ENABLED === "true",

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Session Replay - capture 10% of sessions, 100% on error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Integrations
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Filter out noisy errors
  ignoreErrors: [
    // Browser extensions
    "top.GLOBALS",
    "originalCreateNotification",
    "canvas.contentDocument",
    "MyApp_RemoveAllHighlights",
    "http://tt.telecomgold.ru",
    "jigsaw is not defined",
    // Facebook
    "fb_xd_fragment",
    // Network errors
    "Network request failed",
    "Failed to fetch",
    "Load failed",
    // Cancelled requests
    "AbortError",
    "The operation was aborted",
    // Browser quirks
    "ResizeObserver loop",
    "Non-Error promise rejection",
  ],

  // Don't send PII
  beforeSend(event) {
    // Remove user IP addresses
    if (event.user) {
      delete event.user.ip_address;
    }
    return event;
  },
});
