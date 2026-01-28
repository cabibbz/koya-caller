/**
 * Integration Disconnect Route
 *
 * POST /api/integrations/[provider]/disconnect
 * Disconnects an integration for the current business
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { withDashboardRateLimit } from "@/lib/rate-limit/middleware";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

const VALID_PROVIDERS = [
  "shopify",
  "square",
  "stripe_connect",
  "hubspot",
  "salesforce",
  "opentable",
  "mindbody",
];

async function handlePOST(
  request: NextRequest,
  context?: { params: Promise<{ provider: string }> }
) {
  try {
    if (!context) {
      return NextResponse.json({ error: "Missing context" }, { status: 400 });
    }
    const { provider } = await context.params;

    // Validate provider
    if (!VALID_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        { error: "Invalid integration provider" },
        { status: 400 }
      );
    }

    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get business
    const business = await getBusinessByUserId(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Delete the integration
    const { error: deleteError } = await supabase
      .from("business_integrations")
      .delete()
      .eq("business_id", business.id)
      .eq("provider", provider);

    if (deleteError) {
      throw new Error("Failed to disconnect integration");
    }

    return NextResponse.json({
      success: true,
      message: `${provider} disconnected successfully`,
    });
  } catch (error) {
    logError("Integration Disconnect", error);
    return NextResponse.json(
      { error: "Failed to disconnect integration" },
      { status: 500 }
    );
  }
}

export const POST = withDashboardRateLimit(handlePOST);
