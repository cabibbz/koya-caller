/**
 * Webhook Database Helpers
 * CRUD operations for webhooks and delivery tracking
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;
import crypto from 'crypto';

// ============================================
// Types
// ============================================

export type WebhookEventType =
  | 'call.started'
  | 'call.ended'
  | 'appointment.created'
  | 'appointment.updated'
  | 'appointment.cancelled';

export const WEBHOOK_EVENT_TYPES: WebhookEventType[] = [
  'call.started',
  'call.ended',
  'appointment.created',
  'appointment.updated',
  'appointment.cancelled',
];

export interface Webhook {
  id: string;
  business_id: string;
  url: string;
  events: WebhookEventType[];
  secret: string;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookInsert {
  business_id: string;
  url: string;
  events: WebhookEventType[];
  secret?: string;
  is_active?: boolean;
  description?: string | null;
}

export interface WebhookUpdate {
  url?: string;
  events?: WebhookEventType[];
  is_active?: boolean;
  description?: string | null;
}

export type WebhookDeliveryStatus = 'pending' | 'success' | 'failed' | 'retrying';

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  response_code: number | null;
  response_body: string | null;
  attempts: number;
  max_attempts: number;
  last_attempt_at: string;
  next_retry_at: string | null;
  status: WebhookDeliveryStatus;
  error_message: string | null;
  created_at: string;
}

export interface WebhookDeliveryInsert {
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status?: WebhookDeliveryStatus;
}

// ============================================
// Secret Generation
// ============================================

/**
 * Generate a secure webhook secret
 * Uses crypto.randomBytes for cryptographically secure random values
 */
export function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(32).toString('hex')}`;
}

// ============================================
// Webhook CRUD Operations
// ============================================

/**
 * Get all webhooks for a business
 */
export async function getWebhooksByBusinessId(
  supabase: SupabaseClient,
  businessId: string
): Promise<Webhook[]> {
  const { data, error } = await supabase
    .from('webhooks')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Get active webhooks for a business that subscribe to a specific event
 */
export async function getActiveWebhooksByEvent(
  supabase: SupabaseClient,
  businessId: string,
  eventType: WebhookEventType
): Promise<Webhook[]> {
  const { data, error } = await supabase
    .from('webhooks')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .contains('events', [eventType]);

  if (error) throw error;
  return data ?? [];
}

/**
 * Get a single webhook by ID
 */
export async function getWebhookById(
  supabase: SupabaseClient,
  webhookId: string
): Promise<Webhook | null> {
  const { data, error } = await supabase
    .from('webhooks')
    .select('*')
    .eq('id', webhookId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Create a new webhook
 * Generates a secure secret if not provided
 */
export async function createWebhook(
  supabase: SupabaseClient,
  webhook: WebhookInsert
): Promise<Webhook> {
  const insertData = {
    ...webhook,
    secret: webhook.secret || generateWebhookSecret(),
  };

  const { data, error } = await supabase
    .from('webhooks')
    .insert(insertData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update an existing webhook
 */
export async function updateWebhook(
  supabase: SupabaseClient,
  webhookId: string,
  updates: WebhookUpdate
): Promise<Webhook> {
  const { data, error } = await supabase
    .from('webhooks')
    .update(updates)
    .eq('id', webhookId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a webhook
 */
export async function deleteWebhook(
  supabase: SupabaseClient,
  webhookId: string
): Promise<void> {
  const { error } = await supabase
    .from('webhooks')
    .delete()
    .eq('id', webhookId);

  if (error) throw error;
}

/**
 * Toggle webhook active status
 */
export async function toggleWebhookActive(
  supabase: SupabaseClient,
  webhookId: string,
  isActive: boolean
): Promise<Webhook> {
  return updateWebhook(supabase, webhookId, { is_active: isActive });
}

// ============================================
// Webhook Delivery Operations
// ============================================

/**
 * Create a new webhook delivery record
 */
export async function createWebhookDelivery(
  supabase: SupabaseClient,
  delivery: WebhookDeliveryInsert
): Promise<WebhookDelivery> {
  const { data, error } = await supabase
    .from('webhook_deliveries')
    .insert(delivery)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a webhook delivery after an attempt
 */
export async function updateWebhookDelivery(
  supabase: SupabaseClient,
  deliveryId: string,
  updates: {
    response_code?: number | null;
    response_body?: string | null;
    attempts?: number;
    status?: WebhookDeliveryStatus;
    error_message?: string | null;
    next_retry_at?: string | null;
    last_attempt_at?: string;
  }
): Promise<WebhookDelivery> {
  const { data, error } = await supabase
    .from('webhook_deliveries')
    .update({
      ...updates,
      last_attempt_at: updates.last_attempt_at || new Date().toISOString(),
    })
    .eq('id', deliveryId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get recent deliveries for a webhook
 */
export async function getWebhookDeliveries(
  supabase: SupabaseClient,
  webhookId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ deliveries: WebhookDelivery[]; total: number }> {
  const { limit = 20, offset = 0 } = options;

  const { data, error, count } = await supabase
    .from('webhook_deliveries')
    .select('*', { count: 'exact' })
    .eq('webhook_id', webhookId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return { deliveries: data ?? [], total: count ?? 0 };
}

/**
 * Get a single webhook delivery by ID
 */
export async function getWebhookDeliveryById(
  supabase: SupabaseClient,
  deliveryId: string
): Promise<WebhookDelivery | null> {
  const { data, error } = await supabase
    .from('webhook_deliveries')
    .select('*')
    .eq('id', deliveryId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Get deliveries pending retry
 */
export async function getPendingRetryDeliveries(
  supabase: SupabaseClient,
  limit: number = 100
): Promise<WebhookDelivery[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('webhook_deliveries')
    .select('*')
    .eq('status', 'retrying')
    .lte('next_retry_at', now)
    .order('next_retry_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

/**
 * Mark a delivery as successful
 */
export async function markDeliverySuccess(
  supabase: SupabaseClient,
  deliveryId: string,
  responseCode: number,
  responseBody: string
): Promise<WebhookDelivery> {
  return updateWebhookDelivery(supabase, deliveryId, {
    status: 'success',
    response_code: responseCode,
    response_body: responseBody.substring(0, 1000), // Truncate response
    next_retry_at: null,
  });
}

/**
 * Mark a delivery for retry with exponential backoff
 */
export async function markDeliveryForRetry(
  supabase: SupabaseClient,
  deliveryId: string,
  currentAttempts: number,
  maxAttempts: number,
  errorMessage: string,
  responseCode?: number,
  responseBody?: string
): Promise<WebhookDelivery> {
  const newAttempts = currentAttempts + 1;

  if (newAttempts >= maxAttempts) {
    // Mark as permanently failed
    return updateWebhookDelivery(supabase, deliveryId, {
      status: 'failed',
      attempts: newAttempts,
      error_message: errorMessage,
      response_code: responseCode ?? null,
      response_body: responseBody?.substring(0, 1000) ?? null,
      next_retry_at: null,
    });
  }

  // Calculate next retry time using exponential backoff: 4^(attempt-1) seconds
  // Attempt 1: 1s, 2: 4s, 3: 16s, 4: 64s
  const delaySeconds = Math.pow(4, Math.min(currentAttempts, 4));
  const nextRetry = new Date(Date.now() + delaySeconds * 1000).toISOString();

  return updateWebhookDelivery(supabase, deliveryId, {
    status: 'retrying',
    attempts: newAttempts,
    error_message: errorMessage,
    response_code: responseCode ?? null,
    response_body: responseBody?.substring(0, 1000) ?? null,
    next_retry_at: nextRetry,
  });
}

/**
 * Get delivery statistics for a webhook
 */
export async function getWebhookStats(
  supabase: SupabaseClient,
  webhookId: string
): Promise<{
  total: number;
  success: number;
  failed: number;
  pending: number;
  successRate: number;
}> {
  const { data, error } = await supabase
    .from('webhook_deliveries')
    .select('status')
    .eq('webhook_id', webhookId);

  if (error) throw error;

  const deliveries = (data ?? []) as Array<{ status: string }>;
  const total = deliveries.length;
  const success = deliveries.filter((d: { status: string }) => d.status === 'success').length;
  const failed = deliveries.filter((d: { status: string }) => d.status === 'failed').length;
  const pending = deliveries.filter((d: { status: string }) => d.status === 'pending' || d.status === 'retrying').length;
  const successRate = total > 0 ? Math.round((success / total) * 100) : 100;

  return { total, success, failed, pending, successRate };
}
