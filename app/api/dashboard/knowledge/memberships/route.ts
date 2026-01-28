/**
 * Memberships Knowledge API Route
 * Manages membership plan offers for the AI phone receptionist
 *
 * GET /api/dashboard/knowledge/memberships - List all memberships
 * POST /api/dashboard/knowledge/memberships - Create new membership
 * PUT /api/dashboard/knowledge/memberships - Update membership
 * DELETE /api/dashboard/knowledge/memberships?id=xxx - Delete membership
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { inngest } from "@/lib/inngest/client";
import {
  isValidUUID,
  validateStringLength,
  BILLING_PERIODS,
  LIMITS,
} from "@/lib/validation";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

// =============================================================================
// GET Handler - List all memberships for the business
// =============================================================================

async function handleGet(
  _request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    // Fetch memberships
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: memberships, error } = await (supabase as any)
      .from("memberships")
      .select(`
        id,
        name,
        description,
        price_cents,
        billing_period,
        benefits,
        pitch_message,
        pitch_after_booking_amount_cents,
        pitch_after_visit_count,
        is_active,
        times_offered,
        times_accepted
      `)
      .eq("business_id", business.id)
      .order("created_at", { ascending: false });

    if (error) {
      logError("Memberships GET", error);
      return errors.internalError("Failed to fetch memberships");
    }

    return success({ memberships: memberships || [] });
  } catch (error) {
    logError("Memberships GET", error);
    return errors.internalError("Failed to fetch memberships");
  }
}

// =============================================================================
// POST Handler - Create a new membership
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
      price_cents,
      billing_period = "monthly",
      benefits,
      pitch_message,
      pitch_after_booking_amount_cents,
      pitch_after_visit_count,
      is_active = true,
    } = body;

    // Validate required fields
    if (!name?.trim()) {
      return errors.badRequest("Membership name is required");
    }

    // Validate field lengths
    const nameLengthError = validateStringLength(name, LIMITS.MAX_NAME_LENGTH, "Membership name");
    if (nameLengthError) {
      return errors.badRequest(nameLengthError);
    }

    const descLengthError = validateStringLength(description, LIMITS.MAX_DESCRIPTION_LENGTH, "Description");
    if (descLengthError) {
      return errors.badRequest(descLengthError);
    }

    const benefitsLengthError = validateStringLength(benefits, LIMITS.MAX_BENEFITS_LENGTH, "Benefits");
    if (benefitsLengthError) {
      return errors.badRequest(benefitsLengthError);
    }

    const pitchLengthError = validateStringLength(pitch_message, LIMITS.MAX_PITCH_LENGTH, "Pitch message");
    if (pitchLengthError) {
      return errors.badRequest(pitchLengthError);
    }

    if (!price_cents || !Number.isInteger(price_cents) || price_cents < 1 || price_cents > LIMITS.MAX_PRICE_CENTS) {
      return errors.badRequest("Price must be a whole number between $0.01 and $100,000");
    }

    if (!benefits?.trim()) {
      return errors.badRequest("Membership benefits are required");
    }

    if (!BILLING_PERIODS.includes(billing_period)) {
      return errors.badRequest("Invalid billing period. Must be monthly, quarterly, or annual");
    }

    // Validate pitch trigger fields if provided
    if (pitch_after_booking_amount_cents !== undefined && pitch_after_booking_amount_cents !== null) {
      if (!Number.isInteger(pitch_after_booking_amount_cents) || pitch_after_booking_amount_cents < 0 || pitch_after_booking_amount_cents > LIMITS.MAX_PRICE_CENTS) {
        return errors.badRequest("Pitch booking amount must be between $0 and $100,000");
      }
    }

    if (pitch_after_visit_count !== undefined && pitch_after_visit_count !== null) {
      if (!Number.isInteger(pitch_after_visit_count) || pitch_after_visit_count < 0 || pitch_after_visit_count > LIMITS.MAX_PITCH_VISIT_COUNT) {
        return errors.badRequest(`Pitch visit count must be between 0 and ${LIMITS.MAX_PITCH_VISIT_COUNT}`);
      }
    }

    // Check membership count limit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: membershipCount } = await (supabase as any)
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id);

    if ((membershipCount || 0) >= LIMITS.MAX_MEMBERSHIPS_PER_BUSINESS) {
      return errors.badRequest(`Maximum of ${LIMITS.MAX_MEMBERSHIPS_PER_BUSINESS} memberships allowed. Delete some before creating new ones.`);
    }

    // Create membership
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: membership, error } = await (supabase as any)
      .from("memberships")
      .insert({
        business_id: business.id,
        name: name.trim(),
        description: description?.trim() || null,
        price_cents,
        billing_period,
        benefits: benefits.trim(),
        pitch_message: pitch_message?.trim() || null,
        pitch_after_booking_amount_cents: pitch_after_booking_amount_cents || null,
        pitch_after_visit_count: pitch_after_visit_count || null,
        is_active,
      })
      .select()
      .single();

    if (error) {
      logError("Memberships POST", error);
      return errors.internalError("Failed to create membership");
    }

    // Trigger prompt regeneration
    let regenerationQueued = false;
    try {
      await inngest.send({
        name: "prompt/regeneration.requested",
        data: {
          businessId: business.id,
          triggeredBy: "memberships_update",
        },
      });
      regenerationQueued = true;
    } catch (inngestError) {
      logError("Memberships POST Inngest", inngestError);
    }

    return success({ success: true, membership, regenerationQueued });
  } catch (error) {
    logError("Memberships POST", error);
    return errors.internalError("Failed to create membership");
  }
}

// =============================================================================
// PUT Handler - Update a membership
// =============================================================================

async function handlePut(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    const body = await request.json();
    const { membership } = body;

    if (!membership || !membership.id) {
      return errors.badRequest("Membership ID required");
    }

    if (!isValidUUID(membership.id)) {
      return errors.badRequest("Invalid membership ID format");
    }

    // Verify membership exists and belongs to business
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingMembership, error: fetchError } = await (supabase as any)
      .from("memberships")
      .select("id")
      .eq("id", membership.id)
      .eq("business_id", business.id)
      .single();

    if (fetchError || !existingMembership) {
      return errors.notFound("Membership");
    }

    // Validate fields if provided
    if (membership.name !== undefined && !membership.name?.trim()) {
      return errors.badRequest("Membership name is required");
    }

    // Validate field lengths
    if (membership.name) {
      const nameLengthError = validateStringLength(membership.name, LIMITS.MAX_NAME_LENGTH, "Membership name");
      if (nameLengthError) {
        return errors.badRequest(nameLengthError);
      }
    }

    if (membership.description) {
      const descLengthError = validateStringLength(membership.description, LIMITS.MAX_DESCRIPTION_LENGTH, "Description");
      if (descLengthError) {
        return errors.badRequest(descLengthError);
      }
    }

    if (membership.benefits) {
      const benefitsLengthError = validateStringLength(membership.benefits, LIMITS.MAX_BENEFITS_LENGTH, "Benefits");
      if (benefitsLengthError) {
        return errors.badRequest(benefitsLengthError);
      }
    }

    if (membership.pitch_message) {
      const pitchLengthError = validateStringLength(membership.pitch_message, LIMITS.MAX_PITCH_LENGTH, "Pitch message");
      if (pitchLengthError) {
        return errors.badRequest(pitchLengthError);
      }
    }

    if (membership.price_cents !== undefined) {
      if (!Number.isInteger(membership.price_cents) || membership.price_cents < 1 || membership.price_cents > LIMITS.MAX_PRICE_CENTS) {
        return errors.badRequest("Price must be a whole number between $0.01 and $100,000");
      }
    }

    if (membership.benefits !== undefined && !membership.benefits?.trim()) {
      return errors.badRequest("Membership benefits are required");
    }

    if (membership.billing_period && !BILLING_PERIODS.includes(membership.billing_period)) {
      return errors.badRequest("Invalid billing period. Must be monthly, quarterly, or annual");
    }

    // Validate pitch trigger fields if provided
    if (membership.pitch_after_booking_amount_cents !== undefined && membership.pitch_after_booking_amount_cents !== null) {
      if (!Number.isInteger(membership.pitch_after_booking_amount_cents) || membership.pitch_after_booking_amount_cents < 0 || membership.pitch_after_booking_amount_cents > LIMITS.MAX_PRICE_CENTS) {
        return errors.badRequest("Pitch booking amount must be between $0 and $100,000");
      }
    }

    if (membership.pitch_after_visit_count !== undefined && membership.pitch_after_visit_count !== null) {
      if (!Number.isInteger(membership.pitch_after_visit_count) || membership.pitch_after_visit_count < 0 || membership.pitch_after_visit_count > LIMITS.MAX_PITCH_VISIT_COUNT) {
        return errors.badRequest(`Pitch visit count must be between 0 and ${LIMITS.MAX_PITCH_VISIT_COUNT}`);
      }
    }

    // Validate is_active is boolean
    if (membership.is_active !== undefined && typeof membership.is_active !== "boolean") {
      return errors.badRequest("is_active must be a boolean value");
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (membership.name !== undefined) updateData.name = membership.name.trim();
    if (membership.description !== undefined) updateData.description = membership.description?.trim() || null;
    if (membership.price_cents !== undefined) updateData.price_cents = membership.price_cents;
    if (membership.billing_period !== undefined) updateData.billing_period = membership.billing_period;
    if (membership.benefits !== undefined) updateData.benefits = membership.benefits.trim();
    if (membership.pitch_message !== undefined) updateData.pitch_message = membership.pitch_message?.trim() || null;
    if (membership.pitch_after_booking_amount_cents !== undefined) updateData.pitch_after_booking_amount_cents = membership.pitch_after_booking_amount_cents || null;
    if (membership.pitch_after_visit_count !== undefined) updateData.pitch_after_visit_count = membership.pitch_after_visit_count || null;
    if (membership.is_active !== undefined) updateData.is_active = membership.is_active;

    // Update membership
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("memberships")
      .update(updateData)
      .eq("id", membership.id)
      .eq("business_id", business.id);

    if (error) {
      logError("Memberships PUT", error);
      return errors.internalError("Failed to update membership");
    }

    // Trigger prompt regeneration
    let regenerationQueued = false;
    try {
      await inngest.send({
        name: "prompt/regeneration.requested",
        data: {
          businessId: business.id,
          triggeredBy: "memberships_update",
        },
      });
      regenerationQueued = true;
    } catch (inngestError) {
      logError("Memberships PUT Inngest", inngestError);
    }

    return success({ success: true, regenerationQueued });
  } catch (error) {
    logError("Memberships PUT", error);
    return errors.internalError("Failed to update membership");
  }
}

// =============================================================================
// DELETE Handler - Delete a membership
// =============================================================================

async function handleDelete(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    const { searchParams } = new URL(request.url);
    const membershipId = searchParams.get("id");

    if (!membershipId) {
      return errors.badRequest("Membership ID required");
    }

    if (!isValidUUID(membershipId)) {
      return errors.badRequest("Invalid membership ID format");
    }

    // Delete membership
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: deletedRows, error } = await (supabase as any)
      .from("memberships")
      .delete()
      .eq("id", membershipId)
      .eq("business_id", business.id)
      .select();

    if (error) {
      logError("Memberships DELETE", error);
      return errors.internalError("Failed to delete membership");
    }

    if (!deletedRows || deletedRows.length === 0) {
      return errors.notFound("Membership");
    }

    // Trigger prompt regeneration
    let regenerationQueued = false;
    try {
      await inngest.send({
        name: "prompt/regeneration.requested",
        data: {
          businessId: business.id,
          triggeredBy: "memberships_update",
        },
      });
      regenerationQueued = true;
    } catch (inngestError) {
      logError("Memberships DELETE Inngest", inngestError);
    }

    return success({ success: true, regenerationQueued });
  } catch (error) {
    logError("Memberships DELETE", error);
    return errors.internalError("Failed to delete membership");
  }
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
export const PUT = withAuth(handlePut);
export const DELETE = withAuth(handleDelete);
