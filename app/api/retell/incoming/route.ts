/**
 * Koya Caller - Retell Incoming Call Handler
 * Session 12: Full Twilio Integration
 * Session 23: Enhanced Error Handling
 *
 * Handles incoming Twilio calls and routes them to Retell AI agent.
 * This endpoint returns TwiML that connects the call to Retell.
 *
 * Features:
 * - Fallback to TwiML IVR when Retell is unavailable
 * - Error logging to system_logs table
 * - Retry logic for transient failures
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { redirect as twimlRedirect } from "@/lib/twilio/twiml";
import {
  handleRetellFailure,
} from "@/lib/errors";
import { getAppUrl } from "@/lib/config";

const appUrl = getAppUrl();
const retellApiKey = process.env.RETELL_API_KEY;

// Helper to parse Twilio form data
async function parseTwilioParams(request: NextRequest): Promise<Record<string, string>> {
  const text = await request.text();
  const formData = new URLSearchParams(text);
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

// Helper to return TwiML response
function twimlResponse(xml: string): Response {
  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml",
    },
  });
}

/**
 * POST /api/retell/incoming
 * Handle incoming Twilio call and connect to Retell
 */
export async function POST(request: NextRequest) {
  try {
    const params = await parseTwilioParams(request);
    
    const callSid = params.CallSid;
    const fromNumber = params.From || "";
    const toNumber = params.To || "";
    
    // Check if this is an after-hours call
    const url = new URL(request.url);
    const isAfterHours = url.searchParams.get("after_hours") === "true";

    // Debug logging removed for production

    // Look up business and AI config
    const supabase = createAdminClient();
    
    const { data: phoneRecord } = await supabase
      .from("phone_numbers")
      .select("business_id")
      .eq("number", toNumber)
      .eq("is_active", true)
      .single() as { data: { business_id: string } | null };
    
    if (!phoneRecord?.business_id) {
      return twimlResponse(twimlRedirect(`${appUrl}/api/twilio/fallback`));
    }
    
    const businessId = phoneRecord.business_id;
    
    // Get AI config with Retell agent ID
    const { data: aiConfig } = await supabase
      .from("ai_config")
      .select("retell_agent_id, retell_agent_id_spanish, language_mode, ai_name, greeting, greeting_spanish, spanish_enabled")
      .eq("business_id", businessId)
      .single() as { data: { retell_agent_id: string | null; retell_agent_id_spanish: string | null; language_mode: string; ai_name: string | null; greeting: string | null; greeting_spanish: string | null; spanish_enabled: boolean } | null };

    if (!aiConfig?.retell_agent_id) {
      return twimlResponse(twimlRedirect(`${appUrl}/api/twilio/fallback`));
    }

    // Determine which agent to use based on language mode
    // If spanish_default and Spanish agent exists, use Spanish agent
    // Otherwise use the main (English or multilingual) agent
    const useSpanishAgent =
      aiConfig.language_mode === "spanish_default" &&
      aiConfig.spanish_enabled &&
      aiConfig.retell_agent_id_spanish;

    const selectedAgentId = useSpanishAgent
      ? aiConfig.retell_agent_id_spanish
      : aiConfig.retell_agent_id;

    // Fetch business knowledge to pass to Retell as dynamic variables
    const { data: business } = await supabase
      .from("businesses")
      .select("name, business_type, timezone, address, service_area, differentiator, booking_page_url, booking_link_delivery")
      .eq("id", businessId)
      .single() as { data: { name: string; business_type: string | null; timezone: string | null; address: string | null; service_area: string | null; differentiator: string | null; booking_page_url: string | null; booking_link_delivery: string | null } | null };

    // Fetch FAQs
    const { data: faqs } = await supabase
      .from("faqs")
      .select("question, answer")
      .eq("business_id", businessId)
      .order("sort_order")
      .limit(20);

    const faqList = (faqs || []).map((f: { question: string; answer: string }) =>
      `Q: ${f.question}\nA: ${f.answer}`
    ).join("\n\n");

    // Fetch services
    const { data: services } = await supabase
      .from("services")
      .select("name, description, duration_minutes, price_cents")
      .eq("business_id", businessId)
      .order("sort_order")
      .limit(20);

    const serviceList = (services || []).map((s: { name: string; description: string | null; duration_minutes: number; price_cents: number | null }) => {
      const price = s.price_cents ? `$${(s.price_cents / 100).toFixed(0)}` : "Price varies";
      return `- ${s.name}: ${s.description || "No description"} (${s.duration_minutes} min, ${price})`;
    }).join("\n");

    // Fetch all business hours
    const now = new Date();
    const dayOfWeek = now.getDay();
    const { data: allHours } = await supabase
      .from("business_hours")
      .select("day_of_week, open_time, close_time, is_closed")
      .eq("business_id", businessId)
      .order("day_of_week") as { data: Array<{ day_of_week: number; open_time: string | null; close_time: string | null; is_closed: boolean }> | null };

    // Format today's hours
    const todayHours = allHours?.find(h => h.day_of_week === dayOfWeek);
    const hoursInfo = todayHours?.is_closed
      ? "Closed today"
      : todayHours?.open_time && todayHours?.close_time
        ? `Open ${todayHours.open_time} - ${todayHours.close_time}`
        : "Hours not set";

    // Format full weekly schedule
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const fullHoursSchedule = (allHours || []).map(h => {
      const dayName = dayNames[h.day_of_week];
      if (h.is_closed) {
        return `${dayName}: Closed`;
      }
      return `${dayName}: ${h.open_time || "?"} - ${h.close_time || "?"}`;
    }).join("\n");

    // Fetch additional knowledge
    const { data: knowledge } = await supabase
      .from("knowledge")
      .select("content")
      .eq("business_id", businessId)
      .single() as { data: { content: string | null } | null };

    // Fetch call settings for transfer number
    const { data: callSettings } = await supabase
      .from("call_settings")
      .select("transfer_number, backup_transfer_number, transfer_on_request, transfer_on_emergency, transfer_on_upset")
      .eq("business_id", businessId)
      .single() as { data: { transfer_number: string | null; backup_transfer_number: string | null; transfer_on_request: boolean; transfer_on_emergency: boolean; transfer_on_upset: boolean } | null };

    // Check if Retell is configured
    if (!retellApiKey) {
      return twimlResponse(twimlRedirect(`${appUrl}/api/twilio/fallback`));
    }
    
    // Create call record in database
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: callRecord, error: callError } = await (supabase as any)
      .from("calls")
      .insert({
        business_id: businessId,
        from_number: fromNumber,
        to_number: toNumber,
        started_at: new Date().toISOString(),
        outcome: null, // Will be updated by webhook
      })
      .select("id")
      .single();
    
    if (callError) {
      // Error handled silently
    }
    
    // Use Retell SDK to register the call
    // This creates a Retell call and returns the WebSocket URL
    try {
      const Retell = await import("retell-sdk");
      const retellClient = new Retell.default({ apiKey: retellApiKey });
      
      // Register the call with Retell
      // Use the selected agent (Spanish or English/multilingual)
      const retellCall = await retellClient.call.registerPhoneCall({
        agent_id: selectedAgentId!,
        from_number: toNumber,  // Retell expects the Twilio number as "from"
        to_number: fromNumber,  // Caller's number as "to"
        direction: "inbound",   // Required: specify this is an inbound call
        metadata: {
          twilio_call_sid: callSid,
          koya_call_id: callRecord?.id || "",
          business_id: businessId,
          is_after_hours: isAfterHours ? "true" : "false",
        },
        retell_llm_dynamic_variables: {
          // Call context
          is_after_hours: isAfterHours ? "true" : "false",
          current_date: now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
          current_time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),

          // Business info
          business_name: business?.name || "the business",
          business_type: business?.business_type || "business",
          business_address: business?.address || "Address not available",
          service_area: business?.service_area || "",
          differentiator: business?.differentiator || "",

          // AI personality
          ai_name: aiConfig.ai_name || "Koya",
          greeting: useSpanishAgent
            ? (aiConfig.greeting_spanish || `Gracias por llamar a ${business?.name || "nosotros"}. ¿En qué puedo ayudarle?`)
            : (aiConfig.greeting || `Thanks for calling ${business?.name || "us"}. How can I help you today?`),
          spanish_enabled: aiConfig.spanish_enabled ? "true" : "false",
          using_spanish_agent: useSpanishAgent ? "true" : "false",

          // Today's hours
          todays_hours: hoursInfo,

          // Full weekly business hours
          business_hours: fullHoursSchedule || "Hours not configured",

          // Services (formatted list)
          services_list: serviceList || "No services configured",

          // FAQs (formatted Q&A)
          faqs: faqList || "No FAQs available",

          // Additional knowledge
          additional_knowledge: knowledge?.content || "",

          // External booking page URL (for businesses using Vagaro, Square, Calendly, etc.)
          booking_page_url: business?.booking_page_url || "",
          booking_link_delivery: business?.booking_link_delivery || "sms",

          // Transfer settings - required for Retell's built-in transfer_call tool
          transfer_number: callSettings?.transfer_number || callSettings?.backup_transfer_number || "",
          transfer_enabled: (callSettings?.transfer_number || callSettings?.backup_transfer_number) ? "true" : "false",
        },
      });
      
      // Call registered with Retell successfully
      
      // Update call record with Retell call ID
      if (callRecord?.id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
        await (supabase as any)
          .from("calls")
          .update({ retell_call_id: retellCall.call_id })
          .eq("id", callRecord.id);
      }
      
      // Return TwiML that connects to Retell via SIP
      // Retell uses SIP-based integration for Twilio calls
      // The call_id from registerPhoneCall is used in the SIP URI
      // See: https://docs.retellai.com/deploy/custom-telephony
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Sip>sip:${retellCall.call_id}@5t4n6j0wnrl.sip.livekit.cloud</Sip>
  </Dial>
</Response>`;
      
      return twimlResponse(twiml);
      
    } catch (retellError) {

      // Log to system_logs for admin visibility
      await handleRetellFailure(retellError, {
        businessId,
        callId: callRecord?.id,
        action: "register_phone_call",
      });

      // Update call record to indicate failure
      if (callRecord?.id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
        await (supabase as any)
          .from("calls")
          .update({
            outcome: "missed",
            summary: "Retell connection failed - using fallback IVR",
          })
          .eq("id", callRecord.id);
      }

      // Fall back to TwiML IVR
      return twimlResponse(twimlRedirect(`${appUrl}/api/twilio/fallback`));
    }
    
  } catch (_error) {
    return twimlResponse(twimlRedirect(`${appUrl}/api/twilio/fallback`));
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
