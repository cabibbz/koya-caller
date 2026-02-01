/**
 * Shared Validation Utilities
 * Centralized validation functions for API routes
 */

// =============================================================================
// UUID VALIDATION
// =============================================================================

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

export function validateUUID(value: unknown, fieldName: string): string | null {
  if (!value) {
    return `${fieldName} is required`;
  }
  if (!isValidUUID(value)) {
    return `Invalid ${fieldName} format`;
  }
  return null;
}

export function validateUUIDs(values: unknown[], fieldName: string): string | null {
  for (const value of values) {
    const error = validateUUID(value, fieldName);
    if (error) return error;
  }
  return null;
}

// =============================================================================
// STRING VALIDATION
// =============================================================================

export function validateStringLength(
  value: string | undefined | null,
  maxLength: number,
  fieldName: string
): string | null {
  if (value && value.trim().length > maxLength) {
    return `${fieldName} must be ${maxLength} characters or less`;
  }
  return null;
}

export function validateRequiredString(
  value: unknown,
  fieldName: string
): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return `${fieldName} is required`;
  }
  return null;
}

// =============================================================================
// NUMBER VALIDATION
// =============================================================================

export function validateInteger(
  value: unknown,
  fieldName: string,
  options: { min?: number; max?: number } = {}
): string | null {
  if (value === undefined || value === null) {
    return null; // Optional field
  }

  if (!Number.isInteger(value)) {
    return `${fieldName} must be a whole number`;
  }

  const num = value as number;

  if (options.min !== undefined && num < options.min) {
    return `${fieldName} must be at least ${options.min}`;
  }

  if (options.max !== undefined && num > options.max) {
    return `${fieldName} must be at most ${options.max}`;
  }

  return null;
}

export function validateRequiredInteger(
  value: unknown,
  fieldName: string,
  options: { min?: number; max?: number } = {}
): string | null {
  if (value === undefined || value === null) {
    return `${fieldName} is required`;
  }
  return validateInteger(value, fieldName, options);
}

export function validateDiscountPercent(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return validateInteger(value, "Discount percent", { min: 0, max: 100 });
}

export function validatePriceCents(
  value: unknown,
  fieldName: string = "Price",
  options: { required?: boolean; maxCents?: number } = {}
): string | null {
  const { required = false, maxCents = 10000000 } = options; // Default max $100,000

  if (value === undefined || value === null) {
    if (required) {
      return `${fieldName} is required`;
    }
    return null;
  }

  if (!Number.isInteger(value) || (value as number) < 1) {
    return `${fieldName} must be a positive whole number (in cents)`;
  }

  if ((value as number) > maxCents) {
    return `${fieldName} must be $${(maxCents / 100).toLocaleString()} or less`;
  }

  return null;
}

// =============================================================================
// BOOLEAN VALIDATION
// =============================================================================

export function validateBoolean(value: unknown, fieldName: string): string | null {
  if (value === undefined) {
    return null; // Optional field
  }
  if (typeof value !== "boolean") {
    return `${fieldName} must be a boolean value (true or false)`;
  }
  return null;
}

// =============================================================================
// ENUM VALIDATION
// =============================================================================

export function validateEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fieldName: string
): string | null {
  if (value === undefined || value === null) {
    return null; // Optional field
  }
  if (typeof value !== "string" || !allowedValues.includes(value as T)) {
    return `${fieldName} must be one of: ${allowedValues.join(", ")}`;
  }
  return null;
}

export function validateRequiredEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fieldName: string
): string | null {
  if (value === undefined || value === null) {
    return `${fieldName} is required`;
  }
  return validateEnum(value, allowedValues, fieldName);
}

// =============================================================================
// COMMON FIELD VALIDATORS
// =============================================================================

export const TRIGGER_TIMINGS = ["before_booking", "after_booking"] as const;
export type TriggerTiming = typeof TRIGGER_TIMINGS[number];

export const BILLING_PERIODS = ["monthly", "quarterly", "annual"] as const;
export type BillingPeriod = typeof BILLING_PERIODS[number];

export function validateTriggerTiming(value: unknown): string | null {
  return validateEnum(value, TRIGGER_TIMINGS, "Trigger timing");
}

export function validateBillingPeriod(value: unknown): string | null {
  return validateEnum(value, BILLING_PERIODS, "Billing period");
}

// =============================================================================
// LIMITS CONFIGURATION
// =============================================================================

export const LIMITS = {
  // Entity counts per business
  MAX_UPSELLS_PER_BUSINESS: 20,
  MAX_BUNDLES_PER_BUSINESS: 10,
  MAX_PACKAGES_PER_BUSINESS: 15,
  MAX_MEMBERSHIPS_PER_BUSINESS: 5,

  // Field lengths
  MAX_NAME_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_PITCH_LENGTH: 300,
  MAX_BENEFITS_LENGTH: 1000,

  // Numeric limits
  MAX_PRICE_CENTS: 10000000, // $100,000
  MAX_DISCOUNT_PERCENT: 100,
  MAX_SESSION_COUNT: 100,
  MAX_VALIDITY_DAYS: 365,
  MAX_MIN_VISITS_TO_PITCH: 1000,
  MAX_PITCH_VISIT_COUNT: 100,

  // Bundle specific
  MIN_SERVICES_PER_BUNDLE: 2,
  MAX_SERVICES_PER_BUNDLE: 10,
} as const;
