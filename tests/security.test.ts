/**
 * Security Utilities Tests
 * Tests for input sanitization, validation, and security functions
 */

import { describe, it, expect } from "vitest";
import {
  sanitizeHtml,
  sanitizeSqlPattern,
  sanitizeFilename,
  sanitizeRedirectUrl,
  sanitizeEmail,
  sanitizePhone,
  isValidUuid,
  isAlphanumeric,
  isValidJson,
  containsInjectionPatterns,
  timingSafeEqual,
  generateSecureToken,
  generateUrlSafeToken,
  hashValue,
  maskSensitiveData,
  maskEmail,
  maskPhone,
} from "@/lib/security";

describe("Security Utilities", () => {
  // ==========================================================================
  // HTML Sanitization
  // ==========================================================================
  describe("sanitizeHtml", () => {
    it("should escape HTML special characters", () => {
      expect(sanitizeHtml("<script>alert('xss')</script>")).toBe(
        "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;&#x2F;script&gt;"
      );
    });

    it("should escape quotes and ampersands", () => {
      expect(sanitizeHtml('Hello & "world"')).toBe(
        "Hello &amp; &quot;world&quot;"
      );
    });

    it("should handle empty strings", () => {
      expect(sanitizeHtml("")).toBe("");
    });

    it("should preserve safe text", () => {
      expect(sanitizeHtml("Hello World 123")).toBe("Hello World 123");
    });

    it("should escape backticks and equals", () => {
      expect(sanitizeHtml("`test=value`")).toBe("&#x60;test&#x3D;value&#x60;");
    });
  });

  // ==========================================================================
  // SQL Pattern Sanitization
  // ==========================================================================
  describe("sanitizeSqlPattern", () => {
    it("should escape percent signs", () => {
      expect(sanitizeSqlPattern("100%")).toBe("100\\%");
    });

    it("should escape underscores", () => {
      expect(sanitizeSqlPattern("user_name")).toBe("user\\_name");
    });

    it("should escape backslashes", () => {
      expect(sanitizeSqlPattern("path\\file")).toBe("path\\\\file");
    });

    it("should handle complex patterns", () => {
      expect(sanitizeSqlPattern("%_test\\value_%")).toBe(
        "\\%\\_test\\\\value\\_\\%"
      );
    });

    it("should handle empty strings", () => {
      expect(sanitizeSqlPattern("")).toBe("");
    });
  });

  // ==========================================================================
  // Filename Sanitization
  // ==========================================================================
  describe("sanitizeFilename", () => {
    it("should prevent path traversal with ..", () => {
      expect(sanitizeFilename("../../../etc/passwd")).toBe("etcpasswd");
    });

    it("should remove forward slashes", () => {
      expect(sanitizeFilename("path/to/file.txt")).toBe("pathtofile.txt");
    });

    it("should remove backslashes", () => {
      expect(sanitizeFilename("path\\to\\file.txt")).toBe("pathtofile.txt");
    });

    it("should replace unsafe characters with underscores", () => {
      expect(sanitizeFilename("file<name>:test.txt")).toBe(
        "file_name__test.txt"
      );
    });

    it("should preserve safe filenames", () => {
      expect(sanitizeFilename("document-v1.2_final.pdf")).toBe(
        "document-v1.2_final.pdf"
      );
    });

    it("should limit filename length", () => {
      const longName = "a".repeat(300) + ".txt";
      expect(sanitizeFilename(longName).length).toBeLessThanOrEqual(255);
    });
  });

  // ==========================================================================
  // Redirect URL Sanitization
  // ==========================================================================
  describe("sanitizeRedirectUrl", () => {
    it("should allow valid relative paths", () => {
      expect(sanitizeRedirectUrl("/dashboard")).toBe("/dashboard");
      expect(sanitizeRedirectUrl("/settings/profile")).toBe(
        "/settings/profile"
      );
    });

    it("should reject null/undefined", () => {
      expect(sanitizeRedirectUrl(null)).toBe("/dashboard");
    });

    it("should reject absolute URLs", () => {
      expect(sanitizeRedirectUrl("https://evil.com")).toBe("/dashboard");
    });

    it("should reject protocol-relative URLs", () => {
      expect(sanitizeRedirectUrl("//evil.com")).toBe("/dashboard");
    });

    it("should reject URLs with protocol markers", () => {
      expect(sanitizeRedirectUrl("/redirect?url=http://evil.com")).toBe(
        "/dashboard"
      );
    });

    it("should reject backslash paths", () => {
      expect(sanitizeRedirectUrl("/path\\to\\file")).toBe("/dashboard");
    });

    it("should reject encoded bypass attempts", () => {
      expect(sanitizeRedirectUrl("/%2F%2Fevil.com")).toBe("/dashboard");
    });

    it("should allow paths with query parameters", () => {
      expect(sanitizeRedirectUrl("/search?q=test&page=1")).toBe(
        "/search?q=test&page=1"
      );
    });
  });

  // ==========================================================================
  // Email Sanitization
  // ==========================================================================
  describe("sanitizeEmail", () => {
    it("should accept valid emails", () => {
      expect(sanitizeEmail("user@example.com")).toBe("user@example.com");
      expect(sanitizeEmail("User.Name+tag@example.co.uk")).toBe(
        "user.name+tag@example.co.uk"
      );
    });

    it("should lowercase emails", () => {
      expect(sanitizeEmail("USER@EXAMPLE.COM")).toBe("user@example.com");
    });

    it("should trim whitespace", () => {
      expect(sanitizeEmail("  user@example.com  ")).toBe("user@example.com");
    });

    it("should reject invalid emails", () => {
      expect(sanitizeEmail("not-an-email")).toBeNull();
      expect(sanitizeEmail("missing@domain")).toBeNull();
      expect(sanitizeEmail("@nodomain.com")).toBeNull();
    });

    it("should reject overly long emails", () => {
      const longEmail = "a".repeat(250) + "@example.com";
      expect(sanitizeEmail(longEmail)).toBeNull();
    });
  });

  // ==========================================================================
  // Phone Sanitization
  // ==========================================================================
  describe("sanitizePhone", () => {
    it("should extract digits from phone numbers", () => {
      expect(sanitizePhone("(555) 123-4567")).toBe("5551234567");
      expect(sanitizePhone("+1-555-123-4567")).toBe("15551234567");
    });

    it("should reject too short numbers", () => {
      expect(sanitizePhone("12345")).toBeNull();
    });

    it("should reject too long numbers", () => {
      expect(sanitizePhone("1234567890123456")).toBeNull();
    });

    it("should handle valid international numbers", () => {
      expect(sanitizePhone("+44 20 7123 4567")).toBe("442071234567");
    });
  });

  // ==========================================================================
  // UUID Validation
  // ==========================================================================
  describe("isValidUuid", () => {
    it("should accept valid UUIDs", () => {
      expect(isValidUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
      expect(isValidUuid("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
    });

    it("should reject invalid UUIDs", () => {
      expect(isValidUuid("not-a-uuid")).toBe(false);
      expect(isValidUuid("550e8400-e29b-41d4-a716")).toBe(false);
      expect(isValidUuid("550e8400e29b41d4a716446655440000")).toBe(false);
    });
  });

  // ==========================================================================
  // Alphanumeric Validation
  // ==========================================================================
  describe("isAlphanumeric", () => {
    it("should accept alphanumeric strings", () => {
      expect(isAlphanumeric("abc123")).toBe(true);
      expect(isAlphanumeric("ABC")).toBe(true);
    });

    it("should reject non-alphanumeric strings", () => {
      expect(isAlphanumeric("abc-123")).toBe(false);
      expect(isAlphanumeric("abc 123")).toBe(false);
      expect(isAlphanumeric("abc_123")).toBe(false);
    });
  });

  // ==========================================================================
  // JSON Validation
  // ==========================================================================
  describe("isValidJson", () => {
    it("should accept valid JSON", () => {
      expect(isValidJson('{"key": "value"}')).toBe(true);
      expect(isValidJson("[1, 2, 3]")).toBe(true);
      expect(isValidJson('"string"')).toBe(true);
    });

    it("should reject invalid JSON", () => {
      expect(isValidJson("{key: value}")).toBe(false);
      expect(isValidJson("not json")).toBe(false);
    });
  });

  // ==========================================================================
  // Injection Pattern Detection
  // ==========================================================================
  describe("containsInjectionPatterns", () => {
    it("should detect script tags", () => {
      expect(containsInjectionPatterns("<script>alert(1)</script>")).toBe(true);
      expect(containsInjectionPatterns("<SCRIPT>")).toBe(true);
    });

    it("should detect javascript: protocol", () => {
      expect(containsInjectionPatterns("javascript:alert(1)")).toBe(true);
    });

    it("should detect event handlers", () => {
      expect(containsInjectionPatterns('onclick="alert(1)"')).toBe(true);
      expect(containsInjectionPatterns("onload =alert(1)")).toBe(true);
    });

    it("should detect data: protocol", () => {
      expect(containsInjectionPatterns("data:text/html,<script>")).toBe(true);
    });

    it("should allow safe content", () => {
      expect(containsInjectionPatterns("Hello World")).toBe(false);
      expect(containsInjectionPatterns("data analysis report")).toBe(false);
    });
  });

  // ==========================================================================
  // Timing-Safe Comparison
  // ==========================================================================
  describe("timingSafeEqual", () => {
    it("should return true for equal strings", () => {
      expect(timingSafeEqual("secret123", "secret123")).toBe(true);
    });

    it("should return false for unequal strings", () => {
      expect(timingSafeEqual("secret123", "secret456")).toBe(false);
    });

    it("should return false for different length strings", () => {
      expect(timingSafeEqual("short", "muchlonger")).toBe(false);
    });
  });

  // ==========================================================================
  // Token Generation
  // ==========================================================================
  describe("generateSecureToken", () => {
    it("should generate hex tokens of correct length", () => {
      const token = generateSecureToken(32);
      expect(token).toHaveLength(64); // 32 bytes = 64 hex chars
    });

    it("should generate unique tokens", () => {
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe("generateUrlSafeToken", () => {
    it("should generate URL-safe tokens", () => {
      const token = generateUrlSafeToken(32);
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe("hashValue", () => {
    it("should generate consistent SHA-256 hashes", () => {
      const hash1 = hashValue("test");
      const hash2 = hashValue("test");
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 = 64 hex chars
    });

    it("should generate different hashes for different inputs", () => {
      const hash1 = hashValue("test1");
      const hash2 = hashValue("test2");
      expect(hash1).not.toBe(hash2);
    });
  });

  // ==========================================================================
  // Data Masking
  // ==========================================================================
  describe("maskSensitiveData", () => {
    it("should mask middle characters", () => {
      expect(maskSensitiveData("1234567890")).toBe("1234**7890");
    });

    it("should fully mask short strings", () => {
      expect(maskSensitiveData("abc")).toBe("***");
    });
  });

  describe("maskEmail", () => {
    it("should mask email local part", () => {
      expect(maskEmail("john.doe@example.com")).toBe("j******e@example.com");
    });

    it("should handle short local parts", () => {
      expect(maskEmail("ab@example.com")).toBe("**@example.com");
    });
  });

  describe("maskPhone", () => {
    it("should show only last 4 digits", () => {
      expect(maskPhone("555-123-4567")).toBe("******4567");
    });
  });
});
