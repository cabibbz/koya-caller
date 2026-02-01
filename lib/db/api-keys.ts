/**
 * API Keys Database Helpers
 * CRUD operations for API keys used by Zapier and external integrations
 */

import crypto from 'crypto';
import { logError } from '@/lib/logging';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

// ============================================
// Types
// ============================================

export type ApiKeyPermission =
  | 'read:calls'
  | 'write:appointments'
  | 'read:appointments'
  | 'webhooks:manage';

export const API_KEY_PERMISSIONS: ApiKeyPermission[] = [
  'read:calls',
  'write:appointments',
  'read:appointments',
  'webhooks:manage',
];

export interface ApiKey {
  id: string;
  business_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  permissions: ApiKeyPermission[];
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiKeyInsert {
  business_id: string;
  name: string;
  permissions: ApiKeyPermission[];
  expires_at?: string | null;
}

export interface ApiKeyUpdate {
  name?: string;
  permissions?: ApiKeyPermission[];
  is_active?: boolean;
  expires_at?: string | null;
}

export interface ZapierSubscription {
  id: string;
  api_key_id: string;
  business_id: string;
  target_url: string;
  event_type: ZapierEventType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ZapierEventType = 'call.ended' | 'call.missed' | 'appointment.created';

export const ZAPIER_EVENT_TYPES: ZapierEventType[] = [
  'call.ended',
  'call.missed',
  'appointment.created',
];

export interface ZapierSubscriptionInsert {
  api_key_id: string;
  business_id: string;
  target_url: string;
  event_type: ZapierEventType;
}

export interface ApiKeyUsageLog {
  id: string;
  api_key_id: string;
  endpoint: string;
  method: string;
  status_code: number;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// ============================================
// API Key Generation
// ============================================

/**
 * Generate a secure API key
 * Format: koya_live_xxxxxxxx_yyyyyyyyyyyyyyyyyyyyyyyyyyyy (32 chars after prefix)
 */
export function generateApiKey(isTest: boolean = false): { key: string; prefix: string; hash: string } {
  const prefix = isTest ? 'koya_test_' : 'koya_live_';
  const prefixId = crypto.randomBytes(4).toString('hex'); // 8 chars
  const secretPart = crypto.randomBytes(16).toString('hex'); // 32 chars

  const fullKey = `${prefix}${prefixId}_${secretPart}`;
  const keyPrefix = `${prefix}${prefixId}`;
  const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');

  return {
    key: fullKey,
    prefix: keyPrefix,
    hash: keyHash,
  };
}

/**
 * Hash an API key for verification
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Extract prefix from a full API key
 */
export function extractKeyPrefix(key: string): string {
  // Format: koya_live_xxxxxxxx_...
  const parts = key.split('_');
  if (parts.length < 3) {
    throw new Error('Invalid API key format');
  }
  return `${parts[0]}_${parts[1]}_${parts[2]}`;
}

// ============================================
// API Key CRUD Operations
// ============================================

/**
 * Get all API keys for a business (excludes hash)
 */
export async function getApiKeysByBusinessId(
  supabase: SupabaseClient,
  businessId: string
): Promise<Omit<ApiKey, 'key_hash'>[]> {
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, business_id, name, key_prefix, permissions, is_active, last_used_at, expires_at, created_at, updated_at')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Get a single API key by ID (excludes hash)
 */
export async function getApiKeyById(
  supabase: SupabaseClient,
  apiKeyId: string
): Promise<Omit<ApiKey, 'key_hash'> | null> {
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, business_id, name, key_prefix, permissions, is_active, last_used_at, expires_at, created_at, updated_at')
    .eq('id', apiKeyId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Verify an API key and return associated business info
 */
export async function verifyApiKey(
  supabase: SupabaseClient,
  key: string
): Promise<{ api_key_id: string; business_id: string; permissions: ApiKeyPermission[] } | null> {
  try {
    const prefix = extractKeyPrefix(key);
    const hash = hashApiKey(key);

    const { data, error } = await supabase
      .from('api_keys')
      .select('id, business_id, permissions')
      .eq('key_prefix', prefix)
      .eq('key_hash', hash)
      .eq('is_active', true)
      .or('expires_at.is.null,expires_at.gt.now()')
      .single();

    if (error || !data) return null;

    return {
      api_key_id: data.id,
      business_id: data.business_id,
      permissions: data.permissions,
    };
  } catch {
    return null;
  }
}

/**
 * Create a new API key
 * Returns the full key (only time it's available)
 */
export async function createApiKey(
  supabase: SupabaseClient,
  apiKey: ApiKeyInsert
): Promise<{ apiKey: Omit<ApiKey, 'key_hash'>; fullKey: string }> {
  const { key, prefix, hash } = generateApiKey();

  const insertData = {
    business_id: apiKey.business_id,
    name: apiKey.name,
    key_hash: hash,
    key_prefix: prefix,
    permissions: apiKey.permissions,
    expires_at: apiKey.expires_at || null,
  };

  const { data, error } = await supabase
    .from('api_keys')
    .insert(insertData)
    .select('id, business_id, name, key_prefix, permissions, is_active, last_used_at, expires_at, created_at, updated_at')
    .single();

  if (error) throw error;

  return {
    apiKey: data,
    fullKey: key,
  };
}

/**
 * Update an existing API key
 */
export async function updateApiKey(
  supabase: SupabaseClient,
  apiKeyId: string,
  updates: ApiKeyUpdate
): Promise<Omit<ApiKey, 'key_hash'>> {
  const { data, error } = await supabase
    .from('api_keys')
    .update(updates)
    .eq('id', apiKeyId)
    .select('id, business_id, name, key_prefix, permissions, is_active, last_used_at, expires_at, created_at, updated_at')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete an API key
 */
export async function deleteApiKey(
  supabase: SupabaseClient,
  apiKeyId: string
): Promise<void> {
  const { error } = await supabase
    .from('api_keys')
    .delete()
    .eq('id', apiKeyId);

  if (error) throw error;
}

/**
 * Update last_used_at timestamp for an API key
 */
export async function updateApiKeyLastUsed(
  supabase: SupabaseClient,
  apiKeyId: string
): Promise<void> {
  const { error } = await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKeyId);

  if (error) throw error;
}

/**
 * Revoke (deactivate) an API key
 */
export async function revokeApiKey(
  supabase: SupabaseClient,
  apiKeyId: string
): Promise<Omit<ApiKey, 'key_hash'>> {
  return updateApiKey(supabase, apiKeyId, { is_active: false });
}

// ============================================
// Zapier Subscription Operations
// ============================================

/**
 * Get all Zapier subscriptions for a business
 */
export async function getZapierSubscriptionsByBusinessId(
  supabase: SupabaseClient,
  businessId: string
): Promise<ZapierSubscription[]> {
  const { data, error } = await supabase
    .from('zapier_subscriptions')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Get active subscriptions for a specific event type
 */
export async function getActiveSubscriptionsByEvent(
  supabase: SupabaseClient,
  businessId: string,
  eventType: ZapierEventType
): Promise<ZapierSubscription[]> {
  const { data, error } = await supabase
    .from('zapier_subscriptions')
    .select('*')
    .eq('business_id', businessId)
    .eq('event_type', eventType)
    .eq('is_active', true);

  if (error) throw error;
  return data ?? [];
}

/**
 * Create a new Zapier subscription
 */
export async function createZapierSubscription(
  supabase: SupabaseClient,
  subscription: ZapierSubscriptionInsert
): Promise<ZapierSubscription> {
  const { data, error } = await supabase
    .from('zapier_subscriptions')
    .insert(subscription)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a Zapier subscription
 */
export async function deleteZapierSubscription(
  supabase: SupabaseClient,
  subscriptionId: string
): Promise<void> {
  const { error } = await supabase
    .from('zapier_subscriptions')
    .delete()
    .eq('id', subscriptionId);

  if (error) throw error;
}

/**
 * Delete all subscriptions for a target URL
 */
export async function deleteZapierSubscriptionByUrl(
  supabase: SupabaseClient,
  targetUrl: string,
  apiKeyId: string
): Promise<void> {
  const { error } = await supabase
    .from('zapier_subscriptions')
    .delete()
    .eq('target_url', targetUrl)
    .eq('api_key_id', apiKeyId);

  if (error) throw error;
}

// ============================================
// Usage Logging Operations
// ============================================

/**
 * Log an API key usage
 */
export async function logApiKeyUsage(
  supabase: SupabaseClient,
  usage: {
    api_key_id: string;
    endpoint: string;
    method: string;
    status_code: number;
    ip_address?: string;
    user_agent?: string;
  }
): Promise<void> {
  const { error } = await supabase
    .from('api_key_usage_log')
    .insert(usage);

  if (error) {
    // Log error but don't throw - usage logging shouldn't break the request
    logError('API Key Usage Log', error);
  }
}

/**
 * Get recent usage logs for an API key
 */
export async function getApiKeyUsageLogs(
  supabase: SupabaseClient,
  apiKeyId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ logs: ApiKeyUsageLog[]; total: number }> {
  const { limit = 50, offset = 0 } = options;

  const { data, error, count } = await supabase
    .from('api_key_usage_log')
    .select('*', { count: 'exact' })
    .eq('api_key_id', apiKeyId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return { logs: data ?? [], total: count ?? 0 };
}

/**
 * Get usage statistics for an API key
 */
export async function getApiKeyUsageStats(
  supabase: SupabaseClient,
  apiKeyId: string,
  days: number = 7
): Promise<{
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  requests_by_endpoint: Record<string, number>;
}> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const { data, error } = await supabase
    .from('api_key_usage_log')
    .select('endpoint, status_code')
    .eq('api_key_id', apiKeyId)
    .gte('created_at', cutoffDate.toISOString());

  if (error) throw error;

  const logs = data ?? [];
  const requestsByEndpoint: Record<string, number> = {};

  let successfulRequests = 0;
  let failedRequests = 0;

  for (const log of logs) {
    requestsByEndpoint[log.endpoint] = (requestsByEndpoint[log.endpoint] || 0) + 1;
    if (log.status_code >= 200 && log.status_code < 400) {
      successfulRequests++;
    } else {
      failedRequests++;
    }
  }

  return {
    total_requests: logs.length,
    successful_requests: successfulRequests,
    failed_requests: failedRequests,
    requests_by_endpoint: requestsByEndpoint,
  };
}
