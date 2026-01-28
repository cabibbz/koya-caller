/**
 * API Key Stats Route
 * Get usage statistics for an API key
 *
 * GET /api/dashboard/settings/api-keys/[id]/stats - Get usage statistics
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { getApiKeyById, getApiKeyUsageStats } from "@/lib/db/api-keys";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/dashboard/settings/api-keys/[id]/stats
 * Get usage statistics for an API key (last 7 days by default)
 */
async function handleGet(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext,
  context?: RouteContext
) {
  try {
    if (!context) {
      return errors.badRequest("Invalid request");
    }
    const { id } = await context.params;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apiKey = await getApiKeyById(supabase as any, id);

    if (!apiKey) {
      return errors.notFound("API key");
    }

    // Verify ownership
    if (apiKey.business_id !== business.id) {
      return errors.forbidden("Not authorized to access this API key");
    }

    // Get days parameter from URL (default 7)
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get("days");
    const days = daysParam ? parseInt(daysParam, 10) : 7;

    // Validate days parameter
    if (isNaN(days) || days < 1 || days > 90) {
      return errors.badRequest("Days parameter must be between 1 and 90");
    }

    // Get usage statistics
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stats = await getApiKeyUsageStats(supabase as any, id, days);

    return success(stats);
  } catch (error) {
    logError("API Key Stats GET", error);
    return errors.internalError("Failed to fetch API key statistics");
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GET = withAuth(handleGet as any);
