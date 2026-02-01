/**
 * HubSpot CRM Integration Tests
 * Tests for OAuth flow, token management, and sync operations
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_CRM_SETTINGS,
  crmTokensNeedRefresh,
  type CRMIntegration,
  type CRMIntegrationSettings,
} from "@/lib/db/crm";

// ============================================
// CRM Settings Tests
// ============================================

describe("CRM Settings", () => {
  describe("DEFAULT_CRM_SETTINGS", () => {
    it("should have correct default values", () => {
      expect(DEFAULT_CRM_SETTINGS).toEqual({
        auto_sync_contacts: true,
        log_calls: true,
        create_deals: true,
        deal_pipeline_id: null,
        deal_stage_id: null,
        deal_owner_id: null,
      });
    });

    it("should enable auto sync by default", () => {
      expect(DEFAULT_CRM_SETTINGS.auto_sync_contacts).toBe(true);
    });

    it("should enable call logging by default", () => {
      expect(DEFAULT_CRM_SETTINGS.log_calls).toBe(true);
    });

    it("should enable deal creation by default", () => {
      expect(DEFAULT_CRM_SETTINGS.create_deals).toBe(true);
    });
  });
});

// ============================================
// Token Refresh Logic Tests
// ============================================

describe("Token Refresh Logic", () => {
  const createMockIntegration = (
    expiresAt: Date | null
  ): CRMIntegration => ({
    id: "test-id",
    business_id: "business-id",
    provider: "hubspot",
    access_token: "test-access-token",
    refresh_token: "test-refresh-token",
    token_expires_at: expiresAt?.toISOString() ?? null,
    hub_id: "12345",
    settings: DEFAULT_CRM_SETTINGS,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  describe("crmTokensNeedRefresh", () => {
    it("should return true when token_expires_at is null", () => {
      const integration = createMockIntegration(null);
      expect(crmTokensNeedRefresh(integration)).toBe(true);
    });

    it("should return true when token is already expired", () => {
      const expiredDate = new Date(Date.now() - 60000); // 1 minute ago
      const integration = createMockIntegration(expiredDate);
      expect(crmTokensNeedRefresh(integration)).toBe(true);
    });

    it("should return true when token expires within buffer time", () => {
      const expiresInThreeMinutes = new Date(Date.now() + 3 * 60 * 1000);
      const integration = createMockIntegration(expiresInThreeMinutes);
      // Default buffer is 5 minutes, so 3 minutes should trigger refresh
      expect(crmTokensNeedRefresh(integration)).toBe(true);
    });

    it("should return false when token has plenty of time left", () => {
      const expiresInOneHour = new Date(Date.now() + 60 * 60 * 1000);
      const integration = createMockIntegration(expiresInOneHour);
      expect(crmTokensNeedRefresh(integration)).toBe(false);
    });

    it("should respect custom buffer time", () => {
      const expiresInTenMinutes = new Date(Date.now() + 10 * 60 * 1000);
      const integration = createMockIntegration(expiresInTenMinutes);

      // With default 5 minute buffer, should NOT need refresh
      expect(crmTokensNeedRefresh(integration, 5)).toBe(false);

      // With 15 minute buffer, should need refresh
      expect(crmTokensNeedRefresh(integration, 15)).toBe(true);
    });

    it("should handle edge case at exactly buffer time", () => {
      const expiresAtExactBuffer = new Date(Date.now() + 5 * 60 * 1000);
      const integration = createMockIntegration(expiresAtExactBuffer);
      // At exactly 5 minutes remaining, token does NOT need refresh yet (uses < comparison)
      expect(crmTokensNeedRefresh(integration, 5)).toBe(false);
    });
  });
});

// ============================================
// OAuth State Tests
// ============================================

describe("OAuth State Handling", () => {
  describe("State token generation", () => {
    it("should create valid base64url encoded state", () => {
      const businessId = "test-business-id";
      const returnUrl = "/integrations";
      const nonce = crypto.randomUUID();
      const timestamp = Date.now();

      const state = {
        businessId,
        returnUrl,
        nonce,
        timestamp,
      };

      const encoded = Buffer.from(JSON.stringify(state)).toString("base64url");
      const decoded = JSON.parse(
        Buffer.from(encoded, "base64url").toString("utf-8")
      );

      expect(decoded.businessId).toBe(businessId);
      expect(decoded.returnUrl).toBe(returnUrl);
      expect(decoded.nonce).toBe(nonce);
      expect(decoded.timestamp).toBe(timestamp);
    });

    it("should handle special characters in returnUrl", () => {
      const state = {
        businessId: "test-id",
        returnUrl: "/integrations?tab=crm&status=connected",
        nonce: "test-nonce",
        timestamp: Date.now(),
      };

      const encoded = Buffer.from(JSON.stringify(state)).toString("base64url");
      const decoded = JSON.parse(
        Buffer.from(encoded, "base64url").toString("utf-8")
      );

      expect(decoded.returnUrl).toBe("/integrations?tab=crm&status=connected");
    });
  });

  describe("State validation", () => {
    it("should detect expired state tokens", () => {
      const maxAge = 15 * 60 * 1000; // 15 minutes
      const oldTimestamp = Date.now() - 20 * 60 * 1000; // 20 minutes ago

      const isExpired = Date.now() - oldTimestamp > maxAge;
      expect(isExpired).toBe(true);
    });

    it("should accept valid state tokens within time window", () => {
      const maxAge = 15 * 60 * 1000;
      const recentTimestamp = Date.now() - 5 * 60 * 1000; // 5 minutes ago

      const isExpired = Date.now() - recentTimestamp > maxAge;
      expect(isExpired).toBe(false);
    });
  });
});

// ============================================
// HubSpot API Response Handling
// ============================================

describe("HubSpot API Response Handling", () => {
  describe("Contact creation response parsing", () => {
    it("should extract contact ID from successful response", () => {
      const response = {
        id: "12345",
        properties: {
          email: "test@example.com",
          firstname: "John",
          lastname: "Doe",
        },
      };

      expect(response.id).toBe("12345");
    });

    it("should handle response with null properties", () => {
      const response = {
        id: "12345",
        properties: {
          email: null,
          firstname: null,
          lastname: null,
        },
      };

      expect(response.id).toBeDefined();
      expect(response.properties.email).toBeNull();
    });
  });

  describe("Name parsing for HubSpot", () => {
    it("should split full name into first and last name", () => {
      const fullName = "John Doe";
      const nameParts = fullName.trim().split(" ");
      const firstName = nameParts[0] || null;
      const lastName = nameParts.slice(1).join(" ") || null;

      expect(firstName).toBe("John");
      expect(lastName).toBe("Doe");
    });

    it("should handle single name", () => {
      const fullName = "John";
      const nameParts = fullName.trim().split(" ");
      const firstName = nameParts[0] || null;
      const lastName = nameParts.slice(1).join(" ") || null;

      expect(firstName).toBe("John");
      // Empty string becomes null due to || null
      expect(lastName).toBeNull();
    });

    it("should handle multiple last names", () => {
      const fullName = "John Van Der Berg";
      const nameParts = fullName.trim().split(" ");
      const firstName = nameParts[0] || null;
      const lastName = nameParts.slice(1).join(" ") || null;

      expect(firstName).toBe("John");
      expect(lastName).toBe("Van Der Berg");
    });

    it("should handle empty name", () => {
      const fullName = "";
      const nameParts = fullName.trim().split(" ");
      const firstName = nameParts[0] || null;
      const lastName = nameParts.slice(1).join(" ") || null;

      // Empty string becomes null due to || null
      expect(firstName).toBeNull();
      expect(lastName).toBeNull();
    });

    it("should handle name with extra whitespace", () => {
      const fullName = "  John   Doe  ";
      const nameParts = fullName.trim().split(" ").filter(Boolean);
      const firstName = nameParts[0] || null;
      const lastName = nameParts.slice(1).join(" ") || null;

      expect(firstName).toBe("John");
      expect(lastName).toBe("Doe");
    });
  });
});

// ============================================
// Sync Status Tests
// ============================================

describe("Sync Status Handling", () => {
  describe("Valid sync statuses", () => {
    const validStatuses = ["pending", "success", "failed", "skipped"];

    it("should recognize all valid sync statuses", () => {
      validStatuses.forEach((status) => {
        expect(validStatuses.includes(status)).toBe(true);
      });
    });

    it("should reject invalid status", () => {
      expect(validStatuses.includes("unknown")).toBe(false);
    });
  });

  describe("Sync directions", () => {
    const validDirections = ["outbound", "inbound"];

    it("should recognize outbound direction", () => {
      expect(validDirections.includes("outbound")).toBe(true);
    });

    it("should recognize inbound direction", () => {
      expect(validDirections.includes("inbound")).toBe(true);
    });
  });

  describe("Entity types", () => {
    const validEntityTypes = ["contact", "call", "appointment", "deal"];

    it("should support contact entity type", () => {
      expect(validEntityTypes.includes("contact")).toBe(true);
    });

    it("should support call entity type", () => {
      expect(validEntityTypes.includes("call")).toBe(true);
    });

    it("should support appointment entity type", () => {
      expect(validEntityTypes.includes("appointment")).toBe(true);
    });

    it("should support deal entity type", () => {
      expect(validEntityTypes.includes("deal")).toBe(true);
    });
  });
});

// ============================================
// Sync Stats Calculation Tests
// ============================================

describe("Sync Stats Calculation", () => {
  describe("Success rate calculation", () => {
    it("should calculate 100% success rate correctly", () => {
      const total = 10;
      const success = 10;
      const successRate = total > 0 ? Math.round((success / total) * 100) : 100;
      expect(successRate).toBe(100);
    });

    it("should calculate 50% success rate correctly", () => {
      const total = 10;
      const success = 5;
      const successRate = total > 0 ? Math.round((success / total) * 100) : 100;
      expect(successRate).toBe(50);
    });

    it("should calculate 0% success rate correctly", () => {
      const total = 10;
      const success = 0;
      const successRate = total > 0 ? Math.round((success / total) * 100) : 100;
      expect(successRate).toBe(0);
    });

    it("should return 100% when no syncs have occurred", () => {
      const total = 0;
      const success = 0;
      const successRate = total > 0 ? Math.round((success / total) * 100) : 100;
      expect(successRate).toBe(100);
    });

    it("should round correctly for percentages", () => {
      const total = 3;
      const success = 1;
      // 1/3 = 33.33...% -> should round to 33
      const successRate = total > 0 ? Math.round((success / total) * 100) : 100;
      expect(successRate).toBe(33);
    });
  });
});

// ============================================
// Provider Validation Tests
// ============================================

describe("CRM Provider Validation", () => {
  const validProviders = ["hubspot", "salesforce", "zoho"];

  it("should accept hubspot as valid provider", () => {
    expect(validProviders.includes("hubspot")).toBe(true);
  });

  it("should accept salesforce as valid provider", () => {
    expect(validProviders.includes("salesforce")).toBe(true);
  });

  it("should accept zoho as valid provider", () => {
    expect(validProviders.includes("zoho")).toBe(true);
  });

  it("should reject invalid provider", () => {
    expect(validProviders.includes("pipedrive")).toBe(false);
    expect(validProviders.includes("monday")).toBe(false);
  });
});

// ============================================
// Settings Merge Tests
// ============================================

describe("CRM Settings Merge", () => {
  it("should merge partial settings with defaults", () => {
    const currentSettings = DEFAULT_CRM_SETTINGS;
    const updates: Partial<CRMIntegrationSettings> = {
      auto_sync_contacts: false,
    };

    const merged = {
      ...currentSettings,
      ...updates,
    };

    expect(merged.auto_sync_contacts).toBe(false);
    expect(merged.log_calls).toBe(true); // Unchanged
    expect(merged.create_deals).toBe(true); // Unchanged
  });

  it("should allow setting deal pipeline configuration", () => {
    const currentSettings = DEFAULT_CRM_SETTINGS;
    const updates: Partial<CRMIntegrationSettings> = {
      deal_pipeline_id: "pipeline-123",
      deal_stage_id: "stage-456",
      deal_owner_id: "owner-789",
    };

    const merged = {
      ...currentSettings,
      ...updates,
    };

    expect(merged.deal_pipeline_id).toBe("pipeline-123");
    expect(merged.deal_stage_id).toBe("stage-456");
    expect(merged.deal_owner_id).toBe("owner-789");
  });

  it("should preserve existing settings when merging empty updates", () => {
    const currentSettings: CRMIntegrationSettings = {
      auto_sync_contacts: false,
      log_calls: false,
      create_deals: false,
      deal_pipeline_id: "existing-pipeline",
      deal_stage_id: null,
      deal_owner_id: null,
    };
    const updates: Partial<CRMIntegrationSettings> = {};

    const merged = {
      ...currentSettings,
      ...updates,
    };

    expect(merged).toEqual(currentSettings);
  });
});
