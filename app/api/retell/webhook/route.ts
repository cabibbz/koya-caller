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
import { logError } from "@/lib/logging";

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
        // Create initial call record
        const { error: _insertError } = await supabase.from("calls").insert({
          business_id: businessId,
          retell_call_id: call.call_id,
          from_number: call.from_number || null,
          to_number: call.to_number || null,
          started_at: call.start_timestamp
            ? new Date(call.start_timestamp).toISOString()
            : new Date().toISOString(),
          outcome: null, // Will be set when call ends
          language: "en", // Default, will be updated
        });

        // Error creating call handled silently
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
        if (metadata.appointment_booked === "true") {
          outcome = "booked";
        } else if (metadata.transferred === "true") {
          outcome = "transferred";
        } else if (metadata.message_taken === "true") {
          outcome = "message";
        } else if (disconnectionReason === "user_hangup" && durationSeconds < 10) {
          outcome = "missed";
        }

        // Detect language from transcript or metadata
        const language = metadata.language || "en";

        // Update or insert call record
        const { data: existingCall } = await supabase
          .from("calls")
          .select("id")
          .eq("retell_call_id", call.call_id)
          .single();

        const callData = {
          business_id: businessId,
          retell_call_id: call.call_id,
          from_number: call.from_number || null,
          to_number: call.to_number || null,
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

        if (existingCall) {
          const { error: updateError } = await supabase
            .from("calls")
            .update(callData)
            .eq("id", existingCall.id);
          if (updateError) {
            logError("Retell Webhook", updateError);
          }
        } else {
          const { error: insertError } = await supabase.from("calls").insert(callData);
          if (insertError) {
            logError("Retell Webhook", insertError);
          }
        }

        // Update business minutes usage
        if (durationMinutesBilled > 0) {
          await supabase.rpc("increment_minutes_used", {
            p_business_id: businessId,
            p_minutes: durationMinutesBilled,
          });
        }

        // Get the call ID for events
        const { data: callRecord } = await supabase
          .from("calls")
          .select("id")
          .eq("retell_call_id", call.call_id)
          .single();

        const callId = callRecord?.id || existingCall?.id;

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

    // Return 500 to trigger Retell retry for transient failures
    // Retell will retry up to 3 times with exponential backoff
    // This ensures call data, appointments, and billing are not lost
    return NextResponse.json(
      { error: "Internal processing error" },
      { status: 500 }
    );
  }
}

// Prevent other HTTP methods
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
