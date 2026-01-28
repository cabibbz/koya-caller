/**
 * CRM Manual Sync API
 * POST - Trigger a manual sync of contacts to HubSpot
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { createServiceClient } from "@/lib/supabase/server";
import {
  getActiveCRMIntegration,
  createCRMSyncLog,
  updateCRMSyncLog,
  upsertCRMContactMapping,
  getCRMContactMapping,
  crmTokensNeedRefresh,
  updateCRMTokens,
} from "@/lib/db/crm";
import { logError } from "@/lib/logging";

const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;

export const dynamic = "force-dynamic";

// HubSpot API helpers
async function refreshHubSpotToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
} | null> {
  try {
    const response = await fetch("https://api.hubapi.com/oauth/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: HUBSPOT_CLIENT_ID!,
        client_secret: HUBSPOT_CLIENT_SECRET!,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function createOrUpdateHubSpotContact(
  accessToken: string,
  contact: {
    email?: string | null;
    phone?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  },
  existingHubSpotId?: string
): Promise<{ id: string } | null> {
  try {
    const properties: Record<string, string> = {};
    if (contact.email) properties.email = contact.email;
    if (contact.phone) properties.phone = contact.phone;
    if (contact.firstName) properties.firstname = contact.firstName;
    if (contact.lastName) properties.lastname = contact.lastName;

    const url = existingHubSpotId
      ? `https://api.hubapi.com/crm/v3/objects/contacts/${existingHubSpotId}`
      : "https://api.hubapi.com/crm/v3/objects/contacts";

    const response = await fetch(url, {
      method: existingHubSpotId ? "PATCH" : "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      logError("HubSpot API", error);
      return null;
    }

    return response.json();
  } catch (error) {
    logError("HubSpot Contact Sync", error);
    return null;
  }
}

async function handlePost(
  _request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    const serviceSupabase = createServiceClient();

    // Get active HubSpot integration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const integration = await getActiveCRMIntegration(serviceSupabase as any, business.id, "hubspot");

    if (!integration) {
      return errors.notFound("No active HubSpot integration found");
    }

    // Check if tokens need refresh
    let accessToken = integration.access_token;
    if (crmTokensNeedRefresh(integration) && integration.refresh_token) {
      const newTokens = await refreshHubSpotToken(integration.refresh_token);
      if (newTokens) {
        const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await updateCRMTokens(
          serviceSupabase as any,
          integration.id,
          newTokens.access_token,
          newTokens.refresh_token,
          expiresAt
        );
        accessToken = newTokens.access_token;
      } else {
        return errors.unauthorized("Failed to refresh HubSpot tokens. Please reconnect.");
      }
    }

    if (!accessToken) {
      return errors.unauthorized("No access token available. Please reconnect HubSpot.");
    }

    // Get contacts to sync (caller_profiles)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: contactsData, error: contactsError } = await (supabase as any)
      .from("caller_profiles")
      .select("id, name, phone_number, email")
      .eq("business_id", business.id)
      .limit(100);

    const contacts = contactsData as Array<{
      id: string;
      name: string | null;
      phone_number: string | null;
      email: string | null;
    }> | null;

    if (contactsError) {
      logError("CRM Sync - fetch contacts", contactsError);
      return errors.internalError("Failed to fetch contacts");
    }

    if (!contacts || contacts.length === 0) {
      return success({
        contactsQueued: 0,
        message: "No contacts to sync",
      });
    }

    // Sync contacts to HubSpot
    let successCount = 0;
    let failCount = 0;

    for (const contact of contacts) {
      // Check for existing mapping
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingMapping = await getCRMContactMapping(
        serviceSupabase as any,
        integration.id,
        contact.id
      );

      // Create sync log
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const syncLog = await createCRMSyncLog(serviceSupabase as any, {
        integration_id: integration.id,
        entity_type: "contact",
        entity_id: contact.id,
        crm_id: existingMapping?.crm_contact_id || null,
        sync_direction: "outbound",
        status: "pending",
        request_payload: {
          phone: contact.phone_number,
          email: contact.email,
          name: contact.name,
        },
      });

      try {
        // Parse name into first/last
        const nameParts = (contact.name || "").trim().split(" ");
        const firstName = nameParts[0] || null;
        const lastName = nameParts.slice(1).join(" ") || null;

        // Create/update in HubSpot
        const result = await createOrUpdateHubSpotContact(
          accessToken,
          {
            email: contact.email,
            phone: contact.phone_number,
            firstName,
            lastName,
          },
          existingMapping?.crm_contact_id
        );

        if (result) {
          // Update mapping
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await upsertCRMContactMapping(
            serviceSupabase as any,
            integration.id,
            contact.id,
            result.id
          );

          // Update sync log
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await updateCRMSyncLog(serviceSupabase as any, syncLog.id, {
            crm_id: result.id,
            status: "success",
            response_payload: result as Record<string, unknown>,
          });

          successCount++;
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await updateCRMSyncLog(serviceSupabase as any, syncLog.id, {
            status: "failed",
            error_message: "HubSpot API call failed",
          });
          failCount++;
        }
      } catch (error) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await updateCRMSyncLog(serviceSupabase as any, syncLog.id, {
          status: "failed",
          error_message: error instanceof Error ? error.message : "Unknown error",
        });
        failCount++;
      }
    }

    return success({
      contactsQueued: contacts.length,
      successCount,
      failCount,
      message: `Synced ${successCount} contacts, ${failCount} failed`,
    });
  } catch (error) {
    logError("CRM Sync", error);
    return errors.internalError("Sync failed");
  }
}

export const POST = withAuth(handlePost);
