/**
 * Admin Phone Numbers API Route
 * Get all Twilio phone numbers and their assignments
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

    // Get businesses with phone numbers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: businesses, error } = await (supabase as any)
      .from("businesses")
      .select("id, name, phone_number, created_at")
      .not("phone_number", "is", null);

    if (error) {
      logError("Admin Phones GET", error);
      return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }

    // Get call counts per phone
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: callCounts } = await (supabase as any)
      .from("calls")
      .select("business_id, created_at");

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const callStats: Record<string, { total: number; today: number; lastCall: string | null }> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response iteration
    (callCounts || []).forEach((call: any) => {
      if (!callStats[call.business_id]) {
        callStats[call.business_id] = { total: 0, today: 0, lastCall: null };
      }
      callStats[call.business_id].total++;
      if (new Date(call.created_at) >= todayStart) {
        callStats[call.business_id].today++;
      }
      const current = callStats[call.business_id].lastCall;
      if (!current || call.created_at > current) {
        callStats[call.business_id].lastCall = call.created_at;
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response mapping
    const phones = (businesses || []).map((b: any) => ({
      id: b.id,
      phone_number: b.phone_number,
      friendly_name: b.name,
      business_id: b.id,
      business_name: b.name,
      status: "active",
      capabilities: { voice: true, sms: true },
      created_at: b.created_at,
      last_call_at: callStats[b.id]?.lastCall || null,
      total_calls: callStats[b.id]?.total || 0,
    }));

    const assignedCount = phones.length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Stats accumulator
    const totalCallsToday = Object.values(callStats).reduce((sum: number, s: any) => sum + s.today, 0);

    return NextResponse.json({
      phones,
      stats: {
        total_numbers: assignedCount,
        assigned_numbers: assignedCount,
        available_numbers: 0,
        total_calls_today: totalCallsToday,
      },
    });
  } catch (error) {
    logError("Admin Phones GET", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
