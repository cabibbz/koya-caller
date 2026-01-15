/**
 * API Validation Tests
 * Tests for request validation utilities
 */

import { describe, it, expect } from "vitest";
import {
  validators,
  sanitizeString,
  sanitizeILikePattern,
  sanitizeRedirectPath,
} from "@/lib/api/validation";

describe("API Validation Utilities", () => {
  // ==========================================================================
  // String Validator
  // ==========================================================================
  describe("validators.string", () => {
    const stringValidator = validators.string(1, 10);

    it("should accept valid strings within length", () => {
      expect(stringValidator.validate("hello")).toBe(true);
      expect(stringValidator.validate("a")).toBe(true);
      expect(stringValidator.validate("1234567890")).toBe(true);
    });

    it("should reject strings too short", () => {
      expect(stringValidator.validate("")).toBe(false);
    });

    it("should reject strings too long", () => {
      expect(stringValidator.validate("12345678901")).toBe(false);
    });

    it("should reject non-strings", () => {
      expect(stringValidator.validate(123)).toBe(false);
      expect(stringValidator.validate(null)).toBe(false);
      expect(stringValidator.validate(undefined)).toBe(false);
    });
  });

  // ==========================================================================
  // Non-Empty String Validator
  // ==========================================================================
  describe("validators.nonEmptyString", () => {
    const validator = validators.nonEmptyString();

    it("should accept non-empty strings", () => {
      expect(validator.validate("hello")).toBe(true);
      expect(validator.validate("a")).toBe(true);
    });

    it("should reject empty strings", () => {
      expect(validator.validate("")).toBe(false);
    });

    it("should reject whitespace-only strings", () => {
      expect(validator.validate("   ")).toBe(false);
      expect(validator.validate("\t\n")).toBe(false);
    });
  });

  // ==========================================================================
  // Number Validator
  // ==========================================================================
  describe("validators.number", () => {
    const numberValidator = validators.number(0, 100);

    it("should accept valid numbers", () => {
      expect(numberValidator.validate(50)).toBe(true);
      expect(numberValidator.validate(0)).toBe(true);
      expect(numberValidator.validate(100)).toBe(true);
    });

    it("should reject out of range numbers", () => {
      expect(numberValidator.validate(-1)).toBe(false);
      expect(numberValidator.validate(101)).toBe(false);
    });

    it("should reject NaN", () => {
      expect(numberValidator.validate(NaN)).toBe(false);
    });

    it("should reject non-numbers", () => {
      expect(numberValidator.validate("50")).toBe(false);
      expect(numberValidator.validate(null)).toBe(false);
    });
  });

  // ==========================================================================
  // Integer Validator
  // ==========================================================================
  describe("validators.integer", () => {
    const intValidator = validators.integer(1, 10);

    it("should accept valid integers", () => {
      expect(intValidator.validate(5)).toBe(true);
      expect(intValidator.validate(1)).toBe(true);
      expect(intValidator.validate(10)).toBe(true);
    });

    it("should reject floats", () => {
      expect(intValidator.validate(5.5)).toBe(false);
    });

    it("should reject out of range integers", () => {
      expect(intValidator.validate(0)).toBe(false);
      expect(intValidator.validate(11)).toBe(false);
    });
  });

  // ==========================================================================
  // Boolean Validator
  // ==========================================================================
  describe("validators.boolean", () => {
    const boolValidator = validators.boolean();

    it("should accept booleans", () => {
      expect(boolValidator.validate(true)).toBe(true);
      expect(boolValidator.validate(false)).toBe(true);
    });

    it("should reject non-booleans", () => {
      expect(boolValidator.validate("true")).toBe(false);
      expect(boolValidator.validate(1)).toBe(false);
      expect(boolValidator.validate(null)).toBe(false);
    });
  });

  // ==========================================================================
  // Email Validator
  // ==========================================================================
  describe("validators.email", () => {
    const emailValidator = validators.email();

    it("should accept valid emails", () => {
      expect(emailValidator.validate("user@example.com")).toBe(true);
      expect(emailValidator.validate("user.name@example.co.uk")).toBe(true);
      expect(emailValidator.validate("user+tag@example.com")).toBe(true);
    });

    it("should reject invalid emails", () => {
      expect(emailValidator.validate("not-an-email")).toBe(false);
      expect(emailValidator.validate("missing@")).toBe(false);
      expect(emailValidator.validate("@nodomain.com")).toBe(false);
      expect(emailValidator.validate("spaces in@email.com")).toBe(false);
    });

    it("should reject non-strings", () => {
      expect(emailValidator.validate(123)).toBe(false);
      expect(emailValidator.validate(null)).toBe(false);
    });
  });

  // ==========================================================================
  // Phone Validator
  // ==========================================================================
  describe("validators.phone", () => {
    const phoneValidator = validators.phone();

    it("should accept valid phone numbers", () => {
      expect(phoneValidator.validate("5551234567")).toBe(true);
      expect(phoneValidator.validate("+1-555-123-4567")).toBe(true);
      expect(phoneValidator.validate("(555) 123-4567")).toBe(true);
    });

    it("should reject too short numbers", () => {
      expect(phoneValidator.validate("12345")).toBe(false);
    });

    it("should reject too long numbers", () => {
      expect(phoneValidator.validate("1234567890123456")).toBe(false);
    });
  });

  // ==========================================================================
  // URL Validator
  // ==========================================================================
  describe("validators.url", () => {
    const urlValidator = validators.url();

    it("should accept valid URLs", () => {
      expect(urlValidator.validate("https://example.com")).toBe(true);
      expect(urlValidator.validate("http://localhost:3000")).toBe(true);
      expect(urlValidator.validate("https://example.com/path?query=1")).toBe(
        true
      );
    });

    it("should reject invalid URLs", () => {
      expect(urlValidator.validate("not-a-url")).toBe(false);
      expect(urlValidator.validate("example.com")).toBe(false);
      expect(urlValidator.validate("ftp://example.com")).toBe(true); // FTP is valid URL
    });
  });

  // ==========================================================================
  // UUID Validator
  // ==========================================================================
  describe("validators.uuid", () => {
    const uuidValidator = validators.uuid();

    it("should accept valid UUIDs", () => {
      expect(
        uuidValidator.validate("550e8400-e29b-41d4-a716-446655440000")
      ).toBe(true);
      expect(
        uuidValidator.validate("550E8400-E29B-41D4-A716-446655440000")
      ).toBe(true);
    });

    it("should reject invalid UUIDs", () => {
      expect(uuidValidator.validate("not-a-uuid")).toBe(false);
      expect(uuidValidator.validate("550e8400-e29b-41d4-a716")).toBe(false);
    });
  });

  // ==========================================================================
  // Date Validator
  // ==========================================================================
  describe("validators.date", () => {
    const dateValidator = validators.date();

    it("should accept valid date strings", () => {
      expect(dateValidator.validate("2024-01-15")).toBe(true);
      expect(dateValidator.validate("2024-01-15T10:30:00Z")).toBe(true);
      expect(dateValidator.validate("January 15, 2024")).toBe(true);
    });

    it("should reject invalid date strings", () => {
      expect(dateValidator.validate("not-a-date")).toBe(false);
      expect(dateValidator.validate("2024-13-45")).toBe(false);
    });
  });

  // ==========================================================================
  // Enum Validator
  // ==========================================================================
  describe("validators.enum", () => {
    const statusValidator = validators.enum([
      "active",
      "pending",
      "cancelled",
    ] as const);

    it("should accept valid enum values", () => {
      expect(statusValidator.validate("active")).toBe(true);
      expect(statusValidator.validate("pending")).toBe(true);
      expect(statusValidator.validate("cancelled")).toBe(true);
    });

    it("should reject invalid enum values", () => {
      expect(statusValidator.validate("invalid")).toBe(false);
      expect(statusValidator.validate("ACTIVE")).toBe(false);
    });
  });

  // ==========================================================================
  // Array Validator
  // ==========================================================================
  describe("validators.array", () => {
    const stringArrayValidator = validators.array(validators.nonEmptyString());

    it("should accept valid arrays", () => {
      expect(stringArrayValidator.validate(["a", "b", "c"])).toBe(true);
      expect(stringArrayValidator.validate([])).toBe(true);
    });

    it("should reject arrays with invalid items", () => {
      expect(stringArrayValidator.validate(["a", "", "c"])).toBe(false);
      expect(stringArrayValidator.validate(["a", 123, "c"])).toBe(false);
    });

    it("should reject non-arrays", () => {
      expect(stringArrayValidator.validate("not-an-array")).toBe(false);
      expect(stringArrayValidator.validate(null)).toBe(false);
    });
  });

  // ==========================================================================
  // Optional Validator
  // ==========================================================================
  describe("validators.optional", () => {
    const optionalString = validators.optional(validators.nonEmptyString());

    it("should accept undefined", () => {
      expect(optionalString.validate(undefined)).toBe(true);
    });

    it("should validate non-undefined values", () => {
      expect(optionalString.validate("hello")).toBe(true);
      expect(optionalString.validate("")).toBe(false);
    });
  });

  // ==========================================================================
  // Nullable Validator
  // ==========================================================================
  describe("validators.nullable", () => {
    const nullableString = validators.nullable(validators.nonEmptyString());

    it("should accept null", () => {
      expect(nullableString.validate(null)).toBe(true);
    });

    it("should validate non-null values", () => {
      expect(nullableString.validate("hello")).toBe(true);
      expect(nullableString.validate("")).toBe(false);
    });
  });

  // ==========================================================================
  // Sanitization Functions
  // ==========================================================================
  describe("sanitizeString", () => {
    it("should truncate long strings", () => {
      const longString = "a".repeat(2000);
      expect(sanitizeString(longString, 100).length).toBe(100);
    });

    it("should remove HTML tags", () => {
      expect(sanitizeString("<script>alert(1)</script>")).toBe(
        "scriptalert(1)/script"
      );
    });

    it("should trim whitespace", () => {
      expect(sanitizeString("  hello  ")).toBe("hello");
    });
  });

  describe("sanitizeILikePattern", () => {
    it("should escape SQL LIKE special characters", () => {
      expect(sanitizeILikePattern("50%")).toBe("50\\%");
      expect(sanitizeILikePattern("user_name")).toBe("user\\_name");
      expect(sanitizeILikePattern("path\\file")).toBe("path\\\\file");
    });
  });

  describe("sanitizeRedirectPath", () => {
    it("should allow valid paths", () => {
      expect(sanitizeRedirectPath("/dashboard")).toBe("/dashboard");
      expect(sanitizeRedirectPath("/settings/profile")).toBe(
        "/settings/profile"
      );
    });

    it("should reject null", () => {
      expect(sanitizeRedirectPath(null)).toBe("/dashboard");
    });

    it("should reject absolute URLs", () => {
      expect(sanitizeRedirectPath("https://evil.com")).toBe("/dashboard");
    });

    it("should reject protocol-relative URLs", () => {
      expect(sanitizeRedirectPath("//evil.com")).toBe("/dashboard");
    });

    it("should reject URLs with protocols inside", () => {
      expect(sanitizeRedirectPath("/redirect?url=http://evil.com")).toBe(
        "/dashboard"
      );
    });

    it("should reject backslash paths", () => {
      expect(sanitizeRedirectPath("/path\\evil")).toBe("/dashboard");
    });
  });
});
