/**
 * Campaigns API Route
 * /api/dashboard/campaigns
 *
 * GET: List all campaigns for business
 * POST: Create a new campaign
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError, logInfo } from "@/lib/logging";
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

export const dynamic = "force-dynamic";

// =============================================================================
// Types for outbound_campaigns table
// =============================================================================

interface _OutboundCampaign {
  id: string;
  business_id: string;
  name: string;
  type: "appointment_reminder" | "follow_up" | "marketing" | "custom" | "email";
  status: "draft" | "scheduled" | "running" | "paused" | "completed" | "cancelled";
  agent_id: string | null;
  from_number: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// GET Handler - List campaigns
// =============================================================================

async function handleGet(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const type = searchParams.get("type") || undefined;
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Query campaigns from outbound_campaigns table
    const anySupabase = supabase as AnySupabaseClient;
    let query = anySupabase
      .from("outbound_campaigns")
      .select("*", { count: "exact" })
      .eq("business_id", business.id)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }
    if (type) {
      query = query.eq("type", type);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: campaigns, count, error } = await query;

    if (error) {
      // If table doesn't exist, return empty array
      if (error.code === "42P01") {
        return success({
          campaigns: [],
          total: 0,
          limit,
          offset,
          hasMore: false,
        });
      }
      throw error;
    }

    // Add target_contacts and call stats from queue
    const campaignsWithStats = await Promise.all(
      (campaigns || []).map(async (campaign: Record<string, unknown>) => {
        const settings = campaign.settings as Record<string, unknown> | null;
        const contactIds = settings?.contact_ids as string[] | undefined;
        const campaignId = campaign.id as string;

        const { count: queueCount } = await anySupabase
          .from("outbound_call_queue")
          .select("*", { count: "exact", head: true })
          .eq("campaign_id", campaignId);

        const { count: completedCount } = await anySupabase
          .from("outbound_call_queue")
          .select("*", { count: "exact", head: true })
          .eq("campaign_id", campaignId)
          .eq("status", "completed");

        const { count: failedCount } = await anySupabase
          .from("outbound_call_queue")
          .select("*", { count: "exact", head: true })
          .eq("campaign_id", campaignId)
          .in("status", ["failed", "dnc_blocked"]);

        const total = queueCount || contactIds?.length || 0;
        const completed = completedCount || 0;
        const failed = failedCount || 0;

        return {
          ...campaign,
          target_contacts: total,
          calls_completed: completed + failed,
          calls_successful: completed,
          calls_failed: failed,
        };
      })
    );

    return success({
      campaigns: campaignsWithStats,
      total: count || 0,
      limit,
      offset,
      hasMore: offset + (campaigns?.length || 0) < (count || 0),
    });
  } catch (error) {
    logError("Campaigns GET", error);
    return errors.internalError("Failed to fetch campaigns");
  }
}

// =============================================================================
// POST Handler - Create campaign
// =============================================================================

interface CreateCampaignRequest {
  name: string;
  description?: string;
  type: "appointment_reminder" | "follow_up" | "marketing" | "custom" | "email";
  scheduled_start?: string;
  scheduled_end?: string;
  scheduled_at?: string;
  agent_id?: string;
  from_number?: string;
  custom_message?: string;
  settings?: Record<string, unknown>;
  contact_ids?: string[];
}

async function handlePost(
  request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    const body: CreateCampaignRequest = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
      return errors.badRequest("Campaign name is required");
    }

    const validTypes = ["appointment_reminder", "follow_up", "marketing", "custom", "email"];
    if (!body.type || !validTypes.includes(body.type)) {
      return errors.badRequest("Campaign type must be: appointment_reminder, follow_up, marketing, custom, or email");
    }

    // Build settings object with contact_ids and custom message
    const campaignSettings = {
      ...(body.settings || {}),
      contact_ids: body.contact_ids || [],
      custom_message: body.custom_message || null,
      scheduled_end: body.scheduled_end || null,
      description: body.description || null,
    };

    // Create campaign using admin client in outbound_campaigns table
    const adminSupabase = createAdminClient() as AnySupabaseClient;
    const { data: campaign, error: createError } = await adminSupabase
      .from("outbound_campaigns")
      .insert({
        business_id: business.id,
        name: body.name.trim(),
        type: body.type,
        status: "draft",
        scheduled_at: body.scheduled_start || body.scheduled_at || null,
        agent_id: body.agent_id || null,
        from_number: body.from_number || null,
        settings: campaignSettings,
      })
      .select()
      .single();

    if (createError) {
      // If table doesn't exist, provide helpful error
      if (createError.code === "42P01") {
        return errors.featureDisabled("Campaigns feature not yet enabled. Please run database migrations");
      }
      throw createError;
    }

    logInfo(
      "Campaign Create",
      `Created campaign "${campaign.name}" for business ${business.id}`
    );

    return success(campaign);
  } catch (error) {
    logError("Campaigns POST", error);
    return errors.internalError("Failed to create campaign");
  }
}

// Apply auth middleware with rate limiting
export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
