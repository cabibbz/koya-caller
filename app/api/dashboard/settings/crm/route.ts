/**
 * CRM Integration Settings API
 * GET - Fetch current CRM integration and stats
 * PATCH - Update CRM integration settings
 * DELETE - Disconnect CRM integration
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import {
  getCRMIntegration,
  updateCRMIntegration,
  updateCRMSettings,
  deleteCRMIntegration,
  getCRMSyncStats,
  getCRMSyncLogs,
  type CRMIntegrationSettings,
} from "@/lib/db/crm";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

// GET - Fetch CRM integration
async function handleGet(
  _request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    // Get HubSpot integration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const integration = await getCRMIntegration(supabase as any, business.id, "hubspot");

    if (!integration) {
      return success(null);
    }

    // Get stats and recent logs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [stats, { logs: recentLogs }] = await Promise.all([
      getCRMSyncStats(supabase as any, integration.id),
      getCRMSyncLogs(supabase as any, integration.id, { limit: 10 }),
    ]);

    // Don't expose tokens in response
    const safeIntegration = {
      id: integration.id,
      provider: integration.provider,
      hub_id: integration.hub_id,
      is_active: integration.is_active,
      settings: integration.settings,
      created_at: integration.created_at,
      updated_at: integration.updated_at,
    };

    return success({
      integration: safeIntegration,
      stats,
      recentLogs,
    });
  } catch (error) {
    logError("CRM GET", error);
    return errors.internalError("Failed to fetch CRM integration");
  }
}

// PATCH - Update CRM integration
async function handlePatch(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    const body = await request.json();
    const { settings, is_active } = body as {
      settings?: Partial<CRMIntegrationSettings>;
      is_active?: boolean;
    };

    // Get current integration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const integration = await getCRMIntegration(supabase as any, business.id, "hubspot");

    if (!integration) {
      return errors.notFound("CRM integration");
    }

    let updatedIntegration = integration;

    // Update settings if provided
    if (settings) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updatedIntegration = await updateCRMSettings(supabase as any, integration.id, settings);
    }

    // Update active status if provided
    if (typeof is_active === "boolean") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updatedIntegration = await updateCRMIntegration(supabase as any, integration.id, {
        is_active,
      });
    }

    // Return safe response
    const safeIntegration = {
      id: updatedIntegration.id,
      provider: updatedIntegration.provider,
      hub_id: updatedIntegration.hub_id,
      is_active: updatedIntegration.is_active,
      settings: updatedIntegration.settings,
      created_at: updatedIntegration.created_at,
      updated_at: updatedIntegration.updated_at,
    };

    return success(safeIntegration);
  } catch (error) {
    logError("CRM PATCH", error);
    return errors.internalError("Failed to update CRM integration");
  }
}

// DELETE - Disconnect CRM integration
async function handleDelete(
  _request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    // Get current integration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const integration = await getCRMIntegration(supabase as any, business.id, "hubspot");

    if (!integration) {
      return errors.notFound("CRM integration");
    }

    // Delete the integration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteCRMIntegration(supabase as any, integration.id);

    return success({ message: "CRM integration disconnected" });
  } catch (error) {
    logError("CRM DELETE", error);
    return errors.internalError("Failed to disconnect CRM integration");
  }
}

export const GET = withAuth(handleGet);
export const PATCH = withAuth(handlePatch);
export const DELETE = withAuth(handleDelete);
