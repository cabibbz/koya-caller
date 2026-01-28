/**
 * Availability Settings API Route
 * Manages business hours configuration
 *
 * GET /api/dashboard/settings/availability - Get business hours
 * PUT /api/dashboard/settings/availability - Update business hours
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import {
  getBusinessHoursById,
  updateBusinessHoursById,
} from "@/lib/db/availability";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/settings/availability
 * Get business hours for the authenticated user's business
 */
async function handleGet(
  _request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    const hours = await getBusinessHoursById(business.id);

    return success(hours);
  } catch (error) {
    logError("Availability GET", error);
    return errors.internalError("Failed to fetch business hours");
  }
}

/**
 * PUT /api/dashboard/settings/availability
 * Update business hours for the authenticated user's business
 */
async function handlePut(
  request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    const body = await request.json();
    const { hours } = body;

    // Validate hours array
    if (!hours || !Array.isArray(hours)) {
      return errors.badRequest("Hours array is required");
    }

    // Validate each day entry
    for (const day of hours) {
      if (typeof day.day_of_week !== "number" || day.day_of_week < 0 || day.day_of_week > 6) {
        return errors.badRequest("Invalid day_of_week. Must be 0-6 (Sunday-Saturday)");
      }

      if (!day.is_closed) {
        // Validate time format (HH:MM)
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (day.open_time && !timeRegex.test(day.open_time)) {
          return errors.badRequest(
            `Invalid open_time format for day ${day.day_of_week}. Use HH:MM format.`
          );
        }
        if (day.close_time && !timeRegex.test(day.close_time)) {
          return errors.badRequest(
            `Invalid close_time format for day ${day.day_of_week}. Use HH:MM format.`
          );
        }

        // Validate close time is after open time
        if (day.open_time && day.close_time && day.open_time >= day.close_time) {
          return errors.badRequest(`Close time must be after open time for day ${day.day_of_week}`);
        }
      }
    }

    // Update business hours
    await updateBusinessHoursById(business.id, hours);

    // Fetch updated hours
    const updatedHours = await getBusinessHoursById(business.id);

    return success({
      hours: updatedHours,
      message: "Business hours updated successfully",
    });
  } catch (error) {
    logError("Availability PUT", error);
    return errors.internalError("Failed to update business hours");
  }
}

export const GET = withAuth(handleGet);
export const PUT = withAuth(handlePut);
