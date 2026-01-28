/**
 * Test Outbound Call API
 * /api/test-outbound
 *
 * POST: Test if outbound calling is configured and working
 * Body: { phone: "+1XXXXXXXXXX" } - Your phone number to receive test call
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBusinessByUserId } from "@/lib/db/core";
import { logError } from "@/lib/logging";
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await getBusinessByUserId(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const body = await request.json();
    const testPhone = body.phone;

    if (!testPhone) {
      return NextResponse.json({
        error: "Missing phone number",
        usage: "POST with body: { \"phone\": \"+1XXXXXXXXXX\" }"
      }, { status: 400 });
    }

    const adminSupabase = createAdminClient() as AnySupabaseClient;
    const checks: Record<string, unknown> = {};

    // Check 1: Phone number configured
    const { data: phoneNumber } = await adminSupabase
      .from("phone_numbers")
      .select("number, is_active")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .limit(1)
      .single();

    checks.phoneNumber = phoneNumber
      ? { ok: true, from: phoneNumber.number }
      : { ok: false, error: "No active phone number configured" };

    // Check 2: AI Agent configured
    const { data: aiConfig } = await adminSupabase
      .from("ai_config")
      .select("retell_agent_id, ai_name")
      .eq("business_id", business.id)
      .single();

    checks.aiAgent = aiConfig?.retell_agent_id
      ? { ok: true, agentId: aiConfig.retell_agent_id, name: aiConfig.ai_name }
      : { ok: false, error: "No AI agent configured" };

    // Check 3: Retell API Key
    const { isRetellConfigured, verifyRetellPhoneNumber } = await import("@/lib/retell");
    checks.retellApi = isRetellConfigured()
      ? { ok: true }
      : { ok: false, error: "Retell API not configured" };

    // Check 4: Phone number registered with Retell
    if (phoneNumber?.number) {
      const retellPhoneCheck = await verifyRetellPhoneNumber(phoneNumber.number);
      checks.retellPhoneNumber = retellPhoneCheck.registered
        ? { ok: true, number: phoneNumber.number }
        : { ok: false, error: retellPhoneCheck.error };
    } else {
      checks.retellPhoneNumber = { ok: false, error: "No phone number to verify" };
    }

    // If any check failed, return diagnostics
    const allOk = Object.values(checks).every((c: any) => c.ok);
    if (!allOk) {
      return NextResponse.json({
        success: false,
        message: "Configuration incomplete - cannot make calls",
        checks,
        fix: {
          phoneNumber: "Go to Settings > Phone and add a phone number",
          aiAgent: "Complete onboarding to create an AI agent",
          retellApi: "Ensure the Retell API is properly configured",
          retellPhoneNumber: "Verify your phone number is registered with Retell"
        }
      });
    }

    // For testing, temporarily set outbound hours to 24/7
    await adminSupabase
      .from("outbound_settings")
      .upsert({
        business_id: business.id,
        outbound_enabled: true,
        outbound_hours_start: "00:00",
        outbound_hours_end: "23:59",
        outbound_days: [0, 1, 2, 3, 4, 5, 6],
        outbound_daily_limit: 100,
        outbound_timezone: "America/New_York",
      }, { onConflict: "business_id" });

    // All checks passed - try to make the call
    const { initiateOutboundCall } = await import("@/lib/outbound");

    const result = await initiateOutboundCall(business.id, testPhone, {
      purpose: "custom",
      customMessage: "This is a test call from Koya to verify outbound calling is working.",
      metadata: { test: "true" }
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "Test call initiated! You should receive a call shortly.",
        callId: result.callId,
        retellCallId: result.retellCallId,
        from: phoneNumber?.number,
        to: testPhone
      });
    } else {
      return NextResponse.json({
        success: false,
        message: "Failed to initiate call",
        error: result.error,
        reason: result.reason,
        checks
      });
    }

  } catch (error) {
    logError("Test outbound error", error);
    return NextResponse.json({
      error: "Failed to test outbound call"
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // Security: Require authentication for call status checks
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const callId = searchParams.get("callId");

  if (callId) {
    // Check call status from Retell
    try {
      const { getCallDetails } = await import("@/lib/retell");
      const details = await getCallDetails(callId);

      if (details) {
        return NextResponse.json({
          success: true,
          callId,
          status: details.disconnection_reason || "unknown",
          duration_ms: details.duration_ms,
          start: details.start_timestamp ? new Date(details.start_timestamp).toISOString() : null,
          end: details.end_timestamp ? new Date(details.end_timestamp).toISOString() : null,
          analysis: details.call_analysis
        });
      } else {
        return NextResponse.json({
          success: false,
          callId,
          message: "Could not retrieve call details - call may still be in progress or not found"
        });
      }
    } catch (error) {
      return NextResponse.json({
        success: false,
        callId,
        error: error instanceof Error ? error.message : "Failed to get call details"
      });
    }
  }

  return NextResponse.json({
    usage: {
      test: "POST /api/test-outbound with body: { \"phone\": \"+1XXXXXXXXXX\" }",
      checkStatus: "GET /api/test-outbound?callId=call_xxxxx"
    },
    description: "Tests if outbound calling is configured and makes a test call to your phone"
  });
}
