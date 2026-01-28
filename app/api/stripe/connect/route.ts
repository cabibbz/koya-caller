/**
 * Stripe Connect Account Management API
 * POST: Create new Connect account for business
 * GET: Get Connect account status
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withDashboardRateLimit } from "@/lib/rate-limit/middleware";
import {
  createConnectAccount,
  getConnectAccountForBusiness,
  getAccountStatus,
} from "@/lib/stripe/connect";
import { logError } from "@/lib/logging";

/**
 * POST /api/stripe/connect
 * Create a new Stripe Connect Express account for the business
 */
export const POST = withDashboardRateLimit(async (_request: NextRequest) => {
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
      .select("id, name")
      .eq("user_id", user.id)
      .single();

    if (businessError || !business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const biz = business as { id: string; name: string };

    // Check if account already exists
    const existingAccount = await getConnectAccountForBusiness(biz.id);
    if (existingAccount) {
      // If account exists but not active, get new onboarding link
      if (!existingAccount.isActive) {
        const status = await getAccountStatus(existingAccount.accountId);
        return NextResponse.json({
          success: true,
          accountId: existingAccount.accountId,
          needsOnboarding: true,
          status,
        });
      }

      // Account exists and is active
      return NextResponse.json({
        success: true,
        accountId: existingAccount.accountId,
        needsOnboarding: false,
        message: "Connect account already configured",
      });
    }

    // Create new Connect account
    const result = await createConnectAccount({
      businessId: biz.id,
      email: user.email!,
      businessName: biz.name,
      businessType: "company",
    });

    return NextResponse.json({
      success: true,
      accountId: result.accountId,
      accountLink: result.accountLink,
      needsOnboarding: true,
    });
  } catch (error) {
    logError("Stripe Connect - Create", error);
    return NextResponse.json(
      { error: "Failed to create Connect account" },
      { status: 500 }
    );
  }
});

/**
 * GET /api/stripe/connect
 * Get Connect account status for the business
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
        connected: false,
        message: "Stripe Connect not configured",
      });
    }

    // Get detailed status
    const status = await getAccountStatus(connectAccount.accountId);

    return NextResponse.json({
      connected: true,
      accountId: connectAccount.accountId,
      isActive: connectAccount.isActive,
      chargesEnabled: status.chargesEnabled,
      payoutsEnabled: status.payoutsEnabled,
      detailsSubmitted: status.detailsSubmitted,
      requirements: status.requirements,
      created: status.created,
    });
  } catch (error) {
    logError("Stripe Connect - Status", error);
    return NextResponse.json(
      { error: "Failed to get Connect status" },
      { status: 500 }
    );
  }
});
