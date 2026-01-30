/**
 * API Keys Route
 * Manages API keys for Zapier and external integrations
 *
 * GET /api/dashboard/settings/api-keys - List all API keys
 * POST /api/dashboard/settings/api-keys - Create a new API key
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { successSensitive } from "@/lib/api/responses";
import {
  getApiKeysByBusinessId,
  createApiKey,
  API_KEY_PERMISSIONS,
  type ApiKeyPermission,
} from "@/lib/db/api-keys";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/settings/api-keys
 * List all API keys for the authenticated user's business
 */
async function handleGet(
  _request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apiKeys = await getApiKeysByBusinessId(supabase as any, business.id);

    return success(apiKeys);
  } catch (error) {
    logError("API Keys GET", error);
    return errors.internalError("Failed to fetch API keys");
  }
}

/**
 * POST /api/dashboard/settings/api-keys
 * Create a new API key
 */
async function handlePost(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    const body = await request.json();
    const { name, permissions, expires_at } = body;

    // Validate name
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return errors.badRequest("API key name is required");
    }

    if (name.length > 100) {
      return errors.badRequest("API key name must be 100 characters or less");
    }

    // Validate permissions
    if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
      return errors.badRequest("At least one permission is required");
    }

    // Validate each permission
    const invalidPermissions = permissions.filter(
      (perm: string) => !API_KEY_PERMISSIONS.includes(perm as ApiKeyPermission)
    );
    if (invalidPermissions.length > 0) {
      return errors.badRequest(`Invalid permissions: ${invalidPermissions.join(", ")}`);
    }

    // Check API key limit (max 10 per business)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingKeys = await getApiKeysByBusinessId(supabase as any, business.id);
    if (existingKeys.length >= 10) {
      return errors.badRequest("Maximum API key limit (10) reached");
    }

    // Validate expiration date if provided
    let expiresAt: string | null = null;
    if (expires_at) {
      const expirationDate = new Date(expires_at);
      if (isNaN(expirationDate.getTime())) {
        return errors.badRequest("Invalid expiration date format");
      }

      const now = new Date();
      if (expirationDate <= now) {
        return errors.badRequest("Expiration date must be in the future");
      }

      // Max expiration: 1 year from now
      const maxExpiration = new Date();
      maxExpiration.setFullYear(maxExpiration.getFullYear() + 1);
      if (expirationDate > maxExpiration) {
        return errors.badRequest("Expiration date cannot be more than 1 year in the future");
      }

      expiresAt = expirationDate.toISOString();
    }

    // Create API key
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await createApiKey(supabase as any, {
      business_id: business.id,
      name: name.trim(),
      permissions: permissions as ApiKeyPermission[],
      expires_at: expiresAt,
    });

    // Use successSensitive to prevent caching of the full API key
    return successSensitive({
      apiKey: result.apiKey,
      fullKey: result.fullKey,
      message: "API key created successfully. Save the key - it won't be shown again.",
    });
  } catch (error) {
    logError("API Keys POST", error);
    return errors.internalError("Failed to create API key");
  }
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
