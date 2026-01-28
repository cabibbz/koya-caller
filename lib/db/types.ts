/**
 * Database Types Helper
 * Provides properly typed database utilities to eliminate `as any` casts
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { logError } from "@/lib/logging";

// =============================================================================
// TYPE EXPORTS
// =============================================================================

// Using 'any' for schema parameter to work around Supabase RLS type limitations
export type TypedSupabaseClient = SupabaseClient<Database, "public", any>;

// Table types - generic accessors for any table
export type Tables = Database["public"]["Tables"];
export type TableName = keyof Tables;

// Generic table type accessors - use these to get typed rows for any table
export type TableRow<T extends TableName> = Tables[T]["Row"];
export type TableInsert<T extends TableName> = Tables[T]["Insert"];
export type TableUpdate<T extends TableName> = Tables[T]["Update"];

/**
 * Typed write client for Supabase operations
 *
 * Supabase's TypeScript types with RLS return 'never' for insert/update
 * because they can't determine permissions at compile time. This helper
 * provides a typed wrapper that maintains data type safety while working
 * around the RLS limitation.
 *
 * Usage:
 *   const { data, error } = await typedInsert(supabase, "businesses", insertData);
 *   const { error } = await typedUpdate(supabase, "services", updateData, { id: serviceId });
 */
export async function typedInsert<T extends TableName>(
  client: TypedSupabaseClient,
  table: T,
  data: TableInsert<T>
): Promise<{ data: TableRow<T> | null; error: Error | null }> {
  const result = await (client as unknown as { from: (t: string) => { insert: (d: unknown) => { select: () => { single: () => Promise<{ data: unknown; error: Error | null }> } } } }).from(table).insert(data).select().single();
  return { data: result.data as TableRow<T> | null, error: result.error };
}

export async function typedInsertMany<T extends TableName>(
  client: TypedSupabaseClient,
  table: T,
  data: TableInsert<T>[]
): Promise<{ data: TableRow<T>[]; error: Error | null }> {
  const result = await (client as unknown as { from: (t: string) => { insert: (d: unknown) => { select: () => Promise<{ data: unknown[] | null; error: Error | null }> } } }).from(table).insert(data).select();
  return { data: (result.data ?? []) as TableRow<T>[], error: result.error };
}

export async function typedUpdate<T extends TableName>(
  client: TypedSupabaseClient,
  table: T,
  data: TableUpdate<T>,
  filter: { column: string; value: string }
): Promise<{ data: TableRow<T> | null; error: Error | null }> {
  const result = await (client as unknown as { from: (t: string) => { update: (d: unknown) => { eq: (c: string, v: string) => { select: () => { single: () => Promise<{ data: unknown; error: Error | null }> } } } } })
    .from(table)
    .update(data)
    .eq(filter.column, filter.value)
    .select()
    .single();
  return { data: result.data as TableRow<T> | null, error: result.error };
}

export async function typedUpdateNoReturn<T extends TableName>(
  client: TypedSupabaseClient,
  table: T,
  data: TableUpdate<T>,
  filter: { column: string; value: string }
): Promise<{ error: Error | null }> {
  const result = await (client as unknown as { from: (t: string) => { update: (d: unknown) => { eq: (c: string, v: string) => Promise<{ error: Error | null }> } } })
    .from(table)
    .update(data)
    .eq(filter.column, filter.value);
  return { error: result.error };
}

// Row types for each table
export type BusinessRow = Tables["businesses"]["Row"];
export type BusinessInsert = Tables["businesses"]["Insert"];
export type BusinessUpdate = Tables["businesses"]["Update"];

export type CallRow = Tables["calls"]["Row"];
export type CallInsert = Tables["calls"]["Insert"];
export type CallUpdate = Tables["calls"]["Update"];

export type AppointmentRow = Tables["appointments"]["Row"];
export type AppointmentInsert = Tables["appointments"]["Insert"];
export type AppointmentUpdate = Tables["appointments"]["Update"];

export type ServiceRow = Tables["services"]["Row"];
export type ServiceInsert = Tables["services"]["Insert"];
export type ServiceUpdate = Tables["services"]["Update"];

export type FaqRow = Tables["faqs"]["Row"];
export type FaqInsert = Tables["faqs"]["Insert"];
export type FaqUpdate = Tables["faqs"]["Update"];

export type AiConfigRow = Tables["ai_config"]["Row"];
export type AiConfigInsert = Tables["ai_config"]["Insert"];
export type AiConfigUpdate = Tables["ai_config"]["Update"];

export type PlanRow = Tables["plans"]["Row"];
export type UserRow = Tables["users"]["Row"];

// =============================================================================
// QUERY RESULT TYPES
// =============================================================================

export interface QueryResult<T> {
  data: T | null;
  error: Error | null;
}

export interface QueryListResult<T> {
  data: T[];
  error: Error | null;
  count: number | null;
}

// =============================================================================
// TYPED QUERY HELPERS
// =============================================================================

/**
 * Execute a query and return typed result
 */
export async function executeQuery<T>(
  query: Promise<{ data: T | null; error: unknown }>
): Promise<QueryResult<T>> {
  try {
    const result = await query;
    if (result.error) {
      return {
        data: null,
        error: result.error instanceof Error
          ? result.error
          : new Error(String(result.error)),
      };
    }
    return { data: result.data, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error("Query failed"),
    };
  }
}

/**
 * Execute a list query and return typed result
 */
export async function executeListQuery<T>(
  query: Promise<{ data: T[] | null; error: unknown; count?: number | null }>
): Promise<QueryListResult<T>> {
  try {
    const result = await query;
    if (result.error) {
      return {
        data: [],
        error: result.error instanceof Error
          ? result.error
          : new Error(String(result.error)),
        count: null,
      };
    }
    return {
      data: result.data || [],
      error: null,
      count: result.count ?? null,
    };
  } catch (error) {
    return {
      data: [],
      error: error instanceof Error ? error : new Error("Query failed"),
      count: null,
    };
  }
}

// =============================================================================
// COMMON QUERY PATTERNS
// =============================================================================

/**
 * Safe single row query - handles not found case
 */
export async function findOne<T>(
  query: Promise<{ data: T | null; error: unknown }>
): Promise<T | null> {
  const result = await executeQuery(query);
  if (result.error) {
    logError("DB Query", result.error);
    return null;
  }
  return result.data;
}

/**
 * Safe list query - always returns array
 */
export async function findMany<T>(
  query: Promise<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const result = await executeListQuery(query);
  if (result.error) {
    logError("DB Query", result.error);
    return [];
  }
  return result.data;
}

/**
 * Safe insert with returning
 */
export async function insertOne<T>(
  query: Promise<{ data: T | null; error: unknown }>
): Promise<T | null> {
  return findOne(query);
}

/**
 * Safe update with returning
 */
export async function updateOne<T>(
  query: Promise<{ data: T | null; error: unknown }>
): Promise<T | null> {
  return findOne(query);
}

/**
 * Safe delete - returns success boolean
 */
export async function deleteOne(
  query: Promise<{ error: unknown }>
): Promise<boolean> {
  try {
    const result = await query;
    return !result.error;
  } catch {
    return false;
  }
}

// =============================================================================
// PAGINATION HELPERS
// =============================================================================

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Apply pagination to a query
 */
export function paginate<T>(
  items: T[],
  total: number,
  params: PaginationParams
): PaginatedResult<T> {
  const limit = params.limit || 50;
  const offset = params.offset || 0;

  return {
    items,
    total,
    limit,
    offset,
    hasMore: offset + items.length < total,
  };
}
