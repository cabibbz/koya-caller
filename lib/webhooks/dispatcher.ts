/**
 * Webhook Dispatcher
 * Sends webhook payloads with HMAC signature verification
 * Implements retry logic with exponential backoff
 */

import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import {
  getActiveWebhooksByEvent,
  createWebhookDelivery,
  markDeliverySuccess,
  markDeliveryForRetry,
  type WebhookEventType,
  type Webhook,
  type WebhookDelivery,
} from '@/lib/db/webhooks';
import { logError, logErrorWithMeta, logInfo } from '@/lib/logging';

// ============================================
// Types
// ============================================

export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface DispatchOptions {
  /** Maximum time to wait for response in ms (default: 30000) */
  timeout?: number;
  /** Whether to log delivery attempts (default: true) */
  logDeliveries?: boolean;
}

export interface DispatchResult {
  webhookId: string;
  deliveryId: string;
  success: boolean;
  responseCode?: number;
  error?: string;
}

// ============================================
// HMAC Signature Generation
// ============================================

/**
 * Generate HMAC-SHA256 signature for webhook payload
 * The signature is computed as: HMAC-SHA256(secret, timestamp.payload)
 */
export function generateWebhookSignature(
  payload: string,
  secret: string,
  timestamp: string
): string {
  const signaturePayload = `${timestamp}.${payload}`;
  return crypto
    .createHmac('sha256', secret)
    .update(signaturePayload)
    .digest('hex');
}

/**
 * Create webhook headers including signature
 */
function createWebhookHeaders(
  payload: string,
  secret: string,
  timestamp: string
): Record<string, string> {
  const signature = generateWebhookSignature(payload, secret, timestamp);

  return {
    'Content-Type': 'application/json',
    'X-Koya-Signature': signature,
    'X-Koya-Timestamp': timestamp,
    'X-Koya-Delivery-Id': crypto.randomUUID(),
    'User-Agent': 'Koya-Webhooks/1.0',
  };
}

// ============================================
// Single Webhook Delivery
// ============================================

/**
 * Send webhook to a single endpoint
 */
async function sendWebhook(
  webhook: Webhook,
  payload: WebhookPayload,
  options: DispatchOptions = {}
): Promise<{ success: boolean; responseCode?: number; responseBody?: string; error?: string }> {
  const { timeout = 30000 } = options;
  const timestamp = new Date().toISOString();
  const payloadString = JSON.stringify(payload);

  const headers = createWebhookHeaders(payloadString, webhook.secret, timestamp);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseBody = await response.text().catch(() => '');

    if (response.ok) {
      return {
        success: true,
        responseCode: response.status,
        responseBody,
      };
    }

    return {
      success: false,
      responseCode: response.status,
      responseBody,
      error: `HTTP ${response.status}: ${response.statusText}`,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: `Request timeout after ${timeout}ms`,
        };
      }
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: false,
      error: 'Unknown error occurred',
    };
  }
}

// ============================================
// Webhook Dispatch with Retry
// ============================================

/**
 * Dispatch webhook to a single endpoint and record delivery
 */
async function dispatchToWebhook(
  webhook: Webhook,
  payload: WebhookPayload,
  options: DispatchOptions = {}
): Promise<DispatchResult> {
  const supabase = createAdminClient();
  const { logDeliveries = true } = options;

  // Create delivery record
  const delivery = await createWebhookDelivery(supabase, {
    webhook_id: webhook.id,
    event_type: payload.event,
    payload: payload as unknown as Record<string, unknown>,
    status: 'pending',
  });

  // Attempt delivery
  const result = await sendWebhook(webhook, payload, options);

  if (result.success) {
    await markDeliverySuccess(
      supabase,
      delivery.id,
      result.responseCode!,
      result.responseBody || ''
    );

    if (logDeliveries) {
      logInfo('Webhook Dispatch', `Success: ${webhook.url} - ${payload.event}`);
    }

    return {
      webhookId: webhook.id,
      deliveryId: delivery.id,
      success: true,
      responseCode: result.responseCode,
    };
  }

  // Mark for retry
  await markDeliveryForRetry(
    supabase,
    delivery.id,
    1, // First attempt
    5, // Max attempts
    result.error || 'Unknown error',
    result.responseCode,
    result.responseBody
  );

  if (logDeliveries) {
    logErrorWithMeta('Webhook Dispatch', new Error(result.error), {
      webhookId: webhook.id,
      url: webhook.url,
      event: payload.event,
      responseCode: result.responseCode ?? 0,
    });
  }

  return {
    webhookId: webhook.id,
    deliveryId: delivery.id,
    success: false,
    responseCode: result.responseCode,
    error: result.error,
  };
}

// ============================================
// Main Dispatch Functions
// ============================================

/**
 * Dispatch an event to all subscribed webhooks for a business
 * This is the main entry point for triggering webhooks
 */
export async function dispatchWebhookEvent(
  businessId: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>,
  options: DispatchOptions = {}
): Promise<DispatchResult[]> {
  const supabase = createAdminClient();

  // Get all active webhooks subscribed to this event
  const webhooks = await getActiveWebhooksByEvent(supabase, businessId, eventType);

  if (webhooks.length === 0) {
    return [];
  }

  const payload: WebhookPayload = {
    event: eventType,
    timestamp: new Date().toISOString(),
    data,
  };

  // Dispatch to all webhooks in parallel
  const results = await Promise.all(
    webhooks.map(webhook => dispatchToWebhook(webhook, payload, options))
  );

  return results;
}

/**
 * Retry a failed webhook delivery
 */
export async function retryWebhookDelivery(
  delivery: WebhookDelivery
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  // Get the webhook configuration
  const { data: webhook, error: webhookError } = await supabase
    .from('webhooks')
    .select('*')
    .eq('id', delivery.webhook_id)
    .single();

  if (webhookError || !webhook) {
    await markDeliveryForRetry(
      supabase,
      delivery.id,
      delivery.attempts,
      delivery.max_attempts,
      'Webhook configuration not found',
    );
    return { success: false, error: 'Webhook configuration not found' };
  }

  // Cast to Webhook type for proper typing
  const webhookData = webhook as Webhook;

  if (!webhookData.is_active) {
    await markDeliveryForRetry(
      supabase,
      delivery.id,
      delivery.attempts,
      delivery.max_attempts,
      'Webhook is disabled',
    );
    return { success: false, error: 'Webhook is disabled' };
  }

  // Reconstruct payload
  const payload: WebhookPayload = {
    event: delivery.event_type as WebhookEventType,
    timestamp: new Date().toISOString(),
    data: (delivery.payload as { data: Record<string, unknown> }).data || delivery.payload,
  };

  // Attempt delivery
  const result = await sendWebhook(webhookData, payload);

  if (result.success) {
    await markDeliverySuccess(
      supabase,
      delivery.id,
      result.responseCode!,
      result.responseBody || ''
    );

    logInfo('Webhook Retry', `Success: ${webhookData.url} - ${delivery.event_type}`);
    return { success: true };
  }

  // Mark for another retry
  await markDeliveryForRetry(
    supabase,
    delivery.id,
    delivery.attempts,
    delivery.max_attempts,
    result.error || 'Unknown error',
    result.responseCode,
    result.responseBody
  );

  logErrorWithMeta('Webhook Retry', new Error(result.error), {
    deliveryId: delivery.id,
    webhookId: webhookData.id,
    attempt: delivery.attempts + 1,
  });

  return { success: false, error: result.error };
}

/**
 * Process all pending retry deliveries
 * Called by a background job/cron
 */
export async function processPendingRetries(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const supabase = createAdminClient();

  // Get deliveries ready for retry
  const { data: deliveries, error } = await supabase
    .from('webhook_deliveries')
    .select('*')
    .eq('status', 'retrying')
    .lte('next_retry_at', new Date().toISOString())
    .order('next_retry_at', { ascending: true })
    .limit(100);

  if (error) {
    logError('Webhook Retry Processor', error);
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  const results = {
    processed: deliveries?.length || 0,
    succeeded: 0,
    failed: 0,
  };

  for (const delivery of deliveries || []) {
    const result = await retryWebhookDelivery(delivery);
    if (result.success) {
      results.succeeded++;
    } else {
      results.failed++;
    }
  }

  logInfo('Webhook Retry Processor', `Processed ${results.processed}: ${results.succeeded} succeeded, ${results.failed} failed`);

  return results;
}

// ============================================
// Convenience Functions for Specific Events
// ============================================

/**
 * Dispatch call.started event
 */
export async function dispatchCallStarted(
  businessId: string,
  callData: {
    call_id: string;
    from_number?: string;
    to_number?: string;
    started_at: string;
  }
): Promise<DispatchResult[]> {
  return dispatchWebhookEvent(businessId, 'call.started', callData);
}

/**
 * Dispatch call.ended event
 */
export async function dispatchCallEnded(
  businessId: string,
  callData: {
    call_id: string;
    from_number?: string;
    to_number?: string;
    started_at?: string;
    ended_at: string;
    duration_seconds?: number;
    outcome?: string;
    summary?: string;
  }
): Promise<DispatchResult[]> {
  return dispatchWebhookEvent(businessId, 'call.ended', callData);
}

/**
 * Dispatch appointment.created event
 */
export async function dispatchAppointmentCreated(
  businessId: string,
  appointmentData: {
    appointment_id: string;
    customer_name?: string;
    customer_phone?: string;
    customer_email?: string;
    service_name?: string;
    scheduled_at?: string;
    duration_minutes?: number;
  }
): Promise<DispatchResult[]> {
  return dispatchWebhookEvent(businessId, 'appointment.created', appointmentData);
}

/**
 * Dispatch appointment.updated event
 */
export async function dispatchAppointmentUpdated(
  businessId: string,
  appointmentData: {
    appointment_id: string;
    customer_name?: string;
    customer_phone?: string;
    customer_email?: string;
    service_name?: string;
    scheduled_at?: string;
    duration_minutes?: number;
    status?: string;
    changes: string[];
  }
): Promise<DispatchResult[]> {
  return dispatchWebhookEvent(businessId, 'appointment.updated', appointmentData);
}

/**
 * Dispatch appointment.cancelled event
 */
export async function dispatchAppointmentCancelled(
  businessId: string,
  appointmentData: {
    appointment_id: string;
    customer_name?: string;
    customer_phone?: string;
    cancelled_at: string;
    reason?: string;
  }
): Promise<DispatchResult[]> {
  return dispatchWebhookEvent(businessId, 'appointment.cancelled', appointmentData);
}
