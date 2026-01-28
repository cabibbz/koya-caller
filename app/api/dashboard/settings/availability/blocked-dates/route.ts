/**
 * Blocked Dates API Route
 * Manages holiday/vacation blocking
 *
 * GET /api/dashboard/settings/availability/blocked-dates - Get all blocked dates
 * POST /api/dashboard/settings/availability/blocked-dates - Add a blocked date
 * DELETE /api/dashboard/settings/availability/blocked-dates - Remove a blocked date
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import {
  getBlockedDates,
  addBlockedDate,
  removeBlockedDate,
} from "@/lib/db/availability";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/settings/availability/blocked-dates
 * Get all blocked dates for the authenticated user's business
 */
async function handleGet(
  _request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    const blockedDates = await getBlockedDates(business.id);

    return success(blockedDates);
  } catch (error) {
    logError("Blocked Dates GET", error);
    return errors.internalError("Failed to fetch blocked dates");
  }
}

/**
 * POST /api/dashboard/settings/availability/blocked-dates
 * Add a new blocked date
 */
async function handlePost(
  request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    const body = await request.json();
    const { date, reason, isRecurring } = body;

    // Validate date
    if (!date || typeof date !== "string") {
      return errors.badRequest("Date is required");
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return errors.badRequest("Invalid date format. Use YYYY-MM-DD format.");
    }

    // Validate date is valid
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return errors.badRequest("Invalid date");
    }

    // Add blocked date
    const blockedDate = await addBlockedDate(
      business.id,
      date,
      reason || null,
      isRecurring || false
    );

    return success(blockedDate);
  } catch (error) {
    // Handle unique constraint violation (date already blocked)
    if (error instanceof Error && error.message.includes("duplicate")) {
      return errors.conflict("This date is already blocked");
    }

    logError("Blocked Dates POST", error);
    return errors.internalError("Failed to add blocked date");
  }
}

/**
 * DELETE /api/dashboard/settings/availability/blocked-dates
 * Remove a blocked date by ID
 */
async function handleDelete(
  request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    const { searchParams } = new URL(request.url);
    const blockedDateId = searchParams.get("id");

    if (!blockedDateId) {
      return errors.badRequest("Blocked date ID is required");
    }

    // Verify the blocked date belongs to this business
    const blockedDates = await getBlockedDates(business.id);
    const blockedDate = blockedDates.find((bd) => bd.id === blockedDateId);

    if (!blockedDate) {
      return errors.notFound("Blocked date");
    }

    // Remove blocked date
    await removeBlockedDate(blockedDateId);

    return success({ message: "Blocked date removed successfully" });
  } catch (error) {
    logError("Blocked Dates DELETE", error);
    return errors.internalError("Failed to remove blocked date");
  }
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
export const DELETE = withAuth(handleDelete);
