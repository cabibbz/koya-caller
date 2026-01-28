/**
 * Offer Settings API Route
 * Controls which offers the AI can suggest during calls
 *
 * PUT /api/dashboard/settings/offers
 * Updates: upsells_enabled, bundles_enabled, packages_enabled, memberships_enabled
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { triggerImmediateRegeneration } from "@/lib/claude/queue";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

async function handlePut(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: aiConfig, error: updateError } = await (supabase as any)
      .from("ai_config")
      .upsert(updateData, { onConflict: "business_id" })
      .select()
      .single();

    if (updateError) {
      logError("Offer settings update", updateError);
      return errors.internalError("Failed to update offer settings");
    }

    // Trigger immediate prompt regeneration and Retell sync
    // (Don't await - let it run in background, settings are already saved)
    triggerImmediateRegeneration(business.id).catch((error) => {
      logError("Offer Settings - Retell Sync", error);
    });

    return success(aiConfig);
  } catch (error) {
    logError("Settings Offers PUT", error);
    return errors.internalError("Failed to update offer settings");
  }
}

export const PUT = withAuth(handlePut);
