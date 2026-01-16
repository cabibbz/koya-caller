/**
 * Packages Knowledge API Route
 * Manages multi-visit package offers for the AI phone receptionist
 *
 * GET /api/dashboard/knowledge/packages - List all packages
 * POST /api/dashboard/knowledge/packages - Create new package
 * PUT /api/dashboard/knowledge/packages - Update package
 * DELETE /api/dashboard/knowledge/packages?id=xxx - Delete package
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { inngest } from "@/lib/inngest/client";
import {
  isValidUUID,
  validateStringLength,
  LIMITS,
} from "@/lib/validation";
import { logError } from "@/lib/logging";

// Local constants that differ from shared LIMITS
const MIN_SESSION_COUNT = 2;
const MAX_VALIDITY_DAYS = 730; // 2 years (exceeds shared 365 limit)

// GET - List all packages for the business
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

    // Fetch packages with service names
    const { data: packages, error } = await (supabase as ReturnType<typeof supabase.from>)
      .from("packages")
      .select(`
        id,
        name,
        description,
        service_id,
        session_count,
        discount_percent,
        price_cents,
        validity_days,
        pitch_message,
        min_visits_to_pitch,
        is_active,
        times_offered,
        times_accepted,
        service:services(id, name)
      `)
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (error) {
      logError("Packages GET", error);
      return NextResponse.json({ error: "Failed to fetch packages" }, { status: 500 });
    }

    return NextResponse.json({ packages: packages || [] });
  } catch (error) {
    logError("Packages GET", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Create a new package
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
      service_id,
      session_count,
      discount_percent = 0,
      price_cents,
      validity_days,
      pitch_message,
      min_visits_to_pitch = 0,
      is_active = true,
    } = body;

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Package name is required" },
        { status: 400 }
      );
    }

    // Validate field lengths
    const nameLengthError = validateStringLength(name, LIMITS.MAX_NAME_LENGTH, "Package name");
    if (nameLengthError) {
      return NextResponse.json({ error: nameLengthError }, { status: 400 });
    }

    const descLengthError = validateStringLength(description, LIMITS.MAX_DESCRIPTION_LENGTH, "Description");
    if (descLengthError) {
      return NextResponse.json({ error: descLengthError }, { status: 400 });
    }

    const pitchLengthError = validateStringLength(pitch_message, LIMITS.MAX_PITCH_LENGTH, "Pitch message");
    if (pitchLengthError) {
      return NextResponse.json({ error: pitchLengthError }, { status: 400 });
    }

    if (!session_count || !Number.isInteger(session_count) || session_count < MIN_SESSION_COUNT || session_count > LIMITS.MAX_SESSION_COUNT) {
      return NextResponse.json(
        { error: `Session count must be a whole number between ${MIN_SESSION_COUNT} and ${LIMITS.MAX_SESSION_COUNT}` },
        { status: 400 }
      );
    }

    // Validate validity_days if provided
    if (validity_days !== undefined && validity_days !== null) {
      if (!Number.isInteger(validity_days) || validity_days < 1 || validity_days > MAX_VALIDITY_DAYS) {
        return NextResponse.json(
          { error: `Validity days must be a whole number between 1 and ${MAX_VALIDITY_DAYS}` },
          { status: 400 }
        );
      }
    }

    // Validate discount_percent (reject invalid values instead of silent clamp)
    if (!Number.isInteger(discount_percent) || discount_percent < 0 || discount_percent > 100) {
      return NextResponse.json(
        { error: "Discount percent must be a whole number between 0 and 100" },
        { status: 400 }
      );
    }

    // Validate min_visits_to_pitch
    if (!Number.isInteger(min_visits_to_pitch) || min_visits_to_pitch < 0 || min_visits_to_pitch > LIMITS.MAX_MIN_VISITS_TO_PITCH) {
      return NextResponse.json(
        { error: `Minimum visits to pitch must be between 0 and ${LIMITS.MAX_MIN_VISITS_TO_PITCH}` },
        { status: 400 }
      );
    }

    // Validate is_active is boolean
    if (is_active !== undefined && typeof is_active !== "boolean") {
      return NextResponse.json(
        { error: "is_active must be a boolean value" },
        { status: 400 }
      );
    }

    // Validate price_cents if provided
    if (price_cents !== undefined && price_cents !== null) {
      if (!Number.isInteger(price_cents) || price_cents < 0) {
        return NextResponse.json(
          { error: "Price must be a non-negative whole number" },
          { status: 400 }
        );
      }
    }

    // Check package count limit
    const { count: packageCount } = await (supabase as ReturnType<typeof supabase.from>)
      .from("packages")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId);

    if ((packageCount || 0) >= LIMITS.MAX_PACKAGES_PER_BUSINESS) {
      return NextResponse.json(
        { error: `Maximum of ${LIMITS.MAX_PACKAGES_PER_BUSINESS} packages allowed. Delete some before creating new ones.` },
        { status: 400 }
      );
    }

    // If service_id provided, validate UUID format and ownership
    if (service_id) {
      if (!isValidUUID(service_id)) {
        return NextResponse.json({ error: "Invalid service ID format" }, { status: 400 });
      }

      const { data: service } = await supabase
        .from("services")
        .select("id")
        .eq("business_id", businessId)
        .eq("id", service_id)
        .single();

      if (!service) {
        return NextResponse.json(
          { error: "Service not found or does not belong to your business" },
          { status: 400 }
        );
      }
    }

    // Create package
    const { data: pkg, error } = await (supabase as ReturnType<typeof supabase.from>)
      .from("packages")
      .insert({
        business_id: businessId,
        name: name.trim(),
        description: description?.trim() || null,
        service_id: service_id || null,
        session_count,
        discount_percent,
        price_cents: price_cents || null,
        validity_days: validity_days || null,
        pitch_message: pitch_message?.trim() || null,
        min_visits_to_pitch,
        is_active,
      })
      .select()
      .single();

    if (error) {
      logError("Packages POST", error);
      return NextResponse.json({ error: "Failed to create package" }, { status: 500 });
    }

    // Trigger prompt regeneration
    let regenerationQueued = false;
    try {
      await inngest.send({
        name: "prompt/regeneration.requested",
        data: {
          businessId,
          triggeredBy: "packages_update",
        },
      });
      regenerationQueued = true;
    } catch (inngestError) {
      logError("Packages POST Inngest", inngestError);
    }

    return NextResponse.json({ success: true, package: pkg, regenerationQueued });
  } catch (error) {
    logError("Packages POST", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT - Update a package
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
    const { package: pkg } = body;

    if (!pkg || !pkg.id) {
      return NextResponse.json({ error: "Package ID required" }, { status: 400 });
    }

    if (!isValidUUID(pkg.id)) {
      return NextResponse.json({ error: "Invalid package ID format" }, { status: 400 });
    }

    // Verify package exists and belongs to business
    const { data: existingPkg, error: fetchError } = await (supabase as ReturnType<typeof supabase.from>)
      .from("packages")
      .select("id")
      .eq("id", pkg.id)
      .eq("business_id", businessId)
      .single();

    if (fetchError || !existingPkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    // Validate name if provided
    if (pkg.name !== undefined && !pkg.name?.trim()) {
      return NextResponse.json(
        { error: "Package name is required" },
        { status: 400 }
      );
    }

    // Validate field lengths
    if (pkg.name) {
      const nameLengthError = validateStringLength(pkg.name, LIMITS.MAX_NAME_LENGTH, "Package name");
      if (nameLengthError) {
        return NextResponse.json({ error: nameLengthError }, { status: 400 });
      }
    }

    if (pkg.description) {
      const descLengthError = validateStringLength(pkg.description, LIMITS.MAX_DESCRIPTION_LENGTH, "Description");
      if (descLengthError) {
        return NextResponse.json({ error: descLengthError }, { status: 400 });
      }
    }

    if (pkg.pitch_message) {
      const pitchLengthError = validateStringLength(pkg.pitch_message, LIMITS.MAX_PITCH_LENGTH, "Pitch message");
      if (pitchLengthError) {
        return NextResponse.json({ error: pitchLengthError }, { status: 400 });
      }
    }

    // Validate session_count if provided
    if (pkg.session_count !== undefined) {
      if (!Number.isInteger(pkg.session_count) || pkg.session_count < MIN_SESSION_COUNT || pkg.session_count > LIMITS.MAX_SESSION_COUNT) {
        return NextResponse.json(
          { error: `Session count must be a whole number between ${MIN_SESSION_COUNT} and ${LIMITS.MAX_SESSION_COUNT}` },
          { status: 400 }
        );
      }
    }

    // Validate validity_days if provided
    if (pkg.validity_days !== undefined && pkg.validity_days !== null) {
      if (!Number.isInteger(pkg.validity_days) || pkg.validity_days < 1 || pkg.validity_days > MAX_VALIDITY_DAYS) {
        return NextResponse.json(
          { error: `Validity days must be a whole number between 1 and ${MAX_VALIDITY_DAYS}` },
          { status: 400 }
        );
      }
    }

    // If service_id provided, validate UUID format and ownership
    if (pkg.service_id) {
      if (!isValidUUID(pkg.service_id)) {
        return NextResponse.json({ error: "Invalid service ID format" }, { status: 400 });
      }

      const { data: service } = await supabase
        .from("services")
        .select("id")
        .eq("business_id", businessId)
        .eq("id", pkg.service_id)
        .single();

      if (!service) {
        return NextResponse.json(
          { error: "Service not found or does not belong to your business" },
          { status: 400 }
        );
      }
    }

    // Validate discount_percent if provided (reject invalid values instead of silent clamp)
    if (pkg.discount_percent !== undefined) {
      if (!Number.isInteger(pkg.discount_percent) || pkg.discount_percent < 0 || pkg.discount_percent > 100) {
        return NextResponse.json(
          { error: "Discount percent must be a whole number between 0 and 100" },
          { status: 400 }
        );
      }
    }

    // Validate min_visits_to_pitch if provided
    if (pkg.min_visits_to_pitch !== undefined && pkg.min_visits_to_pitch !== null) {
      if (!Number.isInteger(pkg.min_visits_to_pitch) || pkg.min_visits_to_pitch < 0 || pkg.min_visits_to_pitch > LIMITS.MAX_MIN_VISITS_TO_PITCH) {
        return NextResponse.json(
          { error: `Minimum visits to pitch must be between 0 and ${LIMITS.MAX_MIN_VISITS_TO_PITCH}` },
          { status: 400 }
        );
      }
    }

    // Validate is_active is boolean
    if (pkg.is_active !== undefined && typeof pkg.is_active !== "boolean") {
      return NextResponse.json(
        { error: "is_active must be a boolean value" },
        { status: 400 }
      );
    }

    // Validate price_cents if provided
    if (pkg.price_cents !== undefined && pkg.price_cents !== null) {
      if (!Number.isInteger(pkg.price_cents) || pkg.price_cents < 0) {
        return NextResponse.json(
          { error: "Price must be a non-negative whole number" },
          { status: 400 }
        );
      }
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (pkg.name !== undefined) updateData.name = pkg.name.trim();
    if (pkg.description !== undefined) updateData.description = pkg.description?.trim() || null;
    if (pkg.service_id !== undefined) updateData.service_id = pkg.service_id || null;
    if (pkg.session_count !== undefined) updateData.session_count = pkg.session_count;
    if (pkg.discount_percent !== undefined) updateData.discount_percent = pkg.discount_percent;
    if (pkg.price_cents !== undefined) updateData.price_cents = pkg.price_cents || null;
    if (pkg.validity_days !== undefined) updateData.validity_days = pkg.validity_days || null;
    if (pkg.pitch_message !== undefined) updateData.pitch_message = pkg.pitch_message?.trim() || null;
    if (pkg.min_visits_to_pitch !== undefined) updateData.min_visits_to_pitch = pkg.min_visits_to_pitch || 0;
    if (pkg.is_active !== undefined) updateData.is_active = pkg.is_active;

    // Update package
    const { error } = await (supabase as ReturnType<typeof supabase.from>)
      .from("packages")
      .update(updateData)
      .eq("id", pkg.id)
      .eq("business_id", businessId);

    if (error) {
      logError("Packages PUT", error);
      return NextResponse.json({ error: "Failed to update package" }, { status: 500 });
    }

    // Trigger prompt regeneration
    let regenerationQueued = false;
    try {
      await inngest.send({
        name: "prompt/regeneration.requested",
        data: {
          businessId,
          triggeredBy: "packages_update",
        },
      });
      regenerationQueued = true;
    } catch (inngestError) {
      logError("Packages PUT Inngest", inngestError);
    }

    return NextResponse.json({ success: true, regenerationQueued });
  } catch (error) {
    logError("Packages PUT", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Delete a package
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
    const packageId = searchParams.get("id");

    if (!packageId) {
      return NextResponse.json({ error: "Package ID required" }, { status: 400 });
    }

    if (!isValidUUID(packageId)) {
      return NextResponse.json({ error: "Invalid package ID format" }, { status: 400 });
    }

    // Delete package
    const { data: deletedRows, error } = await (supabase as ReturnType<typeof supabase.from>)
      .from("packages")
      .delete()
      .eq("id", packageId)
      .eq("business_id", businessId)
      .select();

    if (error) {
      logError("Packages DELETE", error);
      return NextResponse.json({ error: "Failed to delete package" }, { status: 500 });
    }

    if (!deletedRows || deletedRows.length === 0) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    // Trigger prompt regeneration
    let regenerationQueued = false;
    try {
      await inngest.send({
        name: "prompt/regeneration.requested",
        data: {
          businessId,
          triggeredBy: "packages_update",
        },
      });
      regenerationQueued = true;
    } catch (inngestError) {
      logError("Packages DELETE Inngest", inngestError);
    }

    return NextResponse.json({ success: true, regenerationQueued });
  } catch (error) {
    logError("Packages DELETE", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
