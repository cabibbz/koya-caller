/**
 * Admin Plans API Route
 * Get all available plans
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: plans, error } = await (supabase as any)
      .from("plans")
      .select("id, name, price_cents, included_minutes")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }

    return NextResponse.json({ plans: plans || [] });
  } catch (error) {
    logError("Admin Plans GET", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
