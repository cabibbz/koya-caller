/**
 * Admin Customer Detail API
 * GET: Fetch single business with all details
 * PATCH: Update business, AI config, or call settings
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = user.app_metadata?.is_admin === true;
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const adminClient = createAdminClient();
    const businessId = params.id;

    // Fetch business with related data
    const { data: business, error: businessError } = await (adminClient as any)
      .from("businesses")
      .select(`
        *,
        users (email, phone),
        plans (name, price_cents)
      `)
      .eq("id", businessId)
      .single();

    if (businessError) {
      console.error("[Admin Customer API] Business error:", businessError);
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Fetch AI config
    const { data: aiConfig } = await (adminClient as any)
      .from("ai_config")
      .select("*")
      .eq("business_id", businessId)
      .single();

    // Fetch call settings
    const { data: callSettings } = await (adminClient as any)
      .from("call_settings")
      .select("*")
      .eq("business_id", businessId)
      .single();

    // Fetch business hours
    const { data: businessHours } = await (adminClient as any)
      .from("business_hours")
      .select("*")
      .eq("business_id", businessId)
      .order("day_of_week");

    // Fetch services
    const { data: services } = await (adminClient as any)
      .from("services")
      .select("*")
      .eq("business_id", businessId)
      .order("name");

    // Fetch FAQs
    const { data: faqs } = await (adminClient as any)
      .from("faqs")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at");

    // Fetch recent calls
    const { data: recentCalls } = await (adminClient as any)
      .from("calls")
      .select("id, started_at, duration_seconds, outcome, caller_number")
      .eq("business_id", businessId)
      .order("started_at", { ascending: false })
      .limit(10);

    // Fetch phone numbers with location info
    const { data: phoneNumbers } = await (adminClient as any)
      .from("phone_numbers")
      .select("id, number, location_name, location_address, is_active")
      .eq("business_id", businessId)
      .order("created_at");

    return NextResponse.json({
      business: {
        ...business,
        user: business.users,
        plan: business.plans,
        ai_config: aiConfig || {},
        call_settings: callSettings || {},
        business_hours: businessHours || [],
        services: services || [],
        faqs: faqs || [],
        recent_calls: recentCalls || [],
        phone_numbers: phoneNumbers || [],
      },
    });
  } catch (error) {
    console.error("[Admin Customer API] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = user.app_metadata?.is_admin === true;
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const adminClient = createAdminClient();
    const businessId = params.id;
    const body = await request.json();

    // Update business info
    if (body.business) {
      const { error } = await (adminClient as any)
        .from("businesses")
        .update({
          name: body.business.name,
          industry: body.business.industry,
          description: body.business.description,
          phone: body.business.phone,
          address: body.business.address,
          website: body.business.website,
          updated_at: new Date().toISOString(),
        })
        .eq("id", businessId);

      if (error) {
        console.error("[Admin Customer API] Business update error:", error);
        return NextResponse.json({ error: "Failed to update business" }, { status: 500 });
      }
    }

    // Update AI config
    if (body.ai_config) {
      const { error } = await (adminClient as any)
        .from("ai_config")
        .upsert({
          business_id: businessId,
          voice_id: body.ai_config.voice_id,
          personality: body.ai_config.personality,
          custom_greeting: body.ai_config.custom_greeting,
          after_hours_greeting: body.ai_config.after_hours_greeting,
          language_mode: body.ai_config.language_mode,
          spanish_enabled: body.ai_config.spanish_enabled,
          updated_at: new Date().toISOString(),
        }, { onConflict: "business_id" });

      if (error) {
        console.error("[Admin Customer API] AI config update error:", error);
        return NextResponse.json({ error: "Failed to update AI config" }, { status: 500 });
      }
    }

    // Update call settings
    if (body.call_settings) {
      const { error } = await (adminClient as any)
        .from("call_settings")
        .upsert({
          business_id: businessId,
          transfer_number: body.call_settings.transfer_number,
          after_hours_action: body.call_settings.after_hours_action,
          max_call_duration: body.call_settings.max_call_duration,
          emergency_keywords: body.call_settings.emergency_keywords,
          updated_at: new Date().toISOString(),
        }, { onConflict: "business_id" });

      if (error) {
        console.error("[Admin Customer API] Call settings update error:", error);
        return NextResponse.json({ error: "Failed to update call settings" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Admin Customer API] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
