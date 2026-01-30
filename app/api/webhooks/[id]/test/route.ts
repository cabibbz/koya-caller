/**
 * Test Webhook API Route
 * POST /api/webhooks/[id]/test - Send a test webhook
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { withDashboardRateLimit } from "@/lib/rate-limit/middleware";
import { testWebhook } from "@/lib/webhooks";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

async function handlePOST(
  request: NextRequest,
  context?: { params: Promise<{ id: string }> }
) {
  try {
    if (!context) {
      return NextResponse.json({ error: "Missing context" }, { status: 400 });
    }
    const { id } = await context.params;

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await getBusinessByUserId(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Verify webhook belongs to this business
    const { data: webhook, error: webhookError } = await (supabase as any)
      .from("business_webhooks")
      .select("id")
      .eq("id", id)
      .eq("business_id", business.id)
      .single();

    if (webhookError || !webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    // Send test webhook
    const result = await testWebhook(id);

    return NextResponse.json({
      success: result.success,
      status_code: result.status_code,
      error: result.error,
    });
  } catch (error) {
    logError("Test Webhook", error);
    return NextResponse.json(
      { error: "Failed to test webhook" },
      { status: 500 }
    );
  }
}

export const POST = withDashboardRateLimit(handlePOST);
