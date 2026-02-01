/**
 * Admin Customers API Route
 * Part 8: Admin Dashboard - Customers
 *
 * Returns all businesses with metrics for admin dashboard
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logging";
import { success, errors } from "@/lib/api/responses";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify auth and admin status
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errors.unauthorized();
    }

    // Check admin status from app_metadata
    const isAdmin = user.app_metadata?.is_admin === true;
    if (!isAdmin) {
      return errors.forbidden();
    }

    // Fetch all businesses with their metrics
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: businesses, error } = await (supabase as any)
      .from("businesses")
      .select(`
        id,
        name,
        subscription_status,
        created_at,
        updated_at,
        minutes_used_this_cycle,
        minutes_included,
        plan_id,
        user_id,
        plans (
          name,
          price_cents
        ),
        users (
          email,
          phone
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      logError("Admin Customers GET - businesses fetch", error);
      return errors.internalError("Failed to fetch businesses");
    }

    // Fetch call and appointment counts for each business
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const businessIds = (businesses || []).map((b: any) => b.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: callCounts } = await (supabase as any)
      .from("calls")
      .select("business_id, status, duration_seconds")
      .in("business_id", businessIds);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: appointmentCounts } = await (supabase as any)
      .from("appointments")
      .select("business_id")
      .in("business_id", businessIds);

    // Aggregate metrics
    const callsByBusiness: Record<string, { total: number; completed: number; failed: number; seconds: number }> = {};
    const appointmentsByBusiness: Record<string, number> = {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (callCounts || []).forEach((call: any) => {
      if (!callsByBusiness[call.business_id]) {
        callsByBusiness[call.business_id] = { total: 0, completed: 0, failed: 0, seconds: 0 };
      }
      callsByBusiness[call.business_id].total++;
      if (call.status === "completed") {
        callsByBusiness[call.business_id].completed++;
      }
      if (call.status === "failed") {
        callsByBusiness[call.business_id].failed++;
      }
      callsByBusiness[call.business_id].seconds += call.duration_seconds || 0;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (appointmentCounts || []).forEach((apt: any) => {
      appointmentsByBusiness[apt.business_id] = (appointmentsByBusiness[apt.business_id] || 0) + 1;
    });

    // Format response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedBusinesses = (businesses || []).map((b: any) => ({
      business_id: b.id,
      business_name: b.name,
      subscription_status: b.subscription_status,
      created_at: b.created_at,
      updated_at: b.updated_at,
      plan_name: b.plans?.name || null,
      plan_price: b.plans?.price_cents || null,
      minutes_used_this_cycle: b.minutes_used_this_cycle || 0,
      minutes_included: b.minutes_included || 0,
      usage_percent:
        b.minutes_included > 0
          ? Math.round((b.minutes_used_this_cycle / b.minutes_included) * 100 * 10) / 10
          : 0,
      total_calls: callsByBusiness[b.id]?.total || 0,
      completed_calls: callsByBusiness[b.id]?.completed || 0,
      failed_calls: callsByBusiness[b.id]?.failed || 0,
      total_appointments: appointmentsByBusiness[b.id] || 0,
      total_call_seconds: callsByBusiness[b.id]?.seconds || 0,
      owner_email: b.users?.email || null,
      owner_phone: b.users?.phone || null,
    }));

    return success({ businesses: formattedBusinesses });
  } catch (error) {
    logError("Admin Customers GET", error);
    return errors.internalError();
  }
}
