/**
 * Dashboard Calls API Integration Tests
 *
 * Tests for GET /api/dashboard/calls and PATCH /api/dashboard/calls
 * using the mock Supabase infrastructure.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  setupAuthenticatedContext,
  setupTestScenario,
  setupUnauthenticatedContext,
  cleanupTestContext,
  createGetRequest,
  createPatchRequest,
  parseResponse,
  expectSuccessResponse,
  expectErrorResponse,
  seedCalls,
  getMockCall,
} from "../utils/api-helpers";
import { createCall, createCallsWithVariedOutcomes } from "../utils/test-factories";
import { seedMockData } from "../utils/mock-supabase";

// Mock the auth middleware and Supabase
vi.mock("@/lib/supabase/server", async () => {
  const { createMockSupabaseClient } = await import("../utils/mock-supabase");
  return {
    createClient: vi.fn(() => Promise.resolve(createMockSupabaseClient())),
  };
});

vi.mock("@/lib/rate-limit/middleware", () => ({
  withDashboardRateLimit: (handler: Function) => handler,
}));

vi.mock("@/lib/logging", () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

// Import the route handlers after mocking
import { GET, PATCH } from "@/app/api/dashboard/calls/route";

describe("Dashboard Calls API", () => {
  beforeEach(() => {
    cleanupTestContext();
  });

  afterEach(() => {
    cleanupTestContext();
    vi.clearAllMocks();
  });

  describe("GET /api/dashboard/calls", () => {
    describe("Authentication", () => {
      it("should return 401 when user is not authenticated", async () => {
        setupUnauthenticatedContext();

        const request = createGetRequest("/api/dashboard/calls");
        const response = await GET(request);

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error.code).toBe("UNAUTHORIZED");
      });

      it("should return 404 when user has no business", async () => {
        // Set up user without business
        const { user } = setupAuthenticatedContext();
        // Clear the seeded business
        cleanupTestContext();
        // Re-setup user only
        const { setMockUser } = await import("../utils/mock-supabase");
        setMockUser(user);

        const request = createGetRequest("/api/dashboard/calls");
        const response = await GET(request);

        expect(response.status).toBe(404);
      });
    });

    describe("Success Cases", () => {
      it("should return calls for authenticated user", async () => {
        const { business } = setupAuthenticatedContext();
        const calls = createCallsWithVariedOutcomes(business.id, 5);
        seedMockData("calls", calls);

        const request = createGetRequest("/api/dashboard/calls");
        const response = await GET(request);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.calls).toHaveLength(5);
        expect(data.data.total).toBe(5);
      });

      it("should support pagination with limit and offset", async () => {
        const { business } = setupAuthenticatedContext();
        const calls = createCallsWithVariedOutcomes(business.id, 20);
        seedMockData("calls", calls);

        // First page
        const firstRequest = createGetRequest("/api/dashboard/calls", {
          limit: "10",
          offset: "0",
        });
        const firstResponse = await GET(firstRequest);
        const firstData = await firstResponse.json();

        expect(firstData.data.calls).toHaveLength(10);
        expect(firstData.data.hasMore).toBe(true);

        // Second page
        const secondRequest = createGetRequest("/api/dashboard/calls", {
          limit: "10",
          offset: "10",
        });
        const secondResponse = await GET(secondRequest);
        const secondData = await secondResponse.json();

        expect(secondData.data.calls).toHaveLength(10);
        expect(secondData.data.hasMore).toBe(false);
      });

      it("should filter calls by outcome", async () => {
        const { business } = setupAuthenticatedContext();
        const calls = createCallsWithVariedOutcomes(business.id, 10);
        seedMockData("calls", calls);

        const request = createGetRequest("/api/dashboard/calls", {
          outcome: "booked",
        });
        const response = await GET(request);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.data.calls.every((c: { outcome: string }) => c.outcome === "booked")).toBe(true);
      });

      it("should filter calls by language", async () => {
        const { business } = setupAuthenticatedContext();
        const calls = [
          createCall({ businessId: business.id, language: "en" }),
          createCall({ businessId: business.id, language: "en" }),
          createCall({ businessId: business.id, language: "es" }),
        ];
        seedMockData("calls", calls);

        const request = createGetRequest("/api/dashboard/calls", {
          language: "es",
        });
        const response = await GET(request);
        const data = await response.json();

        expect(data.data.calls.every((c: { language: string }) => c.language === "es")).toBe(true);
      });

      it("should filter calls by date range", async () => {
        const { business } = setupAuthenticatedContext();
        const today = new Date();
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        const twoDaysAgo = new Date(today.getTime() - 48 * 60 * 60 * 1000);

        const calls = [
          createCall({
            businessId: business.id,
            created_at: today.toISOString(),
            started_at: today.toISOString(),
          }),
          createCall({
            businessId: business.id,
            created_at: yesterday.toISOString(),
            started_at: yesterday.toISOString(),
          }),
          createCall({
            businessId: business.id,
            created_at: twoDaysAgo.toISOString(),
            started_at: twoDaysAgo.toISOString(),
          }),
        ];
        seedMockData("calls", calls);

        const request = createGetRequest("/api/dashboard/calls", {
          startDate: yesterday.toISOString().split("T")[0],
          endDate: today.toISOString().split("T")[0],
        });
        const response = await GET(request);
        const data = await response.json();

        expect(data.data.calls.length).toBeLessThanOrEqual(2);
      });

      it("should return recent calls when recent=true", async () => {
        const { business } = setupAuthenticatedContext();
        const calls = createCallsWithVariedOutcomes(business.id, 20);
        seedMockData("calls", calls);

        const request = createGetRequest("/api/dashboard/calls", {
          recent: "true",
        });
        const response = await GET(request);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.data.calls.length).toBeLessThanOrEqual(10);
        expect(data.data.hasMore).toBe(false);
      });
    });

    describe("Empty Results", () => {
      it("should return empty array when no calls exist", async () => {
        setupAuthenticatedContext();

        const request = createGetRequest("/api/dashboard/calls");
        const response = await GET(request);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.data.calls).toHaveLength(0);
        expect(data.data.total).toBe(0);
      });
    });
  });

  describe("PATCH /api/dashboard/calls", () => {
    describe("Authentication", () => {
      it("should return 401 when user is not authenticated", async () => {
        setupUnauthenticatedContext();

        const request = createPatchRequest("/api/dashboard/calls", {
          id: "some-call-id",
          flagged: true,
        });
        const response = await PATCH(request);

        expect(response.status).toBe(401);
      });
    });

    describe("Validation", () => {
      it("should return 400 when call ID is missing", async () => {
        setupAuthenticatedContext();

        const request = createPatchRequest("/api/dashboard/calls", {
          flagged: true,
        });
        const response = await PATCH(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error.message).toContain("Call ID is required");
      });

      it("should return 400 when no updates provided", async () => {
        const { business } = setupAuthenticatedContext();
        const call = createCall({ businessId: business.id });
        seedMockData("calls", [call]);

        const request = createPatchRequest("/api/dashboard/calls", {
          id: call.id,
        });
        const response = await PATCH(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error.message).toContain("No updates provided");
      });
    });

    describe("Authorization", () => {
      it("should return 404 when call does not exist", async () => {
        setupAuthenticatedContext();

        const request = createPatchRequest("/api/dashboard/calls", {
          id: "non-existent-call-id",
          flagged: true,
        });
        const response = await PATCH(request);

        expect(response.status).toBe(404);
      });

      it("should return 403 when call belongs to different business", async () => {
        setupAuthenticatedContext();
        // Create a call for a different business
        const otherBusinessCall = createCall({ businessId: "other-business-id" });
        seedMockData("calls", [otherBusinessCall]);

        const request = createPatchRequest("/api/dashboard/calls", {
          id: otherBusinessCall.id,
          flagged: true,
        });
        const response = await PATCH(request);

        expect(response.status).toBe(403);
      });
    });

    describe("Success Cases", () => {
      it("should update call flagged status", async () => {
        const { business } = setupAuthenticatedContext();
        const call = createCall({ businessId: business.id, flagged: false });
        seedMockData("calls", [call]);

        const request = createPatchRequest("/api/dashboard/calls", {
          id: call.id,
          flagged: true,
        });
        const response = await PATCH(request);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.flagged).toBe(true);
      });

      it("should update call notes", async () => {
        const { business } = setupAuthenticatedContext();
        const call = createCall({ businessId: business.id, notes: null });
        seedMockData("calls", [call]);

        const request = createPatchRequest("/api/dashboard/calls", {
          id: call.id,
          notes: "This is a test note",
        });
        const response = await PATCH(request);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.notes).toBe("This is a test note");
      });

      it("should update both flagged and notes simultaneously", async () => {
        const { business } = setupAuthenticatedContext();
        const call = createCall({
          businessId: business.id,
          flagged: false,
          notes: null,
        });
        seedMockData("calls", [call]);

        const request = createPatchRequest("/api/dashboard/calls", {
          id: call.id,
          flagged: true,
          notes: "Important call - follow up needed",
        });
        const response = await PATCH(request);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.flagged).toBe(true);
        expect(data.data.notes).toBe("Important call - follow up needed");
      });
    });
  });
});
