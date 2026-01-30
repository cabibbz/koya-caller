/**
 * API Request Validation Utilities
 * Type-safe validation for API inputs
 */

import { errors } from "./responses";
import { NextResponse } from "next/server";

// =============================================================================
// VALIDATION TYPES
// =============================================================================

export type ValidationRule<T> = {
  validate: (value: unknown) => value is T;
  message: string;
};

export type ValidationSchema<T> = {
  [K in keyof T]: ValidationRule<T[K]> & { required?: boolean };
};

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: NextResponse };

// =============================================================================
// BASIC VALIDATORS
// =============================================================================

export const validators = {
  string: (minLength = 0, maxLength = Infinity): ValidationRule<string> => ({
    validate: (value): value is string =>
      typeof value === "string" &&
      value.length >= minLength &&
      value.length <= maxLength,
    message: `Must be a string between ${minLength} and ${maxLength} characters`,
  }),

  nonEmptyString: (): ValidationRule<string> => ({
    validate: (value): value is string =>
      typeof value === "string" && value.trim().length > 0,
    message: "Must be a non-empty string",
  }),

  number: (min = -Infinity, max = Infinity): ValidationRule<number> => ({
    validate: (value): value is number =>
      typeof value === "number" && !isNaN(value) && value >= min && value <= max,
    message: `Must be a number between ${min} and ${max}`,
  }),

  integer: (min = -Infinity, max = Infinity): ValidationRule<number> => ({
    validate: (value): value is number =>
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= min &&
      value <= max,
    message: `Must be an integer between ${min} and ${max}`,
  }),

  boolean: (): ValidationRule<boolean> => ({
    validate: (value): value is boolean => typeof value === "boolean",
    message: "Must be a boolean",
  }),

  email: (): ValidationRule<string> => ({
    validate: (value): value is string => {
      if (typeof value !== "string") return false;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value);
    },
    message: "Must be a valid email address",
  }),

  phone: (): ValidationRule<string> => ({
    validate: (value): value is string => {
      if (typeof value !== "string") return false;
      const cleaned = value.replace(/\D/g, "");
      return cleaned.length >= 10 && cleaned.length <= 15;
    },
    message: "Must be a valid phone number",
  }),

  url: (): ValidationRule<string> => ({
    validate: (value): value is string => {
      if (typeof value !== "string") return false;
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    message: "Must be a valid URL",
  }),

  uuid: (): ValidationRule<string> => ({
    validate: (value): value is string => {
      if (typeof value !== "string") return false;
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(value);
    },
    message: "Must be a valid UUID",
  }),

  date: (): ValidationRule<string> => ({
    validate: (value): value is string => {
      if (typeof value !== "string") return false;
      const date = new Date(value);
      return !isNaN(date.getTime());
    },
    message: "Must be a valid date string",
  }),

  enum: <T extends string>(values: readonly T[]): ValidationRule<T> => ({
    validate: (value): value is T =>
      typeof value === "string" && values.includes(value as T),
    message: `Must be one of: ${values.join(", ")}`,
  }),

  array: <T>(itemValidator: ValidationRule<T>): ValidationRule<T[]> => ({
    validate: (value): value is T[] =>
      Array.isArray(value) && value.every((item) => itemValidator.validate(item)),
    message: `Must be an array where each item ${itemValidator.message.toLowerCase()}`,
  }),

  optional: <T>(validator: ValidationRule<T>): ValidationRule<T | undefined> => ({
    validate: (value): value is T | undefined =>
      value === undefined || validator.validate(value),
    message: validator.message,
  }),

  nullable: <T>(validator: ValidationRule<T>): ValidationRule<T | null> => ({
    validate: (value): value is T | null =>
      value === null || validator.validate(value),
    message: validator.message,
  }),
};

// =============================================================================
// SCHEMA VALIDATION
// =============================================================================

/**
 * Validate an object against a schema
 */
export function validateSchema<T extends Record<string, unknown>>(
  data: unknown,
  schema: ValidationSchema<T>
): ValidationResult<T> {
  if (typeof data !== "object" || data === null) {
    return {
      success: false,
      error: errors.validationError("Request body must be an object"),
    };
  }

  const obj = data as Record<string, unknown>;
  const validatedData: Partial<T> = {};
  const validationErrors: Record<string, string> = {};

  for (const [key, rule] of Object.entries(schema)) {
    const value = obj[key];
    const { validate, message, required } = rule as ValidationRule<unknown> & {
      required?: boolean;
    };

    // Check required fields
    if (required && (value === undefined || value === null)) {
      validationErrors[key] = `${key} is required`;
      continue;
    }

    // Skip validation for optional undefined values
    if (value === undefined && !required) {
      continue;
    }

    // Validate the value
    if (!validate(value)) {
      validationErrors[key] = message;
      continue;
    }

    (validatedData as Record<string, unknown>)[key] = value;
  }

  if (Object.keys(validationErrors).length > 0) {
    return {
      success: false,
      error: errors.validationError("Validation failed", {
        fields: validationErrors,
      }),
    };
  }

  return {
    success: true,
    data: validatedData as T,
  };
}

// =============================================================================
// QUERY PARAMETER VALIDATION
// =============================================================================

/**
 * Parse and validate query parameters
 */
export function parseQueryParams<T extends Record<string, unknown>>(
  searchParams: URLSearchParams,
  schema: {
    [K in keyof T]: {
      type: "string" | "number" | "boolean" | "array";
      required?: boolean;
      default?: T[K];
      validate?: (value: T[K]) => boolean;
    };
  }
): ValidationResult<T> {
  const result: Partial<T> = {};
  const validationErrors: Record<string, string> = {};

  for (const [key, config] of Object.entries(schema)) {
    const rawValue = searchParams.get(key);

    // Handle missing values
    if (rawValue === null) {
      if (config.required) {
        validationErrors[key] = `${key} is required`;
        continue;
      }
      if (config.default !== undefined) {
        (result as Record<string, unknown>)[key] = config.default;
      }
      continue;
    }

    // Parse value based on type
    let parsedValue: unknown;

    switch (config.type) {
      case "string":
        parsedValue = rawValue;
        break;
      case "number":
        parsedValue = Number(rawValue);
        if (isNaN(parsedValue as number)) {
          validationErrors[key] = `${key} must be a valid number`;
          continue;
        }
        break;
      case "boolean":
        parsedValue = rawValue === "true" || rawValue === "1";
        break;
      case "array":
        parsedValue = rawValue.split(",").map((s) => s.trim());
        break;
    }

    // Custom validation
    if (config.validate && !config.validate(parsedValue as T[keyof T])) {
      validationErrors[key] = `${key} is invalid`;
      continue;
    }

    (result as Record<string, unknown>)[key] = parsedValue;
  }

  if (Object.keys(validationErrors).length > 0) {
    return {
      success: false,
      error: errors.validationError("Invalid query parameters", {
        fields: validationErrors,
      }),
    };
  }

  return {
    success: true,
    data: result as T,
  };
}

// =============================================================================
// SANITIZATION
// =============================================================================

/**
 * Sanitize string for safe use in database queries
 */
export function sanitizeString(str: string, maxLength = 1000): string {
  return str
    .slice(0, maxLength)
    .replace(/[<>]/g, "") // Remove potential HTML
    .trim();
}

/**
 * Sanitize for PostgreSQL ILIKE patterns
 */
export function sanitizeILikePattern(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

/**
 * Validate and sanitize redirect path
 */
export function sanitizeRedirectPath(path: string | null): string {
  const defaultPath = "/dashboard";

  if (!path) return defaultPath;
  if (!path.startsWith("/") || path.startsWith("//")) return defaultPath;
  if (path.includes("://") || path.includes("\\")) return defaultPath;

  const decoded = decodeURIComponent(path);
  if (decoded !== path && (decoded.includes("://") || decoded.startsWith("//"))) {
    return defaultPath;
  }

  const safePathRegex = /^\/[a-zA-Z0-9\-_./?=&]*$/;
  if (!safePathRegex.test(path)) return defaultPath;

  return path;
}
