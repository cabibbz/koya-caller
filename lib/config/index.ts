/**
 * Centralized Configuration System
 * Single source of truth for all app configuration
 */

// =============================================================================
// ENVIRONMENT DETECTION
// =============================================================================

export const ENV = {
  isDevelopment: process.env.NODE_ENV === "development",
  isProduction: process.env.NODE_ENV === "production",
  isTest: process.env.NODE_ENV === "test",
} as const;

// =============================================================================
// APP CONFIGURATION
// =============================================================================

export const APP_CONFIG = {
  name: "Koya",
  fullName: "Koya Caller",
  description: "AI-powered phone receptionist for small businesses",
  company: "Koya AI",

  // URLs
  urls: {
    site: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    app: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    production: "https://koyacaller.com",
    support: "https://support.koya.ai",
  },

  // Social
  social: {
    twitter: "https://twitter.com/koyacaller",
    linkedin: "https://linkedin.com/company/koyacaller",
  },

  // Contact
  contact: {
    email: "hello@koyacaller.com",
    support: "support@koyacaller.com",
  },
} as const;

// =============================================================================
// EXTERNAL SERVICE URLS
// =============================================================================

export const EXTERNAL_URLS = {
  // Google OAuth & APIs
  google: {
    auth: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    calendar: "https://www.googleapis.com/calendar/v3",
    scopes: {
      calendarReadonly: "https://www.googleapis.com/auth/calendar.readonly",
      calendarEvents: "https://www.googleapis.com/auth/calendar.events",
    },
  },

  // Microsoft/Azure OAuth & APIs
  microsoft: {
    getAuthUrl: (tenantId: string) =>
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
    getTokenUrl: (tenantId: string) =>
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    graph: "https://graph.microsoft.com/v1.0",
  },

  // Retell AI
  retell: {
    api: "https://api.retellai.com/v2",
    voiceSamples: "https://retell-utils-public.s3.us-west-2.amazonaws.com",
  },

  // Schema.org
  schema: "https://schema.org",

  // Carrier support pages
  carriers: {
    att: "https://www.att.com/support/article/wireless/KM1000839/",
    verizon: "https://www.verizon.com/support/call-forwarding-faqs/",
    tmobile: "https://www.t-mobile.com/support/plans-features/call-forwarding",
    spectrum: "https://www.spectrum.net/support/voice/how-use-call-forwarding",
    comcast: "https://business.comcast.com/help-and-support/voice/call-forwarding",
  },
} as const;

// =============================================================================
// API CONFIGURATION
// =============================================================================

export const API_CONFIG = {
  // Current API version
  version: "v1",

  // Pagination defaults
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },

  // Timeouts (in milliseconds)
  timeouts: {
    default: 30000,
    webhook: 10000,
    scrape: 15000,
    longRunning: 120000,
  },

  // Rate limits (requests per window)
  rateLimits: {
    auth: { requests: 5, windowSeconds: 15 },
    passwordReset: { requests: 3, windowSeconds: 3600 },
    webhook: { requests: 100, windowSeconds: 60 },
    dashboard: { requests: 60, windowSeconds: 60 },
    public: { requests: 30, windowSeconds: 60 },
    demo: { requests: 3, windowSeconds: 3600 },
  },
} as const;

// =============================================================================
// FEATURE FLAGS
// =============================================================================

export const FEATURES = {
  // Core features
  spanishSupport: true,
  calendarIntegration: true,

  // AI features
  sentimentDetection: true,
  industryPrompts: true,

  // Integrations
  googleCalendar: !!process.env.GOOGLE_CLIENT_ID,
  outlookCalendar: !!process.env.AZURE_CLIENT_ID,
  stripePayments: !!process.env.STRIPE_SECRET_KEY,
  twilioSms: !!process.env.TWILIO_MESSAGING_SERVICE_SID,
  emailNotifications: !!process.env.RESEND_API_KEY,

  // Background jobs
  inngestJobs: !!process.env.INNGEST_EVENT_KEY,
} as const;

// =============================================================================
// SERVICE CONFIGURATION
// =============================================================================

export const SERVICES = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
  },

  retell: {
    apiKey: process.env.RETELL_API_KEY,
    webhookSecret: process.env.RETELL_WEBHOOK_SECRET,
    demoAgentId: process.env.RETELL_DEMO_AGENT_ID,
  },

  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: "claude-sonnet-4-5-20250929",
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    apiVersion: "2025-02-24.acacia" as const,
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  },

  azure: {
    clientId: process.env.AZURE_CLIENT_ID,
    clientSecret: process.env.AZURE_CLIENT_SECRET,
    tenantId: process.env.AZURE_TENANT_ID || "common",
  },

  redis: {
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  },

  email: {
    apiKey: process.env.RESEND_API_KEY,
    fromAddress: process.env.FROM_EMAIL || "Koya <noreply@koyacaller.com>",
  },
} as const;

// =============================================================================
// BUSINESS LOGIC CONSTANTS
// =============================================================================

export const BUSINESS_RULES = {
  // Call settings
  calls: {
    maxDurationSeconds: 3600,
    defaultMaxDurationSeconds: 600,
    minDurationSeconds: 60,
  },

  // Appointments
  appointments: {
    defaultDurationMinutes: 60,
    minDurationMinutes: 15,
    maxDurationMinutes: 480,
    maxAdvanceBookingDays: 90,
    defaultAdvanceBookingDays: 14,
  },

  // Toasts
  toasts: {
    maxVisible: 5,
    removeDelayMs: 5000,
  },

  // Search
  search: {
    minQueryLength: 2,
    maxQueryLength: 100,
    maxResults: 30,
  },
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the base URL for the application
 */
export function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return APP_CONFIG.urls.site;
}

/**
 * Build a full URL from a path
 */
export function buildUrl(path: string): string {
  const base = getBaseUrl();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof typeof FEATURES): boolean {
  return FEATURES[feature];
}

/**
 * Get callback URL for OAuth flows
 */
export function getOAuthCallbackUrl(provider: "google" | "outlook"): string {
  return buildUrl(`/api/calendar/${provider}/callback`);
}

/**
 * Validate required environment variables at startup
 */
export function validateConfig(): { valid: boolean; missing: string[] } {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ];

  const missing = required.filter((key) => !process.env[key]);

  return {
    valid: missing.length === 0,
    missing,
  };
}
