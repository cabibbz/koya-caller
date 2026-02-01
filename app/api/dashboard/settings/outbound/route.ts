/**
 * Outbound Settings API Route
 * /api/dashboard/settings/outbound
 *
 * GET: Fetch outbound settings (limits, hours, reminder config)
 * PUT: Update outbound settings
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { getOutboundSettings, updateOutboundSettings } from "@/lib/outbound";
import { logError, logInfo } from "@/lib/logging";

export const dynamic = "force-dynamic";

// =============================================================================
// GET Handler - Fetch outbound settings
// =============================================================================

async function handleGet(
  _request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    // Get outbound settings
    const settings = await getOutboundSettings(business.id);

    return success(settings);
  } catch (error) {
    logError("Outbound Settings GET", error);
    return errors.internalError("Failed to fetch outbound settings");
  }
}

// =============================================================================
// PUT Handler - Update outbound settings
// =============================================================================

interface UpdateSettingsRequest {
  outbound_enabled?: boolean;
  daily_limit?: number;
  outbound_hours_start?: string;
  outbound_hours_end?: string;
  outbound_days?: number[];
  reminder_24hr_enabled?: boolean;
  reminder_2hr_enabled?: boolean;
  reminder_message_template?: string | null;
  followup_enabled?: boolean;
  followup_delay_hours?: number;
}

async function handlePut(
  request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    // Parse request body
    const body: UpdateSettingsRequest = await request.json();

    // Validate fields
    if (body.daily_limit !== undefined) {
      if (typeof body.daily_limit !== "number" || body.daily_limit < 0 || body.daily_limit > 500) {
        return errors.badRequest("daily_limit must be a number between 0 and 500");
      }
    }

    if (body.outbound_hours_start !== undefined) {
      if (!/^\d{2}:\d{2}$/.test(body.outbound_hours_start)) {
        return errors.badRequest("outbound_hours_start must be in HH:MM format");
      }
    }

    if (body.outbound_hours_end !== undefined) {
      if (!/^\d{2}:\d{2}$/.test(body.outbound_hours_end)) {
        return errors.badRequest("outbound_hours_end must be in HH:MM format");
      }
    }

    if (body.outbound_days !== undefined) {
      if (!Array.isArray(body.outbound_days)) {
        return errors.badRequest("outbound_days must be an array of numbers (0-6)");
      }
      const validDays = body.outbound_days.every(
        (d) => typeof d === "number" && d >= 0 && d <= 6
      );
      if (!validDays) {
        return errors.badRequest("outbound_days must contain numbers between 0 and 6");
      }
    }

    if (body.followup_delay_hours !== undefined) {
      if (
        typeof body.followup_delay_hours !== "number" ||
        body.followup_delay_hours < 1 ||
        body.followup_delay_hours > 168
      ) {
        return errors.badRequest("followup_delay_hours must be between 1 and 168 (7 days)");
      }
    }

    // Build update object with only provided fields
    const updates: Partial<UpdateSettingsRequest> = {};

    if (body.outbound_enabled !== undefined) {
      updates.outbound_enabled = body.outbound_enabled;
    }
    if (body.daily_limit !== undefined) {
      updates.daily_limit = body.daily_limit;
    }
    if (body.outbound_hours_start !== undefined) {
      updates.outbound_hours_start = body.outbound_hours_start;
    }
    if (body.outbound_hours_end !== undefined) {
      updates.outbound_hours_end = body.outbound_hours_end;
    }
    if (body.outbound_days !== undefined) {
      updates.outbound_days = body.outbound_days;
    }
    if (body.reminder_24hr_enabled !== undefined) {
      updates.reminder_24hr_enabled = body.reminder_24hr_enabled;
    }
    if (body.reminder_2hr_enabled !== undefined) {
      updates.reminder_2hr_enabled = body.reminder_2hr_enabled;
    }
    if (body.reminder_message_template !== undefined) {
      updates.reminder_message_template = body.reminder_message_template;
    }
    if (body.followup_enabled !== undefined) {
      updates.followup_enabled = body.followup_enabled;
    }
    if (body.followup_delay_hours !== undefined) {
      updates.followup_delay_hours = body.followup_delay_hours;
    }

    if (Object.keys(updates).length === 0) {
      return errors.badRequest("No updates provided");
    }

    // Update settings
    const result = await updateOutboundSettings(business.id, updates);

    if (!result.success) {
      return errors.internalError(result.error || "Failed to update settings");
    }

    logInfo(
      "Outbound Settings PUT",
      `Updated outbound settings for business ${business.id}`
    );

    // Fetch and return updated settings
    const updatedSettings = await getOutboundSettings(business.id);

    return success(updatedSettings);
  } catch (error) {
    logError("Outbound Settings PUT", error);
    return errors.internalError("Failed to update outbound settings");
  }
}

export const GET = withAuth(handleGet);
export const PUT = withAuth(handlePut);
