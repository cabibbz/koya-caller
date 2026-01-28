/**
 * Mock Supabase Client for Testing
 *
 * Provides comprehensive mocking of Supabase client operations
 * for use in API route integration tests.
 */

import { vi } from "vitest";
import type { Database } from "@/types/supabase";
import type {
  User,
  Business,
  Call,
  Appointment,
  Service,
  FAQ,
  CallOutcome,
  CallLanguage,
  AppointmentStatus,
} from "@/types";

// =============================================================================
// Types
// =============================================================================

export interface MockUser {
  id: string;
  email: string;
  phone?: string | null;
  app_metadata?: {
    tenant_id?: string;
    is_admin?: boolean;
  };
  user_metadata?: Record<string, unknown>;
}

export interface MockAuthResult {
  user: MockUser | null;
  error: Error | null;
}

export interface MockQueryResult<T> {
  data: T | null;
  error: Error | null;
  count?: number | null;
}

export type TableName = keyof Database["public"]["Tables"];

// =============================================================================
// Mock Data Store
// =============================================================================

/**
 * In-memory data store for mock Supabase operations
 */
class MockDataStore {
  private data: Map<TableName, Map<string, Record<string, unknown>>> = new Map();
  private currentUser: MockUser | null = null;
  private authError: Error | null = null;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.data = new Map();
    this.currentUser = null;
    this.authError = null;

    // Initialize tables
    const tables: TableName[] = [
      "users",
      "businesses",
      "calls",
      "appointments",
      "services",
      "faqs",
      "knowledge",
      "ai_config",
      "call_settings",
      "business_hours",
      "notification_settings",
      "phone_numbers",
      "plans",
      "sms_messages",
    ];
    tables.forEach((table) => this.data.set(table, new Map()));
  }

  // Auth methods
  setCurrentUser(user: MockUser | null): void {
    this.currentUser = user;
    this.authError = null;
  }

  setAuthError(error: Error | null): void {
    this.authError = error;
    this.currentUser = null;
  }

  getCurrentUser(): MockAuthResult {
    if (this.authError) {
      return { user: null, error: this.authError };
    }
    return { user: this.currentUser, error: null };
  }

  // Data methods
  insert<T extends TableName>(
    table: T,
    record: Record<string, unknown>
  ): Record<string, unknown> {
    const tableData = this.data.get(table);
    if (!tableData) throw new Error(`Table ${table} not found`);

    const id = record.id as string || crypto.randomUUID();
    const now = new Date().toISOString();
    const fullRecord = {
      ...record,
      id,
      created_at: record.created_at || now,
      updated_at: record.updated_at || now,
    };

    tableData.set(id, fullRecord);
    return fullRecord;
  }

  insertMany<T extends TableName>(
    table: T,
    records: Record<string, unknown>[]
  ): Record<string, unknown>[] {
    return records.map((record) => this.insert(table, record));
  }

  select<T extends TableName>(
    table: T,
    filters?: Record<string, unknown>
  ): Record<string, unknown>[] {
    const tableData = this.data.get(table);
    if (!tableData) return [];

    let results = Array.from(tableData.values());

    if (filters) {
      results = results.filter((record) => {
        return Object.entries(filters).every(([key, value]) => {
          if (value === undefined) return true;
          return record[key] === value;
        });
      });
    }

    return results;
  }

  selectOne<T extends TableName>(
    table: T,
    filters: Record<string, unknown>
  ): Record<string, unknown> | null {
    const results = this.select(table, filters);
    return results[0] || null;
  }

  update<T extends TableName>(
    table: T,
    id: string,
    updates: Record<string, unknown>
  ): Record<string, unknown> | null {
    const tableData = this.data.get(table);
    if (!tableData) return null;

    const existing = tableData.get(id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    tableData.set(id, updated);
    return updated;
  }

  delete<T extends TableName>(table: T, id: string): boolean {
    const tableData = this.data.get(table);
    if (!tableData) return false;
    return tableData.delete(id);
  }

  count<T extends TableName>(
    table: T,
    filters?: Record<string, unknown>
  ): number {
    return this.select(table, filters).length;
  }

  getTable<T extends TableName>(table: T): Map<string, Record<string, unknown>> {
    return this.data.get(table) || new Map();
  }

  seed<T extends TableName>(table: T, records: Record<string, unknown>[]): void {
    records.forEach((record) => this.insert(table, record));
  }
}

// Global mock data store instance
export const mockDataStore = new MockDataStore();

// =============================================================================
// Query Builder Mock
// =============================================================================

/**
 * Creates a chainable query builder that mimics Supabase's API
 */
function createQueryBuilder(table: TableName) {
  let filters: Record<string, unknown> = {};
  let selectedColumns: string[] | null = null;
  let orderByColumn: string | null = null;
  let orderAscending = true;
  let limitCount: number | null = null;
  let offsetCount = 0;
  let countMode: "exact" | null = null;
  let headOnly = false;
  let orFilters: string | null = null;

  // Helper function to execute the query and return a Promise
  function executeQuery(): Promise<MockQueryResult<unknown[] | null>> {
    return new Promise((resolve) => {
      let results = mockDataStore.select(table);

      // Apply basic equality filters
      Object.entries(filters).forEach(([key, value]) => {
        if (key.startsWith("_")) return; // Skip special filters
        results = results.filter((r) => r[key] === value);
      });

      // Apply range filters
      Object.entries(filters).forEach(([key, value]) => {
        if (key.startsWith("_gte_")) {
          const col = key.replace("_gte_", "");
          results = results.filter((r) => {
            const recordValue = r[col];
            if (typeof recordValue === "string" && typeof value === "string") {
              return recordValue >= value;
            }
            return (recordValue as number) >= (value as number);
          });
        }
        if (key.startsWith("_lte_")) {
          const col = key.replace("_lte_", "");
          results = results.filter((r) => {
            const recordValue = r[col];
            if (typeof recordValue === "string" && typeof value === "string") {
              return recordValue <= value;
            }
            return (recordValue as number) <= (value as number);
          });
        }
        if (key.startsWith("_lt_")) {
          const col = key.replace("_lt_", "");
          results = results.filter((r) => {
            const recordValue = r[col];
            if (typeof recordValue === "string" && typeof value === "string") {
              return recordValue < value;
            }
            return (recordValue as number) < (value as number);
          });
        }
        if (key.startsWith("_gt_")) {
          const col = key.replace("_gt_", "");
          results = results.filter((r) => {
            const recordValue = r[col];
            if (typeof recordValue === "string" && typeof value === "string") {
              return recordValue > value;
            }
            return (recordValue as number) > (value as number);
          });
        }
        if (key.startsWith("_in_")) {
          const col = key.replace("_in_", "");
          const values = value as unknown[];
          results = results.filter((r) => values.includes(r[col]));
        }
        if (key.startsWith("_not_") && key.includes("_is")) {
          const col = key.replace("_not_", "").replace("_is", "");
          results = results.filter((r) => r[col] !== null && r[col] !== undefined);
        }
      });

      // Apply OR filters (simplified implementation)
      if (orFilters) {
        // Parse simple OR filters like "summary.ilike.%query%,message_taken.ilike.%query%"
        const orParts = orFilters.split(",");
        const orResults = results.filter((record) => {
          return orParts.some((part) => {
            const [column, operator, ...valueParts] = part.split(".");
            const value = valueParts.join(".").replace(/%/g, "");
            if (operator === "ilike" && typeof record[column] === "string") {
              return (record[column] as string)
                .toLowerCase()
                .includes(value.toLowerCase());
            }
            return false;
          });
        });
        results = orResults;
      }

      // Apply ordering
      if (orderByColumn) {
        results.sort((a, b) => {
          const aVal = a[orderByColumn!];
          const bVal = b[orderByColumn!];
          if (aVal === bVal) return 0;
          if (aVal === null || aVal === undefined) return 1;
          if (bVal === null || bVal === undefined) return -1;
          const comparison = aVal < bVal ? -1 : 1;
          return orderAscending ? comparison : -comparison;
        });
      }

      const totalCount = results.length;

      // Apply pagination
      if (offsetCount > 0) {
        results = results.slice(offsetCount);
      }
      if (limitCount !== null) {
        results = results.slice(0, limitCount);
      }

      // Apply column selection
      if (selectedColumns) {
        results = results.map((record) => {
          const selected: Record<string, unknown> = {};
          selectedColumns!.forEach((col) => {
            selected[col] = record[col];
          });
          return selected;
        });
      }

      // Head mode returns no data, just count
      if (headOnly) {
        resolve({
          data: null,
          error: null,
          count: countMode === "exact" ? totalCount : null,
        });
        return;
      }

      resolve({
        data: results,
        error: null,
        count: countMode === "exact" ? totalCount : null,
      });
    });
  }

  const builder = {
    select(columns?: string, options?: { count?: "exact"; head?: boolean }) {
      if (columns && columns !== "*") {
        selectedColumns = columns.split(",").map((c) => c.trim());
      }
      if (options?.count === "exact") {
        countMode = "exact";
      }
      if (options?.head) {
        headOnly = true;
      }
      return builder;
    },

    insert(data: Record<string, unknown> | Record<string, unknown>[]) {
      const records = Array.isArray(data) ? data : [data];
      const inserted = mockDataStore.insertMany(table, records);
      return {
        select() {
          return {
            single() {
              return Promise.resolve({
                data: inserted[0] || null,
                error: null,
              });
            },
            then(resolve: (value: MockQueryResult<unknown[]>) => void) {
              resolve({ data: inserted, error: null });
            },
          };
        },
        single() {
          return Promise.resolve({
            data: inserted[0] || null,
            error: null,
          });
        },
        then(resolve: (value: MockQueryResult<unknown[]>) => void) {
          resolve({ data: inserted, error: null });
        },
      };
    },

    update(data: Record<string, unknown>) {
      return {
        eq(column: string, value: unknown) {
          const records = mockDataStore.select(table, { [column]: value });
          const updated = records.map((record) =>
            mockDataStore.update(table, record.id as string, data)
          );
          return {
            select() {
              return {
                single() {
                  return Promise.resolve({
                    data: updated[0] || null,
                    error: updated[0] ? null : new Error("Record not found"),
                  });
                },
                then(resolve: (value: MockQueryResult<unknown[]>) => void) {
                  resolve({ data: updated.filter(Boolean) as unknown[], error: null });
                },
              };
            },
            single() {
              return Promise.resolve({
                data: updated[0] || null,
                error: updated[0] ? null : new Error("Record not found"),
              });
            },
            then(resolve: (value: MockQueryResult<unknown[]>) => void) {
              resolve({ data: updated.filter(Boolean) as unknown[], error: null });
            },
          };
        },
      };
    },

    delete() {
      return {
        eq(column: string, value: unknown) {
          const records = mockDataStore.select(table, { [column]: value });
          records.forEach((record) =>
            mockDataStore.delete(table, record.id as string)
          );
          return Promise.resolve({ data: null, error: null });
        },
      };
    },

    eq(column: string, value: unknown) {
      filters[column] = value;
      return builder;
    },

    neq(column: string, value: unknown) {
      // Store as a special filter marker
      filters[`_neq_${column}`] = value;
      return builder;
    },

    gt(column: string, value: unknown) {
      filters[`_gt_${column}`] = value;
      return builder;
    },

    gte(column: string, value: unknown) {
      filters[`_gte_${column}`] = value;
      return builder;
    },

    lt(column: string, value: unknown) {
      filters[`_lt_${column}`] = value;
      return builder;
    },

    lte(column: string, value: unknown) {
      filters[`_lte_${column}`] = value;
      return builder;
    },

    in(column: string, values: unknown[]) {
      filters[`_in_${column}`] = values;
      return builder;
    },

    not(column: string, operator: string, value: unknown) {
      filters[`_not_${column}_${operator}`] = value;
      return builder;
    },

    or(filterString: string) {
      orFilters = filterString;
      return builder;
    },

    order(column: string, options?: { ascending?: boolean }) {
      orderByColumn = column;
      orderAscending = options?.ascending ?? true;
      return builder;
    },

    limit(count: number) {
      limitCount = count;
      return builder;
    },

    range(from: number, to: number) {
      offsetCount = from;
      limitCount = to - from + 1;
      return builder;
    },

    single() {
      return executeQuery().then((result) => {
        const data = result.data;
        if (Array.isArray(data)) {
          if (data.length === 0) {
            return {
              data: null,
              error: { code: "PGRST116", message: "No rows found" },
            };
          }
          return { data: data[0], error: null };
        }
        return { data, error: null };
      });
    },

    maybeSingle() {
      return executeQuery().then((result) => {
        const data = result.data;
        if (Array.isArray(data)) {
          return { data: data[0] || null, error: null };
        }
        return { data, error: null };
      });
    },

    then(
      resolve: (value: MockQueryResult<unknown[] | null>) => void,
      reject?: (error: unknown) => void
    ) {
      return executeQuery().then(resolve, reject);
    },
  };

  return builder;
}

// =============================================================================
// Mock Supabase Client Factory
// =============================================================================

/**
 * Creates a mock Supabase client that can be used in tests
 */
export function createMockSupabaseClient() {
  return {
    auth: {
      getUser: vi.fn(async () => {
        const result = mockDataStore.getCurrentUser();
        return {
          data: { user: result.user },
          error: result.error,
        };
      }),
      getSession: vi.fn(async () => {
        const result = mockDataStore.getCurrentUser();
        if (result.user) {
          return {
            data: {
              session: {
                user: result.user,
                access_token: "mock-access-token",
                expires_at: Math.floor(Date.now() / 1000) + 3600,
              },
            },
            error: null,
          };
        }
        return { data: { session: null }, error: result.error };
      }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn((table: string) => createQueryBuilder(table as TableName)),
    rpc: vi.fn(async (functionName: string, params?: Record<string, unknown>) => {
      // Handle specific RPC functions
      if (functionName === "increment_usage_minutes") {
        const businessId = params?.p_business_id as string;
        const minutes = params?.p_minutes as number;
        const business = mockDataStore.selectOne("businesses", { id: businessId });
        if (business) {
          const updated = mockDataStore.update("businesses", businessId, {
            minutes_used_this_cycle:
              ((business.minutes_used_this_cycle as number) || 0) + minutes,
          });
          return { data: [updated], error: null };
        }
        return { data: null, error: new Error("Business not found") };
      }
      return { data: null, error: null };
    }),
  };
}

// =============================================================================
// Module Mock Setup
// =============================================================================

/**
 * Sets up the Supabase module mock for vitest
 * Call this in your test setup file or at the top of test files
 */
export function setupSupabaseMock() {
  vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(createMockSupabaseClient())),
    createAdminClient: vi.fn(() => createMockSupabaseClient()),
    createServiceClient: vi.fn(() => createMockSupabaseClient()),
  }));
}

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Resets the mock data store between tests
 */
export function resetMockData(): void {
  mockDataStore.reset();
}

/**
 * Sets the authenticated user for subsequent requests
 */
export function setMockUser(user: MockUser | null): void {
  mockDataStore.setCurrentUser(user);
}

/**
 * Sets an authentication error for subsequent requests
 */
export function setMockAuthError(error: Error | null): void {
  mockDataStore.setAuthError(error);
}

/**
 * Seeds mock data into a table
 */
export function seedMockData<T extends TableName>(
  table: T,
  records: Record<string, unknown>[]
): void {
  mockDataStore.seed(table, records);
}

/**
 * Gets all records from a mock table
 */
export function getMockTableData<T extends TableName>(
  table: T
): Record<string, unknown>[] {
  return Array.from(mockDataStore.getTable(table).values());
}

/**
 * Gets a single record from a mock table by ID
 */
export function getMockRecord<T extends TableName>(
  table: T,
  id: string
): Record<string, unknown> | null {
  return mockDataStore.selectOne(table, { id });
}

// =============================================================================
// Export Types
// =============================================================================

export type MockSupabaseClient = ReturnType<typeof createMockSupabaseClient>;
