/**
 * Upsells Knowledge API Route
 * Manages service upgrade offers for the AI phone receptionist
 *
 * GET /api/dashboard/knowledge/upsells - List all upsells
 * POST /api/dashboard/knowledge/upsells - Create new upsell
 * PUT /api/dashboard/knowledge/upsells - Update upsells (batch)
 * DELETE /api/dashboard/knowledge/upsells?id=xxx - Delete upsell
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { inngest } from "@/lib/inngest/client";

interface Upsell {
  id: string;
  source_service_id: string;
  target_service_id: string;
  discount_percent: number;
  pitch_message: string | null;
  trigger_timing: "before_booking" | "after_booking";
  is_active: boolean;
  suggest_when_unavailable: boolean;
  times_offered?: number;
  times_accepted?: number;
}

interface UpsellWithServices extends Upsell {
  source_service?: { id: string; name: string };
  target_service?: { id: string; name: string };
}

// GET - List all upsells for the business
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request.headers);
    const rateLimitResult = await checkRateLimit("dashboard", ip);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const businessId = (business as { id: string }).id;

    // Fetch upsells with service names
    const { data: upsells, error } = await (supabase as any)
      .from("upsells")
      .select(`
        id,
        source_service_id,
        target_service_id,
        discount_percent,
        pitch_message,
        trigger_timing,
        is_active,
        suggest_when_unavailable,
        times_offered,
        times_accepted,
        source_service:services!upsells_source_service_id_fkey(id, name),
        target_service:services!upsells_target_service_id_fkey(id, name)
      `)
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Upsells GET] Error:", error);
      return NextResponse.json({ error: "Failed to fetch upsells" }, { status: 500 });
    }

    return NextResponse.json({ upsells: upsells || [] });
  } catch (error) {
    console.error("[Upsells GET] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Create a new upsell
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request.headers);
    const rateLimitResult = await checkRateLimit("dashboard", ip);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const businessId = (business as { id: string }).id;
    const body = await request.json();

    const {
      source_service_id,
      target_service_id,
      discount_percent = 0,
      pitch_message,
      trigger_timing = "before_booking",
      is_active = true,
      suggest_when_unavailable = false,
    } = body;

    // Validate required fields
    if (!source_service_id || !target_service_id) {
      return NextResponse.json(
        { error: "Source and target services are required" },
        { status: 400 }
      );
    }

    if (source_service_id === target_service_id) {
      return NextResponse.json(
        { error: "Source and target services must be different" },
        { status: 400 }
      );
    }

    // Validate services belong to this business
    const { data: services } = await supabase
      .from("services")
      .select("id")
      .eq("business_id", businessId)
      .in("id", [source_service_id, target_service_id]);

    if (!services || services.length !== 2) {
      return NextResponse.json(
        { error: "Invalid service selection" },
        { status: 400 }
      );
    }

    // Check upsell count limit (max 20 per business)
    const { count: upsellCount } = await (supabase as any)
      .from("upsells")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId);

    if ((upsellCount || 0) >= 20) {
      return NextResponse.json(
        { error: "Maximum of 20 upsells allowed. Delete some before creating new ones." },
        { status: 400 }
      );
    }

    // Check for existing upsell with same service pair
    const { data: existingUpsell } = await (supabase as any)
      .from("upsells")
      .select("id")
      .eq("business_id", businessId)
      .eq("source_service_id", source_service_id)
      .eq("target_service_id", target_service_id)
      .maybeSingle();

    if (existingUpsell) {
      return NextResponse.json(
        { error: "An upsell for this service combination already exists" },
        { status: 409 }
      );
    }

    // Create upsell
    const { data: upsell, error } = await (supabase as any)
      .from("upsells")
      .insert({
        business_id: businessId,
        source_service_id,
        target_service_id,
        discount_percent: Math.min(100, Math.max(0, discount_percent)),
        pitch_message: pitch_message?.trim() || null,
        trigger_timing,
        is_active,
        suggest_when_unavailable,
      })
      .select()
      .single();

    if (error) {
      console.error("[Upsells POST] Error:", error);
      return NextResponse.json({ error: "Failed to create upsell" }, { status: 500 });
    }

    // Trigger Retell AI sync (non-blocking - don't fail the request if this fails)
    try {
      await inngest.send({
        name: "prompt/regeneration.requested",
        data: {
          businessId,
          triggeredBy: "upsells_update",
        },
      });
    } catch (inngestError) {
      console.error("[Upsells POST] Inngest error (non-fatal):", inngestError);
    }

    return NextResponse.json({ success: true, upsell });
  } catch (error) {
    console.error("[Upsells POST] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT - Update upsells (batch update)
export async function PUT(request: NextRequest) {
  try {
    const ip = getClientIP(request.headers);
    const rateLimitResult = await checkRateLimit("dashboard", ip);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const businessId = (business as { id: string }).id;
    const body = await request.json();
    const { upsell } = body;

    if (!upsell || !upsell.id) {
      return NextResponse.json({ error: "Upsell ID required" }, { status: 400 });
    }

    // Validate UUID format
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(upsell.id)) {
      return NextResponse.json({ error: "Invalid upsell ID format" }, { status: 400 });
    }

    // Fetch the existing upsell to get current values
    const { data: existingUpsell, error: fetchError } = await (supabase as any)
      .from("upsells")
      .select("source_service_id, target_service_id")
      .eq("id", upsell.id)
      .eq("business_id", businessId)
      .single();

    if (fetchError || !existingUpsell) {
      return NextResponse.json({ error: "Upsell not found" }, { status: 404 });
    }

    // Determine final values after update
    const finalSourceId = upsell.source_service_id || existingUpsell.source_service_id;
    const finalTargetId = upsell.target_service_id || existingUpsell.target_service_id;

    // Validate both final service IDs belong to this business
    const { data: services } = await supabase
      .from("services")
      .select("id")
      .eq("business_id", businessId)
      .in("id", [finalSourceId, finalTargetId]);

    if (!services || services.length !== 2) {
      return NextResponse.json(
        { error: "Invalid service selection" },
        { status: 400 }
      );
    }

    // Ensure source and target are different
    if (finalSourceId === finalTargetId) {
      return NextResponse.json(
        { error: "Source and target services must be different" },
        { status: 400 }
      );
    }

    // Check for duplicate (excluding current upsell)
    const { data: duplicateUpsell } = await (supabase as any)
      .from("upsells")
      .select("id")
      .eq("business_id", businessId)
      .eq("source_service_id", finalSourceId)
      .eq("target_service_id", finalTargetId)
      .neq("id", upsell.id)
      .maybeSingle();

    if (duplicateUpsell) {
      return NextResponse.json(
        { error: "An upsell for this service combination already exists" },
        { status: 409 }
      );
    }

    // Validate trigger_timing
    const validTimings = ["before_booking", "after_booking"];
    const triggerTiming = validTimings.includes(upsell.trigger_timing)
      ? upsell.trigger_timing
      : "before_booking";

    // Update the upsell
    const { error } = await (supabase as any)
      .from("upsells")
      .update({
        source_service_id: upsell.source_service_id,
        target_service_id: upsell.target_service_id,
        discount_percent: Math.min(100, Math.max(0, upsell.discount_percent || 0)),
        pitch_message: upsell.pitch_message?.trim() || null,
        trigger_timing: triggerTiming,
        is_active: upsell.is_active ?? true,
        suggest_when_unavailable: upsell.suggest_when_unavailable ?? false,
      })
      .eq("id", upsell.id)
      .eq("business_id", businessId);

    if (error) {
      console.error("[Upsells PUT] Error:", error);
      return NextResponse.json({ error: "Failed to update upsell" }, { status: 500 });
    }

    // Trigger Retell AI sync (non-blocking)
    try {
      await inngest.send({
        name: "prompt/regeneration.requested",
        data: {
          businessId,
          triggeredBy: "upsells_update",
        },
      });
    } catch (inngestError) {
      console.error("[Upsells PUT] Inngest error (non-fatal):", inngestError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Upsells PUT] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Delete an upsell
export async function DELETE(request: NextRequest) {
  try {
    const ip = getClientIP(request.headers);
    const rateLimitResult = await checkRateLimit("dashboard", ip);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const businessId = (business as { id: string }).id;

    // Get upsell ID from query params
    const { searchParams } = new URL(request.url);
    const upsellId = searchParams.get("id");

    if (!upsellId) {
      return NextResponse.json({ error: "Upsell ID required" }, { status: 400 });
    }

    // Validate UUID format
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(upsellId)) {
      return NextResponse.json({ error: "Invalid upsell ID format" }, { status: 400 });
    }

    // Delete the upsell and return deleted rows
    const { data: deletedRows, error } = await (supabase as any)
      .from("upsells")
      .delete()
      .eq("id", upsellId)
      .eq("business_id", businessId)
      .select();

    if (error) {
      console.error("[Upsells DELETE] Error:", error);
      return NextResponse.json({ error: "Failed to delete upsell" }, { status: 500 });
    }

    if (!deletedRows || deletedRows.length === 0) {
      return NextResponse.json({ error: "Upsell not found" }, { status: 404 });
    }

    // Trigger Retell AI sync (non-blocking)
    try {
      await inngest.send({
        name: "prompt/regeneration.requested",
        data: {
          businessId,
          triggeredBy: "upsells_update",
        },
      });
    } catch (inngestError) {
      console.error("[Upsells DELETE] Inngest error (non-fatal):", inngestError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Upsells DELETE] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
