/**
 * Business Info Knowledge API Route
 * Session 17: Dashboard - Appointments & Knowledge
 * Spec Reference: Part 7, Lines 735-741
 *
 * PUT: Update business info and hours
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

export const dynamic = "force-dynamic";

// =============================================================================
// PUT Handler - Update business info and hours
// =============================================================================

async function handlePut(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    const body = await request.json();
    const { business: businessUpdate, businessHours } = body;

    // Update business info
    if (businessUpdate) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from("businesses")
        .update({
          name: businessUpdate.name,
          address: businessUpdate.address || null,
          website: businessUpdate.website || null,
          service_area: businessUpdate.service_area || null,
          differentiator: businessUpdate.differentiator || null,
        })
        .eq("id", business.id);

      if (updateError) {
        logError("Knowledge Business PUT", updateError);
        return errors.internalError("Failed to update business");
      }
    }

    // Update business hours
    if (businessHours && Array.isArray(businessHours)) {
      // Delete existing hours
      const { error: deleteError } = await supabase
        .from("business_hours")
        .delete()
        .eq("business_id", business.id);

      if (deleteError) {
        logError("Knowledge Business PUT - Delete Hours", deleteError);
        return errors.internalError("Failed to update hours");
      }

      // Insert new hours
      if (businessHours.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hoursToInsert = businessHours.map((h: any) => ({
          business_id: business.id,
          day_of_week: h.day_of_week,
          is_closed: h.is_closed ?? false,
          open_time: h.open_time || null,
          close_time: h.close_time || null,
        }));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: insertError } = await (supabase as any)
          .from("business_hours")
          .insert(hoursToInsert);

        if (insertError) {
          logError("Knowledge Business PUT - Insert Hours", insertError);
          return errors.internalError("Failed to save hours");
        }
      }
    }

    // Trigger Retell AI sync via prompt regeneration
    await inngest.send({
      name: "prompt/regeneration.requested",
      data: {
        businessId: business.id,
        triggeredBy: "business_update",
      },
    });

    return success({ message: "Business info updated successfully" });
  } catch (error) {
    logError("Knowledge Business PUT", error);
    return errors.internalError("Failed to update business info");
  }
}

export const PUT = withAuth(handlePut);
