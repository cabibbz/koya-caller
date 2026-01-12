/**
 * Admin Financials API Route
 * Part 8: Admin Dashboard - Financials
 *
 * Returns MRR, ARPU, customer counts, and growth metrics
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify auth and admin status
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin status from app_metadata
    const isAdmin = user.app_metadata?.is_admin === true;
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch all businesses with their plans
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: businesses, error } = await (supabase as any)
      .from("businesses")
      .select(`
        id,
        subscription_status,
        created_at,
        updated_at,
        plan_id,
        plans (
          price_cents
        )
      `);

    if (error) {
      logError("Admin Financials GET", error);
      return NextResponse.json(
        { error: "Failed to fetch financial data" },
        { status: 500 }
      );
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Calculate metrics
    let totalMrrCents = 0;
    let activeCustomers = 0;
    let churnedCustomers = 0;
    let newCustomers30d = 0;
    let churnedCustomers30d = 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response iteration
    (businesses || []).forEach((b: any) => {
      const createdAt = new Date(b.created_at);
      const updatedAt = new Date(b.updated_at);

      if (b.subscription_status === "active") {
        activeCustomers++;
        totalMrrCents += b.plans?.price_cents || 0;
      }

      if (b.subscription_status === "cancelled") {
        churnedCustomers++;
        if (updatedAt >= thirtyDaysAgo) {
          churnedCustomers30d++;
        }
      }

      if (createdAt >= thirtyDaysAgo && b.subscription_status !== "onboarding") {
        newCustomers30d++;
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response filter
    const totalCustomers = (businesses || []).filter(
      (b: any) => b.subscription_status !== "onboarding"
    ).length;

    const arpuCents =
      activeCustomers > 0 ? Math.round(totalMrrCents / activeCustomers) : 0;

    const summary = {
      total_mrr_cents: totalMrrCents,
      total_customers: totalCustomers,
      active_customers: activeCustomers,
      churned_customers: churnedCustomers,
      arpu_cents: arpuCents,
      new_customers_30d: newCustomers30d,
      churned_customers_30d: churnedCustomers30d,
    };

    return NextResponse.json({ summary });
  } catch (error) {
    logError("Admin Financials GET", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
