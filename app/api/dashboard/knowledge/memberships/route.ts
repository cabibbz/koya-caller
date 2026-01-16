/**
 * Memberships Knowledge API Route
 * Manages membership plan offers for the AI phone receptionist
 *
 * GET /api/dashboard/knowledge/memberships - List all memberships
 * POST /api/dashboard/knowledge/memberships - Create new membership
 * PUT /api/dashboard/knowledge/memberships - Update membership
 * DELETE /api/dashboard/knowledge/memberships?id=xxx - Delete membership
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { inngest } from "@/lib/inngest/client";
import {
  isValidUUID,
  validateStringLength,
  BILLING_PERIODS,
  LIMITS,
} from "@/lib/validation";
import { logError } from "@/lib/logging";

// GET - List all memberships for the business
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

    // Fetch memberships
    const { data: memberships, error } = await (supabase as ReturnType<typeof supabase.from>)
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
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (error) {
      logError("Memberships GET", error);
      return NextResponse.json({ error: "Failed to fetch memberships" }, { status: 500 });
    }

    return NextResponse.json({ memberships: memberships || [] });
  } catch (error) {
    logError("Memberships GET", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Create a new membership
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
      return NextResponse.json(
        { error: "Membership name is required" },
        { status: 400 }
      );
    }

    // Validate field lengths
    const nameLengthError = validateStringLength(name, LIMITS.MAX_NAME_LENGTH, "Membership name");
    if (nameLengthError) {
      return NextResponse.json({ error: nameLengthError }, { status: 400 });
    }

    const descLengthError = validateStringLength(description, LIMITS.MAX_DESCRIPTION_LENGTH, "Description");
    if (descLengthError) {
      return NextResponse.json({ error: descLengthError }, { status: 400 });
    }

    const benefitsLengthError = validateStringLength(benefits, LIMITS.MAX_BENEFITS_LENGTH, "Benefits");
    if (benefitsLengthError) {
      return NextResponse.json({ error: benefitsLengthError }, { status: 400 });
    }

    const pitchLengthError = validateStringLength(pitch_message, LIMITS.MAX_PITCH_LENGTH, "Pitch message");
    if (pitchLengthError) {
      return NextResponse.json({ error: pitchLengthError }, { status: 400 });
    }

    if (!price_cents || !Number.isInteger(price_cents) || price_cents < 1 || price_cents > LIMITS.MAX_PRICE_CENTS) {
      return NextResponse.json(
        { error: "Price must be a whole number between $0.01 and $100,000" },
        { status: 400 }
      );
    }

    if (!benefits?.trim()) {
      return NextResponse.json(
        { error: "Membership benefits are required" },
        { status: 400 }
      );
    }

    if (!BILLING_PERIODS.includes(billing_period)) {
      return NextResponse.json(
        { error: "Invalid billing period. Must be monthly, quarterly, or annual" },
        { status: 400 }
      );
    }

    // Validate pitch trigger fields if provided
    if (pitch_after_booking_amount_cents !== undefined && pitch_after_booking_amount_cents !== null) {
      if (!Number.isInteger(pitch_after_booking_amount_cents) || pitch_after_booking_amount_cents < 0 || pitch_after_booking_amount_cents > LIMITS.MAX_PRICE_CENTS) {
        return NextResponse.json(
          { error: "Pitch booking amount must be between $0 and $100,000" },
          { status: 400 }
        );
      }
    }

    if (pitch_after_visit_count !== undefined && pitch_after_visit_count !== null) {
      if (!Number.isInteger(pitch_after_visit_count) || pitch_after_visit_count < 0 || pitch_after_visit_count > LIMITS.MAX_PITCH_VISIT_COUNT) {
        return NextResponse.json(
          { error: `Pitch visit count must be between 0 and ${LIMITS.MAX_PITCH_VISIT_COUNT}` },
          { status: 400 }
        );
      }
    }

    // Check membership count limit
    const { count: membershipCount } = await (supabase as ReturnType<typeof supabase.from>)
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId);

    if ((membershipCount || 0) >= LIMITS.MAX_MEMBERSHIPS_PER_BUSINESS) {
      return NextResponse.json(
        { error: `Maximum of ${LIMITS.MAX_MEMBERSHIPS_PER_BUSINESS} memberships allowed. Delete some before creating new ones.` },
        { status: 400 }
      );
    }

    // Create membership
    const { data: membership, error } = await (supabase as ReturnType<typeof supabase.from>)
      .from("memberships")
      .insert({
        business_id: businessId,
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
      return NextResponse.json({ error: "Failed to create membership" }, { status: 500 });
    }

    // Trigger prompt regeneration
    let regenerationQueued = false;
    try {
      await inngest.send({
        name: "prompt/regeneration.requested",
        data: {
          businessId,
          triggeredBy: "memberships_update",
        },
      });
      regenerationQueued = true;
    } catch (inngestError) {
      logError("Memberships POST Inngest", inngestError);
    }

    return NextResponse.json({ success: true, membership, regenerationQueued });
  } catch (error) {
    logError("Memberships POST", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT - Update a membership
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
    const { membership } = body;

    if (!membership || !membership.id) {
      return NextResponse.json({ error: "Membership ID required" }, { status: 400 });
    }

    if (!isValidUUID(membership.id)) {
      return NextResponse.json({ error: "Invalid membership ID format" }, { status: 400 });
    }

    // Verify membership exists and belongs to business
    const { data: existingMembership, error: fetchError } = await (supabase as ReturnType<typeof supabase.from>)
      .from("memberships")
      .select("id")
      .eq("id", membership.id)
      .eq("business_id", businessId)
      .single();

    if (fetchError || !existingMembership) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    // Validate fields if provided
    if (membership.name !== undefined && !membership.name?.trim()) {
      return NextResponse.json(
        { error: "Membership name is required" },
        { status: 400 }
      );
    }

    // Validate field lengths
    if (membership.name) {
      const nameLengthError = validateStringLength(membership.name, LIMITS.MAX_NAME_LENGTH, "Membership name");
      if (nameLengthError) {
        return NextResponse.json({ error: nameLengthError }, { status: 400 });
      }
    }

    if (membership.description) {
      const descLengthError = validateStringLength(membership.description, LIMITS.MAX_DESCRIPTION_LENGTH, "Description");
      if (descLengthError) {
        return NextResponse.json({ error: descLengthError }, { status: 400 });
      }
    }

    if (membership.benefits) {
      const benefitsLengthError = validateStringLength(membership.benefits, LIMITS.MAX_BENEFITS_LENGTH, "Benefits");
      if (benefitsLengthError) {
        return NextResponse.json({ error: benefitsLengthError }, { status: 400 });
      }
    }

    if (membership.pitch_message) {
      const pitchLengthError = validateStringLength(membership.pitch_message, LIMITS.MAX_PITCH_LENGTH, "Pitch message");
      if (pitchLengthError) {
        return NextResponse.json({ error: pitchLengthError }, { status: 400 });
      }
    }

    if (membership.price_cents !== undefined) {
      if (!Number.isInteger(membership.price_cents) || membership.price_cents < 1 || membership.price_cents > LIMITS.MAX_PRICE_CENTS) {
        return NextResponse.json(
          { error: "Price must be a whole number between $0.01 and $100,000" },
          { status: 400 }
        );
      }
    }

    if (membership.benefits !== undefined && !membership.benefits?.trim()) {
      return NextResponse.json(
        { error: "Membership benefits are required" },
        { status: 400 }
      );
    }

    if (membership.billing_period && !BILLING_PERIODS.includes(membership.billing_period)) {
      return NextResponse.json(
        { error: "Invalid billing period. Must be monthly, quarterly, or annual" },
        { status: 400 }
      );
    }

    // Validate pitch trigger fields if provided
    if (membership.pitch_after_booking_amount_cents !== undefined && membership.pitch_after_booking_amount_cents !== null) {
      if (!Number.isInteger(membership.pitch_after_booking_amount_cents) || membership.pitch_after_booking_amount_cents < 0 || membership.pitch_after_booking_amount_cents > LIMITS.MAX_PRICE_CENTS) {
        return NextResponse.json(
          { error: "Pitch booking amount must be between $0 and $100,000" },
          { status: 400 }
        );
      }
    }

    if (membership.pitch_after_visit_count !== undefined && membership.pitch_after_visit_count !== null) {
      if (!Number.isInteger(membership.pitch_after_visit_count) || membership.pitch_after_visit_count < 0 || membership.pitch_after_visit_count > LIMITS.MAX_PITCH_VISIT_COUNT) {
        return NextResponse.json(
          { error: `Pitch visit count must be between 0 and ${LIMITS.MAX_PITCH_VISIT_COUNT}` },
          { status: 400 }
        );
      }
    }

    // Validate is_active is boolean
    if (membership.is_active !== undefined && typeof membership.is_active !== "boolean") {
      return NextResponse.json(
        { error: "is_active must be a boolean value" },
        { status: 400 }
      );
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
    const { error } = await (supabase as ReturnType<typeof supabase.from>)
      .from("memberships")
      .update(updateData)
      .eq("id", membership.id)
      .eq("business_id", businessId);

    if (error) {
      logError("Memberships PUT", error);
      return NextResponse.json({ error: "Failed to update membership" }, { status: 500 });
    }

    // Trigger prompt regeneration
    let regenerationQueued = false;
    try {
      await inngest.send({
        name: "prompt/regeneration.requested",
        data: {
          businessId,
          triggeredBy: "memberships_update",
        },
      });
      regenerationQueued = true;
    } catch (inngestError) {
      logError("Memberships PUT Inngest", inngestError);
    }

    return NextResponse.json({ success: true, regenerationQueued });
  } catch (error) {
    logError("Memberships PUT", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Delete a membership
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

    const { searchParams } = new URL(request.url);
    const membershipId = searchParams.get("id");

    if (!membershipId) {
      return NextResponse.json({ error: "Membership ID required" }, { status: 400 });
    }

    if (!isValidUUID(membershipId)) {
      return NextResponse.json({ error: "Invalid membership ID format" }, { status: 400 });
    }

    // Delete membership
    const { data: deletedRows, error } = await (supabase as ReturnType<typeof supabase.from>)
      .from("memberships")
      .delete()
      .eq("id", membershipId)
      .eq("business_id", businessId)
      .select();

    if (error) {
      logError("Memberships DELETE", error);
      return NextResponse.json({ error: "Failed to delete membership" }, { status: 500 });
    }

    if (!deletedRows || deletedRows.length === 0) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    // Trigger prompt regeneration
    let regenerationQueued = false;
    try {
      await inngest.send({
        name: "prompt/regeneration.requested",
        data: {
          businessId,
          triggeredBy: "memberships_update",
        },
      });
      regenerationQueued = true;
    } catch (inngestError) {
      logError("Memberships DELETE Inngest", inngestError);
    }

    return NextResponse.json({ success: true, regenerationQueued });
  } catch (error) {
    logError("Memberships DELETE", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
