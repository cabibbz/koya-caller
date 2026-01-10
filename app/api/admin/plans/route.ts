/**
 * Admin Plans API Route
 * Get all available plans
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.app_metadata?.is_admin !== true) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: plans, error } = await (supabase as any)
      .from("plans")
      .select("id, name, price_cents, included_minutes")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("[Admin Plans API] Error:", error);
      return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }

    return NextResponse.json({ plans: plans || [] });
  } catch (error) {
    console.error("[Admin Plans API] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
