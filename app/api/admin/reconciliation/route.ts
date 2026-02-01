/**
 * Admin Usage Reconciliation API Route
 *
 * Provides endpoints for:
 * - Viewing usage discrepancies between recorded and actual usage
 * - Running reconciliation to fix discrepancies
 * - Viewing reconciliation history
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError, logInfo } from "@/lib/logging";

export const dynamic = "force-dynamic";

interface DiscrepancyRow {
  id: string;
  name: string;
  subscription_status: string | null;
  minutes_used_this_cycle: number;
  current_cycle_start: string;
  actual_minutes: number;
  difference: number;
}

/**
 * GET /api/admin/reconciliation
 *
 * Query params:
 * - view: "discrepancies" | "history" (default: discrepancies)
 * - businessId: Optional filter for specific business
 * - limit: Number of results (default: 50)
 * - offset: Pagination offset (default: 0)
 */
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

    const isAdmin = user.app_metadata?.is_admin === true;
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const view = searchParams.get("view") || "discrepancies";
    const businessId = searchParams.get("businessId");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminSupabase = supabase as any;

    if (view === "history") {
      // Return reconciliation audit log entries
      let query = adminSupabase
        .from("usage_audit_log")
        .select("*", { count: "exact" })
        .eq("event_type", "reconciliation")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (businessId) {
        query = query.eq("business_id", businessId);
      }

      const { data, count, error } = await query;

      if (error) {
        logError("Admin Reconciliation GET history", error);
        return NextResponse.json(
          { error: "Failed to fetch reconciliation history" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        history: data || [],
        total: count || 0,
        limit,
        offset,
      });
    }

    // Default: show discrepancies
    // Query to find businesses where recorded usage doesn't match actual calls
    const { data: discrepancies, error: discError } = await adminSupabase.rpc(
      "find_usage_discrepancies",
      { p_business_id: businessId || null }
    );

    if (discError) {
      // If the function doesn't exist yet, fall back to manual query
      if (discError.code === "42883") {
        // Function does not exist - use direct query
        const { data: businesses, error: bizError } = await adminSupabase
          .from("businesses")
          .select(`
            id,
            name,
            subscription_status,
            minutes_used_this_cycle,
            current_cycle_start
          `)
          .not("subscription_status", "eq", "trialing");

        if (bizError) {
          logError("Admin Reconciliation GET businesses", bizError);
          return NextResponse.json(
            { error: "Failed to fetch businesses" },
            { status: 500 }
          );
        }

        // For each business, calculate actual usage
        const discrepancyList: DiscrepancyRow[] = [];

        for (const biz of businesses || []) {
          const { data: callSum } = await adminSupabase
            .from("calls")
            .select("duration_minutes_billed")
            .eq("business_id", biz.id)
            .gte("started_at", biz.current_cycle_start || "1970-01-01");

          const actualMinutes = (callSum || []).reduce(
            (sum: number, c: { duration_minutes_billed: number | null }) =>
              sum + (c.duration_minutes_billed || 0),
            0
          );

          const recorded = biz.minutes_used_this_cycle || 0;
          const difference = recorded - actualMinutes;

          if (difference !== 0) {
            discrepancyList.push({
              id: biz.id,
              name: biz.name,
              subscription_status: biz.subscription_status,
              minutes_used_this_cycle: recorded,
              current_cycle_start: biz.current_cycle_start,
              actual_minutes: actualMinutes,
              difference,
            });
          }
        }

        return NextResponse.json({
          discrepancies: discrepancyList,
          total: discrepancyList.length,
        });
      }

      logError("Admin Reconciliation GET discrepancies", discError);
      return NextResponse.json(
        { error: "Failed to fetch discrepancies" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      discrepancies: discrepancies || [],
      total: (discrepancies || []).length,
    });
  } catch (error) {
    logError("Admin Reconciliation GET", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/reconciliation
 *
 * Body:
 * - businessId: UUID of business to reconcile (optional, reconciles all if not provided)
 * - dryRun: If true, only shows what would be fixed without applying (default: false)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify auth and admin status
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = user.app_metadata?.is_admin === true;
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { businessId, dryRun = false } = body;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminSupabase = supabase as any;

    if (businessId) {
      // Reconcile specific business
      if (dryRun) {
        // Just show what would happen
        const { data: biz } = await adminSupabase
          .from("businesses")
          .select("id, name, minutes_used_this_cycle, current_cycle_start")
          .eq("id", businessId)
          .single();

        if (!biz) {
          return NextResponse.json({ error: "Business not found" }, { status: 404 });
        }

        const { data: callSum } = await adminSupabase
          .from("calls")
          .select("duration_minutes_billed")
          .eq("business_id", businessId)
          .gte("started_at", biz.current_cycle_start || "1970-01-01");

        const actualMinutes = (callSum || []).reduce(
          (sum: number, c: { duration_minutes_billed: number | null }) =>
            sum + (c.duration_minutes_billed || 0),
          0
        );

        const recorded = biz.minutes_used_this_cycle || 0;
        const difference = recorded - actualMinutes;

        return NextResponse.json({
          dryRun: true,
          result: {
            businessId: biz.id,
            businessName: biz.name,
            recordedMinutes: recorded,
            actualMinutes,
            difference,
            wouldFix: difference !== 0,
          },
        });
      }

      // Actually reconcile
      const { data: result, error } = await adminSupabase.rpc(
        "reconcile_business_usage",
        {
          p_business_id: businessId,
          p_admin_id: user.id,
        }
      );

      if (error) {
        // Function may not exist yet, do manual reconciliation
        if (error.code === "42883") {
          const { data: biz } = await adminSupabase
            .from("businesses")
            .select("id, name, minutes_used_this_cycle, current_cycle_start")
            .eq("id", businessId)
            .single();

          if (!biz) {
            return NextResponse.json({ error: "Business not found" }, { status: 404 });
          }

          const { data: callSum } = await adminSupabase
            .from("calls")
            .select("duration_minutes_billed")
            .eq("business_id", businessId)
            .gte("started_at", biz.current_cycle_start || "1970-01-01");

          const actualMinutes = (callSum || []).reduce(
            (sum: number, c: { duration_minutes_billed: number | null }) =>
              sum + (c.duration_minutes_billed || 0),
            0
          );

          const recorded = biz.minutes_used_this_cycle || 0;
          const difference = recorded - actualMinutes;

          if (difference !== 0) {
            // Update business
            await adminSupabase
              .from("businesses")
              .update({ minutes_used_this_cycle: actualMinutes })
              .eq("id", businessId);

            // Try to log to audit table (may not exist yet)
            try {
              await adminSupabase.from("usage_audit_log").insert({
                business_id: businessId,
                event_type: "reconciliation",
                minutes_before: recorded,
                minutes_after: actualMinutes,
                minutes_delta: difference,
                source: "admin",
                source_reference: "manual_reconciliation",
                notes: `Admin reconciliation by ${user.email}`,
                created_by: user.id,
              });
            } catch {
              // Audit table may not exist yet
            }

            logInfo("Admin Reconciliation", `Reconciled ${biz.name}: ${recorded} -> ${actualMinutes} (diff: ${difference})`);
          }

          return NextResponse.json({
            success: true,
            result: {
              businessId: biz.id,
              businessName: biz.name,
              recordedMinutes: recorded,
              actualMinutes,
              difference,
              fixed: difference !== 0,
            },
          });
        }

        logError("Admin Reconciliation POST", error);
        return NextResponse.json(
          { error: "Failed to reconcile" },
          { status: 500 }
        );
      }

      logInfo("Admin Reconciliation", `Reconciled business ${businessId}`);

      return NextResponse.json({
        success: true,
        result: result?.[0] || null,
      });
    }

    // Reconcile all businesses with discrepancies
    const { data: businesses } = await adminSupabase
      .from("businesses")
      .select("id, name, minutes_used_this_cycle, current_cycle_start")
      .not("subscription_status", "eq", "trialing");

    const results: Array<{
      businessId: string;
      businessName: string;
      recordedMinutes: number;
      actualMinutes: number;
      difference: number;
      fixed: boolean;
    }> = [];

    for (const biz of businesses || []) {
      const { data: callSum } = await adminSupabase
        .from("calls")
        .select("duration_minutes_billed")
        .eq("business_id", biz.id)
        .gte("started_at", biz.current_cycle_start || "1970-01-01");

      const actualMinutes = (callSum || []).reduce(
        (sum: number, c: { duration_minutes_billed: number | null }) =>
          sum + (c.duration_minutes_billed || 0),
        0
      );

      const recorded = biz.minutes_used_this_cycle || 0;
      const difference = recorded - actualMinutes;

      if (difference !== 0) {
        if (!dryRun) {
          await adminSupabase
            .from("businesses")
            .update({ minutes_used_this_cycle: actualMinutes })
            .eq("id", biz.id);

          try {
            await adminSupabase.from("usage_audit_log").insert({
              business_id: biz.id,
              event_type: "reconciliation",
              minutes_before: recorded,
              minutes_after: actualMinutes,
              minutes_delta: difference,
              source: "admin",
              source_reference: "bulk_reconciliation",
              notes: `Bulk reconciliation by ${user.email}`,
              created_by: user.id,
            });
          } catch {
            // Audit table may not exist yet
          }
        }

        results.push({
          businessId: biz.id,
          businessName: biz.name,
          recordedMinutes: recorded,
          actualMinutes,
          difference,
          fixed: !dryRun,
        });
      }
    }

    if (!dryRun && results.length > 0) {
      logInfo("Admin Reconciliation", `Bulk reconciled ${results.length} businesses`);
    }

    return NextResponse.json({
      dryRun,
      success: true,
      totalFixed: dryRun ? 0 : results.length,
      totalDiscrepancies: results.length,
      results,
    });
  } catch (error) {
    logError("Admin Reconciliation POST", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
