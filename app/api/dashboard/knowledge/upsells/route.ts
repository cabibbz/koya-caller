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
import { logError } from "@/lib/logging";
import {
  isValidUUID,
  validateStringLength,
  validateDiscountPercent,
  validateBoolean,
  validateEnum,
  TRIGGER_TIMINGS,
  LIMITS,
} from "@/lib/validation";

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
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
      logError("Upsells GET", error);
      return NextResponse.json({ error: "Failed to fetch upsells" }, { status: 500 });
    }

    return NextResponse.json({ upsells: upsells || [] });
  } catch (error) {
    logError("Upsells GET", error);
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

    // Validate UUID format for service IDs
    if (!isValidUUID(source_service_id) || !isValidUUID(target_service_id)) {
      return NextResponse.json(
        { error: "Invalid service ID format" },
        { status: 400 }
      );
    }

    if (source_service_id === target_service_id) {
      return NextResponse.json(
        { error: "Source and target services must be different" },
        { status: 400 }
      );
    }

    // Validate trigger_timing
    const triggerTimingError = validateEnum(trigger_timing, TRIGGER_TIMINGS, "Trigger timing");
    if (triggerTimingError) {
      return NextResponse.json({ error: triggerTimingError }, { status: 400 });
    }

    // Validate discount_percent (reject invalid values instead of clamping)
    const discountError = validateDiscountPercent(discount_percent);
    if (discountError) {
      return NextResponse.json({ error: discountError }, { status: 400 });
    }

    // Validate pitch_message length
    const pitchError = validateStringLength(pitch_message, LIMITS.MAX_PITCH_LENGTH, "Pitch message");
    if (pitchError) {
      return NextResponse.json({ error: pitchError }, { status: 400 });
    }

    // Validate is_active is boolean
    const isActiveError = validateBoolean(is_active, "is_active");
    if (isActiveError) {
      return NextResponse.json({ error: isActiveError }, { status: 400 });
    }

    // Validate suggest_when_unavailable is boolean
    const suggestError = validateBoolean(suggest_when_unavailable, "suggest_when_unavailable");
    if (suggestError) {
      return NextResponse.json({ error: suggestError }, { status: 400 });
    }

    // Validate services belong to this business
    const { data: services } = await supabase
      .from("services")
      .select("id")
      .eq("business_id", businessId)
      .in("id", [source_service_id, target_service_id]);

    if (!services || services.length !== 2) {
      return NextResponse.json(
        { error: "One or more services not found or do not belong to your business" },
        { status: 400 }
      );
    }

    // Check upsell count limit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: upsellCount } = await (supabase as any)
      .from("upsells")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId);

    if ((upsellCount || 0) >= LIMITS.MAX_UPSELLS_PER_BUSINESS) {
      return NextResponse.json(
        { error: `Maximum of ${LIMITS.MAX_UPSELLS_PER_BUSINESS} upsells allowed. Delete some before creating new ones.` },
        { status: 400 }
      );
    }

    // Check for existing upsell with same service pair
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: upsell, error } = await (supabase as any)
      .from("upsells")
      .insert({
        business_id: businessId,
        source_service_id,
        target_service_id,
        discount_percent: discount_percent || 0,
        pitch_message: pitch_message?.trim() || null,
        trigger_timing,
        is_active: is_active ?? true,
        suggest_when_unavailable: suggest_when_unavailable ?? false,
      })
      .select()
      .single();

    if (error) {
      logError("Upsells POST", error);
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
      logError("Upsells POST Inngest", inngestError);
    }

    return NextResponse.json({ success: true, upsell });
  } catch (error) {
    logError("Upsells POST", error);
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
    if (!isValidUUID(upsell.id)) {
      return NextResponse.json({ error: "Invalid upsell ID format" }, { status: 400 });
    }

    // Validate service IDs if provided
    if (upsell.source_service_id !== undefined && !isValidUUID(upsell.source_service_id)) {
      return NextResponse.json({ error: "Invalid source service ID format" }, { status: 400 });
    }
    if (upsell.target_service_id !== undefined && !isValidUUID(upsell.target_service_id)) {
      return NextResponse.json({ error: "Invalid target service ID format" }, { status: 400 });
    }

    // Validate trigger_timing if provided
    if (upsell.trigger_timing !== undefined) {
      const triggerError = validateEnum(upsell.trigger_timing, TRIGGER_TIMINGS, "Trigger timing");
      if (triggerError) {
        return NextResponse.json({ error: triggerError }, { status: 400 });
      }
    }

    // Validate discount_percent if provided (reject invalid values instead of clamping)
    if (upsell.discount_percent !== undefined) {
      const discountError = validateDiscountPercent(upsell.discount_percent);
      if (discountError) {
        return NextResponse.json({ error: discountError }, { status: 400 });
      }
    }

    // Validate pitch_message length if provided
    if (upsell.pitch_message !== undefined) {
      const pitchError = validateStringLength(upsell.pitch_message, LIMITS.MAX_PITCH_LENGTH, "Pitch message");
      if (pitchError) {
        return NextResponse.json({ error: pitchError }, { status: 400 });
      }
    }

    // Validate boolean fields
    const isActiveError = validateBoolean(upsell.is_active, "is_active");
    if (isActiveError) {
      return NextResponse.json({ error: isActiveError }, { status: 400 });
    }
    const suggestError = validateBoolean(upsell.suggest_when_unavailable, "suggest_when_unavailable");
    if (suggestError) {
      return NextResponse.json({ error: suggestError }, { status: 400 });
    }

    // Fetch the existing upsell to get current values
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        { error: "One or more services not found or do not belong to your business" },
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (upsell.source_service_id !== undefined) updateData.source_service_id = upsell.source_service_id;
    if (upsell.target_service_id !== undefined) updateData.target_service_id = upsell.target_service_id;
    if (upsell.discount_percent !== undefined) updateData.discount_percent = upsell.discount_percent;
    if (upsell.pitch_message !== undefined) updateData.pitch_message = upsell.pitch_message?.trim() || null;
    if (upsell.trigger_timing !== undefined) updateData.trigger_timing = upsell.trigger_timing;
    if (upsell.is_active !== undefined) updateData.is_active = upsell.is_active;
    if (upsell.suggest_when_unavailable !== undefined) updateData.suggest_when_unavailable = upsell.suggest_when_unavailable;

    // Update the upsell
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("upsells")
      .update(updateData)
      .eq("id", upsell.id)
      .eq("business_id", businessId);

    if (error) {
      logError("Upsells PUT", error);
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
      logError("Upsells PUT Inngest", inngestError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError("Upsells PUT", error);
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
    if (!isValidUUID(upsellId)) {
      return NextResponse.json({ error: "Invalid upsell ID format" }, { status: 400 });
    }

    // Delete the upsell and return deleted rows
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: deletedRows, error } = await (supabase as any)
      .from("upsells")
      .delete()
      .eq("id", upsellId)
      .eq("business_id", businessId)
      .select();

    if (error) {
      logError("Upsells DELETE", error);
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
      logError("Upsells DELETE Inngest", inngestError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError("Upsells DELETE", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
