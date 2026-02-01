/**
 * Retell.ai Webhook Handler
 *
 * Handles incoming webhooks from Retell.ai for:
 * - Call started events
 * - Call ended events
 * - Call analyzed events
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyWebhookSignature, getCallDetails } from "@/lib/retell";
import { inngest } from "@/lib/inngest";
import { createAppointmentEvent } from "@/lib/calendar";
import { logError, logErrorWithMeta } from "@/lib/logging";
import { dispatchCallStarted, dispatchCallEnded } from "@/lib/webhooks";
import { recordOutboundCallOutcome } from "@/lib/outbound";
import { storeFailedWebhook } from "@/lib/webhooks/retry";

// Retell webhook event types
interface RetellCallEvent {
  event: "call_started" | "call_ended" | "call_analyzed";
  // duration_ms is provided at the event level for call_ended events
  duration_ms?: number;
  call: {
    call_id: string;
    agent_id: string;
    call_type: "web_call" | "phone_call";
    from_number?: string;
    to_number?: string;
    direction?: "inbound" | "outbound";
    call_status: string;
    start_timestamp?: number;
    end_timestamp?: number;
    // Duration may also be inside the call object
    duration_ms?: number;
    duration_seconds?: number;
    transcript?: string;
    transcript_object?: Array<{ role: string; content: string }>;
    recording_url?: string;
    public_log_url?: string;
    disconnection_reason?: string;
    call_analysis?: {
      call_summary?: string;
      user_sentiment?: string;
      call_successful?: boolean;
      custom_analysis_data?: Record<string, unknown>;
    };
    metadata?: Record<string, string>;
    retell_llm_dynamic_variables?: Record<string, string>;
  };
}

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const payload = await request.text();
    const signature = request.headers.get("x-retell-signature");

    // Verify signature - required unless explicitly bypassed for local testing
    const verified = verifyWebhookSignature(payload, signature);
    const allowBypass = process.env.WEBHOOK_SIGNATURE_BYPASS === "true" &&
                        process.env.NODE_ENV !== "production";

    if (!verified && !allowBypass) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Parse the event
    let event: RetellCallEvent;
    try {
      event = JSON.parse(payload);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    // Webhook event received - processing

    // Use any to bypass strict type checking for admin client
    const supabase = createAdminClient() as any;
    const call = event.call;

    // Look up business by agent_id first
    let businessId: string | null = null;

    const { data: aiConfig } = await supabase
      .from("ai_config")
      .select("business_id")
      .eq("retell_agent_id", call.agent_id)
      .single();

    if (aiConfig) {
      businessId = aiConfig.business_id;
    } else if (call.metadata?.businessId) {
      // Fall back to businessId from call metadata (for test calls during onboarding)
      businessId = call.metadata.businessId;
    }

    if (!businessId) {
      // Still return 200 to acknowledge receipt (demo calls without business)
      return NextResponse.json({ received: true, warning: "Unknown agent or demo call" });
    }

    switch (event.event) {
      case "call_started": {
        // Check trial/subscription status before allowing call
        const { data: businessStatus } = await supabase
          .from("businesses")
          .select("subscription_status, trial_ends_at, trial_minutes_used, trial_minutes_limit")
          .eq("id", businessId)
          .single();

        if (businessStatus) {
          const isTrialing = businessStatus.subscription_status === "trialing";
          const isTrialExpired = businessStatus.subscription_status === "trial_expired";

          // Check if trial time has expired
          if (isTrialing && businessStatus.trial_ends_at) {
            const trialEndsAt = new Date(businessStatus.trial_ends_at);
            if (trialEndsAt < new Date()) {
              // Trial time expired - update status and reject call
              await supabase
                .from("businesses")
                .update({ subscription_status: "trial_expired" })
                .eq("id", businessId);

              // Trigger expired email
              await inngest.send({
                name: "trial/expired.send",
                data: { businessId },
              });

              // Note: We still log the call attempt but it won't be answered
              logErrorWithMeta("Retell Webhook call_started blocked", new Error("Trial expired"), {
                businessId,
                callId: call.call_id,
                reason: "trial_time_expired",
              });
            }
          }

          // Check if trial minutes exhausted
          if (isTrialing) {
            const minutesUsed = businessStatus.trial_minutes_used ?? 0;
            const minutesLimit = businessStatus.trial_minutes_limit ?? 30;
            if (minutesUsed >= minutesLimit) {
              logErrorWithMeta("Retell Webhook call_started blocked", new Error("Trial minutes exhausted"), {
                businessId,
                callId: call.call_id,
                reason: "trial_minutes_exhausted",
                minutesUsed,
                minutesLimit,
              });
            }
          }

          // Check if subscription is expired
          if (isTrialExpired) {
            logErrorWithMeta("Retell Webhook call_started blocked", new Error("Trial expired status"), {
              businessId,
              callId: call.call_id,
              reason: "trial_expired_status",
            });
          }

          // Note: We don't reject the webhook - Retell handles call routing
          // The agent should be configured to check trial status and respond appropriately
        }

        // Determine call direction from Retell data or metadata
        const callDirection = call.direction || call.metadata?.direction || "inbound";

        // Create or update call record (upsert handles retries/duplicates)
        const { error: insertError } = await supabase.from("calls").upsert({
          business_id: businessId,
          retell_call_id: call.call_id,
          from_number: call.from_number || null,
          to_number: call.to_number || null,
          direction: callDirection,
          started_at: call.start_timestamp
            ? new Date(call.start_timestamp).toISOString()
            : new Date().toISOString(),
          outcome: null, // Will be set when call ends
          language: "en", // Default, will be updated
        }, {
          onConflict: "retell_call_id",
          ignoreDuplicates: false,
        });

        if (insertError) {
          logErrorWithMeta("Retell Webhook call_started upsert", insertError, {
            businessId,
            callId: call.call_id,
            fromNumber: call.from_number,
          });
          // Return 500 to trigger retry - call data is critical for billing
          return NextResponse.json(
            { error: "Failed to create call record" },
            { status: 500 }
          );
        }

        // Dispatch webhook event for call.started (non-blocking)
        dispatchCallStarted(businessId, {
          call_id: call.call_id,
          from_number: call.from_number,
          to_number: call.to_number,
          started_at: call.start_timestamp
            ? new Date(call.start_timestamp).toISOString()
            : new Date().toISOString(),
        }).catch(err => logError("Webhook dispatch call.started", err));

        break;
      }

      case "call_ended": {

        // Fetch full call details from Retell API for accurate duration and recording URL
        // The webhook payload may not include all details, so we fetch directly from Retell
        const retellCallDetails = await getCallDetails(call.call_id);

        // Use Retell API data if available, otherwise fall back to webhook data
        let durationMs = 0;
        let durationSeconds = 0;
        let recordingUrl: string | null = null;
        let transcriptObject = call.transcript_object || null;
        let startTimestamp = call.start_timestamp;
        let endTimestamp = call.end_timestamp;
        let disconnectionReason = call.disconnection_reason;

        if (retellCallDetails) {
          // Use data from Retell API (more reliable)
          durationMs = retellCallDetails.duration_ms;
          durationSeconds = Math.ceil(durationMs / 1000);
          recordingUrl = retellCallDetails.recording_url;
          transcriptObject = retellCallDetails.transcript_object || transcriptObject;
          startTimestamp = retellCallDetails.start_timestamp || startTimestamp;
          endTimestamp = retellCallDetails.end_timestamp || endTimestamp;
          disconnectionReason = retellCallDetails.disconnection_reason || disconnectionReason;

        } else {
          // Fall back to webhook payload data
          // Try duration_ms from event or call object first
          if (event.duration_ms) {
            durationMs = event.duration_ms;
            durationSeconds = Math.ceil(durationMs / 1000);
          } else if (call.duration_ms) {
            durationMs = call.duration_ms;
            durationSeconds = Math.ceil(durationMs / 1000);
          } else if (call.duration_seconds) {
            durationSeconds = call.duration_seconds;
            durationMs = durationSeconds * 1000;
          } else if (startTimestamp && endTimestamp) {
            // Calculate from timestamps as last resort
            durationMs = endTimestamp - startTimestamp;
            durationSeconds = Math.ceil(durationMs / 1000);
          }

          recordingUrl = call.recording_url || null;
        }

        const durationMinutesBilled = durationSeconds > 0 ? Math.max(1, Math.ceil(durationSeconds / 60)) : 0;

        // Determine outcome based on metadata or disconnection reason
        let outcome = "info"; // Default
        const metadata = call.metadata || {};
        const isOutboundCall = call.direction === "outbound" ||
                               metadata.direction === "outbound" ||
                               metadata.purpose !== undefined;

        if (metadata.appointment_booked === "true") {
          outcome = "booked";
        } else if (metadata.transferred === "true") {
          outcome = "transferred";
        } else if (metadata.message_taken === "true") {
          outcome = "message";
        } else if (!isOutboundCall && disconnectionReason === "user_hangup" && durationSeconds < 10) {
          // Only mark as missed for INBOUND calls where user hung up quickly
          // For outbound calls, user_hangup means they answered
          outcome = "missed";
        } else if (isOutboundCall) {
          // For outbound calls, determine outcome from disconnection reason
          if (disconnectionReason === "no_answer" || disconnectionReason === "user_did_not_answer") {
            outcome = "no_answer";
          } else if (disconnectionReason === "voicemail_reached" || disconnectionReason === "answering_machine") {
            outcome = "voicemail";
          } else if (disconnectionReason === "rejected" || disconnectionReason === "call_rejected") {
            outcome = "declined";
          } else if (disconnectionReason === "user_hangup" || disconnectionReason === "agent_hangup") {
            // Call was answered and ended normally - use "info" which is allowed by DB constraint
            outcome = "info";
          }
        }

        // Detect language from transcript or metadata
        const language = metadata.language || "en";

        // Determine call direction
        const callDirection = call.direction || metadata.direction || "inbound";

        // Upsert call record (prevents race condition if multiple webhooks arrive simultaneously)
        const callData = {
          business_id: businessId,
          retell_call_id: call.call_id,
          from_number: call.from_number || null,
          to_number: call.to_number || null,
          direction: callDirection,
          started_at: startTimestamp
            ? new Date(startTimestamp).toISOString()
            : null,
          ended_at: endTimestamp
            ? new Date(endTimestamp).toISOString()
            : new Date().toISOString(),
          duration_seconds: durationSeconds,
          duration_minutes_billed: durationMinutesBilled,
          language: language,
          recording_url: recordingUrl,
          transcript: transcriptObject,
          outcome: outcome,
        };

        const { error: upsertError } = await supabase
          .from("calls")
          .upsert(callData, {
            onConflict: "retell_call_id",
            ignoreDuplicates: false
          });

        if (upsertError) {
          logErrorWithMeta("Retell Webhook call_ended upsert", upsertError, {
            businessId,
            callId: call.call_id,
            durationSeconds,
            durationMinutesBilled,
          });
          // Return 500 to trigger retry - call data is critical for billing and analytics
          return NextResponse.json(
            { error: "Failed to update call record" },
            { status: 500 }
          );
        }

        // Get the call ID immediately after upsert for audit trail
        const { data: callRecord } = await supabase
          .from("calls")
          .select("id")
          .eq("retell_call_id", call.call_id)
          .single();

        const callId = callRecord?.id;

        // Update business minutes usage - critical for billing
        // Also check for trial status and update trial minutes
        if (durationMinutesBilled > 0) {
          // First, check if business is in trial mode
          const { data: businessData } = await supabase
            .from("businesses")
            .select("subscription_status, trial_minutes_used, trial_minutes_limit")
            .eq("id", businessId)
            .single();

          const isTrialing = businessData?.subscription_status === "trialing";

          if (isTrialing) {
            // Update trial minutes
            const { data: trialResult, error: trialError } = await supabase.rpc("increment_trial_minutes", {
              p_business_id: businessId,
              p_minutes: durationMinutesBilled,
            });

            if (trialError) {
              logErrorWithMeta("Retell Webhook increment_trial_minutes", trialError, {
                businessId,
                callId: call.call_id,
                durationMinutesBilled,
              });
              // Don't fail - still try to increment regular minutes
            }

            // Check if trial minutes exhausted
            if (trialResult && trialResult[0]?.trial_exhausted) {
              // Trigger trial expired event
              await inngest.send({
                name: "trial/expired.send",
                data: { businessId },
              });
            }
          } else {
            // Regular billing - increment minutes used with call_id for audit trail
            const { error: minutesError } = await supabase.rpc("increment_minutes_used", {
              p_business_id: businessId,
              p_minutes: durationMinutesBilled,
              p_call_id: callId || null,
              p_source: "webhook",
              p_source_reference: call.call_id,
            });

            if (minutesError) {
              // Log but don't fail - function may not exist yet
              logErrorWithMeta("Retell Webhook increment_minutes_used", minutesError, {
                businessId,
                callId: call.call_id,
                durationMinutesBilled,
              });
              // Don't return 500 - call record is already saved, billing can be reconciled later
            }
          }

          // Calculate and store platform cost for profitability tracking
          if (callId) {
            const { error: costError } = await supabase.rpc("calculate_call_platform_cost", {
              p_call_id: callId,
            });

            if (costError) {
              // Log but don't fail - can be calculated later
              logErrorWithMeta("Retell Webhook calculate_call_platform_cost", costError, {
                callId,
                durationMinutesBilled,
              });
            }
          }
        }

        // Trigger missed call alert if applicable
        if (outcome === "missed" && call.from_number && callId) {
          await inngest.send({
            name: "call/missed.alert",
            data: {
              callId,
              businessId,
              callerPhone: call.from_number,
              callerName: metadata.caller_name,
              callTime: call.start_timestamp
                ? new Date(call.start_timestamp).toISOString()
                : new Date().toISOString(),
            },
          });
        }

        // Trigger follow-up text for successful calls
        if (["booked", "info", "message"].includes(outcome) && call.from_number && callId) {
          await inngest.send({
            name: "call/followup.send",
            data: {
              callId,
              businessId,
              callerPhone: call.from_number,
              outcome,
              serviceName: metadata.service_name,
            },
          });
        }

        // Dispatch webhook event for call.ended (non-blocking)
        dispatchCallEnded(businessId, {
          call_id: call.call_id,
          from_number: call.from_number,
          to_number: call.to_number,
          started_at: startTimestamp
            ? new Date(startTimestamp).toISOString()
            : undefined,
          ended_at: endTimestamp
            ? new Date(endTimestamp).toISOString()
            : new Date().toISOString(),
          duration_seconds: durationSeconds,
          outcome,
        }).catch(err => logError("Webhook dispatch call.ended", err));

        // Record outbound call outcome if this was an outbound call
        // Check direction from metadata or call object
        const isOutbound = call.direction === "outbound" ||
                          metadata.direction === "outbound" ||
                          metadata.purpose !== undefined; // outbound calls have a purpose

        if (isOutbound) {
          // Log raw Retell data for debugging
          console.log("[Retell Outbound Debug]", {
            callId: call.call_id,
            disconnectionReason,
            durationSeconds,
            outcome,
            callStatus: call.call_status,
          });

          try {
            await recordOutboundCallOutcome({
              retellCallId: call.call_id,
              businessId,
              callId: callId || undefined,
              outcome: outcome,
              durationSeconds,
              disconnectionReason: disconnectionReason,
              errorMessage: disconnectionReason === "error" ? "Call ended with error" : undefined,
            });
          } catch (outboundError) {
            // Log but don't fail the webhook - the call record is already saved
            logErrorWithMeta("Retell Webhook outbound outcome", outboundError, {
              businessId,
              callId: call.call_id,
              outcome,
            });
          }
        }

        // Call ended - processed successfully
        break;
      }

      case "call_analyzed": {
        // Update call with analysis data
        const analysis = call.call_analysis;

        if (analysis) {
          const { data: existingCall } = await supabase
            .from("calls")
            .select("id, outcome")
            .eq("retell_call_id", call.call_id)
            .single();

          if (existingCall) {
            // Extract lead info from custom analysis
            const leadInfo = analysis.custom_analysis_data || {};

            // Update outcome based on analysis if we have better info
            let outcome = existingCall.outcome;
            if (analysis.custom_analysis_data?.appointment_booked) {
              outcome = "booked";
            }

            // Update call record with analysis
            await supabase
              .from("calls")
              .update({
                summary: analysis.call_summary || null,
                outcome: outcome,
                lead_info: leadInfo,
              })
              .eq("id", existingCall.id);

            // If appointment was booked, create appointment record and sync to calendar
            if (leadInfo.appointment_date && leadInfo.customer_name) {
              const appointmentData = {
                business_id: businessId,
                call_id: existingCall.id,
                customer_name: leadInfo.customer_name as string,
                customer_phone: leadInfo.customer_phone as string || call.from_number,
                customer_email: leadInfo.customer_email as string || null,
                service_name: leadInfo.service_name as string || "Appointment",
                scheduled_at: leadInfo.appointment_date as string,
                duration_minutes: leadInfo.duration_minutes as number || 60,
                status: "confirmed",
              };

              const { data: newAppointment } = await supabase
                .from("appointments")
                .insert(appointmentData)
                .select("id")
                .single();

              // Sync to external calendar if connected
              if (newAppointment?.id) {
                try {
                  const startTime = new Date(leadInfo.appointment_date as string);
                  const endTime = new Date(startTime.getTime() + ((leadInfo.duration_minutes as number) || 60) * 60000);

                  const eventId = await createAppointmentEvent(businessId, {
                    summary: `${leadInfo.service_name || "Appointment"} - ${leadInfo.customer_name}`,
                    description: `Booked via Koya AI call\nCustomer: ${leadInfo.customer_name}\nPhone: ${leadInfo.customer_phone || call.from_number}`,
                    start: startTime,
                    end: endTime,
                    customerEmail: leadInfo.customer_email as string,
                    customerName: leadInfo.customer_name as string,
                  });

                  if (eventId) {
                    await supabase
                      .from("appointments")
                      .update({ external_event_id: eventId })
                      .eq("id", newAppointment.id);
                  }
                } catch (_calendarError) {
                  // Don't fail the whole webhook - calendar sync is nice-to-have
                }
              }
            }
          }
        }

        // Call analyzed - processed successfully
        break;
      }

      default:
        // Unknown event type - ignored
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    // Log the error for debugging
    logError("Retell Webhook", error);

    // Try to parse the payload for storage
    let parsedPayload: Record<string, unknown> = {};
    try {
      const payload = await request.clone().text();
      parsedPayload = JSON.parse(payload);
    } catch {
      // Use empty object if parsing fails
    }

    // Store the failed webhook for retry
    const eventType = (parsedPayload as { event?: string }).event || "unknown";
    await storeFailedWebhook({
      source: "retell",
      eventType,
      payload: parsedPayload,
      error: error instanceof Error ? error : new Error(String(error)),
    });

    // Return 200 to acknowledge receipt (we'll handle retry internally)
    // This prevents Retell from retrying and creating duplicate events
    return NextResponse.json({ received: true, queued_for_retry: true });
  }
}

// Prevent other HTTP methods
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
