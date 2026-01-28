/**
 * Webhook Utility
 * Handles firing webhooks for business events
 *
 * This is SEPARATE from direct integrations (Shopify, Square, etc.)
 * - Direct integrations: Real-time queries DURING calls
 * - Webhooks: Post-event notifications to external systems
 */

import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

// =============================================================================
// Types
// =============================================================================

export type WebhookEvent =
  | "call.started"
  | "call.completed"
  | "appointment.booked"
  | "appointment.cancelled"
  | "message.taken"
  | "lead.captured"
  | "payment.collected";

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  business_id: string;
  data: Record<string, unknown>;
}

interface Webhook {
  id: string;
  business_id: string;
  name: string;
  url: string;
  events: string[];
  secret: string | null;
  is_active: boolean;
}

export interface DeliveryResult {
  webhook_id: string;
  success: boolean;
  status_code?: number;
  error?: string;
}

// =============================================================================
// Webhook Signing
// =============================================================================

/**
 * Generate HMAC signature for webhook payload
 * Allows receivers to verify the webhook came from Koya
 */
function signPayload(payload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Fire webhooks for a specific event
 * Called after events like call completion, appointment booking, etc.
 */
export async function fireWebhooks(
  businessId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<DeliveryResult[]> {
  const supabase = createAdminClient();

  // Get active webhooks for this business that listen to this event
  const { data: webhooks, error } = await (supabase as any)
    .from("business_webhooks")
    .select("*")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .contains("events", [event]);

  if (error || !webhooks || webhooks.length === 0) {
    return [];
  }

  // Build payload
  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    business_id: businessId,
    data,
  };

  const payloadString = JSON.stringify(payload);

  // Fire all webhooks concurrently
  const results = await Promise.all(
    (webhooks as Webhook[]).map((webhook) =>
      deliverWebhook(webhook, event, payloadString)
    )
  );

  return results;
}

/**
 * Deliver a webhook to a single endpoint
 */
async function deliverWebhook(
  webhook: Webhook,
  event: WebhookEvent,
  payloadString: string
): Promise<DeliveryResult> {
  const supabase = createAdminClient();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "Koya-Webhooks/1.0",
    "X-Koya-Event": event,
    "X-Koya-Delivery": crypto.randomUUID(),
  };

  // Add signature if secret is configured
  if (webhook.secret) {
    const signature = signPayload(payloadString, webhook.secret);
    headers["X-Koya-Signature"] = `sha256=${signature}`;
  }

  let statusCode: number | undefined;
  let responseBody: string | undefined;
  let success = false;

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers,
      body: payloadString,
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    statusCode = response.status;
    responseBody = await response.text().catch(() => "");
    success = response.ok;
  } catch (error) {
    responseBody = error instanceof Error ? error.message : "Unknown error";
  }

  // Log delivery attempt
  await (supabase as any).from("webhook_deliveries").insert({
    webhook_id: webhook.id,
    event,
    payload: JSON.parse(payloadString),
    status_code: statusCode,
    response_body: responseBody?.slice(0, 1000), // Limit response body size
    success,
  });

  return {
    webhook_id: webhook.id,
    success,
    status_code: statusCode,
    error: success ? undefined : responseBody,
  };
}

// =============================================================================
// Event-Specific Helpers
// =============================================================================

/**
 * Fire webhook when a call is completed
 */
export async function onCallCompleted(
  businessId: string,
  callData: {
    call_id: string;
    caller_number: string;
    duration_seconds: number;
    outcome: string;
    summary?: string;
    recording_url?: string;
  }
): Promise<void> {
  await fireWebhooks(businessId, "call.completed", callData);
}

/**
 * Fire webhook when an appointment is booked
 */
export async function onAppointmentBooked(
  businessId: string,
  appointmentData: {
    appointment_id: string;
    customer_name: string;
    customer_phone: string;
    customer_email?: string;
    service: string;
    date: string;
    time: string;
    notes?: string;
  }
): Promise<void> {
  await fireWebhooks(businessId, "appointment.booked", appointmentData);
}

/**
 * Fire webhook when an appointment is cancelled
 */
export async function onAppointmentCancelled(
  businessId: string,
  appointmentData: {
    appointment_id: string;
    customer_name: string;
    customer_phone: string;
    reason?: string;
  }
): Promise<void> {
  await fireWebhooks(businessId, "appointment.cancelled", appointmentData);
}

/**
 * Fire webhook when a message is taken
 */
export async function onMessageTaken(
  businessId: string,
  messageData: {
    caller_name: string;
    caller_phone: string;
    message: string;
    urgency: "low" | "medium" | "high";
    call_id?: string;
  }
): Promise<void> {
  await fireWebhooks(businessId, "message.taken", messageData);
}

/**
 * Fire webhook when a lead is captured
 * Note: This is fired from webhook system, NOT the direct CRM integration
 * Direct CRM integration creates leads in real-time during calls
 * This webhook notifies other systems after the fact
 */
export async function onLeadCaptured(
  businessId: string,
  leadData: {
    name: string;
    email?: string;
    phone: string;
    interest?: string;
    notes?: string;
    source: string;
  }
): Promise<void> {
  await fireWebhooks(businessId, "lead.captured", leadData);
}

/**
 * Fire webhook when a payment is collected
 */
export async function onPaymentCollected(
  businessId: string,
  paymentData: {
    amount: number;
    currency: string;
    description: string;
    customer_phone: string;
    payment_link?: string;
    status: string;
  }
): Promise<void> {
  await fireWebhooks(businessId, "payment.collected", paymentData);
}

// =============================================================================
// Webhook Management
// =============================================================================

/**
 * Test a webhook by sending a test event
 */
export async function testWebhook(webhookId: string): Promise<DeliveryResult> {
  const supabase = createAdminClient();

  const { data: webhook, error } = await (supabase as any)
    .from("business_webhooks")
    .select("*")
    .eq("id", webhookId)
    .single();

  if (error || !webhook) {
    return {
      webhook_id: webhookId,
      success: false,
      error: "Webhook not found",
    };
  }

  const testPayload: WebhookPayload = {
    event: "call.completed",
    timestamp: new Date().toISOString(),
    business_id: webhook.business_id,
    data: {
      test: true,
      message: "This is a test webhook from Koya",
      call_id: "test-" + crypto.randomUUID().slice(0, 8),
      caller_number: "+15555555555",
      duration_seconds: 120,
      outcome: "test",
    },
  };

  return deliverWebhook(webhook as Webhook, "call.completed", JSON.stringify(testPayload));
}

// =============================================================================
// Webhook Dispatch Functions (for real-time event firing)
// =============================================================================

/**
 * Dispatch webhook when a call starts
 */
export async function dispatchCallStarted(
  businessId: string,
  callData: {
    call_id: string;
    from_number?: string;
    to_number?: string;
    caller_number?: string;
    started_at: string;
  }
): Promise<void> {
  await fireWebhooks(businessId, "call.started", callData);
}

/**
 * Dispatch webhook when a call ends
 */
export async function dispatchCallEnded(
  businessId: string,
  callData: {
    call_id: string;
    from_number?: string;
    to_number?: string;
    caller_number?: string;
    started_at?: string;
    ended_at: string;
    duration_seconds: number;
    outcome: string;
    summary?: string;
    recording_url?: string;
  }
): Promise<void> {
  await fireWebhooks(businessId, "call.completed", callData);
}

/**
 * Dispatch webhook when an appointment is created
 */
export async function dispatchAppointmentCreated(
  businessId: string,
  appointmentData: {
    appointment_id: string;
    customer_name?: string;
    customer_phone?: string;
    customer_email?: string;
    service?: string;
    service_name?: string;
    scheduled_at?: string;
    duration_minutes?: number;
    notes?: string;
  }
): Promise<void> {
  await fireWebhooks(businessId, "appointment.booked", appointmentData);
}

/**
 * Dispatch webhook when an appointment is updated
 */
export async function dispatchAppointmentUpdated(
  businessId: string,
  appointmentData: {
    appointment_id: string;
    customer_name?: string;
    customer_phone?: string;
    customer_email?: string;
    service?: string;
    service_name?: string;
    scheduled_at?: string;
    duration_minutes?: number;
    status?: string;
    changes?: string[] | Record<string, unknown>;
  }
): Promise<void> {
  // Use appointment.booked since there's no specific update event type
  await fireWebhooks(businessId, "appointment.booked", { ...appointmentData, type: "updated" });
}

/**
 * Dispatch webhook when an appointment is cancelled
 */
export async function dispatchAppointmentCancelled(
  businessId: string,
  appointmentData: {
    appointment_id: string;
    customer_name?: string;
    customer_phone?: string;
    reason?: string;
    cancelled_at?: string;
  }
): Promise<void> {
  await fireWebhooks(businessId, "appointment.cancelled", appointmentData);
}

// =============================================================================
// Retry Logic
// =============================================================================

/**
 * Get pending webhook deliveries that need retry
 */
export async function getPendingRetryDeliveries(
  limit: number = 50
): Promise<{ id: string; webhook_id: string; event: WebhookEvent; payload: WebhookPayload; retry_count: number }[]> {
  const supabase = createAdminClient();

  const { data, error } = await (supabase as any)
    .from("webhook_deliveries")
    .select("id, webhook_id, event, payload, retry_count")
    .eq("success", false)
    .lt("retry_count", 3) // Max 3 retries
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data;
}

/**
 * Retry a failed webhook delivery
 */
export async function retryWebhookDelivery(
  deliveryId: string
): Promise<DeliveryResult> {
  const supabase = createAdminClient();

  // Get the failed delivery
  const { data: delivery, error: deliveryError } = await (supabase as any)
    .from("webhook_deliveries")
    .select("*, business_webhooks(*)")
    .eq("id", deliveryId)
    .single();

  if (deliveryError || !delivery || !delivery.business_webhooks) {
    return {
      webhook_id: "",
      success: false,
      error: "Delivery not found",
    };
  }

  const webhook = delivery.business_webhooks as Webhook;
  const result = await deliverWebhook(
    webhook,
    delivery.event as WebhookEvent,
    JSON.stringify(delivery.payload)
  );

  // Update retry count
  await (supabase as any)
    .from("webhook_deliveries")
    .update({
      retry_count: (delivery.retry_count || 0) + 1,
      last_retry_at: new Date().toISOString(),
    })
    .eq("id", deliveryId);

  return result;
}

/**
 * Process all pending webhook retries
 */
export async function processPendingRetries(): Promise<{ processed: number; succeeded: number; failed: number }> {
  const pendingDeliveries = await getPendingRetryDeliveries(50);

  let succeeded = 0;
  let failed = 0;

  for (const delivery of pendingDeliveries) {
    const result = await retryWebhookDelivery(delivery.id);
    if (result.success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  return {
    processed: pendingDeliveries.length,
    succeeded,
    failed,
  };
}
