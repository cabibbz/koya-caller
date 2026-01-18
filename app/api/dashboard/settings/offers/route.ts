/**
 * Offer Settings API Route
 * Controls which offers the AI can suggest during calls
 *
 * PUT /api/dashboard/settings/offers
 * Updates: upsells_enabled, bundles_enabled, packages_enabled, memberships_enabled
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { triggerImmediateRegeneration } from "@/lib/claude/queue";
import { withDashboardRateLimit } from "@/lib/rate-limit/middleware";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

async function handler(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's business
    const business = await getBusinessByUserId(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const body = await request.json();
    const { upsellsEnabled, bundlesEnabled, packagesEnabled, membershipsEnabled } = body;

    // Build update object
    const updateData: Record<string, unknown> = {
      business_id: business.id,
      updated_at: new Date().toISOString(),
    };

    if (upsellsEnabled !== undefined) updateData.upsells_enabled = upsellsEnabled;
    if (bundlesEnabled !== undefined) updateData.bundles_enabled = bundlesEnabled;
    if (packagesEnabled !== undefined) updateData.packages_enabled = packagesEnabled;
    if (membershipsEnabled !== undefined) updateData.memberships_enabled = membershipsEnabled;

    // Upsert AI config
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: aiConfig, error: updateError } = await (supabase as any)
      .from("ai_config")
      .upsert(updateData, { onConflict: "business_id" })
      .select()
      .single();

    if (updateError) {
      logError("Offer settings update", updateError);
      return NextResponse.json(
        { error: "Failed to update offer settings" },
        { status: 500 }
      );
    }

    // Trigger immediate prompt regeneration and Retell sync
    // (Don't await - let it run in background, settings are already saved)
    triggerImmediateRegeneration(business.id).catch((error) => {
      logError("Offer Settings - Retell Sync", error);
    });

    return NextResponse.json({
      success: true,
      data: aiConfig,
    });
  } catch (error) {
    logError("Settings Offers PUT", error);
    return NextResponse.json(
      { error: "Failed to update offer settings" },
      { status: 500 }
    );
  }
}

// Apply rate limiting
export const PUT = withDashboardRateLimit(handler);
