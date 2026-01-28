/**
 * Stripe Connect Onboarding API
 * POST: Generate Account Link for onboarding
 * GET: Check if onboarding is complete
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withDashboardRateLimit } from "@/lib/rate-limit/middleware";
import {
  getConnectAccountForBusiness,
  getAccountLink,
  getAccountStatus,
} from "@/lib/stripe/connect";
import { logError, logInfo } from "@/lib/logging";

/**
 * POST /api/stripe/connect/onboarding
 * Generate a new Account Link for continuing onboarding
 */
export const POST = withDashboardRateLimit(async (request: NextRequest) => {
  try {
    // Verify authentication
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get business
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (businessError || !business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const biz = business as { id: string };

    // Get Connect account
    const connectAccount = await getConnectAccountForBusiness(biz.id);
    if (!connectAccount) {
      return NextResponse.json(
        { error: "Stripe Connect not configured. Create an account first." },
        { status: 400 }
      );
    }

    // Parse request body for return URL
    let returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/settings/payments?onboarding=complete`;
    try {
      const body = await request.json();
      if (body.returnUrl) {
        returnUrl = body.returnUrl;
      }
    } catch {
      // Use default return URL
    }

    // Generate new account link
    const accountLink = await getAccountLink({
      accountId: connectAccount.accountId,
      returnUrl,
    });

    return NextResponse.json({
      success: true,
      accountLink,
    });
  } catch (error) {
    logError("Stripe Connect - Onboarding Link", error);
    return NextResponse.json(
      { error: "Failed to generate onboarding link" },
      { status: 500 }
    );
  }
});

/**
 * GET /api/stripe/connect/onboarding
 * Check if onboarding is complete and update status
 */
export const GET = withDashboardRateLimit(async (_request: NextRequest) => {
  try {
    // Verify authentication
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get business
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (businessError || !business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const biz = business as { id: string };

    // Get Connect account
    const connectAccount = await getConnectAccountForBusiness(biz.id);
    if (!connectAccount) {
      return NextResponse.json({
        configured: false,
        complete: false,
        message: "Stripe Connect not configured",
      });
    }

    // Get account status from Stripe
    const status = await getAccountStatus(connectAccount.accountId);

    // Determine if onboarding is complete
    const isComplete =
      status.chargesEnabled &&
      status.payoutsEnabled &&
      status.detailsSubmitted &&
      status.requirements.currentlyDue.length === 0;

    // Update database if status changed
    if (isComplete && !connectAccount.isActive) {
      const adminSupabase = createAdminClient();
      await (adminSupabase as any)
        .from("business_integrations")
        .update({
          is_active: true,
          metadata: {
            charges_enabled: status.chargesEnabled,
            payouts_enabled: status.payoutsEnabled,
            onboarding_completed_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq("business_id", biz.id)
        .eq("provider", "stripe_connect");

      logInfo("Stripe Connect", `Onboarding completed for business ${biz.id}`);
    }

    // Determine next steps if not complete
    const nextSteps: string[] = [];
    if (!isComplete) {
      if (!status.detailsSubmitted) {
        nextSteps.push("Complete business information");
      }
      if (status.requirements.currentlyDue.length > 0) {
        nextSteps.push("Provide additional verification documents");
      }
      if (!status.chargesEnabled) {
        nextSteps.push("Verify identity to enable charges");
      }
      if (!status.payoutsEnabled) {
        nextSteps.push("Add bank account for payouts");
      }
    }

    return NextResponse.json({
      configured: true,
      complete: isComplete,
      chargesEnabled: status.chargesEnabled,
      payoutsEnabled: status.payoutsEnabled,
      detailsSubmitted: status.detailsSubmitted,
      requirements: status.requirements,
      nextSteps,
    });
  } catch (error) {
    logError("Stripe Connect - Onboarding Status", error);
    return NextResponse.json(
      { error: "Failed to check onboarding status" },
      { status: 500 }
    );
  }
});
