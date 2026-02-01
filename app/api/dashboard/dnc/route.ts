/**
 * Do-Not-Call (DNC) List API Route
 * /api/dashboard/dnc
 *
 * GET: List DNC entries with pagination
 * POST: Add number to DNC
 * DELETE: Remove from DNC
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { getDNCList, addToDNC, removeFromDNC, checkDNC } from "@/lib/outbound";
import { logError, logInfo } from "@/lib/logging";
import { toE164, isValidE164 } from "@/lib/utils/phone";

export const dynamic = "force-dynamic";

// =============================================================================
// GET Handler - List DNC entries
// =============================================================================

async function handleGet(
  request: NextRequest,
  { business, user }: BusinessAuthContext
) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const parsedLimit = parseInt(searchParams.get("limit") || "50", 10);
    const parsedOffset = parseInt(searchParams.get("offset") || "0", 10);
    const search = searchParams.get("search") || undefined;

    // Validate pagination - handle NaN and out-of-range values
    const limit = Number.isNaN(parsedLimit) || parsedLimit < 1 ? 50 : Math.min(parsedLimit, 100);
    const offset = Number.isNaN(parsedOffset) || parsedOffset < 0 ? 0 : parsedOffset;

    // Get DNC list
    const { entries, total } = await getDNCList(business.id, {
      limit,
      offset,
      search,
    });

    return success({
      entries,
      total,
      limit,
      offset,
      hasMore: offset + entries.length < total,
    });
  } catch (error) {
    logError("DNC GET", error);
    return errors.internalError("Failed to fetch DNC list");
  }
}

// =============================================================================
// POST Handler - Add number to DNC
// =============================================================================

type DNCReason = "customer_request" | "complaint" | "legal" | "bounced" | "other";

const VALID_DNC_REASONS: DNCReason[] = ["customer_request", "complaint", "legal", "bounced", "other"];

interface AddDNCRequest {
  phone_number: string;
  reason: DNCReason;
}

async function handlePost(
  request: NextRequest,
  { business, user }: BusinessAuthContext
) {
  try {
    // Parse request body
    const body: AddDNCRequest = await request.json();

    // Validate required fields
    if (!body.phone_number) {
      return errors.badRequest("phone_number is required");
    }

    if (!body.reason || !VALID_DNC_REASONS.includes(body.reason)) {
      return errors.badRequest(`reason must be one of: ${VALID_DNC_REASONS.join(", ")}`);
    }

    // Normalize and validate phone number
    const phoneNumber = toE164(body.phone_number);
    if (!phoneNumber || !isValidE164(phoneNumber)) {
      return errors.badRequest("Invalid phone number format. Use E.164 format (+1XXXXXXXXXX)");
    }

    // Check if already on DNC
    const isDNC = await checkDNC(business.id, phoneNumber);
    if (isDNC) {
      return errors.conflict("Phone number is already on the DNC list");
    }

    // Add to DNC
    const result = await addToDNC(
      business.id,
      phoneNumber,
      body.reason,
      user.id
    );

    if (!result.success) {
      return errors.internalError(result.error || "Failed to add to DNC list");
    }

    logInfo(
      "DNC POST",
      `Added ${phoneNumber} to DNC for business ${business.id}`
    );

    return success({
      phone_number: phoneNumber,
      reason: body.reason,
      added_at: new Date().toISOString(),
    });
  } catch (error) {
    logError("DNC POST", error);
    return errors.internalError("Failed to add to DNC list");
  }
}

// =============================================================================
// DELETE Handler - Remove from DNC
// =============================================================================

async function handleDelete(
  request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    // Parse query parameters for phone number
    const { searchParams } = new URL(request.url);
    const phoneNumber = searchParams.get("phone_number");

    if (!phoneNumber) {
      return errors.badRequest("phone_number query parameter is required");
    }

    // Normalize and validate phone number
    const normalizedPhone = toE164(phoneNumber);
    if (!normalizedPhone || !isValidE164(normalizedPhone)) {
      return errors.badRequest("Invalid phone number format");
    }

    // Check if on DNC
    const isDNC = await checkDNC(business.id, normalizedPhone);
    if (!isDNC) {
      return errors.notFound("Phone number is not on the DNC list");
    }

    // Remove from DNC
    const result = await removeFromDNC(business.id, normalizedPhone);

    if (!result.success) {
      return errors.internalError(result.error || "Failed to remove from DNC list");
    }

    logInfo(
      "DNC DELETE",
      `Removed ${normalizedPhone} from DNC for business ${business.id}`
    );

    return success({
      phone_number: normalizedPhone,
      removed_at: new Date().toISOString(),
    });
  } catch (error) {
    logError("DNC DELETE", error);
    return errors.internalError("Failed to remove from DNC list");
  }
}

// Apply auth middleware with rate limiting: 60 req/min per user
export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
export const DELETE = withAuth(handleDelete);
