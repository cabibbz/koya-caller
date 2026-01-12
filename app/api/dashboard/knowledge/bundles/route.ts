/**
 * Bundles Knowledge API Route
 * Manages service bundle offers for the AI phone receptionist
 *
 * GET /api/dashboard/knowledge/bundles - List all bundles
 * POST /api/dashboard/knowledge/bundles - Create new bundle
 * PUT /api/dashboard/knowledge/bundles - Update bundle
 * DELETE /api/dashboard/knowledge/bundles?id=xxx - Delete bundle
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { inngest } from "@/lib/inngest/client";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Field length limits
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_PITCH_LENGTH = 300;
const MAX_BUNDLES_PER_BUSINESS = 10;
const MIN_SERVICES_PER_BUNDLE = 2;

// Validation helpers
function validateUuidArray(arr: unknown[]): { valid: boolean; error?: string } {
  for (const item of arr) {
    if (typeof item !== "string" || !UUID_REGEX.test(item)) {
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

function validateStringLength(value: string | undefined, maxLength: number, fieldName: string): string | null {
  if (value && value.trim().length > maxLength) {
    return `${fieldName} must be ${maxLength} characters or less`;
  }
  return null;
}

// GET - List all bundles for the business
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

    // Fetch bundles with their services
    // Note: Using 'as any' due to Supabase RLS type limitations with joined queries
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
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Bundles GET] Error:", error);
      return NextResponse.json({ error: "Failed to fetch bundles" }, { status: 500 });
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

    return NextResponse.json({ bundles: transformedBundles });
  } catch (error) {
    console.error("[Bundles GET] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Create a new bundle
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
      discount_percent = 0,
      pitch_message,
      service_ids = [],
      is_active = true,
    } = body;

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Bundle name is required" },
        { status: 400 }
      );
    }

    // Validate field lengths
    const nameLengthError = validateStringLength(name, MAX_NAME_LENGTH, "Bundle name");
    if (nameLengthError) {
      return NextResponse.json({ error: nameLengthError }, { status: 400 });
    }

    const descLengthError = validateStringLength(description, MAX_DESCRIPTION_LENGTH, "Description");
    if (descLengthError) {
      return NextResponse.json({ error: descLengthError }, { status: 400 });
    }

    const pitchLengthError = validateStringLength(pitch_message, MAX_PITCH_LENGTH, "Pitch message");
    if (pitchLengthError) {
      return NextResponse.json({ error: pitchLengthError }, { status: 400 });
    }

    if (!Array.isArray(service_ids) || service_ids.length < MIN_SERVICES_PER_BUNDLE) {
      return NextResponse.json(
        { error: `Bundle must include at least ${MIN_SERVICES_PER_BUNDLE} services` },
        { status: 400 }
      );
    }

    // Validate UUID format and check for duplicates
    const uuidValidation = validateUuidArray(service_ids);
    if (!uuidValidation.valid) {
      return NextResponse.json({ error: uuidValidation.error }, { status: 400 });
    }

    // Validate discount_percent (reject invalid values instead of silent clamp)
    if (!Number.isInteger(discount_percent) || discount_percent < 0 || discount_percent > 100) {
      return NextResponse.json(
        { error: "Discount percent must be a whole number between 0 and 100" },
        { status: 400 }
      );
    }

    // Check bundle count limit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: bundleCount } = await (supabase as any)
      .from("bundles")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId);

    if ((bundleCount || 0) >= MAX_BUNDLES_PER_BUSINESS) {
      return NextResponse.json(
        { error: `Maximum of ${MAX_BUNDLES_PER_BUSINESS} bundles allowed. Delete some before creating new ones.` },
        { status: 400 }
      );
    }

    // Validate all service IDs belong to this business
    const { data: services } = await supabase
      .from("services")
      .select("id")
      .eq("business_id", businessId)
      .in("id", service_ids);

    if (!services || services.length !== service_ids.length) {
      return NextResponse.json(
        { error: "One or more services not found or do not belong to your business" },
        { status: 400 }
      );
    }

    // Create bundle
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bundle, error: bundleError } = await (supabase as any)
      .from("bundles")
      .insert({
        business_id: businessId,
        name: name.trim(),
        description: description?.trim() || null,
        discount_percent,
        pitch_message: pitch_message?.trim() || null,
        is_active,
      })
      .select()
      .single();

    if (bundleError) {
      console.error("[Bundles POST] Error:", bundleError);
      return NextResponse.json({ error: "Failed to create bundle" }, { status: 500 });
    }

    // Create bundle_services entries
    const bundleServicesData = service_ids.map((serviceId: string, index: number) => ({
      bundle_id: bundle.id,
      service_id: serviceId,
      sort_order: index,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: servicesError } = await (supabase as any)
      .from("bundle_services")
      .insert(bundleServicesData);

    if (servicesError) {
      console.error("[Bundles POST] Services error:", servicesError);
      // Clean up the bundle if services failed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: cleanupError } = await (supabase as any)
        .from("bundles")
        .delete()
        .eq("id", bundle.id);

      if (cleanupError) {
        console.error("[Bundles POST] Cleanup failed - orphaned bundle:", bundle.id, cleanupError);
      }
      return NextResponse.json({ error: "Failed to create bundle services. Please try again." }, { status: 500 });
    }

    // Trigger prompt regeneration
    let regenerationQueued = false;
    try {
      await inngest.send({
        name: "prompt/regeneration.requested",
        data: {
          businessId,
          triggeredBy: "bundles_update",
        },
      });
      regenerationQueued = true;
    } catch (inngestError) {
      console.error("[Bundles POST] Inngest error:", inngestError);
    }

    return NextResponse.json({
      success: true,
      bundle,
      regenerationQueued,
    });
  } catch (error) {
    console.error("[Bundles POST] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT - Update a bundle
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
    const { bundle } = body;

    if (!bundle || !bundle.id) {
      return NextResponse.json({ error: "Bundle ID required" }, { status: 400 });
    }

    if (!UUID_REGEX.test(bundle.id)) {
      return NextResponse.json({ error: "Invalid bundle ID format" }, { status: 400 });
    }

    // Verify bundle exists and belongs to business
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingBundle, error: fetchError } = await (supabase as any)
      .from("bundles")
      .select("id")
      .eq("id", bundle.id)
      .eq("business_id", businessId)
      .single();

    if (fetchError || !existingBundle) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }

    // Validate name if provided
    if (bundle.name !== undefined && !bundle.name?.trim()) {
      return NextResponse.json(
        { error: "Bundle name is required" },
        { status: 400 }
      );
    }

    // Validate field lengths
    if (bundle.name) {
      const nameLengthError = validateStringLength(bundle.name, MAX_NAME_LENGTH, "Bundle name");
      if (nameLengthError) {
        return NextResponse.json({ error: nameLengthError }, { status: 400 });
      }
    }

    if (bundle.description) {
      const descLengthError = validateStringLength(bundle.description, MAX_DESCRIPTION_LENGTH, "Description");
      if (descLengthError) {
        return NextResponse.json({ error: descLengthError }, { status: 400 });
      }
    }

    if (bundle.pitch_message) {
      const pitchLengthError = validateStringLength(bundle.pitch_message, MAX_PITCH_LENGTH, "Pitch message");
      if (pitchLengthError) {
        return NextResponse.json({ error: pitchLengthError }, { status: 400 });
      }
    }

    // If service_ids provided, validate and update them
    if (bundle.service_ids) {
      if (!Array.isArray(bundle.service_ids) || bundle.service_ids.length < MIN_SERVICES_PER_BUNDLE) {
        return NextResponse.json(
          { error: `Bundle must include at least ${MIN_SERVICES_PER_BUNDLE} services` },
          { status: 400 }
        );
      }

      // Validate UUID format and check for duplicates
      const uuidValidation = validateUuidArray(bundle.service_ids);
      if (!uuidValidation.valid) {
        return NextResponse.json({ error: uuidValidation.error }, { status: 400 });
      }

      const { data: services } = await supabase
        .from("services")
        .select("id")
        .eq("business_id", businessId)
        .in("id", bundle.service_ids);

      if (!services || services.length !== bundle.service_ids.length) {
        return NextResponse.json(
          { error: "One or more services not found or do not belong to your business" },
          { status: 400 }
        );
      }

      // RACE CONDITION FIX: Save existing services before delete so we can restore on failure
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingServices } = await (supabase as any)
        .from("bundle_services")
        .select("service_id, sort_order")
        .eq("bundle_id", bundle.id);

      // Delete existing services
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: deleteError } = await (supabase as any)
        .from("bundle_services")
        .delete()
        .eq("bundle_id", bundle.id);

      if (deleteError) {
        console.error("[Bundles PUT] Delete services error:", deleteError);
        return NextResponse.json({ error: "Failed to update bundle services" }, { status: 500 });
      }

      // Insert new services
      const bundleServicesData = bundle.service_ids.map((serviceId: string, index: number) => ({
        bundle_id: bundle.id,
        service_id: serviceId,
        sort_order: index,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: servicesError } = await (supabase as any)
        .from("bundle_services")
        .insert(bundleServicesData);

      if (servicesError) {
        console.error("[Bundles PUT] Insert services error:", servicesError);
        // RESTORE: Try to restore the original services
        if (existingServices && existingServices.length > 0) {
          const restoreData = existingServices.map((s: { service_id: string; sort_order: number }) => ({
            bundle_id: bundle.id,
            service_id: s.service_id,
            sort_order: s.sort_order,
          }));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: restoreError } = await (supabase as any)
            .from("bundle_services")
            .insert(restoreData);
          if (restoreError) {
            console.error("[Bundles PUT] Failed to restore services:", restoreError);
            // If restore fails, deactivate the bundle to prevent inconsistent state
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
              .from("bundles")
              .update({ is_active: false })
              .eq("id", bundle.id);
            console.error("[Bundles PUT] Bundle deactivated due to restore failure:", bundle.id);
            return NextResponse.json({ error: "Failed to update bundle services. Bundle has been deactivated for safety. Please re-add services manually." }, { status: 500 });
          }
        }
        return NextResponse.json({ error: "Failed to update bundle services. Please try again." }, { status: 500 });
      }
    }

    // Validate discount_percent if provided (reject invalid values instead of silent clamp)
    if (bundle.discount_percent !== undefined) {
      if (!Number.isInteger(bundle.discount_percent) || bundle.discount_percent < 0 || bundle.discount_percent > 100) {
        return NextResponse.json(
          { error: "Discount percent must be a whole number between 0 and 100" },
          { status: 400 }
        );
      }
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("bundles")
        .update(updateData)
        .eq("id", bundle.id)
        .eq("business_id", businessId);

      if (error) {
        console.error("[Bundles PUT] Error:", error);
        return NextResponse.json({ error: "Failed to update bundle" }, { status: 500 });
      }
    }

    // Trigger prompt regeneration
    let regenerationQueued = false;
    try {
      await inngest.send({
        name: "prompt/regeneration.requested",
        data: {
          businessId,
          triggeredBy: "bundles_update",
        },
      });
      regenerationQueued = true;
    } catch (inngestError) {
      console.error("[Bundles PUT] Inngest error:", inngestError);
    }

    return NextResponse.json({ success: true, regenerationQueued });
  } catch (error) {
    console.error("[Bundles PUT] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Delete a bundle
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
    const bundleId = searchParams.get("id");

    if (!bundleId) {
      return NextResponse.json({ error: "Bundle ID required" }, { status: 400 });
    }

    if (!UUID_REGEX.test(bundleId)) {
      return NextResponse.json({ error: "Invalid bundle ID format" }, { status: 400 });
    }

    // Delete bundle (cascade will delete bundle_services)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: deletedRows, error } = await (supabase as any)
      .from("bundles")
      .delete()
      .eq("id", bundleId)
      .eq("business_id", businessId)
      .select();

    if (error) {
      console.error("[Bundles DELETE] Error:", error);
      return NextResponse.json({ error: "Failed to delete bundle" }, { status: 500 });
    }

    if (!deletedRows || deletedRows.length === 0) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }

    // Trigger prompt regeneration
    let regenerationQueued = false;
    try {
      await inngest.send({
        name: "prompt/regeneration.requested",
        data: {
          businessId,
          triggeredBy: "bundles_update",
        },
      });
      regenerationQueued = true;
    } catch (inngestError) {
      console.error("[Bundles DELETE] Inngest error:", inngestError);
    }

    return NextResponse.json({ success: true, regenerationQueued });
  } catch (error) {
    console.error("[Bundles DELETE] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
