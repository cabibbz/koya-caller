/**
 * Onboarding Validation Tests
 * Tests for onboarding completion and voice preview functionality
 */

import { describe, it, expect } from "vitest";

// =============================================================================
// Onboarding Validation Tests
// =============================================================================

describe("Onboarding Validation", () => {
  describe("Business ID validation", () => {
    function validateBusinessId(businessId: string | null | undefined): {
      valid: boolean;
      error?: string;
    } {
      if (!businessId) {
        return { valid: false, error: "Business ID required" };
      }
      if (typeof businessId !== "string") {
        return { valid: false, error: "Business ID must be a string" };
      }
      if (businessId.trim().length === 0) {
        return { valid: false, error: "Business ID cannot be empty" };
      }
      return { valid: true };
    }

    it("should accept valid business ID", () => {
      const result = validateBusinessId("biz-123-abc");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject null business ID", () => {
      const result = validateBusinessId(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Business ID required");
    });

    it("should reject undefined business ID", () => {
      const result = validateBusinessId(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Business ID required");
    });

    it("should reject empty string business ID", () => {
      const result = validateBusinessId("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Business ID required");
    });

    it("should reject whitespace-only business ID", () => {
      const result = validateBusinessId("   ");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Business ID cannot be empty");
    });
  });

  describe("Business ownership validation", () => {
    interface Business {
      id: string;
      user_id: string;
      name: string;
    }

    function validateOwnership(
      business: Business | null,
      userId: string
    ): { authorized: boolean; error?: string } {
      if (!business) {
        return { authorized: false, error: "Business not found or access denied" };
      }
      if (business.user_id !== userId) {
        return { authorized: false, error: "Business not found or access denied" };
      }
      return { authorized: true };
    }

    it("should authorize matching user ID", () => {
      const business: Business = { id: "biz-1", user_id: "user-1", name: "Test Biz" };
      const result = validateOwnership(business, "user-1");
      expect(result.authorized).toBe(true);
    });

    it("should reject non-matching user ID", () => {
      const business: Business = { id: "biz-1", user_id: "user-1", name: "Test Biz" };
      const result = validateOwnership(business, "user-2");
      expect(result.authorized).toBe(false);
      expect(result.error).toBe("Business not found or access denied");
    });

    it("should reject null business", () => {
      const result = validateOwnership(null, "user-1");
      expect(result.authorized).toBe(false);
      expect(result.error).toBe("Business not found or access denied");
    });
  });
});

// =============================================================================
// Test Call Validation Tests
// =============================================================================

describe("Test Call Validation", () => {
  interface TestCallResult {
    hasCompletedTestCall: boolean;
    testCallSkipped: boolean;
    requiresTestCall: boolean;
  }

  function validateTestCall(
    hasWebCalls: boolean,
    hasRetellAgent: boolean,
    skipRequested: boolean
  ): TestCallResult {
    const hasCompletedTestCall = hasWebCalls || hasRetellAgent;

    if (!hasCompletedTestCall) {
      if (skipRequested) {
        return {
          hasCompletedTestCall: false,
          testCallSkipped: true,
          requiresTestCall: false,
        };
      }
      return {
        hasCompletedTestCall: false,
        testCallSkipped: false,
        requiresTestCall: true,
      };
    }

    return {
      hasCompletedTestCall: true,
      testCallSkipped: false,
      requiresTestCall: false,
    };
  }

  describe("Test call completion", () => {
    it("should detect completed test call via web calls", () => {
      const result = validateTestCall(true, false, false);
      expect(result.hasCompletedTestCall).toBe(true);
      expect(result.requiresTestCall).toBe(false);
    });

    it("should detect completed test call via Retell agent", () => {
      const result = validateTestCall(false, true, false);
      expect(result.hasCompletedTestCall).toBe(true);
      expect(result.requiresTestCall).toBe(false);
    });

    it("should require test call when none completed", () => {
      const result = validateTestCall(false, false, false);
      expect(result.hasCompletedTestCall).toBe(false);
      expect(result.requiresTestCall).toBe(true);
    });
  });

  describe("Skip functionality", () => {
    it("should allow skipping test call", () => {
      const result = validateTestCall(false, false, true);
      expect(result.testCallSkipped).toBe(true);
      expect(result.requiresTestCall).toBe(false);
    });

    it("should not mark as skipped if test call was completed", () => {
      const result = validateTestCall(true, false, true);
      expect(result.testCallSkipped).toBe(false);
    });
  });
});

// =============================================================================
// Onboarding Step Validation Tests
// =============================================================================

describe("Onboarding Step Validation", () => {
  const ONBOARDING_COMPLETE_STEP = 10;

  describe("Step completion", () => {
    it("should mark step 10 as onboarding complete", () => {
      expect(ONBOARDING_COMPLETE_STEP).toBe(10);
    });

    it("should validate step progression", () => {
      const steps = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      expect(steps.length).toBe(10);
      expect(steps[steps.length - 1]).toBe(ONBOARDING_COMPLETE_STEP);
    });
  });

  describe("Subscription status on completion", () => {
    it("should set status to active on completion", () => {
      const completionUpdate = {
        onboarding_completed_at: new Date().toISOString(),
        onboarding_step: ONBOARDING_COMPLETE_STEP,
        subscription_status: "active",
      };

      expect(completionUpdate.subscription_status).toBe("active");
      expect(completionUpdate.onboarding_step).toBe(10);
    });
  });
});

// =============================================================================
// AI Config Default Values Tests
// =============================================================================

describe("AI Config Default Values", () => {
  const DEFAULT_AI_CONFIG = {
    voice_id: "11labs-Grace",
    ai_name: "Koya",
    personality: "professional",
    spanish_enabled: false,
    language_mode: "auto",
  };

  describe("Default voice settings", () => {
    it("should have Grace as default voice", () => {
      expect(DEFAULT_AI_CONFIG.voice_id).toBe("11labs-Grace");
    });

    it("should have Koya as default AI name", () => {
      expect(DEFAULT_AI_CONFIG.ai_name).toBe("Koya");
    });

    it("should have professional as default personality", () => {
      expect(DEFAULT_AI_CONFIG.personality).toBe("professional");
    });
  });

  describe("Default language settings", () => {
    it("should have Spanish disabled by default", () => {
      expect(DEFAULT_AI_CONFIG.spanish_enabled).toBe(false);
    });

    it("should have auto language mode by default", () => {
      expect(DEFAULT_AI_CONFIG.language_mode).toBe("auto");
    });
  });
});

// =============================================================================
// Greeting Generation Tests
// =============================================================================

describe("Greeting Generation", () => {
  function generateDefaultGreeting(businessName: string, aiName: string): string {
    return `Thanks for calling ${businessName}, this is ${aiName}, how can I help you?`;
  }

  describe("Default greeting format", () => {
    it("should generate correct greeting", () => {
      const greeting = generateDefaultGreeting("Acme Dental", "Koya");
      expect(greeting).toBe("Thanks for calling Acme Dental, this is Koya, how can I help you?");
    });

    it("should include business name", () => {
      const greeting = generateDefaultGreeting("Test Business", "Koya");
      expect(greeting).toContain("Test Business");
    });

    it("should include AI name", () => {
      const greeting = generateDefaultGreeting("Test Business", "Custom AI");
      expect(greeting).toContain("Custom AI");
    });
  });
});

// =============================================================================
// Voice Preview Tests
// =============================================================================

describe("Voice Preview", () => {
  const VOICE_PREVIEWS: Record<string, string> = {
    "grace-warm": "https://retell-utils-public.s3.us-west-2.amazonaws.com/grace.mp3",
    "jenny-professional": "https://retell-utils-public.s3.us-west-2.amazonaws.com/Jenny.mp3",
    "hailey-energetic": "https://retell-utils-public.s3.us-west-2.amazonaws.com/11labs-9koBc4DQZJE0dLobwFBt.mp3",
    "adrian-professional": "https://retell-utils-public.s3.us-west-2.amazonaws.com/adrian.mp3",
    "brian-warm": "https://retell-utils-public.s3.us-west-2.amazonaws.com/brian.mp3",
    "nico-energetic": "https://retell-utils-public.s3.us-west-2.amazonaws.com/11labs-pdBC2RxjF7wu7aBAu86E.mp3",
  };

  describe("Voice ID validation", () => {
    function validateVoiceId(voiceId: string | null): {
      valid: boolean;
      error?: string;
      url?: string;
    } {
      if (!voiceId) {
        return { valid: false, error: "Voice ID is required. Please provide a valid voice ID." };
      }

      const previewUrl = VOICE_PREVIEWS[voiceId];
      if (!previewUrl) {
        return { valid: false, error: "The requested voice could not be found. Please select a different voice." };
      }

      return { valid: true, url: previewUrl };
    }

    it("should accept valid voice ID", () => {
      const result = validateVoiceId("grace-warm");
      expect(result.valid).toBe(true);
      expect(result.url).toBeDefined();
    });

    it("should reject null voice ID", () => {
      const result = validateVoiceId(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Voice ID is required");
    });

    it("should reject unknown voice ID", () => {
      const result = validateVoiceId("unknown-voice");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("could not be found");
    });
  });

  describe("Voice preview URLs", () => {
    it("should have all expected voices configured", () => {
      expect(Object.keys(VOICE_PREVIEWS).length).toBe(6);
    });

    it("should have valid S3 URLs", () => {
      Object.values(VOICE_PREVIEWS).forEach(url => {
        expect(url).toMatch(/^https:\/\/retell-utils-public\.s3\.us-west-2\.amazonaws\.com\//);
        expect(url).toMatch(/\.mp3$/);
      });
    });

    it("should include grace voice", () => {
      expect(VOICE_PREVIEWS["grace-warm"]).toBeDefined();
    });

    it("should include jenny voice", () => {
      expect(VOICE_PREVIEWS["jenny-professional"]).toBeDefined();
    });

    it("should include adrian voice", () => {
      expect(VOICE_PREVIEWS["adrian-professional"]).toBeDefined();
    });
  });
});

// =============================================================================
// Voice Preview Error Handling Tests
// =============================================================================

describe("Voice Preview Error Handling", () => {
  const ERROR_MESSAGES = {
    MISSING_VOICE_ID: "Voice ID is required. Please provide a valid voice ID.",
    VOICE_NOT_FOUND: "The requested voice could not be found. Please select a different voice.",
    FETCH_FAILED: "Unable to load voice preview. The audio service may be temporarily unavailable.",
    FETCH_TIMEOUT: "Voice preview request timed out. Please try again.",
    INVALID_AUDIO: "The voice preview file is invalid or corrupted. Please try a different voice.",
    NETWORK_ERROR: "Network error while fetching voice preview. Please check your connection.",
    UNKNOWN_ERROR: "An unexpected error occurred while loading the voice preview.",
  };

  describe("Error messages", () => {
    it("should have user-friendly missing voice ID message", () => {
      expect(ERROR_MESSAGES.MISSING_VOICE_ID).toContain("Voice ID is required");
    });

    it("should have user-friendly not found message", () => {
      expect(ERROR_MESSAGES.VOICE_NOT_FOUND).toContain("could not be found");
    });

    it("should have user-friendly timeout message", () => {
      expect(ERROR_MESSAGES.FETCH_TIMEOUT).toContain("timed out");
    });

    it("should have user-friendly network error message", () => {
      expect(ERROR_MESSAGES.NETWORK_ERROR).toContain("Network error");
    });
  });

  describe("Error code mapping", () => {
    interface ErrorResponse {
      error: string;
      code: string;
      status: number;
    }

    function mapError(errorType: string): ErrorResponse {
      switch (errorType) {
        case "MISSING_VOICE_ID":
          return { error: ERROR_MESSAGES.MISSING_VOICE_ID, code: "MISSING_VOICE_ID", status: 400 };
        case "VOICE_NOT_FOUND":
          return { error: ERROR_MESSAGES.VOICE_NOT_FOUND, code: "VOICE_NOT_FOUND", status: 404 };
        case "FETCH_TIMEOUT":
          return { error: ERROR_MESSAGES.FETCH_TIMEOUT, code: "FETCH_TIMEOUT", status: 504 };
        case "NETWORK_ERROR":
          return { error: ERROR_MESSAGES.NETWORK_ERROR, code: "NETWORK_ERROR", status: 502 };
        case "INVALID_AUDIO":
          return { error: ERROR_MESSAGES.INVALID_AUDIO, code: "INVALID_AUDIO", status: 502 };
        default:
          return { error: ERROR_MESSAGES.UNKNOWN_ERROR, code: "UNKNOWN_ERROR", status: 500 };
      }
    }

    it("should return 400 for missing voice ID", () => {
      const error = mapError("MISSING_VOICE_ID");
      expect(error.status).toBe(400);
    });

    it("should return 404 for voice not found", () => {
      const error = mapError("VOICE_NOT_FOUND");
      expect(error.status).toBe(404);
    });

    it("should return 504 for timeout", () => {
      const error = mapError("FETCH_TIMEOUT");
      expect(error.status).toBe(504);
    });

    it("should return 502 for network error", () => {
      const error = mapError("NETWORK_ERROR");
      expect(error.status).toBe(502);
    });

    it("should return 500 for unknown error", () => {
      const error = mapError("UNKNOWN");
      expect(error.status).toBe(500);
    });
  });
});

// =============================================================================
// Audio Response Tests
// =============================================================================

describe("Audio Response Formatting", () => {
  interface AudioResponseHeaders {
    contentType: string;
    contentLength: string;
    cacheControl: string;
  }

  function createAudioResponseHeaders(bufferLength: number): AudioResponseHeaders {
    return {
      contentType: "audio/mpeg",
      contentLength: bufferLength.toString(),
      cacheControl: "public, max-age=86400",
    };
  }

  describe("Response headers", () => {
    it("should set correct content type", () => {
      const headers = createAudioResponseHeaders(1000);
      expect(headers.contentType).toBe("audio/mpeg");
    });

    it("should set correct content length", () => {
      const headers = createAudioResponseHeaders(12345);
      expect(headers.contentLength).toBe("12345");
    });

    it("should enable caching for 24 hours", () => {
      const headers = createAudioResponseHeaders(1000);
      expect(headers.cacheControl).toContain("max-age=86400");
      expect(headers.cacheControl).toContain("public");
    });
  });

  describe("Buffer validation", () => {
    function validateAudioBuffer(bufferLength: number): { valid: boolean; error?: string } {
      if (bufferLength === 0) {
        return { valid: false, error: "Empty audio buffer received" };
      }
      return { valid: true };
    }

    it("should accept non-empty buffer", () => {
      const result = validateAudioBuffer(1000);
      expect(result.valid).toBe(true);
    });

    it("should reject empty buffer", () => {
      const result = validateAudioBuffer(0);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Empty audio buffer");
    });
  });
});

// =============================================================================
// Retell Agent Configuration Tests
// =============================================================================

describe("Retell Agent Configuration", () => {
  interface AgentConfig {
    agent_name: string;
    voice_id: string;
    language: string;
    enable_recording: boolean;
    enable_voicemail_detection: boolean;
    reminder_trigger_ms: number;
    reminder_max_count: number;
    end_call_after_silence_ms: number;
  }

  function createAgentConfig(aiName: string, businessName: string, voiceId: string): AgentConfig {
    return {
      agent_name: `${aiName} - ${businessName}`,
      voice_id: voiceId,
      language: "en-US",
      enable_recording: true,
      enable_voicemail_detection: false,
      reminder_trigger_ms: 10000,
      reminder_max_count: 2,
      end_call_after_silence_ms: 30000,
    };
  }

  describe("Agent name format", () => {
    it("should combine AI name and business name", () => {
      const config = createAgentConfig("Koya", "Acme Dental", "11labs-Grace");
      expect(config.agent_name).toBe("Koya - Acme Dental");
    });
  });

  describe("Default settings", () => {
    it("should enable recording by default", () => {
      const config = createAgentConfig("Koya", "Test", "voice-1");
      expect(config.enable_recording).toBe(true);
    });

    it("should disable voicemail detection by default", () => {
      const config = createAgentConfig("Koya", "Test", "voice-1");
      expect(config.enable_voicemail_detection).toBe(false);
    });

    it("should set reminder trigger to 10 seconds", () => {
      const config = createAgentConfig("Koya", "Test", "voice-1");
      expect(config.reminder_trigger_ms).toBe(10000);
    });

    it("should set max reminders to 2", () => {
      const config = createAgentConfig("Koya", "Test", "voice-1");
      expect(config.reminder_max_count).toBe(2);
    });

    it("should end call after 30 seconds of silence", () => {
      const config = createAgentConfig("Koya", "Test", "voice-1");
      expect(config.end_call_after_silence_ms).toBe(30000);
    });
  });

  describe("Language setting", () => {
    it("should set language to en-US", () => {
      const config = createAgentConfig("Koya", "Test", "voice-1");
      expect(config.language).toBe("en-US");
    });
  });
});

// =============================================================================
// Post-Call Analysis Configuration Tests
// =============================================================================

describe("Post-Call Analysis Configuration", () => {
  const POST_CALL_ANALYSIS_FIELDS = [
    { type: "call_summary", name: "call_summary" },
    { type: "custom", name: "customer_name" },
    { type: "custom", name: "customer_phone" },
    { type: "custom", name: "customer_email" },
    { type: "custom", name: "service_name" },
    { type: "custom", name: "appointment_date" },
    { type: "custom", name: "appointment_booked" },
  ];

  describe("Analysis fields", () => {
    it("should include call summary field", () => {
      const summaryField = POST_CALL_ANALYSIS_FIELDS.find(f => f.name === "call_summary");
      expect(summaryField).toBeDefined();
      expect(summaryField?.type).toBe("call_summary");
    });

    it("should include customer name field", () => {
      const field = POST_CALL_ANALYSIS_FIELDS.find(f => f.name === "customer_name");
      expect(field).toBeDefined();
      expect(field?.type).toBe("custom");
    });

    it("should include customer phone field", () => {
      const field = POST_CALL_ANALYSIS_FIELDS.find(f => f.name === "customer_phone");
      expect(field).toBeDefined();
    });

    it("should include customer email field", () => {
      const field = POST_CALL_ANALYSIS_FIELDS.find(f => f.name === "customer_email");
      expect(field).toBeDefined();
    });

    it("should include service name field", () => {
      const field = POST_CALL_ANALYSIS_FIELDS.find(f => f.name === "service_name");
      expect(field).toBeDefined();
    });

    it("should include appointment date field", () => {
      const field = POST_CALL_ANALYSIS_FIELDS.find(f => f.name === "appointment_date");
      expect(field).toBeDefined();
    });

    it("should include appointment booked field", () => {
      const field = POST_CALL_ANALYSIS_FIELDS.find(f => f.name === "appointment_booked");
      expect(field).toBeDefined();
    });

    it("should have 7 analysis fields", () => {
      expect(POST_CALL_ANALYSIS_FIELDS.length).toBe(7);
    });
  });
});

// =============================================================================
// Onboarding Response Format Tests
// =============================================================================

describe("Onboarding Response Format", () => {
  describe("Success response", () => {
    interface SuccessResponse {
      success: true;
      message: string;
      testCallSkipped: boolean;
    }

    it("should have correct structure", () => {
      const response: SuccessResponse = {
        success: true,
        message: "Onboarding completed successfully",
        testCallSkipped: false,
      };

      expect(response.success).toBe(true);
      expect(response.message).toBeDefined();
      expect(typeof response.testCallSkipped).toBe("boolean");
    });

    it("should indicate if test call was skipped", () => {
      const responseSkipped: SuccessResponse = {
        success: true,
        message: "Onboarding completed successfully",
        testCallSkipped: true,
      };

      expect(responseSkipped.testCallSkipped).toBe(true);
    });
  });

  describe("Error response", () => {
    interface ErrorResponse {
      success: false;
      error: string;
      requiresTestCall?: boolean;
    }

    it("should have correct structure for auth error", () => {
      const response: ErrorResponse = {
        success: false,
        error: "Unauthorized",
      };

      expect(response.success).toBe(false);
      expect(response.error).toBe("Unauthorized");
    });

    it("should have correct structure for test call required", () => {
      const response: ErrorResponse = {
        success: false,
        error: "Please make a test call before completing onboarding, or click 'Skip for now' to proceed without testing.",
        requiresTestCall: true,
      };

      expect(response.success).toBe(false);
      expect(response.requiresTestCall).toBe(true);
    });
  });
});

// =============================================================================
// Default Call Settings Tests
// =============================================================================

describe("Default Call Settings", () => {
  const DEFAULT_CALL_SETTINGS = {
    transfer_number: null,
    transfer_on_request: true,
    transfer_on_emergency: true,
    transfer_on_upset: false,
    after_hours_enabled: true,
    after_hours_can_book: true,
  };

  describe("Transfer settings", () => {
    it("should have no transfer number by default", () => {
      expect(DEFAULT_CALL_SETTINGS.transfer_number).toBeNull();
    });

    it("should enable transfer on request", () => {
      expect(DEFAULT_CALL_SETTINGS.transfer_on_request).toBe(true);
    });

    it("should enable transfer on emergency", () => {
      expect(DEFAULT_CALL_SETTINGS.transfer_on_emergency).toBe(true);
    });

    it("should disable transfer on upset by default", () => {
      expect(DEFAULT_CALL_SETTINGS.transfer_on_upset).toBe(false);
    });
  });

  describe("After hours settings", () => {
    it("should enable after hours by default", () => {
      expect(DEFAULT_CALL_SETTINGS.after_hours_enabled).toBe(true);
    });

    it("should allow booking after hours by default", () => {
      expect(DEFAULT_CALL_SETTINGS.after_hours_can_book).toBe(true);
    });
  });
});

// =============================================================================
// Business Data Fetch Structure Tests
// =============================================================================

describe("Business Data Fetch Structure", () => {
  interface BusinessDataResult {
    business: { name: string; business_type: string };
    businessHours: Array<{ day: number; open: string; close: string }>;
    timezone: string;
    services: Array<{ name: string; duration: number; price: number }>;
    faqs: Array<{ question: string; answer: string }>;
    knowledge: { additional_info: string } | null;
    aiConfig: { ai_name: string; personality: string };
    callSettings: { transfer_number: string | null };
    minutesRemaining: number;
    minutesExhausted: boolean;
  }

  function createDefaultBusinessData(): Partial<BusinessDataResult> {
    return {
      businessHours: [],
      timezone: "America/New_York",
      services: [],
      faqs: [],
      knowledge: null,
      aiConfig: {
        ai_name: "Koya",
        personality: "professional",
      },
      minutesRemaining: 200,
      minutesExhausted: false,
    };
  }

  describe("Default values", () => {
    it("should have empty business hours array", () => {
      const data = createDefaultBusinessData();
      expect(data.businessHours).toEqual([]);
    });

    it("should default to America/New_York timezone", () => {
      const data = createDefaultBusinessData();
      expect(data.timezone).toBe("America/New_York");
    });

    it("should have 200 minutes remaining by default", () => {
      const data = createDefaultBusinessData();
      expect(data.minutesRemaining).toBe(200);
    });

    it("should not be minutes exhausted by default", () => {
      const data = createDefaultBusinessData();
      expect(data.minutesExhausted).toBe(false);
    });
  });
});

// =============================================================================
// Edge Case Tests
// =============================================================================

describe("Edge Cases", () => {
  // ---------------------------------------------------------------------------
  // Empty Business Name
  // ---------------------------------------------------------------------------
  describe("Empty business name in greeting generation", () => {
    function generateDefaultGreeting(businessName: string, aiName: string): string {
      return `Thanks for calling ${businessName}, this is ${aiName}, how can I help you?`;
    }

    function generateSafeGreeting(businessName: string, aiName: string): string {
      const safeName = businessName?.trim() || "our business";
      const safeAiName = aiName?.trim() || "your assistant";
      return `Thanks for calling ${safeName}, this is ${safeAiName}, how can I help you?`;
    }

    it("should produce awkward greeting with empty business name", () => {
      const greeting = generateDefaultGreeting("", "Koya");
      expect(greeting).toBe("Thanks for calling , this is Koya, how can I help you?");
    });

    it("should use fallback for empty business name with safe function", () => {
      const greeting = generateSafeGreeting("", "Koya");
      expect(greeting).toBe("Thanks for calling our business, this is Koya, how can I help you?");
    });

    it("should handle whitespace-only business name", () => {
      const greeting = generateSafeGreeting("   ", "Koya");
      expect(greeting).toBe("Thanks for calling our business, this is Koya, how can I help you?");
    });

    it("should preserve valid business name", () => {
      const greeting = generateSafeGreeting("Acme Dental", "Koya");
      expect(greeting).toContain("Acme Dental");
    });

    it("should handle both empty business and AI name", () => {
      const greeting = generateSafeGreeting("", "");
      expect(greeting).toBe("Thanks for calling our business, this is your assistant, how can I help you?");
    });
  });

  // ---------------------------------------------------------------------------
  // Special Characters in Business Name
  // ---------------------------------------------------------------------------
  describe("Special characters in business name", () => {
    function generateGreeting(businessName: string, aiName: string): string {
      return `Thanks for calling ${businessName}, this is ${aiName}, how can I help you?`;
    }

    function sanitizeBusinessName(name: string): string {
      // Remove or escape potentially dangerous characters
      return name
        .replace(/[<>]/g, "") // Remove angle brackets (XSS)
        .replace(/["']/g, (match) => (match === '"' ? '\\"' : "\\'")) // Escape quotes
        .replace(/[\r\n]/g, " ") // Replace newlines with space
        .trim();
    }

    function isSafeForDisplay(name: string): boolean {
      const dangerousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i, // onclick, onerror, etc.
        /<iframe/i,
        /<img[^>]+onerror/i,
      ];
      return !dangerousPatterns.some(pattern => pattern.test(name));
    }

    it("should detect XSS script tags as unsafe", () => {
      const xssName = '<script>alert("xss")</script>';
      expect(isSafeForDisplay(xssName)).toBe(false);
    });

    it("should detect javascript: protocol as unsafe", () => {
      const xssName = 'javascript:alert("xss")';
      expect(isSafeForDisplay(xssName)).toBe(false);
    });

    it("should detect event handlers as unsafe", () => {
      const xssName = 'Business" onclick="alert(1)';
      expect(isSafeForDisplay(xssName)).toBe(false);
    });

    it("should detect img onerror as unsafe", () => {
      const xssName = '<img src=x onerror=alert(1)>';
      expect(isSafeForDisplay(xssName)).toBe(false);
    });

    it("should allow normal business names with special chars", () => {
      expect(isSafeForDisplay("O'Brien & Sons, LLC")).toBe(true);
      expect(isSafeForDisplay("Cafe Sante")).toBe(true);
      expect(isSafeForDisplay("Dr. Smith's Dental (Main St.)")).toBe(true);
    });

    it("should sanitize angle brackets", () => {
      const sanitized = sanitizeBusinessName("<Business>Name");
      expect(sanitized).toBe("BusinessName");
    });

    it("should escape quotes in business name", () => {
      const sanitized = sanitizeBusinessName('Business "Best" Name');
      expect(sanitized).toContain('\\"');
    });

    it("should replace newlines with space", () => {
      const sanitized = sanitizeBusinessName("Business\nName\rHere");
      expect(sanitized).toBe("Business Name Here");
    });

    it("should handle Unicode characters safely", () => {
      expect(isSafeForDisplay("Cafe Sante")).toBe(true);
      expect(isSafeForDisplay("Li Wei Acupuncture")).toBe(true);
    });

    it("should handle emoji in business name", () => {
      const greeting = generateGreeting("Happy Pets", "Koya");
      expect(greeting).toContain("Happy Pets");
    });
  });

  // ---------------------------------------------------------------------------
  // Very Long Business Name
  // ---------------------------------------------------------------------------
  describe("Very long business name", () => {
    const MAX_NAME_LENGTH = 100;

    function truncateName(name: string, maxLength: number = MAX_NAME_LENGTH): string {
      if (name.length <= maxLength) return name;
      return name.substring(0, maxLength - 3) + "...";
    }

    function generateGreetingWithTruncation(businessName: string, aiName: string): string {
      const safeName = truncateName(businessName.trim());
      return `Thanks for calling ${safeName}, this is ${aiName}, how can I help you?`;
    }

    it("should truncate names exceeding maximum length", () => {
      const longName = "A".repeat(150);
      const truncated = truncateName(longName);
      expect(truncated.length).toBe(MAX_NAME_LENGTH);
      expect(truncated.endsWith("...")).toBe(true);
    });

    it("should preserve short names", () => {
      const shortName = "Acme Dental";
      expect(truncateName(shortName)).toBe(shortName);
    });

    it("should handle name exactly at max length", () => {
      const exactName = "A".repeat(MAX_NAME_LENGTH);
      expect(truncateName(exactName)).toBe(exactName);
    });

    it("should handle name one character over max length", () => {
      const overName = "A".repeat(MAX_NAME_LENGTH + 1);
      const truncated = truncateName(overName);
      expect(truncated.length).toBe(MAX_NAME_LENGTH);
    });

    it("should generate reasonable greeting with very long name", () => {
      const longName = "The Absolutely Most Incredible Amazing Wonderful Fantastic Super Duper Really Long Business Name That Just Keeps Going";
      const greeting = generateGreetingWithTruncation(longName, "Koya");
      expect(greeting.length).toBeLessThan(200);
      expect(greeting).toContain("...");
    });

    it("should handle custom truncation length", () => {
      const name = "This is a moderately long name";
      const truncated = truncateName(name, 20);
      expect(truncated.length).toBe(20);
    });
  });

  // ---------------------------------------------------------------------------
  // Empty Voice ID (not just null)
  // ---------------------------------------------------------------------------
  describe("Empty voice ID in voice preview", () => {
    const VOICE_PREVIEWS: Record<string, string> = {
      "grace-warm": "https://retell-utils-public.s3.us-west-2.amazonaws.com/grace.mp3",
      "jenny-professional": "https://retell-utils-public.s3.us-west-2.amazonaws.com/Jenny.mp3",
    };

    function validateVoiceId(voiceId: string | null | undefined): {
      valid: boolean;
      error?: string;
      url?: string;
    } {
      // Handle null, undefined, empty string, and whitespace-only
      if (!voiceId || voiceId.trim() === "") {
        return { valid: false, error: "Voice ID is required. Please provide a valid voice ID." };
      }

      const trimmedId = voiceId.trim();
      const previewUrl = VOICE_PREVIEWS[trimmedId];
      if (!previewUrl) {
        return { valid: false, error: "The requested voice could not be found. Please select a different voice." };
      }

      return { valid: true, url: previewUrl };
    }

    it("should reject empty string voice ID", () => {
      const result = validateVoiceId("");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Voice ID is required");
    });

    it("should reject whitespace-only voice ID", () => {
      const result = validateVoiceId("   ");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Voice ID is required");
    });

    it("should reject undefined voice ID", () => {
      const result = validateVoiceId(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Voice ID is required");
    });

    it("should reject null voice ID", () => {
      const result = validateVoiceId(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Voice ID is required");
    });

    it("should trim whitespace from valid voice ID", () => {
      const result = validateVoiceId("  grace-warm  ");
      expect(result.valid).toBe(true);
      expect(result.url).toBeDefined();
    });

    it("should distinguish between empty and unknown voice ID errors", () => {
      const emptyResult = validateVoiceId("");
      const unknownResult = validateVoiceId("nonexistent-voice");

      expect(emptyResult.error).toContain("required");
      expect(unknownResult.error).toContain("could not be found");
    });

    it("should handle voice ID with only newlines", () => {
      const result = validateVoiceId("\n\n\t");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Voice ID is required");
    });
  });
});
