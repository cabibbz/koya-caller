/**
 * Integration Status Checker
 * Provides centralized status checking for all external integrations
 *
 * Used to:
 * - Show clear UI indicators when services are in mock mode
 * - Prevent confusion when API keys are not configured
 * - Health check endpoint for monitoring
 */

export type IntegrationStatus = "connected" | "mock" | "error";

export interface IntegrationInfo {
  name: string;
  status: IntegrationStatus;
  description: string;
  required: boolean;
  configuredKeys?: string[];
  missingKeys?: string[];
}

export interface IntegrationsStatusResult {
  allConfigured: boolean;
  production: boolean;
  integrations: {
    retell: IntegrationInfo;
    twilio: IntegrationInfo;
    claude: IntegrationInfo;
    stripe: IntegrationInfo;
    supabase: IntegrationInfo;
    redis: IntegrationInfo;
    nylas: IntegrationInfo;
    sentry: IntegrationInfo;
    inngest: IntegrationInfo;
  };
  criticalMissing: string[];
  warnings: string[];
}

/**
 * Check if an environment variable is set
 */
function isSet(key: string): boolean {
  const value = process.env[key];
  return !!value && value.trim() !== "";
}

/**
 * Check Retell.ai integration status
 */
function checkRetell(): IntegrationInfo {
  const hasApiKey = isSet("RETELL_API_KEY");

  return {
    name: "Retell.ai",
    status: hasApiKey ? "connected" : "mock",
    description: hasApiKey
      ? "Voice AI agent connected"
      : "Running in mock mode - voice calls will not work",
    required: true,
    configuredKeys: hasApiKey ? ["RETELL_API_KEY"] : [],
    missingKeys: hasApiKey ? [] : ["RETELL_API_KEY"],
  };
}

/**
 * Check Twilio integration status
 */
function checkTwilio(): IntegrationInfo {
  const hasAccountSid = isSet("TWILIO_ACCOUNT_SID");
  const hasAuthToken = isSet("TWILIO_AUTH_TOKEN");
  const isConfigured = hasAccountSid && hasAuthToken;

  const missingKeys: string[] = [];
  if (!hasAccountSid) missingKeys.push("TWILIO_ACCOUNT_SID");
  if (!hasAuthToken) missingKeys.push("TWILIO_AUTH_TOKEN");

  return {
    name: "Twilio",
    status: isConfigured ? "connected" : "mock",
    description: isConfigured
      ? "Phone and SMS connected"
      : "Running in mock mode - SMS and phone provisioning will not work",
    required: true,
    configuredKeys: isConfigured ? ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"] : [],
    missingKeys,
  };
}

/**
 * Check Claude/Anthropic integration status
 */
function checkClaude(): IntegrationInfo {
  const hasApiKey = isSet("ANTHROPIC_API_KEY");

  return {
    name: "Claude AI",
    status: hasApiKey ? "connected" : "mock",
    description: hasApiKey
      ? "AI prompt generation connected"
      : "Running in mock mode - prompts will be generic",
    required: true,
    configuredKeys: hasApiKey ? ["ANTHROPIC_API_KEY"] : [],
    missingKeys: hasApiKey ? [] : ["ANTHROPIC_API_KEY"],
  };
}

/**
 * Check Stripe integration status
 */
function checkStripe(): IntegrationInfo {
  const hasSecretKey = isSet("STRIPE_SECRET_KEY");
  const hasPublishableKey = isSet("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
  const hasWebhookSecret = isSet("STRIPE_WEBHOOK_SECRET");
  const isConfigured = hasSecretKey && hasPublishableKey;

  const missingKeys: string[] = [];
  if (!hasSecretKey) missingKeys.push("STRIPE_SECRET_KEY");
  if (!hasPublishableKey) missingKeys.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
  if (!hasWebhookSecret) missingKeys.push("STRIPE_WEBHOOK_SECRET");

  return {
    name: "Stripe",
    status: isConfigured ? "connected" : "mock",
    description: isConfigured
      ? "Payments connected"
      : "Payments not configured - billing will not work",
    required: true,
    configuredKeys: isConfigured ? ["STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"] : [],
    missingKeys,
  };
}

/**
 * Check Supabase integration status
 */
function checkSupabase(): IntegrationInfo {
  const hasUrl = isSet("NEXT_PUBLIC_SUPABASE_URL");
  const hasAnonKey = isSet("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const hasServiceKey = isSet("SUPABASE_SERVICE_ROLE_KEY");
  const isConfigured = hasUrl && hasAnonKey && hasServiceKey;

  const missingKeys: string[] = [];
  if (!hasUrl) missingKeys.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!hasAnonKey) missingKeys.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!hasServiceKey) missingKeys.push("SUPABASE_SERVICE_ROLE_KEY");

  return {
    name: "Supabase",
    status: isConfigured ? "connected" : "error",
    description: isConfigured
      ? "Database connected"
      : "Database not configured - app will not function",
    required: true,
    configuredKeys: isConfigured ? ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] : [],
    missingKeys,
  };
}

/**
 * Check Redis/Upstash integration status
 */
function checkRedis(): IntegrationInfo {
  const hasUrl = isSet("UPSTASH_REDIS_REST_URL");
  const hasToken = isSet("UPSTASH_REDIS_REST_TOKEN");
  const isConfigured = hasUrl && hasToken;

  return {
    name: "Redis (Upstash)",
    status: isConfigured ? "connected" : "mock",
    description: isConfigured
      ? "Rate limiting connected"
      : "Rate limiting disabled - API endpoints unprotected",
    required: false,
    configuredKeys: isConfigured ? ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"] : [],
    missingKeys: isConfigured ? [] : ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
  };
}

/**
 * Check Nylas integration status (calendar + email)
 */
function checkNylas(): IntegrationInfo {
  const hasApiKey = isSet("NYLAS_API_KEY");
  const hasClientId = isSet("NYLAS_CLIENT_ID");
  const isConfigured = hasApiKey && hasClientId;

  return {
    name: "Nylas",
    status: isConfigured ? "connected" : "mock",
    description: isConfigured
      ? "Nylas calendar & email connected"
      : "Nylas integration disabled (calendar, email, scheduling)",
    required: false,
    configuredKeys: isConfigured ? ["NYLAS_API_KEY", "NYLAS_CLIENT_ID"] : [],
    missingKeys: isConfigured ? [] : ["NYLAS_API_KEY", "NYLAS_CLIENT_ID"],
  };
}

/**
 * Check Sentry integration status
 */
function checkSentry(): IntegrationInfo {
  const hasDsn = isSet("NEXT_PUBLIC_SENTRY_DSN") || isSet("SENTRY_DSN");

  return {
    name: "Sentry",
    status: hasDsn ? "connected" : "mock",
    description: hasDsn
      ? "Error reporting connected"
      : "Error reporting disabled",
    required: false,
    configuredKeys: hasDsn ? ["SENTRY_DSN"] : [],
    missingKeys: hasDsn ? [] : ["NEXT_PUBLIC_SENTRY_DSN"],
  };
}

/**
 * Check Inngest integration status
 */
function checkInngest(): IntegrationInfo {
  const hasEventKey = isSet("INNGEST_EVENT_KEY");
  const hasSigningKey = isSet("INNGEST_SIGNING_KEY");
  const isConfigured = hasEventKey && hasSigningKey;

  return {
    name: "Inngest",
    status: isConfigured ? "connected" : "mock",
    description: isConfigured
      ? "Background jobs connected"
      : "Background jobs disabled - reminders won't work",
    required: false,
    configuredKeys: isConfigured ? ["INNGEST_EVENT_KEY", "INNGEST_SIGNING_KEY"] : [],
    missingKeys: isConfigured ? [] : ["INNGEST_EVENT_KEY", "INNGEST_SIGNING_KEY"],
  };
}

/**
 * Get complete integration status for all services
 */
export function getIntegrationsStatus(): IntegrationsStatusResult {
  const integrations = {
    retell: checkRetell(),
    twilio: checkTwilio(),
    claude: checkClaude(),
    stripe: checkStripe(),
    supabase: checkSupabase(),
    redis: checkRedis(),
    nylas: checkNylas(),
    sentry: checkSentry(),
    inngest: checkInngest(),
  };

  // Check which required integrations are missing
  const criticalMissing: string[] = [];
  const warnings: string[] = [];

  Object.values(integrations).forEach((integration) => {
    if (integration.status !== "connected") {
      if (integration.required) {
        criticalMissing.push(integration.name);
      } else {
        warnings.push(`${integration.name}: ${integration.description}`);
      }
    }
  });

  const allConfigured = criticalMissing.length === 0;
  const isProduction = process.env.NODE_ENV === "production";

  return {
    allConfigured,
    production: isProduction,
    integrations,
    criticalMissing,
    warnings,
  };
}

/**
 * Check if system is running in mock mode (any critical integration missing)
 */
export function isInMockMode(): boolean {
  const status = getIntegrationsStatus();
  return !status.allConfigured;
}

/**
 * Get a simple summary for logging
 */
export function getStatusSummary(): string {
  const status = getIntegrationsStatus();

  if (status.allConfigured) {
    return "All integrations configured";
  }

  return `Mock mode: Missing ${status.criticalMissing.join(", ")}`;
}
