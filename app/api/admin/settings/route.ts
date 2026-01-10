/**
 * Admin Site Settings API
 * GET: Fetch all settings or by category
 * PUT: Update a setting
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin status via app_metadata
    const isAdmin = user.app_metadata?.is_admin === true;
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden - not admin" }, { status: 403 });
    }

    const adminClient = createAdminClient();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    let query = (adminClient.from("site_settings") as any).select("*");

    if (category) {
      query = query.eq("category", category);
    }

    const { data: settings, error } = await query.order("key");

    console.log("Admin settings query result:", { settings, error });

    if (error) {
      console.error("Error fetching settings:", error);
      return NextResponse.json({ error: "Failed to fetch settings: " + error.message }, { status: 500 });
    }

    return NextResponse.json({ settings: settings || [] });
  } catch (error) {
    console.error("Settings API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin status via app_metadata
    const isAdmin = user.app_metadata?.is_admin === true;
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden - not admin" }, { status: 403 });
    }

    const adminClient = createAdminClient();

    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json({ error: "Key and value are required" }, { status: 400 });
    }
    const { data: setting, error } = await (adminClient
      .from("site_settings") as any)
      .update({
        value,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("key", key)
      .select()
      .single();

    if (error) {
      console.error("Error updating setting:", error);
      return NextResponse.json({ error: "Failed to update setting" }, { status: 500 });
    }

    return NextResponse.json({ setting });
  } catch (error) {
    console.error("Settings API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
