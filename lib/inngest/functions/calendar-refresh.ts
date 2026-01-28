/**
 * Koya Caller - Calendar Token Refresh Background Jobs
 * Session 21: Background Jobs
 * Spec Reference: Part 13, Lines 1667-1704; Part 14, Lines 1750-1756
 *
 * Handles proactive token refresh for Google Calendar and Outlook integrations.
 * Prevents token expiration and ensures seamless calendar access.
 */

import { inngest } from "../client";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshGoogleToken } from "../helpers/google-refresh";
import { refreshOutlookToken } from "../helpers/outlook-refresh";
import { sendCalendarDisconnectEmail } from "@/lib/email";
import { getDashboardUrl } from "@/lib/config";

// =============================================================================
// Check for Expiring Tokens (Scheduled Job)
// =============================================================================

/**
 * Scheduled job to find and refresh tokens expiring soon
 * Runs every 2 hours
 * Spec Reference: Part 16, Lines 1939-1965
 */
export const checkExpiringTokens = inngest.createFunction(
  {
    id: "calendar-check-expiring-tokens",
    name: "Check Expiring Calendar Tokens",
  },
  { cron: "0 */2 * * *" }, // Every 2 hours
  async ({ step }) => {
    const supabase = createAdminClient();

    // Find tokens expiring within the next 1 hour
    const expiryThreshold = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const integrations = await step.run("fetch-expiring-tokens", async () => {
      const { data, error } = await (supabase as any)
        .from("calendar_integrations")
        .select("business_id, provider, token_expires_at")
        .neq("provider", "built_in")
        .not("access_token", "is", null)
        .lt("token_expires_at", expiryThreshold)
        .order("token_expires_at", { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch expiring tokens: ${error.message}`);
      }

      return data || [];
    });

    if (integrations.length === 0) {
      return { refreshed: 0, message: "No tokens expiring soon" };
    }

    // Send refresh events for each expiring token
    const events = integrations.map((integration: any) => ({
      name: "calendar/token.refresh" as const,
      data: {
        businessId: integration.business_id,
        provider: integration.provider as "google" | "outlook",
      },
    }));

    await step.sendEvent("send-refresh-events", events);

    return {
      refreshed: integrations.length,
      businesses: integrations.map((i: any) => i.business_id),
    };
  }
);

// =============================================================================
// Refresh Single Token
// =============================================================================

/**
 * Refresh a single calendar token
 * Triggered by expiring token check or manual request
 */
export const refreshCalendarToken = inngest.createFunction(
  {
    id: "calendar-token-refresh",
    name: "Refresh Calendar Token",
    retries: 3,
    onFailure: async ({ event, error: _error }) => {
      // On final failure, mark calendar as disconnected and notify user
      // The event object in onFailure contains the original event in event.data.event
      const originalEvent = (event as any).data?.event;
      const businessId = originalEvent?.data?.businessId;
      const provider = originalEvent?.data?.provider;

      if (!businessId) {
        return;
      }

      const supabase = createAdminClient();

      // Mark as needing re-authentication
      await (supabase as any)
        .from("calendar_integrations")
        .update({
          access_token: null,
          refresh_token: null,
          token_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("business_id", businessId);

      // Fetch user email for notification
      const { data: business } = await (supabase as any)
        .from("businesses")
        .select("name, user_id")
        .eq("id", businessId)
        .single();

      if (business?.user_id) {
        const { data: user } = await (supabase as any)
          .from("users")
          .select("email")
          .eq("id", business.user_id)
          .single();

        if (user?.email) {
          // Send email notification about calendar disconnect
          await sendCalendarDisconnectEmail({
            to: user.email,
            businessName: business.name || "Your business",
            provider: provider as "google" | "outlook",
            reason: "token_expired",
            reconnectUrl: getDashboardUrl("/settings?tab=calendar"),
          });
        }
      }
    },
  },
  { event: "calendar/token.refresh" },
  async ({ event, step }) => {
    const { businessId, provider } = event.data;
    const supabase = createAdminClient();

    // Step 1: Fetch current tokens
    const integration = await step.run("fetch-integration", async () => {
      const { data, error } = await (supabase as any)
        .from("calendar_integrations")
        .select("access_token, refresh_token, token_expires_at, calendar_id")
        .eq("business_id", businessId)
        .single();

      if (error || !data) {
        throw new Error("Calendar integration not found");
      }

      if (!data.refresh_token) {
        throw new Error("No refresh token available");
      }

      return data;
    });

    // Step 2: Refresh the token based on provider
    const newTokens = await step.run("refresh-token", async () => {
      let result;
      if (provider === "google") {
        result = await refreshGoogleToken(integration.refresh_token);
      } else if (provider === "outlook") {
        result = await refreshOutlookToken(integration.refresh_token);
      } else {
        throw new Error(`Unknown provider: ${provider}`);
      }
      // Convert Date to ISO string for serialization
      return {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: result.expiresAt.toISOString(),
      };
    });

    // Step 3: Save new tokens
    await step.run("save-tokens", async () => {
      const { error } = await (supabase as any)
        .from("calendar_integrations")
        .update({
          access_token: newTokens.accessToken,
          refresh_token: newTokens.refreshToken || integration.refresh_token,
          token_expires_at: newTokens.expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("business_id", businessId);

      if (error) {
        throw new Error(`Failed to save refreshed tokens: ${error.message}`);
      }
    });

    return {
      success: true,
      businessId,
      provider,
      expiresAt: newTokens.expiresAt,
    };
  }
);
