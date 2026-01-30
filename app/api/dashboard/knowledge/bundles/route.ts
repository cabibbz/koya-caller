/**
 * Bundles Knowledge API Route
 * Manages service bundle offers for the AI phone receptionist
 *
 * GET /api/dashboard/knowledge/bundles - List all bundles
 * POST /api/dashboard/knowledge/bundles - Create new bundle
 * PUT /api/dashboard/knowledge/bundles - Update bundle
 * DELETE /api/dashboard/knowledge/bundles?id=xxx - Delete bundle
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

// Validation helpers
function validateUuidArray(arr: unknown[]): { valid: boolean; error?: string } {
  for (const item of arr) {
    if (!isValidUUID(item)) {
      return { valid: false, error: "Invalid service ID format" };
    }
  }
  // Check for duplicates
  const uniqueIds = new Set(arr);
  if (uniqueIds.size !== arr.length) {
    return { valid: false, error: "Duplicate service IDs are not allowed" };
  }
  return { valid: true };
}

// =============================================================================
// GET Handler - List all bundles
// =============================================================================

async function handleGet(
  _request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    // Fetch bundles with their services
    const { data: bundles, error } = await (supabase as ReturnType<typeof supabase.from>)
      .from("bundles")
      .select(`
        id,
        name,
        description,
        discount_percent,
        pitch_message,
        is_active,
        times_offered,
        times_accepted,
        bundle_services(
          service_id,
          sort_order,
          service:services(id, name, duration_minutes, price_cents)
        )
      `)
      .eq("business_id", business.id)
      .order("created_at", { ascending: false });

    if (error) {
      logError("Bundles GET", error);
      return errors.internalError("Failed to fetch bundles");
    }

    // Define types for the joined query result
    type BundleServiceWithService = {
      service_id: string;
      sort_order: number;
      service: { id: string; name: string; duration_minutes: number; price_cents: number | null } | null;
    };
    type BundleWithServices = {
      id: string;
      name: string;
      description: string | null;
      discount_percent: number;
      pitch_message: string | null;
      is_active: boolean;
      times_offered: number;
      times_accepted: number;
      bundle_services: BundleServiceWithService[] | null;
    };

    // Transform the response to flatten services
    const transformedBundles = ((bundles || []) as BundleWithServices[]).map((bundle) => ({
      ...bundle,
      services: (bundle.bundle_services || [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((bs) => bs.service)
        .filter(Boolean),
      bundle_services: undefined,
    }));

    return success({ bundles: transformedBundles });
  } catch (error) {
    logError("Bundles GET", error);
    return errors.internalError("Failed to fetch bundles");
  }
}

// =============================================================================
// POST Handler - Create a new bundle
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
      discount_percent = 0,
      pitch_message,
      service_ids = [],
      is_active = true,
    } = body;

    // Validate required fields
    if (!name?.trim()) {
      return errors.badRequest("Bundle name is required");
    }

    // Validate field lengths
    const nameLengthError = validateStringLength(name, LIMITS.MAX_NAME_LENGTH, "Bundle name");
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

    if (!Array.isArray(service_ids) || service_ids.length < LIMITS.MIN_SERVICES_PER_BUNDLE) {
      return errors.badRequest(`Bundle must include at least ${LIMITS.MIN_SERVICES_PER_BUNDLE} services`);
    }

    // Validate UUID format and check for duplicates
    const uuidValidation = validateUuidArray(service_ids);
    if (!uuidValidation.valid) {
      return errors.badRequest(uuidValidation.error || "Invalid service IDs");
    }

    // Validate discount_percent
    if (!Number.isInteger(discount_percent) || discount_percent < 0 || discount_percent > 100) {
      return errors.badRequest("Discount percent must be a whole number between 0 and 100");
    }

    // Check bundle count limit
    const { count: bundleCount } = await (supabase as ReturnType<typeof supabase.from>)
      .from("bundles")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id);

    if ((bundleCount || 0) >= LIMITS.MAX_BUNDLES_PER_BUSINESS) {
      return errors.badRequest(`Maximum of ${LIMITS.MAX_BUNDLES_PER_BUSINESS} bundles allowed. Delete some before creating new ones.`);
    }

    // Validate all service IDs belong to this business
    const { data: services } = await supabase
      .from("services")
      .select("id")
      .eq("business_id", business.id)
      .in("id", service_ids);

    if (!services || services.length !== service_ids.length) {
      return errors.badRequest("One or more services not found or do not belong to your business");
    }

    // Create bundle
    const { data: bundle, error: bundleError } = await (supabase as ReturnType<typeof supabase.from>)
      .from("bundles")
      .insert({
        business_id: business.id,
        name: name.trim(),
        description: description?.trim() || null,
        discount_percent,
        pitch_message: pitch_message?.trim() || null,
        is_active,
      })
      .select()
      .single();

    if (bundleError) {
      logError("Bundles POST", bundleError);
      return errors.internalError("Failed to create bundle");
    }

    // Create bundle_services entries
    const bundleServicesData = service_ids.map((serviceId: string, index: number) => ({
      bundle_id: bundle.id,
      service_id: serviceId,
      sort_order: index,
    }));

    const { error: servicesError } = await (supabase as ReturnType<typeof supabase.from>)
      .from("bundle_services")
      .insert(bundleServicesData);

    if (servicesError) {
      logError("Bundles POST Services", servicesError);
      // Clean up the bundle if services failed
      const { error: cleanupError } = await (supabase as ReturnType<typeof supabase.from>)
        .from("bundles")
        .delete()
        .eq("id", bundle.id);

      if (cleanupError) {
        logError(`Bundles POST Cleanup orphaned bundle ${bundle.id}`, cleanupError);
      }
      return errors.internalError("Failed to create bundle services. Please try again.");
    }

    // Trigger prompt regeneration
    let regenerationQueued = false;
    try {
      await inngest.send({
        name: "prompt/regeneration.requested",
        data: {
          businessId: business.id,
          triggeredBy: "bundles_update",
        },
      });
      regenerationQueued = true;
    } catch (inngestError) {
      logError("Bundles POST Inngest", inngestError);
    }

    return success({
      bundle,
      regenerationQueued,
    });
  } catch (error) {
    logError("Bundles POST", error);
    return errors.internalError("Failed to create bundle");
  }
}

// =============================================================================
// PUT Handler - Update a bundle
// =============================================================================

async function handlePut(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    const body = await request.json();
    const { bundle } = body;

    if (!bundle || !bundle.id) {
      return errors.badRequest("Bundle ID required");
    }

    if (!isValidUUID(bundle.id)) {
      return errors.badRequest("Invalid bundle ID format");
    }

    // Verify bundle exists and belongs to business
    const { data: existingBundle, error: fetchError } = await (supabase as ReturnType<typeof supabase.from>)
      .from("bundles")
      .select("id")
      .eq("id", bundle.id)
      .eq("business_id", business.id)
      .single();

    if (fetchError || !existingBundle) {
      return errors.notFound("Bundle");
    }

    // Validate name if provided
    if (bundle.name !== undefined && !bundle.name?.trim()) {
      return errors.badRequest("Bundle name is required");
    }

    // Validate field lengths
    if (bundle.name) {
      const nameLengthError = validateStringLength(bundle.name, LIMITS.MAX_NAME_LENGTH, "Bundle name");
      if (nameLengthError) {
        return errors.badRequest(nameLengthError);
      }
    }

    if (bundle.description) {
      const descLengthError = validateStringLength(bundle.description, LIMITS.MAX_DESCRIPTION_LENGTH, "Description");
      if (descLengthError) {
        return errors.badRequest(descLengthError);
      }
    }

    if (bundle.pitch_message) {
      const pitchLengthError = validateStringLength(bundle.pitch_message, LIMITS.MAX_PITCH_LENGTH, "Pitch message");
      if (pitchLengthError) {
        return errors.badRequest(pitchLengthError);
      }
    }

    // If service_ids provided, validate and update them
    if (bundle.service_ids) {
      if (!Array.isArray(bundle.service_ids) || bundle.service_ids.length < LIMITS.MIN_SERVICES_PER_BUNDLE) {
        return errors.badRequest(`Bundle must include at least ${LIMITS.MIN_SERVICES_PER_BUNDLE} services`);
      }

      // Validate UUID format and check for duplicates
      const uuidValidation = validateUuidArray(bundle.service_ids);
      if (!uuidValidation.valid) {
        return errors.badRequest(uuidValidation.error || "Invalid service IDs");
      }

      const { data: services } = await supabase
        .from("services")
        .select("id")
        .eq("business_id", business.id)
        .in("id", bundle.service_ids);

      if (!services || services.length !== bundle.service_ids.length) {
        return errors.badRequest("One or more services not found or do not belong to your business");
      }

      // Save existing services before delete so we can restore on failure
      const { data: existingServices } = await (supabase as ReturnType<typeof supabase.from>)
        .from("bundle_services")
        .select("service_id, sort_order")
        .eq("bundle_id", bundle.id);

      // Delete existing services
      const { error: deleteError } = await (supabase as ReturnType<typeof supabase.from>)
        .from("bundle_services")
        .delete()
        .eq("bundle_id", bundle.id);

      if (deleteError) {
        logError("Bundles PUT Delete services", deleteError);
        return errors.internalError("Failed to update bundle services");
      }

      // Insert new services
      const bundleServicesData = bundle.service_ids.map((serviceId: string, index: number) => ({
        bundle_id: bundle.id,
        service_id: serviceId,
        sort_order: index,
      }));

      const { error: servicesError } = await (supabase as ReturnType<typeof supabase.from>)
        .from("bundle_services")
        .insert(bundleServicesData);

      if (servicesError) {
        logError("Bundles PUT Insert services", servicesError);
        // Try to restore the original services
        if (existingServices && existingServices.length > 0) {
          const restoreData = existingServices.map((s: { service_id: string; sort_order: number }) => ({
            bundle_id: bundle.id,
            service_id: s.service_id,
            sort_order: s.sort_order,
          }));
          const { error: restoreError } = await (supabase as ReturnType<typeof supabase.from>)
            .from("bundle_services")
            .insert(restoreData);
          if (restoreError) {
            logError("Bundles PUT Restore services", restoreError);
            // If restore fails, deactivate the bundle to prevent inconsistent state
            await (supabase as ReturnType<typeof supabase.from>)
              .from("bundles")
              .update({ is_active: false })
              .eq("id", bundle.id);
            logError(`Bundles PUT Deactivated bundle ${bundle.id}`, new Error("Bundle deactivated due to restore failure"));
            return errors.internalError("Failed to update bundle services. Bundle has been deactivated for safety. Please re-add services manually.");
          }
        }
        return errors.internalError("Failed to update bundle services. Please try again.");
      }
    }

    // Validate discount_percent if provided
    if (bundle.discount_percent !== undefined) {
      if (!Number.isInteger(bundle.discount_percent) || bundle.discount_percent < 0 || bundle.discount_percent > 100) {
        return errors.badRequest("Discount percent must be a whole number between 0 and 100");
      }
    }

    // Validate is_active is boolean
    if (bundle.is_active !== undefined && typeof bundle.is_active !== "boolean") {
      return errors.badRequest("is_active must be a boolean value");
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (bundle.name !== undefined) updateData.name = bundle.name.trim();
    if (bundle.description !== undefined) updateData.description = bundle.description?.trim() || null;
    if (bundle.discount_percent !== undefined) updateData.discount_percent = bundle.discount_percent;
    if (bundle.pitch_message !== undefined) updateData.pitch_message = bundle.pitch_message?.trim() || null;
    if (bundle.is_active !== undefined) updateData.is_active = bundle.is_active;

    // Update bundle (only if there are fields to update)
    if (Object.keys(updateData).length > 0) {
      const { error } = await (supabase as ReturnType<typeof supabase.from>)
        .from("bundles")
        .update(updateData)
        .eq("id", bundle.id)
        .eq("business_id", business.id);

      if (error) {
        logError("Bundles PUT", error);
        return errors.internalError("Failed to update bundle");
      }
    }

    // Trigger prompt regeneration
    let regenerationQueued = false;
    try {
      await inngest.send({
        name: "prompt/regeneration.requested",
        data: {
          businessId: business.id,
          triggeredBy: "bundles_update",
        },
      });
      regenerationQueued = true;
    } catch (inngestError) {
      logError("Bundles PUT Inngest", inngestError);
    }

    return success({ regenerationQueued });
  } catch (error) {
    logError("Bundles PUT", error);
    return errors.internalError("Failed to update bundle");
  }
}

// =============================================================================
// DELETE Handler - Delete a bundle
// =============================================================================

async function handleDelete(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    const { searchParams } = new URL(request.url);
    const bundleId = searchParams.get("id");

    if (!bundleId) {
      return errors.badRequest("Bundle ID required");
    }

    if (!isValidUUID(bundleId)) {
      return errors.badRequest("Invalid bundle ID format");
    }

    // Delete bundle (cascade will delete bundle_services)
    const { data: deletedRows, error } = await (supabase as ReturnType<typeof supabase.from>)
      .from("bundles")
      .delete()
      .eq("id", bundleId)
      .eq("business_id", business.id)
      .select();

    if (error) {
      logError("Bundles DELETE", error);
      return errors.internalError("Failed to delete bundle");
    }

    if (!deletedRows || deletedRows.length === 0) {
      return errors.notFound("Bundle");
    }

    // Trigger prompt regeneration
    let regenerationQueued = false;
    try {
      await inngest.send({
        name: "prompt/regeneration.requested",
        data: {
          businessId: business.id,
          triggeredBy: "bundles_update",
        },
      });
      regenerationQueued = true;
    } catch (inngestError) {
      logError("Bundles DELETE Inngest", inngestError);
    }

    return success({ regenerationQueued });
  } catch (error) {
    logError("Bundles DELETE", error);
    return errors.internalError("Failed to delete bundle");
  }
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
export const PUT = withAuth(handlePut);
export const DELETE = withAuth(handleDelete);
