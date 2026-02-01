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
  validateBoolean,
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
    // Fetch upsells - using actual database schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: upsells, error } = await (supabase as any)
      .from("upsells")
      .select(`
        id,
        name,
        description,
        trigger_keywords,
        trigger_services,
        price_cents,
        is_active,
        created_at,
        updated_at
      `)
      .eq("business_id", business.id)
      .order("created_at", { ascending: false });

    if (error) {
      logError("Upsells GET", error);
      return errors.internalError("Failed to fetch upsells");
    }

    return success({ upsells: upsells || [] });
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
      name,
      description,
      trigger_keywords = [],
      trigger_services = [],
      price_cents = 0,
      is_active = true,
    } = body;

    // Validate required fields
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return errors.badRequest("Name is required");
    }

    // Validate name length
    const nameError = validateStringLength(name, 100, "Name");
    if (nameError) {
      return errors.badRequest(nameError);
    }

    // Validate description length if provided
    if (description) {
      const descError = validateStringLength(description, 500, "Description");
      if (descError) {
        return errors.badRequest(descError);
      }
    }

    // Validate is_active is boolean
    const isActiveError = validateBoolean(is_active, "is_active");
    if (isActiveError) {
      return errors.badRequest(isActiveError);
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

    // Create upsell
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: upsell, error } = await (supabase as any)
      .from("upsells")
      .insert({
        business_id: business.id,
        name: name.trim(),
        description: description?.trim() || null,
        trigger_keywords: Array.isArray(trigger_keywords) ? trigger_keywords : [],
        trigger_services: Array.isArray(trigger_services) ? trigger_services : [],
        price_cents: typeof price_cents === "number" ? price_cents : 0,
        is_active: is_active ?? true,
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

    // Validate name length if provided
    if (upsell.name !== undefined) {
      const nameError = validateStringLength(upsell.name, 100, "Name");
      if (nameError) {
        return errors.badRequest(nameError);
      }
    }

    // Validate description length if provided
    if (upsell.description !== undefined) {
      const descError = validateStringLength(upsell.description, 500, "Description");
      if (descError) {
        return errors.badRequest(descError);
      }
    }

    // Validate boolean fields if provided
    if (upsell.is_active !== undefined) {
      const isActiveError = validateBoolean(upsell.is_active, "is_active");
      if (isActiveError) {
        return errors.badRequest(isActiveError);
      }
    }

    // Fetch the existing upsell to verify ownership
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingUpsell, error: fetchError } = await (supabase as any)
      .from("upsells")
      .select("id")
      .eq("id", upsell.id)
      .eq("business_id", business.id)
      .single();

    if (fetchError || !existingUpsell) {
      return errors.notFound("Upsell");
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (upsell.name !== undefined) updateData.name = upsell.name?.trim();
    if (upsell.description !== undefined) updateData.description = upsell.description?.trim() || null;
    if (upsell.trigger_keywords !== undefined) updateData.trigger_keywords = Array.isArray(upsell.trigger_keywords) ? upsell.trigger_keywords : [];
    if (upsell.trigger_services !== undefined) updateData.trigger_services = Array.isArray(upsell.trigger_services) ? upsell.trigger_services : [];
    if (upsell.price_cents !== undefined) updateData.price_cents = typeof upsell.price_cents === "number" ? upsell.price_cents : 0;
    if (upsell.is_active !== undefined) updateData.is_active = upsell.is_active;

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
