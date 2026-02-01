/**
 * Service Availability API Route
 * Manages per-service availability overrides
 *
 * GET /api/dashboard/settings/availability/services - Get service availability
 * PUT /api/dashboard/settings/availability/services - Update service availability
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { getServices, getServiceById } from "@/lib/db/core";
import {
  getServiceAvailability,
  updateServiceAvailability,
  setServiceUseBusinessHours,
} from "@/lib/db/availability";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/settings/availability/services
 * Get service availability for all services or a specific service
 */
async function handleGet(
  request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get("serviceId");

    if (serviceId) {
      // Get availability for a specific service
      const service = await getServiceById(serviceId);
      if (!service || service.business_id !== business.id) {
        return errors.notFound("Service");
      }

      const availability = await getServiceAvailability(serviceId);

      return success({
        service,
        availability,
        usesBusinessHours: availability.length === 0 || availability.every(a => a.use_business_hours),
      });
    }

    // Get all services with their availability
    const services = await getServices(business.id);
    const servicesWithAvailability = await Promise.all(
      services.map(async (service) => {
        const availability = await getServiceAvailability(service.id);
        return {
          service,
          availability,
          usesBusinessHours: availability.length === 0 || availability.every(a => a.use_business_hours),
        };
      })
    );

    return success(servicesWithAvailability);
  } catch (error) {
    logError("Service Availability GET", error);
    return errors.internalError("Failed to fetch service availability");
  }
}

/**
 * PUT /api/dashboard/settings/availability/services
 * Update service availability
 */
async function handlePut(
  request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    const body = await request.json();
    const { serviceId, useBusinessHours, availability } = body;

    // Validate service ID
    if (!serviceId || typeof serviceId !== "string") {
      return errors.badRequest("Service ID is required");
    }

    // Verify the service belongs to this business
    const service = await getServiceById(serviceId);
    if (!service || service.business_id !== business.id) {
      return errors.notFound("Service");
    }

    // If using business hours, clear custom availability
    if (useBusinessHours === true) {
      await setServiceUseBusinessHours(serviceId);

      return success({
        service,
        availability: [],
        usesBusinessHours: true,
        message: "Service will now use business hours",
      });
    }

    // Otherwise, update custom availability
    if (!availability || !Array.isArray(availability)) {
      return errors.badRequest("Availability array is required when not using business hours");
    }

    // Validate each day entry
    for (const day of availability) {
      if (typeof day.day_of_week !== "number" || day.day_of_week < 0 || day.day_of_week > 6) {
        return errors.badRequest("Invalid day_of_week. Must be 0-6 (Sunday-Saturday)");
      }

      if (!day.is_closed && !day.use_business_hours) {
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

    // Update service availability
    const updatedAvailability = await updateServiceAvailability(serviceId, availability);

    return success({
      service,
      availability: updatedAvailability,
      usesBusinessHours: false,
      message: "Service availability updated successfully",
    });
  } catch (error) {
    logError("Service Availability PUT", error);
    return errors.internalError("Failed to update service availability");
  }
}

export const GET = withAuth(handleGet);
export const PUT = withAuth(handlePut);
