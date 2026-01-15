/**
 * Shared Constants and Enums
 * Business domain constants used across the application
 */

// =============================================================================
// CALL CONSTANTS
// =============================================================================

export enum CallStatus {
  INITIATED = "initiated",
  RINGING = "ringing",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  FAILED = "failed",
  BUSY = "busy",
  NO_ANSWER = "no_answer",
  CANCELED = "canceled",
}

export enum CallOutcome {
  BOOKED = "booked",
  TRANSFERRED = "transferred",
  INFO = "info",
  MESSAGE = "message",
  MISSED = "missed",
  MINUTES_EXHAUSTED = "minutes_exhausted",
}

export const CALL_OUTCOME_CONFIG = {
  [CallOutcome.BOOKED]: {
    label: "Booked",
    color: "emerald",
    description: "Appointment was scheduled",
  },
  [CallOutcome.TRANSFERRED]: {
    label: "Transferred",
    color: "blue",
    description: "Call was transferred to a human",
  },
  [CallOutcome.INFO]: {
    label: "Info Only",
    color: "purple",
    description: "Caller received information",
  },
  [CallOutcome.MESSAGE]: {
    label: "Message",
    color: "amber",
    description: "Message was taken",
  },
  [CallOutcome.MISSED]: {
    label: "Missed",
    color: "red",
    description: "Call was not answered",
  },
  [CallOutcome.MINUTES_EXHAUSTED]: {
    label: "Over Limit",
    color: "gray",
    description: "Monthly minutes exhausted",
  },
} as const;

// =============================================================================
// APPOINTMENT CONSTANTS
// =============================================================================

export enum AppointmentStatus {
  CONFIRMED = "confirmed",
  CANCELLED = "cancelled",
  COMPLETED = "completed",
  NO_SHOW = "no_show",
}

export const APPOINTMENT_STATUS_CONFIG = {
  [AppointmentStatus.CONFIRMED]: {
    label: "Confirmed",
    variant: "default" as const,
    color: "green",
  },
  [AppointmentStatus.CANCELLED]: {
    label: "Cancelled",
    variant: "destructive" as const,
    color: "red",
  },
  [AppointmentStatus.COMPLETED]: {
    label: "Completed",
    variant: "secondary" as const,
    color: "gray",
  },
  [AppointmentStatus.NO_SHOW]: {
    label: "No Show",
    variant: "outline" as const,
    color: "orange",
  },
} as const;

// =============================================================================
// SUBSCRIPTION CONSTANTS
// =============================================================================

export enum SubscriptionStatus {
  ACTIVE = "active",
  TRIALING = "trialing",
  PAST_DUE = "past_due",
  CANCELED = "canceled",
  UNPAID = "unpaid",
}

export enum PlanTier {
  STARTER = "starter",
  PROFESSIONAL = "professional",
  BUSINESS = "business",
}

export const PLAN_CONFIG = {
  [PlanTier.STARTER]: {
    name: "Starter",
    minutesIncluded: 100,
    features: ["1 phone number", "Basic analytics", "Email support"],
  },
  [PlanTier.PROFESSIONAL]: {
    name: "Professional",
    minutesIncluded: 300,
    features: ["1 phone number", "Advanced analytics", "Priority support", "Calendar sync"],
  },
  [PlanTier.BUSINESS]: {
    name: "Business",
    minutesIncluded: 1000,
    features: ["Multiple phone numbers", "Custom integrations", "Dedicated support", "API access"],
  },
} as const;

// =============================================================================
// AI CONFIGURATION CONSTANTS
// =============================================================================

export enum Personality {
  PROFESSIONAL = "professional",
  FRIENDLY = "friendly",
  CASUAL = "casual",
}

export const PERSONALITY_CONFIG = {
  [Personality.PROFESSIONAL]: {
    label: "Professional",
    description: "Clear and businesslike",
  },
  [Personality.FRIENDLY]: {
    label: "Friendly",
    description: "Warm and approachable",
  },
  [Personality.CASUAL]: {
    label: "Casual",
    description: "Relaxed and conversational",
  },
} as const;

export enum LanguageMode {
  AUTO = "auto",
  ASK = "ask",
  SPANISH_DEFAULT = "spanish_default",
}

export const LANGUAGE_MODE_CONFIG = {
  [LanguageMode.AUTO]: {
    label: "Auto-detect",
    description: "Koya detects the caller's language automatically",
  },
  [LanguageMode.ASK]: {
    label: "Ask first",
    description: "Koya asks which language the caller prefers",
  },
  [LanguageMode.SPANISH_DEFAULT]: {
    label: "Spanish default",
    description: "Start in Spanish, switch if needed",
  },
} as const;

export enum SentimentLevel {
  NONE = "none",
  BASIC = "basic",
  ADVANCED = "advanced",
}

export const SENTIMENT_LEVEL_CONFIG = {
  [SentimentLevel.NONE]: {
    label: "Off",
    description: "No sentiment detection",
  },
  [SentimentLevel.BASIC]: {
    label: "Basic",
    description: "Detect frustrated and upset callers",
  },
  [SentimentLevel.ADVANCED]: {
    label: "Advanced",
    description: "Full emotion detection with de-escalation",
  },
} as const;

// =============================================================================
// NOTIFICATION CONSTANTS
// =============================================================================

export enum ReminderSetting {
  OFF = "off",
  ONE_HOUR = "1hr",
  TWENTY_FOUR_HOURS = "24hr",
}

export const REMINDER_OPTIONS = [
  { value: ReminderSetting.OFF, label: "No reminder" },
  { value: ReminderSetting.ONE_HOUR, label: "1 hour before" },
  { value: ReminderSetting.TWENTY_FOUR_HOURS, label: "24 hours before" },
] as const;

// =============================================================================
// TRANSFER CONSTANTS
// =============================================================================

export enum TransferHoursType {
  ALWAYS = "always",
  BUSINESS_HOURS = "business_hours",
  CUSTOM = "custom",
}

export const TRANSFER_HOURS_OPTIONS = [
  { value: TransferHoursType.ALWAYS, label: "Always available" },
  { value: TransferHoursType.BUSINESS_HOURS, label: "Business hours only" },
  { value: TransferHoursType.CUSTOM, label: "Custom schedule (coming soon)" },
] as const;

// =============================================================================
// CALENDAR CONSTANTS
// =============================================================================

export enum CalendarProvider {
  BUILT_IN = "built_in",
  GOOGLE = "google",
  OUTLOOK = "outlook",
}

export const CALENDAR_PROVIDER_CONFIG = {
  [CalendarProvider.BUILT_IN]: {
    label: "Built-in Calendar",
    description: "Use Koya's calendar",
  },
  [CalendarProvider.GOOGLE]: {
    label: "Google Calendar",
    description: "Sync with Google Calendar",
  },
  [CalendarProvider.OUTLOOK]: {
    label: "Outlook Calendar",
    description: "Sync with Microsoft Outlook",
  },
} as const;

// =============================================================================
// INDUSTRY CONSTANTS
// =============================================================================

export enum IndustryType {
  MEDICAL = "medical",
  DENTAL = "dental",
  LEGAL = "legal",
  REAL_ESTATE = "real_estate",
  HOME_SERVICES = "home_services",
  SALON_SPA = "salon_spa",
  RESTAURANT = "restaurant",
  FITNESS = "fitness",
  AUTOMOTIVE = "automotive",
  OTHER = "other",
}

export const INDUSTRY_CONFIG = {
  [IndustryType.MEDICAL]: {
    label: "Medical Practice",
    icon: "stethoscope",
  },
  [IndustryType.DENTAL]: {
    label: "Dental Office",
    icon: "tooth",
  },
  [IndustryType.LEGAL]: {
    label: "Law Firm",
    icon: "scale",
  },
  [IndustryType.REAL_ESTATE]: {
    label: "Real Estate",
    icon: "home",
  },
  [IndustryType.HOME_SERVICES]: {
    label: "Home Services",
    icon: "wrench",
  },
  [IndustryType.SALON_SPA]: {
    label: "Salon & Spa",
    icon: "scissors",
  },
  [IndustryType.RESTAURANT]: {
    label: "Restaurant",
    icon: "utensils",
  },
  [IndustryType.FITNESS]: {
    label: "Fitness & Gym",
    icon: "dumbbell",
  },
  [IndustryType.AUTOMOTIVE]: {
    label: "Automotive",
    icon: "car",
  },
  [IndustryType.OTHER]: {
    label: "Other",
    icon: "building",
  },
} as const;

// =============================================================================
// PHONE SETUP CONSTANTS
// =============================================================================

export enum PhoneSetupType {
  NEW = "new",
  FORWARDED = "forwarded",
  PORTED = "ported",
}

export const PHONE_SETUP_CONFIG = {
  [PhoneSetupType.NEW]: {
    label: "New Number",
    description: "Get a new phone number from Koya",
  },
  [PhoneSetupType.FORWARDED]: {
    label: "Call Forwarding",
    description: "Forward your existing number to Koya",
  },
  [PhoneSetupType.PORTED]: {
    label: "Port Number",
    description: "Transfer your existing number to Koya",
  },
} as const;

// =============================================================================
// ERROR LOG CONSTANTS
// =============================================================================

export enum ErrorCategory {
  RETELL = "retell",
  TWILIO = "twilio",
  STRIPE = "stripe",
  CALENDAR = "calendar",
  CLAUDE = "claude",
  WEBHOOK = "webhook",
  API = "api",
  DATABASE = "database",
}

export enum ErrorSeverity {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical",
}
