/**
 * Services Knowledge API Route
 * Session 17: Dashboard - Appointments & Knowledge
 * Spec Reference: Part 7, Lines 722-727
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
import { z } from "zod";

// Input validation schema for Services
const serviceSchema = z.object({
  name: z.string()
    .min(1, "Service name is required")
    .max(200, "Service name must be 200 characters or less")
    .trim(),
  description: z.string()
    .max(2000, "Description must be 2000 characters or less")
    .trim()
    .optional()
    .nullable(),
  duration_minutes: z.number()
    .int("Duration must be a whole number")
    .min(1, "Duration must be at least 1 minute")
    .max(1440, "Duration must be 1440 minutes or less")
    .optional()
    .default(60),
  price_cents: z.number()
    .int("Price must be in whole cents")
    .min(0, "Price cannot be negative")
    .max(100000000, "Price must be $1,000,000 or less")
    .optional()
    .nullable(),
  price_type: z.enum(["fixed", "starting_at", "quote"])
    .optional()
    .default("quote"),
  is_bookable: z.boolean()
    .optional()
    .default(true),
});

const servicesRequestSchema = z.object({
  services: z.array(serviceSchema)
    .max(100, "Maximum 100 services allowed"),
});

async function handlePut(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    const body = await request.json();

    // Validate input with Zod
    const validationResult = servicesRequestSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors
        .map(e => e.message)
        .join(", ");
      return errors.badRequest(`Validation failed: ${errorMessages}`);
    }

    const { services } = validationResult.data;

    // Delete existing services
    const { error: deleteError } = await supabase
      .from("services")
      .delete()
      .eq("business_id", business.id);

    if (deleteError) {
      return errors.internalError("Failed to update services");
    }

    // Insert new services
    if (services.length > 0) {
      const servicesToInsert = services.map((s, index) => ({
        business_id: business.id,
        name: s.name,
        description: s.description || null,
        duration_minutes: s.duration_minutes,
        price_cents: s.price_cents ?? null,
        price_type: s.price_type,
        is_bookable: s.is_bookable,
        sort_order: index,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
      const { error: insertError } = await (supabase as any)
        .from("services")
        .insert(servicesToInsert);

      if (insertError) {
        return errors.internalError("Failed to save services");
      }
    }

    // Trigger Retell AI sync via prompt regeneration
    await inngest.send({
      name: "prompt/regeneration.requested",
      data: {
        businessId: business.id,
        triggeredBy: "services_update",
      },
    });

    return success({ updated: true });
  } catch (error) {
    logError("Knowledge Services PUT", error);
    return errors.internalError("Failed to update services");
  }
}

export const PUT = withAuth(handlePut);
