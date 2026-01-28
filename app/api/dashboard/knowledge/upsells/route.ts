/**
 * Upsells Knowledge API Route
 * Manages service upgrade offers for the AI phone receptionist
 *
 * GET /api/dashboard/knowledge/upsells - List all upsells
 * POST /api/dashboard/knowledge/upsells - Create new upsell
 * PUT /api/dashboard/knowledge/upsells - Update upsells (batch)
 * DELETE /api/dashboard/knowledge/upsells?id=xxx - Delete upsell
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
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

export const dynamic = "force-dynamic";

// =============================================================================
// GET Handler - List all upsells for the business
// =============================================================================

async function handleGet(
  _request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    // Fetch upsells
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
        times_accepted
      `)
      .eq("business_id", business.id)
      .order("created_at", { ascending: false });

    if (error) {
      logError("Upsells GET", error);
      return errors.internalError("Failed to fetch upsells");
    }

    // Fetch services to map names
    const serviceIds = new Set<string>();
    (upsells || []).forEach((u: { source_service_id: string; target_service_id: string }) => {
      if (u.source_service_id) serviceIds.add(u.source_service_id);
      if (u.target_service_id) serviceIds.add(u.target_service_id);
    });

    let servicesMap: Record<string, { id: string; name: string }> = {};
    if (serviceIds.size > 0) {
      const { data: services } = await supabase
        .from("services")
        .select("id, name")
        .in("id", Array.from(serviceIds));

      if (services) {
        servicesMap = Object.fromEntries(services.map((s: { id: string; name: string }) => [s.id, s]));
      }
    }

    // Add service names to upsells
    const upsellsWithServices = (upsells || []).map((u: Record<string, unknown>) => ({
      ...u,
      source_service: servicesMap[u.source_service_id as string] || null,
      target_service: servicesMap[u.target_service_id as string] || null,
    }));

    return success({ upsells: upsellsWithServices });
  } catch (error) {
    logError("Upsells GET", error);
    return errors.internalError("Failed to fetch upsells");
  }
}

// =============================================================================
// POST Handler - Create a new upsell
// =============================================================================

async function handlePost(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
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
      return errors.badRequest("Source and target services are required");
    }

    // Validate UUID format for service IDs
    if (!isValidUUID(source_service_id) || !isValidUUID(target_service_id)) {
      return errors.badRequest("Invalid service ID format");
    }

    if (source_service_id === target_service_id) {
      return errors.badRequest("Source and target services must be different");
    }

    // Validate trigger_timing
    const triggerTimingError = validateEnum(trigger_timing, TRIGGER_TIMINGS, "Trigger timing");
    if (triggerTimingError) {
      return errors.badRequest(triggerTimingError);
    }

    // Validate discount_percent (reject invalid values instead of clamping)
    const discountError = validateDiscountPercent(discount_percent);
    if (discountError) {
      return errors.badRequest(discountError);
    }

    // Validate pitch_message length
    const pitchError = validateStringLength(pitch_message, LIMITS.MAX_PITCH_LENGTH, "Pitch message");
    if (pitchError) {
      return errors.badRequest(pitchError);
    }

    // Validate is_active is boolean
    const isActiveError = validateBoolean(is_active, "is_active");
    if (isActiveError) {
      return errors.badRequest(isActiveError);
    }

    // Validate suggest_when_unavailable is boolean
    const suggestError = validateBoolean(suggest_when_unavailable, "suggest_when_unavailable");
    if (suggestError) {
      return errors.badRequest(suggestError);
    }

    // Validate services belong to this business
    const { data: services } = await supabase
      .from("services")
      .select("id")
      .eq("business_id", business.id)
      .in("id", [source_service_id, target_service_id]);

    if (!services || services.length !== 2) {
      return errors.badRequest("One or more services not found or do not belong to your business");
    }

    // Check upsell count limit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: upsellCount } = await (supabase as any)
      .from("upsells")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id);

    if ((upsellCount || 0) >= LIMITS.MAX_UPSELLS_PER_BUSINESS) {
      return errors.badRequest(`Maximum of ${LIMITS.MAX_UPSELLS_PER_BUSINESS} upsells allowed. Delete some before creating new ones.`);
    }

    // Check for existing upsell with same service pair
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingUpsell } = await (supabase as any)
      .from("upsells")
      .select("id")
      .eq("business_id", business.id)
      .eq("source_service_id", source_service_id)
      .eq("target_service_id", target_service_id)
      .maybeSingle();

    if (existingUpsell) {
      return errors.conflict("An upsell for this service combination already exists");
    }

    // Create upsell
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: upsell, error } = await (supabase as any)
      .from("upsells")
      .insert({
        business_id: business.id,
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
      return errors.internalError("Failed to create upsell");
    }

    // Trigger Retell AI sync (non-blocking - don't fail the request if this fails)
    try {
      await inngest.send({
        name: "prompt/regeneration.requested",
        data: {
          businessId: business.id,
          triggeredBy: "upsells_update",
        },
      });
    } catch (inngestError) {
      logError("Upsells POST Inngest", inngestError);
    }

    return success({ success: true, upsell });
  } catch (error) {
    logError("Upsells POST", error);
    return errors.internalError("Failed to create upsell");
  }
}

// =============================================================================
// PUT Handler - Update upsells (batch update)
// =============================================================================

async function handlePut(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    const body = await request.json();
    const { upsell } = body;

    if (!upsell || !upsell.id) {
      return errors.badRequest("Upsell ID required");
    }

    // Validate UUID format
    if (!isValidUUID(upsell.id)) {
      return errors.badRequest("Invalid upsell ID format");
    }

    // Validate service IDs if provided
    if (upsell.source_service_id !== undefined && !isValidUUID(upsell.source_service_id)) {
      return errors.badRequest("Invalid source service ID format");
    }
    if (upsell.target_service_id !== undefined && !isValidUUID(upsell.target_service_id)) {
      return errors.badRequest("Invalid target service ID format");
    }

    // Validate trigger_timing if provided
    if (upsell.trigger_timing !== undefined) {
      const triggerError = validateEnum(upsell.trigger_timing, TRIGGER_TIMINGS, "Trigger timing");
      if (triggerError) {
        return errors.badRequest(triggerError);
      }
    }

    // Validate discount_percent if provided (reject invalid values instead of clamping)
    if (upsell.discount_percent !== undefined) {
      const discountError = validateDiscountPercent(upsell.discount_percent);
      if (discountError) {
        return errors.badRequest(discountError);
      }
    }

    // Validate pitch_message length if provided
    if (upsell.pitch_message !== undefined) {
      const pitchError = validateStringLength(upsell.pitch_message, LIMITS.MAX_PITCH_LENGTH, "Pitch message");
      if (pitchError) {
        return errors.badRequest(pitchError);
      }
    }

    // Validate boolean fields
    const isActiveError = validateBoolean(upsell.is_active, "is_active");
    if (isActiveError) {
      return errors.badRequest(isActiveError);
    }
    const suggestError = validateBoolean(upsell.suggest_when_unavailable, "suggest_when_unavailable");
    if (suggestError) {
      return errors.badRequest(suggestError);
    }

    // Fetch the existing upsell to get current values
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingUpsell, error: fetchError } = await (supabase as any)
      .from("upsells")
      .select("source_service_id, target_service_id")
      .eq("id", upsell.id)
      .eq("business_id", business.id)
      .single();

    if (fetchError || !existingUpsell) {
      return errors.notFound("Upsell");
    }

    // Determine final values after update
    const finalSourceId = upsell.source_service_id || existingUpsell.source_service_id;
    const finalTargetId = upsell.target_service_id || existingUpsell.target_service_id;

    // Validate both final service IDs belong to this business
    const { data: services } = await supabase
      .from("services")
      .select("id")
      .eq("business_id", business.id)
      .in("id", [finalSourceId, finalTargetId]);

    if (!services || services.length !== 2) {
      return errors.badRequest("One or more services not found or do not belong to your business");
    }

    // Ensure source and target are different
    if (finalSourceId === finalTargetId) {
      return errors.badRequest("Source and target services must be different");
    }

    // Check for duplicate (excluding current upsell)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: duplicateUpsell } = await (supabase as any)
      .from("upsells")
      .select("id")
      .eq("business_id", business.id)
      .eq("source_service_id", finalSourceId)
      .eq("target_service_id", finalTargetId)
      .neq("id", upsell.id)
      .maybeSingle();

    if (duplicateUpsell) {
      return errors.conflict("An upsell for this service combination already exists");
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
      .eq("business_id", business.id);

    if (error) {
      logError("Upsells PUT", error);
      return errors.internalError("Failed to update upsell");
    }

    // Trigger Retell AI sync (non-blocking)
    try {
      await inngest.send({
        name: "prompt/regeneration.requested",
        data: {
          businessId: business.id,
          triggeredBy: "upsells_update",
        },
      });
    } catch (inngestError) {
      logError("Upsells PUT Inngest", inngestError);
    }

    return success({ success: true });
  } catch (error) {
    logError("Upsells PUT", error);
    return errors.internalError("Failed to update upsell");
  }
}

// =============================================================================
// DELETE Handler - Delete an upsell
// =============================================================================

async function handleDelete(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    // Get upsell ID from query params
    const { searchParams } = new URL(request.url);
    const upsellId = searchParams.get("id");

    if (!upsellId) {
      return errors.badRequest("Upsell ID required");
    }

    // Validate UUID format
    if (!isValidUUID(upsellId)) {
      return errors.badRequest("Invalid upsell ID format");
    }

    // Delete the upsell and return deleted rows
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: deletedRows, error } = await (supabase as any)
      .from("upsells")
      .delete()
      .eq("id", upsellId)
      .eq("business_id", business.id)
      .select();

    if (error) {
      logError("Upsells DELETE", error);
      return errors.internalError("Failed to delete upsell");
    }

    if (!deletedRows || deletedRows.length === 0) {
      return errors.notFound("Upsell");
    }

    // Trigger Retell AI sync (non-blocking)
    try {
      await inngest.send({
        name: "prompt/regeneration.requested",
        data: {
          businessId: business.id,
          triggeredBy: "upsells_update",
        },
      });
    } catch (inngestError) {
      logError("Upsells DELETE Inngest", inngestError);
    }

    return success({ success: true });
  } catch (error) {
    logError("Upsells DELETE", error);
    return errors.internalError("Failed to delete upsell");
  }
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
export const PUT = withAuth(handlePut);
export const DELETE = withAuth(handleDelete);
