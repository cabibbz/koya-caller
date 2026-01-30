/**
 * Packages Knowledge API Route
 * Manages multi-visit package offers for the AI phone receptionist
 *
 * GET /api/dashboard/knowledge/packages - List all packages
 * POST /api/dashboard/knowledge/packages - Create new package
 * PUT /api/dashboard/knowledge/packages - Update package
 * DELETE /api/dashboard/knowledge/packages?id=xxx - Delete package
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
  LIMITS,
} from "@/lib/validation";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

// Local constants that differ from shared LIMITS
const MIN_SESSION_COUNT = 2;
const MAX_VALIDITY_DAYS = 730; // 2 years (exceeds shared 365 limit)

// =============================================================================
// GET Handler - List all packages for the business
// =============================================================================

async function handleGet(
  _request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    // Fetch packages with service names
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: packages, error } = await (supabase as any)
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
      .eq("business_id", business.id)
      .order("created_at", { ascending: false });

    if (error) {
      logError("Packages GET", error);
      return errors.internalError("Failed to fetch packages");
    }

    return success({ packages: packages || [] });
  } catch (error) {
    logError("Packages GET", error);
    return errors.internalError("Failed to fetch packages");
  }
}

// =============================================================================
// POST Handler - Create a new package
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
      return errors.badRequest("Package name is required");
    }

    // Validate field lengths
    const nameLengthError = validateStringLength(name, LIMITS.MAX_NAME_LENGTH, "Package name");
    if (nameLengthError) {
      return errors.badRequest(nameLengthError);
    }

    const descLengthError = validateStringLength(description, LIMITS.MAX_DESCRIPTION_LENGTH, "Description");
    if (descLengthError) {
      return errors.badRequest(descLengthError);
    }

    const pitchLengthError = validateStringLength(pitch_message, LIMITS.MAX_PITCH_LENGTH, "Pitch message");
    if (pitchLengthError) {
      return errors.badRequest(pitchLengthError);
    }

    if (!session_count || !Number.isInteger(session_count) || session_count < MIN_SESSION_COUNT || session_count > LIMITS.MAX_SESSION_COUNT) {
      return errors.badRequest(`Session count must be a whole number between ${MIN_SESSION_COUNT} and ${LIMITS.MAX_SESSION_COUNT}`);
    }

    // Validate validity_days if provided
    if (validity_days !== undefined && validity_days !== null) {
      if (!Number.isInteger(validity_days) || validity_days < 1 || validity_days > MAX_VALIDITY_DAYS) {
        return errors.badRequest(`Validity days must be a whole number between 1 and ${MAX_VALIDITY_DAYS}`);
      }
    }

    // Validate discount_percent (reject invalid values instead of silent clamp)
    if (!Number.isInteger(discount_percent) || discount_percent < 0 || discount_percent > 100) {
      return errors.badRequest("Discount percent must be a whole number between 0 and 100");
    }

    // Validate min_visits_to_pitch
    if (!Number.isInteger(min_visits_to_pitch) || min_visits_to_pitch < 0 || min_visits_to_pitch > LIMITS.MAX_MIN_VISITS_TO_PITCH) {
      return errors.badRequest(`Minimum visits to pitch must be between 0 and ${LIMITS.MAX_MIN_VISITS_TO_PITCH}`);
    }

    // Validate is_active is boolean
    if (is_active !== undefined && typeof is_active !== "boolean") {
      return errors.badRequest("is_active must be a boolean value");
    }

    // Validate price_cents if provided
    if (price_cents !== undefined && price_cents !== null) {
      if (!Number.isInteger(price_cents) || price_cents < 0) {
        return errors.badRequest("Price must be a non-negative whole number");
      }
    }

    // Check package count limit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: packageCount } = await (supabase as any)
      .from("packages")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id);

    if ((packageCount || 0) >= LIMITS.MAX_PACKAGES_PER_BUSINESS) {
      return errors.badRequest(`Maximum of ${LIMITS.MAX_PACKAGES_PER_BUSINESS} packages allowed. Delete some before creating new ones.`);
    }

    // If service_id provided, validate UUID format and ownership
    if (service_id) {
      if (!isValidUUID(service_id)) {
        return errors.badRequest("Invalid service ID format");
      }

      const { data: service } = await supabase
        .from("services")
        .select("id")
        .eq("business_id", business.id)
        .eq("id", service_id)
        .single();

      if (!service) {
        return errors.badRequest("Service not found or does not belong to your business");
      }
    }

    // Create package
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pkg, error } = await (supabase as any)
      .from("packages")
      .insert({
        business_id: business.id,
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
      return errors.internalError("Failed to create package");
    }

    // Trigger prompt regeneration
    let regenerationQueued = false;
    try {
      await inngest.send({
        name: "prompt/regeneration.requested",
        data: {
          businessId: business.id,
          triggeredBy: "packages_update",
        },
      });
      regenerationQueued = true;
    } catch (inngestError) {
      logError("Packages POST Inngest", inngestError);
    }

    return success({ success: true, package: pkg, regenerationQueued });
  } catch (error) {
    logError("Packages POST", error);
    return errors.internalError("Failed to create package");
  }
}

// =============================================================================
// PUT Handler - Update a package
// =============================================================================

async function handlePut(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    const body = await request.json();
    const { package: pkg } = body;

    if (!pkg || !pkg.id) {
      return errors.badRequest("Package ID required");
    }

    if (!isValidUUID(pkg.id)) {
      return errors.badRequest("Invalid package ID format");
    }

    // Verify package exists and belongs to business
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingPkg, error: fetchError } = await (supabase as any)
      .from("packages")
      .select("id")
      .eq("id", pkg.id)
      .eq("business_id", business.id)
      .single();

    if (fetchError || !existingPkg) {
      return errors.notFound("Package");
    }

    // Validate name if provided
    if (pkg.name !== undefined && !pkg.name?.trim()) {
      return errors.badRequest("Package name is required");
    }

    // Validate field lengths
    if (pkg.name) {
      const nameLengthError = validateStringLength(pkg.name, LIMITS.MAX_NAME_LENGTH, "Package name");
      if (nameLengthError) {
        return errors.badRequest(nameLengthError);
      }
    }

    if (pkg.description) {
      const descLengthError = validateStringLength(pkg.description, LIMITS.MAX_DESCRIPTION_LENGTH, "Description");
      if (descLengthError) {
        return errors.badRequest(descLengthError);
      }
    }

    if (pkg.pitch_message) {
      const pitchLengthError = validateStringLength(pkg.pitch_message, LIMITS.MAX_PITCH_LENGTH, "Pitch message");
      if (pitchLengthError) {
        return errors.badRequest(pitchLengthError);
      }
    }

    // Validate session_count if provided
    if (pkg.session_count !== undefined) {
      if (!Number.isInteger(pkg.session_count) || pkg.session_count < MIN_SESSION_COUNT || pkg.session_count > LIMITS.MAX_SESSION_COUNT) {
        return errors.badRequest(`Session count must be a whole number between ${MIN_SESSION_COUNT} and ${LIMITS.MAX_SESSION_COUNT}`);
      }
    }

    // Validate validity_days if provided
    if (pkg.validity_days !== undefined && pkg.validity_days !== null) {
      if (!Number.isInteger(pkg.validity_days) || pkg.validity_days < 1 || pkg.validity_days > MAX_VALIDITY_DAYS) {
        return errors.badRequest(`Validity days must be a whole number between 1 and ${MAX_VALIDITY_DAYS}`);
      }
    }

    // If service_id provided, validate UUID format and ownership
    if (pkg.service_id) {
      if (!isValidUUID(pkg.service_id)) {
        return errors.badRequest("Invalid service ID format");
      }

      const { data: service } = await supabase
        .from("services")
        .select("id")
        .eq("business_id", business.id)
        .eq("id", pkg.service_id)
        .single();

      if (!service) {
        return errors.badRequest("Service not found or does not belong to your business");
      }
    }

    // Validate discount_percent if provided (reject invalid values instead of silent clamp)
    if (pkg.discount_percent !== undefined) {
      if (!Number.isInteger(pkg.discount_percent) || pkg.discount_percent < 0 || pkg.discount_percent > 100) {
        return errors.badRequest("Discount percent must be a whole number between 0 and 100");
      }
    }

    // Validate min_visits_to_pitch if provided
    if (pkg.min_visits_to_pitch !== undefined && pkg.min_visits_to_pitch !== null) {
      if (!Number.isInteger(pkg.min_visits_to_pitch) || pkg.min_visits_to_pitch < 0 || pkg.min_visits_to_pitch > LIMITS.MAX_MIN_VISITS_TO_PITCH) {
        return errors.badRequest(`Minimum visits to pitch must be between 0 and ${LIMITS.MAX_MIN_VISITS_TO_PITCH}`);
      }
    }

    // Validate is_active is boolean
    if (pkg.is_active !== undefined && typeof pkg.is_active !== "boolean") {
      return errors.badRequest("is_active must be a boolean value");
    }

    // Validate price_cents if provided
    if (pkg.price_cents !== undefined && pkg.price_cents !== null) {
      if (!Number.isInteger(pkg.price_cents) || pkg.price_cents < 0) {
        return errors.badRequest("Price must be a non-negative whole number");
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("packages")
      .update(updateData)
      .eq("id", pkg.id)
      .eq("business_id", business.id);

    if (error) {
      logError("Packages PUT", error);
      return errors.internalError("Failed to update package");
    }

    // Trigger prompt regeneration
    let regenerationQueued = false;
    try {
      await inngest.send({
        name: "prompt/regeneration.requested",
        data: {
          businessId: business.id,
          triggeredBy: "packages_update",
        },
      });
      regenerationQueued = true;
    } catch (inngestError) {
      logError("Packages PUT Inngest", inngestError);
    }

    return success({ success: true, regenerationQueued });
  } catch (error) {
    logError("Packages PUT", error);
    return errors.internalError("Failed to update package");
  }
}

// =============================================================================
// DELETE Handler - Delete a package
// =============================================================================

async function handleDelete(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    const { searchParams } = new URL(request.url);
    const packageId = searchParams.get("id");

    if (!packageId) {
      return errors.badRequest("Package ID required");
    }

    if (!isValidUUID(packageId)) {
      return errors.badRequest("Invalid package ID format");
    }

    // Delete package
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: deletedRows, error } = await (supabase as any)
      .from("packages")
      .delete()
      .eq("id", packageId)
      .eq("business_id", business.id)
      .select();

    if (error) {
      logError("Packages DELETE", error);
      return errors.internalError("Failed to delete package");
    }

    if (!deletedRows || deletedRows.length === 0) {
      return errors.notFound("Package");
    }

    // Trigger prompt regeneration
    let regenerationQueued = false;
    try {
      await inngest.send({
        name: "prompt/regeneration.requested",
        data: {
          businessId: business.id,
          triggeredBy: "packages_update",
        },
      });
      regenerationQueued = true;
    } catch (inngestError) {
      logError("Packages DELETE Inngest", inngestError);
    }

    return success({ success: true, regenerationQueued });
  } catch (error) {
    logError("Packages DELETE", error);
    return errors.internalError("Failed to delete package");
  }
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
export const PUT = withAuth(handlePut);
export const DELETE = withAuth(handleDelete);
