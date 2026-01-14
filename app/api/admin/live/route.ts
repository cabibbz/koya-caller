/**
 * Admin Live Dashboard API Route
 * Real-time stats and activity feed
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.app_metadata?.is_admin !== true) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get today's calls
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: todayCalls } = await (supabase as any)
      .from("calls")
      .select("id, status, created_at, business_id, businesses(name)")
      .gte("created_at", todayStart.toISOString())
      .order("created_at", { ascending: false });

    // Get today's appointments
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: todayAppointments } = await (supabase as any)
      .from("appointments")
      .select("id, created_at, business_id, customer_name, businesses(name)")
      .gte("created_at", todayStart.toISOString())
      .order("created_at", { ascending: false });

    // Get new customers today
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: newCustomers } = await (supabase as any)
      .from("businesses")
      .select("id, name, created_at")
      .gte("created_at", todayStart.toISOString());

    // Calculate active calls (in-progress status)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response filtering
    const activeCalls = (todayCalls || []).filter(
      (c: any) => c.status === "in-progress" || c.status === "ringing"
    ).length;

    // Build activity feed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic event structure
    const events: any[] = [];

    // Add call events
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response iteration
    (todayCalls || []).slice(0, 20).forEach((call: any) => {
      if (call.status === "completed") {
        events.push({
          id: `call-end-${call.id}`,
          type: "call_ended",
          message: "Call completed",
          business_name: call.businesses?.name,
          timestamp: call.created_at,
        });
      } else if (call.status === "in-progress") {
        events.push({
          id: `call-start-${call.id}`,
          type: "call_started",
          message: "Call in progress",
          business_name: call.businesses?.name,
          timestamp: call.created_at,
        });
      } else if (call.status === "failed") {
        events.push({
          id: `call-error-${call.id}`,
          type: "error",
          message: "Call failed",
          business_name: call.businesses?.name,
          timestamp: call.created_at,
        });
      }
    });

    // Add appointment events
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response iteration
    (todayAppointments || []).slice(0, 10).forEach((apt: any) => {
      events.push({
        id: `apt-${apt.id}`,
        type: "appointment_booked",
        message: `Appointment booked for ${apt.customer_name}`,
        business_name: apt.businesses?.name,
        timestamp: apt.created_at,
      });
    });

    // Add customer signup events
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response iteration
    (newCustomers || []).forEach((c: any) => {
      events.push({
        id: `customer-${c.id}`,
        type: "customer_signup",
        message: `New customer: ${c.name}`,
        business_name: c.name,
        timestamp: c.created_at,
      });
    });

    // Sort events by timestamp
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      stats: {
        active_calls: activeCalls,
        calls_today: (todayCalls || []).length,
        appointments_today: (todayAppointments || []).length,
        new_customers_today: (newCustomers || []).length,
        system_health: "healthy",
      },
      events: events.slice(0, 50),
    });
  } catch (error) {
    logError("Admin Live GET", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
