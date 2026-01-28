/**
 * Integration Status API Route
 * Returns the status of all external integrations
 *
 * GET /api/dashboard/integrations/status
 * Returns integration status for displaying in dashboard
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { getIntegrationsStatus } from "@/lib/integrations/status";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

async function handleGet(
  _request: NextRequest,
  { user }: BusinessAuthContext
) {
  try {
    // Get integration status
    const status = getIntegrationsStatus();

    // For non-admin users, only return summary (don't expose env var names)
    const isAdmin = user.app_metadata?.is_admin === true;

    if (isAdmin) {
      // Admin gets full details
      return success(status);
    }

    // Regular users get simplified view
    return success({
      allConfigured: status.allConfigured,
      production: status.production,
      criticalMissing: status.criticalMissing,
      warnings: status.warnings.length > 0,
      integrations: Object.fromEntries(
        Object.entries(status.integrations).map(([key, info]) => [
          key,
          {
            name: info.name,
            status: info.status,
            description: info.description,
          },
        ])
      ),
    });
  } catch (error) {
    logError("Integration Status", error);
    return errors.internalError("Failed to get integration status");
  }
}

export const GET = withAuth(handleGet);
