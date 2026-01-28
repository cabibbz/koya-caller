/**
 * Single API Key Route
 * Manage individual API keys
 *
 * GET /api/dashboard/settings/api-keys/[id] - Get API key details
 * PATCH /api/dashboard/settings/api-keys/[id] - Update API key
 * DELETE /api/dashboard/settings/api-keys/[id] - Delete API key
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import {
  getApiKeyById,
  updateApiKey,
  deleteApiKey,
  API_KEY_PERMISSIONS,
  type ApiKeyPermission,
} from "@/lib/db/api-keys";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/dashboard/settings/api-keys/[id]
 * Get a single API key's details
 */
async function handleGet(
  _request: NextRequest,
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

    return success(apiKey);
  } catch (error) {
    logError("API Key GET", error);
    return errors.internalError("Failed to fetch API key");
  }
}

/**
 * PATCH /api/dashboard/settings/api-keys/[id]
 * Update an API key (name, permissions, is_active, expires_at)
 */
async function handlePatch(
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
    const existingKey = await getApiKeyById(supabase as any, id);

    if (!existingKey) {
      return errors.notFound("API key");
    }

    // Verify ownership
    if (existingKey.business_id !== business.id) {
      return errors.forbidden("Not authorized to update this API key");
    }

    const body = await request.json();
    const { name, permissions, is_active, expires_at } = body;

    // Build update object
    const updates: {
      name?: string;
      permissions?: ApiKeyPermission[];
      is_active?: boolean;
      expires_at?: string | null;
    } = {};

    // Validate and add name if provided
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return errors.badRequest("API key name cannot be empty");
      }
      if (name.length > 100) {
        return errors.badRequest("API key name must be 100 characters or less");
      }
      updates.name = name.trim();
    }

    // Validate and add permissions if provided
    if (permissions !== undefined) {
      if (!Array.isArray(permissions) || permissions.length === 0) {
        return errors.badRequest("At least one permission is required");
      }
      const invalidPermissions = permissions.filter(
        (perm: string) => !API_KEY_PERMISSIONS.includes(perm as ApiKeyPermission)
      );
      if (invalidPermissions.length > 0) {
        return errors.badRequest(`Invalid permissions: ${invalidPermissions.join(", ")}`);
      }
      updates.permissions = permissions as ApiKeyPermission[];
    }

    // Add is_active if provided
    if (is_active !== undefined) {
      if (typeof is_active !== "boolean") {
        return errors.badRequest("is_active must be a boolean");
      }
      updates.is_active = is_active;
    }

    // Validate and add expires_at if provided
    if (expires_at !== undefined) {
      if (expires_at === null) {
        updates.expires_at = null;
      } else {
        const expirationDate = new Date(expires_at);
        if (isNaN(expirationDate.getTime())) {
          return errors.badRequest("Invalid expiration date format");
        }
        if (expirationDate <= new Date()) {
          return errors.badRequest("Expiration date must be in the future");
        }
        updates.expires_at = expirationDate.toISOString();
      }
    }

    // Check if there's anything to update
    if (Object.keys(updates).length === 0) {
      return errors.badRequest("No valid fields provided for update");
    }

    // Update the API key
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatedKey = await updateApiKey(supabase as any, id, updates);

    return success({
      ...updatedKey,
      message: "API key updated successfully",
    });
  } catch (error) {
    logError("API Key PATCH", error);
    return errors.internalError("Failed to update API key");
  }
}

/**
 * DELETE /api/dashboard/settings/api-keys/[id]
 * Permanently delete an API key
 */
async function handleDelete(
  _request: NextRequest,
  { business, supabase }: BusinessAuthContext,
  context?: RouteContext
) {
  try {
    if (!context) {
      return errors.badRequest("Invalid request");
    }
    const { id } = await context.params;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingKey = await getApiKeyById(supabase as any, id);

    if (!existingKey) {
      return errors.notFound("API key");
    }

    // Verify ownership
    if (existingKey.business_id !== business.id) {
      return errors.forbidden("Not authorized to delete this API key");
    }

    // Delete the API key (cascades to zapier_subscriptions and usage_logs)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteApiKey(supabase as any, id);

    return success({ message: "API key deleted successfully" });
  } catch (error) {
    logError("API Key DELETE", error);
    return errors.internalError("Failed to delete API key");
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GET = withAuth(handleGet as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PATCH = withAuth(handlePatch as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DELETE = withAuth(handleDelete as any);
