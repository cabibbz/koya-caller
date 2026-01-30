/**
 * API Testing Helpers
 *
 * Utilities for testing Next.js API routes in integration tests.
 * Provides request building, response parsing, and common assertions.
 */

import { NextRequest } from "next/server";
import { vi } from "vitest";
import {
  mockDataStore,
  setMockUser,
  setMockAuthError,
  seedMockData,
  resetMockData,
  getMockTableData,
  getMockRecord,
  type MockUser,
} from "./mock-supabase";
import {
  createMockUser,
  createBusiness,
  createCall,
  createAppointment,
  createTestScenario,
  type TestScenarioData,
} from "./test-factories";
import type { Call, Business, Appointment } from "@/types";

// =============================================================================
// Types
// =============================================================================

export interface APITestContext {
  user: MockUser;
  business: Business;
  scenario?: TestScenarioData;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  searchParams?: Record<string, string>;
  headers?: Record<string, string>;
}

export interface ParsedResponse<T = unknown> {
  status: number;
  ok: boolean;
  data: T;
  headers: Headers;
}

// =============================================================================
// Request Builders
// =============================================================================

/**
 * Creates a NextRequest object for testing API routes
 */
export function createTestRequest(
  path: string,
  options: RequestOptions = {}
): NextRequest {
  const { method = "GET", body, searchParams, headers = {} } = options;

  // Build URL with search params
  let url = `http://localhost:3000${path}`;
  if (searchParams) {
    const params = new URLSearchParams(searchParams);
    url += `?${params.toString()}`;
  }

  // Build request init
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (body && method !== "GET") {
    init.body = JSON.stringify(body);
  }

  return new NextRequest(url, init);
}

/**
 * Creates a GET request
 */
export function createGetRequest(
  path: string,
  searchParams?: Record<string, string>,
  headers?: Record<string, string>
): NextRequest {
  return createTestRequest(path, { method: "GET", searchParams, headers });
}

/**
 * Creates a POST request
 */
export function createPostRequest(
  path: string,
  body?: Record<string, unknown>,
  headers?: Record<string, string>
): NextRequest {
  return createTestRequest(path, { method: "POST", body, headers });
}

/**
 * Creates a PATCH request
 */
export function createPatchRequest(
  path: string,
  body?: Record<string, unknown>,
  headers?: Record<string, string>
): NextRequest {
  return createTestRequest(path, { method: "PATCH", body, headers });
}

/**
 * Creates a PUT request
 */
export function createPutRequest(
  path: string,
  body?: Record<string, unknown>,
  headers?: Record<string, string>
): NextRequest {
  return createTestRequest(path, { method: "PUT", body, headers });
}

/**
 * Creates a DELETE request
 */
export function createDeleteRequest(
  path: string,
  headers?: Record<string, string>
): NextRequest {
  return createTestRequest(path, { method: "DELETE", headers });
}

// =============================================================================
// Response Helpers
// =============================================================================

/**
 * Parses a Response object into a typed result
 */
export async function parseResponse<T = unknown>(
  response: Response
): Promise<ParsedResponse<T>> {
  let data: T;

  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    data = await response.json();
  } else {
    data = (await response.text()) as unknown as T;
  }

  return {
    status: response.status,
    ok: response.ok,
    data,
    headers: response.headers,
  };
}

/**
 * Expects a successful JSON response
 */
export async function expectSuccessResponse<T = unknown>(
  response: Response,
  expectedStatus: number = 200
): Promise<T> {
  const parsed = await parseResponse<{ success?: boolean; data?: T; error?: string }>(
    response
  );

  if (parsed.status !== expectedStatus) {
    throw new Error(
      `Expected status ${expectedStatus}, got ${parsed.status}. Response: ${JSON.stringify(parsed.data)}`
    );
  }

  if (!parsed.ok) {
    throw new Error(`Expected successful response, got error: ${JSON.stringify(parsed.data)}`);
  }

  return parsed.data as T;
}

/**
 * Expects an error response
 */
export async function expectErrorResponse(
  response: Response,
  expectedStatus: number,
  expectedError?: string | RegExp
): Promise<{ error: string }> {
  const parsed = await parseResponse<{ error: string }>(response);

  if (parsed.status !== expectedStatus) {
    throw new Error(
      `Expected status ${expectedStatus}, got ${parsed.status}. Response: ${JSON.stringify(parsed.data)}`
    );
  }

  if (parsed.ok) {
    throw new Error(`Expected error response, got success: ${JSON.stringify(parsed.data)}`);
  }

  if (expectedError) {
    const errorMessage = parsed.data.error;
    if (typeof expectedError === "string") {
      if (errorMessage !== expectedError) {
        throw new Error(`Expected error "${expectedError}", got "${errorMessage}"`);
      }
    } else {
      if (!expectedError.test(errorMessage)) {
        throw new Error(
          `Expected error matching ${expectedError}, got "${errorMessage}"`
        );
      }
    }
  }

  return parsed.data;
}

// =============================================================================
// Test Setup Helpers
// =============================================================================

/**
 * Sets up an authenticated test context with a user and business
 */
export function setupAuthenticatedContext(options?: {
  userId?: string;
  businessId?: string;
  subscriptionStatus?: string;
}): APITestContext {
  const user = createMockUser({ id: options?.userId });
  const business = createBusiness({
    id: options?.businessId,
    userId: user.id,
    subscription_status: (options?.subscriptionStatus as Business["subscription_status"]) || "active",
  });

  // Set up mock user
  setMockUser(user);

  // Seed business data
  seedMockData("businesses", [business]);

  return { user, business };
}

/**
 * Sets up a complete test scenario with multiple entities
 */
export function setupTestScenario(options?: {
  callCount?: number;
  appointmentCount?: number;
  serviceCount?: number;
  faqCount?: number;
}): APITestContext & { scenario: TestScenarioData } {
  const scenario = createTestScenario(options);

  // Set up mock user
  setMockUser(scenario.user);

  // Seed all data
  seedMockData("businesses", [scenario.business]);
  seedMockData("calls", scenario.calls);
  seedMockData("appointments", scenario.appointments);
  seedMockData("services", scenario.services);
  seedMockData("faqs", scenario.faqs);

  return {
    user: scenario.user,
    business: scenario.business,
    scenario,
  };
}

/**
 * Sets up an unauthenticated context (no user)
 */
export function setupUnauthenticatedContext(): void {
  setMockUser(null);
}

/**
 * Sets up a context with an authentication error
 */
export function setupAuthErrorContext(errorMessage: string = "Auth error"): void {
  setMockAuthError(new Error(errorMessage));
}

/**
 * Cleans up test context between tests
 */
export function cleanupTestContext(): void {
  resetMockData();
}

// =============================================================================
// Data Verification Helpers
// =============================================================================

/**
 * Gets all calls from mock database
 */
export function getMockCalls(): Call[] {
  return getMockTableData("calls") as unknown as Call[];
}

/**
 * Gets a specific call from mock database
 */
export function getMockCall(id: string): Call | null {
  return getMockRecord("calls", id) as unknown as Call | null;
}

/**
 * Gets all businesses from mock database
 */
export function getMockBusinesses(): Business[] {
  return getMockTableData("businesses") as unknown as Business[];
}

/**
 * Gets a specific business from mock database
 */
export function getMockBusiness(id: string): Business | null {
  return getMockRecord("businesses", id) as unknown as Business | null;
}

/**
 * Gets all appointments from mock database
 */
export function getMockAppointments(): Appointment[] {
  return getMockTableData("appointments") as unknown as Appointment[];
}

/**
 * Gets a specific appointment from mock database
 */
export function getMockAppointment(id: string): Appointment | null {
  return getMockRecord("appointments", id) as unknown as Appointment | null;
}

// =============================================================================
// Seed Helpers
// =============================================================================

/**
 * Seeds additional calls for a business
 */
export function seedCalls(businessId: string, count: number): Call[] {
  const calls = Array.from({ length: count }, () => createCall({ businessId }));
  seedMockData("calls", calls);
  return calls;
}

/**
 * Seeds additional appointments for a business
 */
export function seedAppointments(businessId: string, count: number): Appointment[] {
  const appointments = Array.from({ length: count }, () =>
    createAppointment({ businessId })
  );
  seedMockData("appointments", appointments);
  return appointments;
}

// =============================================================================
// Mock Module Setup
// =============================================================================

/**
 * Mocks external dependencies commonly used in API routes
 */
export function mockExternalDependencies(): void {
  // Mock rate limiting to always pass
  vi.mock("@/lib/rate-limit/middleware", () => ({
    withDashboardRateLimit: (handler: Function) => handler,
    withPublicRateLimit: (handler: Function) => handler,
    withDemoRateLimit: (handler: Function) => handler,
    withAIGenerationRateLimit: (handler: Function) => handler,
    withWebhook: (handler: Function) => handler,
  }));

  // Mock logging to suppress output
  vi.mock("@/lib/logging", () => ({
    logError: vi.fn(),
    logInfo: vi.fn(),
    logWarn: vi.fn(),
    logDebug: vi.fn(),
  }));
}

// =============================================================================
// Assertion Helpers
// =============================================================================

/**
 * Asserts that a call was updated in the mock database
 */
export function assertCallUpdated(
  callId: string,
  expectedUpdates: Partial<Call>
): void {
  const call = getMockCall(callId);
  if (!call) {
    throw new Error(`Call ${callId} not found in mock database`);
  }

  Object.entries(expectedUpdates).forEach(([key, value]) => {
    const actualValue = call[key as keyof Call];
    if (actualValue !== value) {
      throw new Error(
        `Expected call.${key} to be ${JSON.stringify(value)}, got ${JSON.stringify(actualValue)}`
      );
    }
  });
}

/**
 * Asserts that a business was updated in the mock database
 */
export function assertBusinessUpdated(
  businessId: string,
  expectedUpdates: Partial<Business>
): void {
  const business = getMockBusiness(businessId);
  if (!business) {
    throw new Error(`Business ${businessId} not found in mock database`);
  }

  Object.entries(expectedUpdates).forEach(([key, value]) => {
    const actualValue = business[key as keyof Business];
    if (actualValue !== value) {
      throw new Error(
        `Expected business.${key} to be ${JSON.stringify(value)}, got ${JSON.stringify(actualValue)}`
      );
    }
  });
}

// =============================================================================
// Pagination Test Helpers
// =============================================================================

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    items?: T[];
    calls?: T[];
    appointments?: T[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Tests pagination for a list endpoint
 */
export async function testPagination<T>(
  handler: (request: NextRequest) => Promise<Response>,
  path: string,
  options: {
    totalItems: number;
    pageSize: number;
    dataKey: string;
  }
): Promise<void> {
  const { totalItems, pageSize, dataKey } = options;

  // Test first page
  const firstPageRequest = createGetRequest(path, {
    limit: pageSize.toString(),
    offset: "0",
  });
  const firstPageResponse = await handler(firstPageRequest);
  const firstPage = (await parseResponse(firstPageResponse)).data as PaginatedResponse<T>;

  if (!firstPage.success) {
    throw new Error("First page request failed");
  }

  const firstPageItems = (firstPage.data as Record<string, unknown>)[dataKey] as T[];
  if (firstPageItems.length !== Math.min(pageSize, totalItems)) {
    throw new Error(
      `Expected ${Math.min(pageSize, totalItems)} items on first page, got ${firstPageItems.length}`
    );
  }

  // Test second page if there are more items
  if (totalItems > pageSize) {
    const secondPageRequest = createGetRequest(path, {
      limit: pageSize.toString(),
      offset: pageSize.toString(),
    });
    const secondPageResponse = await handler(secondPageRequest);
    const secondPage = (await parseResponse(secondPageResponse)).data as PaginatedResponse<T>;

    const secondPageItems = (secondPage.data as Record<string, unknown>)[dataKey] as T[];
    const expectedSecondPageItems = Math.min(pageSize, totalItems - pageSize);
    if (secondPageItems.length !== expectedSecondPageItems) {
      throw new Error(
        `Expected ${expectedSecondPageItems} items on second page, got ${secondPageItems.length}`
      );
    }
  }
}

// =============================================================================
// Export All
// =============================================================================

export const apiHelpers = {
  createTestRequest,
  createGetRequest,
  createPostRequest,
  createPatchRequest,
  createPutRequest,
  createDeleteRequest,
  parseResponse,
  expectSuccessResponse,
  expectErrorResponse,
  setupAuthenticatedContext,
  setupTestScenario,
  setupUnauthenticatedContext,
  setupAuthErrorContext,
  cleanupTestContext,
  getMockCalls,
  getMockCall,
  getMockBusinesses,
  getMockBusiness,
  getMockAppointments,
  getMockAppointment,
  seedCalls,
  seedAppointments,
  mockExternalDependencies,
  assertCallUpdated,
  assertBusinessUpdated,
  testPagination,
};
