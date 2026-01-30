/**
 * Campaign Detail API Route
 * /api/dashboard/campaigns/[id]
 *
 * GET: Get campaign details
 * PUT: Update campaign
 * DELETE: Delete campaign
 * POST: Execute action (start, pause, resume, cancel)
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
import { getNylasGrant } from "@/lib/nylas/calendar";
import { sendMessage } from "@/lib/nylas/messages";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// =============================================================================
// Types for outbound_campaigns table
// =============================================================================

interface OutboundCampaign {
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
// GET Handler - Get campaign details
// =============================================================================

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

    // Get campaign from outbound_campaigns table
    const anySupabase = supabase as AnySupabaseClient;
    const { data: campaign, error } = await anySupabase
      .from("outbound_campaigns")
      .select("*")
      .eq("id", id)
      .eq("business_id", business.id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return errors.notFound("Campaign");
      }
      throw error;
    }

    // Get associated queue items count for this campaign
    const { count: queueCount } = await anySupabase
      .from("outbound_call_queue")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", id);

    // Count calls that actually connected and had a positive outcome
    // Successful outcomes: booked, transferred, message_taken, completed, answered
    const { count: successfulCount } = await anySupabase
      .from("outbound_call_queue")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", id)
      .eq("status", "completed")
      .in("outcome", ["booked", "transferred", "message_taken", "completed", "answered"]);

    // Count calls that failed or had negative outcomes
    // Failed statuses: failed, dnc_blocked, no_answer
    // Failed outcomes: no_answer, voicemail, busy, rejected, error, invalid_number
    const { count: failedStatusCount } = await anySupabase
      .from("outbound_call_queue")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", id)
      .in("status", ["failed", "dnc_blocked", "no_answer"]);

    const { count: failedOutcomeCount } = await anySupabase
      .from("outbound_call_queue")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", id)
      .eq("status", "completed")
      .in("outcome", ["no_answer", "voicemail", "busy", "rejected", "error", "invalid_number", "hung_up"]);

    // Count calls still in progress (calling status)
    const { count: inProgressCount } = await anySupabase
      .from("outbound_call_queue")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", id)
      .eq("status", "calling");

    const total = queueCount || 0;
    const successful = successfulCount || 0;
    const failed = (failedStatusCount || 0) + (failedOutcomeCount || 0);
    const inProgress = inProgressCount || 0;
    const completed = successful + failed;

    return success({
      ...campaign,
      target_contacts: total,
      calls_completed: completed,
      calls_successful: successful,
      calls_failed: failed,
      calls_in_progress: inProgress,
      queue_stats: {
        total,
        completed,
        successful,
        failed,
        in_progress: inProgress,
        pending: total - completed - inProgress,
      },
    });
  } catch (error) {
    logError("Campaign GET", error);
    return errors.internalError("Failed to fetch campaign");
  }
}

// =============================================================================
// PUT Handler - Update campaign
// =============================================================================

interface UpdateCampaignRequest {
  name?: string;
  description?: string | null;
  type?: "appointment_reminder" | "follow_up" | "marketing" | "custom" | "reminder" | "followup";
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  scheduled_at?: string;
  agent_id?: string;
  from_number?: string;
  custom_message?: string | null;
  settings?: Record<string, unknown>;
  contact_ids?: string[];
}

async function handlePut(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext,
  context?: RouteContext
) {
  try {
    if (!context) {
      return errors.badRequest("Invalid request");
    }
    const { id } = await context.params;

    // Verify campaign belongs to business
    const anySupabase = supabase as AnySupabaseClient;
    const { data: existing, error: checkError } = await anySupabase
      .from("outbound_campaigns")
      .select("id, status")
      .eq("id", id)
      .eq("business_id", business.id)
      .single();

    if (checkError) {
      if (checkError.code === "PGRST116") {
        return errors.notFound("Campaign");
      }
      throw checkError;
    }
    if (!existing) {
      return errors.notFound("Campaign");
    }

    // Can't update running campaigns
    if ((existing as OutboundCampaign).status === "running") {
      return errors.badRequest("Cannot update a running campaign. Pause it first.");
    }

    const body: UpdateCampaignRequest = await request.json();

    // Validate name length if provided
    if (body.name !== undefined && (typeof body.name !== "string" || body.name.trim().length === 0 || body.name.length > 200)) {
      return errors.badRequest("Campaign name must be between 1 and 200 characters");
    }

    // Validate description length if provided
    if (body.description !== undefined && body.description !== null && body.description.length > 2000) {
      return errors.badRequest("Campaign description must be 2000 characters or less");
    }

    // Validate custom_message length if provided
    if (body.custom_message !== undefined && body.custom_message !== null && body.custom_message.length > 5000) {
      return errors.badRequest("Custom message must be 5000 characters or less");
    }

    // Whitelist allowed settings keys to prevent arbitrary JSON injection
    const ALLOWED_SETTINGS_KEYS = [
      "scheduled_end", "custom_message", "max_retries", "retry_delay",
      "call_window_start", "call_window_end", "timezone", "contact_ids",
      "caller_id", "voice_id", "script_id", "priority"
    ];

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) {
      updates.name = body.name.trim();
    }
    if (body.description !== undefined) {
      updates.description = body.description;
    }
    if (body.type !== undefined) {
      // Map type names to database format
      const typeMap: Record<string, string> = {
        reminder: "appointment_reminder",
        followup: "follow_up",
        custom: "custom",
        appointment_reminder: "appointment_reminder",
        follow_up: "follow_up",
        marketing: "marketing",
      };
      updates.type = typeMap[body.type] || body.type;
    }
    if (body.scheduled_at !== undefined) {
      updates.scheduled_at = body.scheduled_at;
    }
    if (body.scheduled_start !== undefined) {
      updates.scheduled_at = body.scheduled_start;
    }
    if (body.scheduled_end !== undefined) {
      // Store end date in settings
      updates.settings = {
        ...(body.settings || {}),
        scheduled_end: body.scheduled_end,
      };
    }
    if (body.agent_id !== undefined) {
      updates.agent_id = body.agent_id;
    }
    if (body.from_number !== undefined) {
      updates.from_number = body.from_number;
    }
    if (body.custom_message !== undefined) {
      updates.settings = {
        ...((updates.settings as Record<string, unknown>) || body.settings || {}),
        custom_message: body.custom_message,
      };
    }
    if (body.settings !== undefined && typeof body.settings === "object" && body.settings !== null) {
      // Filter settings to only include allowed keys with value validation
      const filteredSettings: Record<string, unknown> = {};
      for (const key of Object.keys(body.settings)) {
        if (ALLOWED_SETTINGS_KEYS.includes(key)) {
          const value = (body.settings as Record<string, unknown>)[key];
          // Validate setting values based on key
          if (key === "max_retries" || key === "retry_delay" || key === "priority") {
            if (value !== null && value !== undefined && (typeof value !== "number" || value < 0 || value > 100)) {
              return errors.badRequest(`${key} must be a number between 0 and 100`);
            }
          } else if (key === "call_window_start" || key === "call_window_end") {
            if (value !== null && value !== undefined && (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value))) {
              return errors.badRequest(`${key} must be in HH:MM format`);
            }
          } else if (key === "timezone") {
            if (value !== null && value !== undefined && (typeof value !== "string" || value.length > 50)) {
              return errors.badRequest("timezone must be a valid timezone string");
            }
          } else if (key === "contact_ids") {
            if (value !== null && value !== undefined && (!Array.isArray(value) || value.length > 10000)) {
              return errors.badRequest("contact_ids must be an array with at most 10000 items");
            }
          } else if (key === "custom_message" || key === "caller_id" || key === "voice_id" || key === "script_id") {
            if (value !== null && value !== undefined && (typeof value !== "string" || value.length > 5000)) {
              return errors.badRequest(`${key} must be a string with at most 5000 characters`);
            }
          } else if (key === "scheduled_end") {
            if (value !== null && value !== undefined && typeof value !== "string") {
              return errors.badRequest("scheduled_end must be a date string");
            }
          }
          filteredSettings[key] = value;
        }
      }
      updates.settings = {
        ...((updates.settings as Record<string, unknown>) || {}),
        ...filteredSettings,
      };
    }

    const adminSupabase = createAdminClient() as AnySupabaseClient;
    const { data: campaign, error: updateError } = await adminSupabase
      .from("outbound_campaigns")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    logInfo("Campaign Update", `Updated campaign ${id} for business ${business.id}`);

    return success(campaign);
  } catch (error) {
    logError("Campaign PUT", error);
    return errors.internalError("Failed to update campaign");
  }
}

// =============================================================================
// DELETE Handler - Delete campaign
// =============================================================================

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

    // Verify campaign belongs to business
    const anySupabase = supabase as AnySupabaseClient;
    const { data: existing, error: checkError } = await anySupabase
      .from("outbound_campaigns")
      .select("id, status")
      .eq("id", id)
      .eq("business_id", business.id)
      .single();

    if (checkError) {
      if (checkError.code === "PGRST116") {
        return errors.notFound("Campaign");
      }
      throw checkError;
    }
    if (!existing) {
      return errors.notFound("Campaign");
    }

    // Can't delete running campaigns
    if ((existing as OutboundCampaign).status === "running") {
      return errors.badRequest("Cannot delete a running campaign. Cancel it first.");
    }

    const adminSupabase = createAdminClient() as AnySupabaseClient;

    // Cancel any pending queue items for this campaign
    await adminSupabase
      .from("outbound_call_queue")
      .update({ status: "cancelled", campaign_id: null })
      .eq("campaign_id", id)
      .in("status", ["pending", "scheduled"]);

    // Delete campaign
    const { error: deleteError } = await adminSupabase
      .from("outbound_campaigns")
      .delete()
      .eq("id", id);

    if (deleteError) {
      throw deleteError;
    }

    logInfo("Campaign Delete", `Deleted campaign ${id} for business ${business.id}`);

    return success({ deleted: true, message: "Campaign deleted successfully" });
  } catch (error) {
    logError("Campaign DELETE", error);
    return errors.internalError("Failed to delete campaign");
  }
}

// =============================================================================
// POST Handler - Execute action (start, pause, resume, cancel)
// =============================================================================

interface CampaignActionRequest {
  action: "start" | "pause" | "resume" | "cancel" | "reset";
}

async function handlePost(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext,
  context?: RouteContext
) {
  try {
    if (!context) {
      return errors.badRequest("Invalid request");
    }
    const { id } = await context.params;

    // Verify campaign belongs to business
    const anySupabase = supabase as AnySupabaseClient;
    const { data: existing, error: checkError } = await anySupabase
      .from("outbound_campaigns")
      .select("*")
      .eq("id", id)
      .eq("business_id", business.id)
      .single();

    if (checkError) {
      if (checkError.code === "PGRST116") {
        return errors.notFound("Campaign");
      }
      throw checkError;
    }
    if (!existing) {
      return errors.notFound("Campaign");
    }

    const existingCampaign = existing as OutboundCampaign;

    const body: CampaignActionRequest = await request.json();

    if (!body.action || !["start", "pause", "resume", "cancel", "reset"].includes(body.action)) {
      return errors.badRequest("Action must be: start, pause, resume, cancel, or reset");
    }

    // Validate state transitions
    // Note: outbound_campaigns uses 'running' instead of 'active'
    const validTransitions: Record<string, string[]> = {
      start: ["draft", "scheduled"],
      pause: ["running"],
      resume: ["paused"],
      cancel: ["running", "paused", "scheduled"],
      reset: ["completed", "cancelled"],
    };

    if (!validTransitions[body.action].includes(existingCampaign.status)) {
      return errors.badRequest(
        `Cannot ${body.action} a campaign with status "${existingCampaign.status}"`
      );
    }

    // Determine new status
    const statusMap: Record<string, string> = {
      start: "running",
      pause: "paused",
      resume: "running",
      cancel: "cancelled",
      reset: "draft",
    };

    const newStatus = statusMap[body.action];

    const adminSupabase = createAdminClient() as AnySupabaseClient;

    // Build update data
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    // Set started_at when starting
    if (body.action === "start" && !existingCampaign.started_at) {
      updateData.started_at = new Date().toISOString();
    }

    // Set completed_at when cancelling
    if (body.action === "cancel") {
      updateData.completed_at = new Date().toISOString();
    }

    // Clear started_at and completed_at when resetting
    if (body.action === "reset") {
      updateData.started_at = null;
      updateData.completed_at = null;
    }

    const { data: campaign, error: updateError } = await adminSupabase
      .from("outbound_campaigns")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // If starting, populate the call queue with contacts (for call campaigns) or send emails (for email campaigns)
    if (body.action === "start") {
      const settings = existingCampaign.settings as Record<string, unknown>;
      // Type guard for contact_ids - ensure it's an array of strings
      const rawContactIds = settings?.contact_ids;
      const contactIds: string[] = Array.isArray(rawContactIds)
        ? rawContactIds.filter((id): id is string => typeof id === "string" && id.length > 0)
        : [];

      // Handle email campaigns differently
      if (existingCampaign.type === "email") {
        // Check if Nylas is connected
        const grant = await getNylasGrant(business.id);
        if (!grant) {
          // Rollback campaign status
          await adminSupabase
            .from("outbound_campaigns")
            .update({
              status: existingCampaign.status,
              started_at: existingCampaign.started_at,
              updated_at: existingCampaign.updated_at,
            })
            .eq("id", id);
          return errors.badRequest("No email account connected. Connect one in Connections first.");
        }

        const emailSubject = settings?.email_subject as string;
        const emailBody = settings?.email_body as string;

        if (!emailSubject || !emailBody) {
          await adminSupabase
            .from("outbound_campaigns")
            .update({
              status: existingCampaign.status,
              started_at: existingCampaign.started_at,
              updated_at: existingCampaign.updated_at,
            })
            .eq("id", id);
          return errors.badRequest("Email subject and body are required");
        }

        if (contactIds.length > 0) {
          // Fetch contact details
          const { data: contacts } = await adminSupabase
            .from("caller_profiles")
            .select("id, name, email")
            .in("id", contactIds);

          // Filter contacts with valid email addresses
          const contactsWithEmail = (contacts || []).filter(
            (c: { id: string; name: string; email?: string }) => c.email && c.email.trim().length > 0
          );

          if (contactsWithEmail.length === 0) {
            await adminSupabase
              .from("outbound_campaigns")
              .update({
                status: existingCampaign.status,
                started_at: existingCampaign.started_at,
                updated_at: existingCampaign.updated_at,
              })
              .eq("id", id);
            return errors.badRequest("No contacts have email addresses");
          }

          // Send emails to all contacts
          let sent = 0;
          let failed = 0;

          for (const contact of contactsWithEmail) {
            try {
              await sendMessage(grant.grantId, {
                to: [{ email: contact.email, name: contact.name }],
                subject: emailSubject,
                body: emailBody.replace(/\n/g, "<br>"),
              });
              sent++;
              // Small delay to respect rate limits
              await new Promise((resolve) => setTimeout(resolve, 100));
            } catch (err) {
              logError("Email Campaign Send", err);
              failed++;
            }
          }

          logInfo(
            "Email Campaign",
            `Campaign ${id}: Sent ${sent}/${contactsWithEmail.length} emails (${failed} failed)`
          );

          // Mark campaign as completed
          await adminSupabase
            .from("outbound_campaigns")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
              settings: {
                ...settings,
                emails_sent: sent,
                emails_failed: failed,
                total_contacts: contactsWithEmail.length,
              },
            })
            .eq("id", id);

          return success({
            campaign: { ...campaign, status: "completed" },
            message: `Email campaign completed: ${sent} sent, ${failed} failed`,
            stats: { sent, failed, total: contactsWithEmail.length },
          });
        }
      } else {
        // Call campaign: ensure outbound settings exist and are enabled
        const { data: outboundSettings } = await adminSupabase
          .from("outbound_settings")
          .select("*")
          .eq("business_id", business.id)
          .single();

        if (!outboundSettings) {
          // Create outbound settings with defaults
          await adminSupabase.from("outbound_settings").insert({
            business_id: business.id,
            outbound_enabled: true,
            outbound_daily_limit: 100,
            outbound_hours_start: "09:00",
            outbound_hours_end: "21:00",
            outbound_days: [0, 1, 2, 3, 4, 5, 6], // All days
            outbound_timezone: "America/New_York",
          });
          logInfo("Campaign Start", `Created outbound settings for business ${business.id}`);
        } else if (!outboundSettings.outbound_enabled) {
          // Enable outbound if it was disabled
          await adminSupabase
            .from("outbound_settings")
            .update({ outbound_enabled: true })
            .eq("business_id", business.id);
          logInfo("Campaign Start", `Enabled outbound for business ${business.id}`);
        }

        if (contactIds.length > 0) {
          // Check if queue items already exist for this campaign (e.g., after a reset)
          const { count: existingQueueCount } = await adminSupabase
            .from("outbound_call_queue")
            .select("*", { count: "exact", head: true })
            .eq("campaign_id", id);

          // Only create new queue items if none exist
          if ((existingQueueCount || 0) === 0) {
            // Fetch contact details from caller_profiles table
            const { data: contacts } = await adminSupabase
              .from("caller_profiles")
              .select("id, name, phone_number, email")
              .in("id", contactIds);

            if (contacts && contacts.length > 0) {
              // Create queue items for each contact
              const queueItems = contacts.map(
              (contact: { id: string; name: string; phone_number: string; email?: string }) => ({
                business_id: business.id,
                campaign_id: id,
                contact_phone: contact.phone_number,
                contact_name: contact.name || "Unknown",
                status: "pending",
                scheduled_for: new Date().toISOString(),
                dynamic_variables: {
                  contact_id: contact.id,
                  contact_name: contact.name,
                  contact_email: contact.email,
                  campaign_type: existingCampaign.type,
                  custom_message: settings?.custom_message || null,
                },
                priority: 0,
                attempt_count: 0,
                max_attempts: (settings?.max_retries as number) || 3,
              })
            );

            const { error: queueError } = await adminSupabase
              .from("outbound_call_queue")
              .insert(queueItems);

            if (queueError) {
              logError("Campaign Start Queue", queueError);
              // Rollback campaign status since queue insertion failed
              await adminSupabase
                .from("outbound_campaigns")
                .update({
                  status: existingCampaign.status,
                  started_at: existingCampaign.started_at,
                  updated_at: existingCampaign.updated_at,
                })
                .eq("id", id);
              logError("Campaign Start Rollback", `Rolled back campaign ${id} status due to queue insertion failure`);
              return errors.internalError("Failed to populate call queue. Campaign start aborted.");
            } else {
              logInfo(
                "Campaign Start",
                `Added ${queueItems.length} contacts to call queue for campaign ${id}`
              );
            }
            }
          } else {
            logInfo(
              "Campaign Start",
              `Queue items already exist for campaign ${id}, skipping creation`
            );
          }
        }
      }
    }

    // If cancelling, also cancel pending queue items
    if (body.action === "cancel") {
      await adminSupabase
        .from("outbound_call_queue")
        .update({ status: "cancelled" })
        .eq("campaign_id", id)
        .in("status", ["pending", "scheduled"]);
    }

    // If resetting, reset all queue items back to pending
    if (body.action === "reset") {
      await adminSupabase
        .from("outbound_call_queue")
        .update({
          status: "pending",
          attempt_count: 0,
          last_attempt_at: null,
          call_id: null,
          result: null,
          error_message: null,
        })
        .eq("campaign_id", id);
    }

    logInfo(
      "Campaign Action",
      `${body.action} campaign ${id} (${existingCampaign.status} -> ${newStatus}) for business ${business.id}`
    );

    return success({
      campaign,
      message: `Campaign ${body.action}ed successfully`,
    });
  } catch (error) {
    logError("Campaign POST Action", error);
    return errors.internalError("Failed to execute campaign action");
  }
}

// Apply auth middleware - cast needed for route context support
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GET = withAuth(handleGet as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PUT = withAuth(handlePut as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PATCH = withAuth(handlePut as any); // Alias for PUT
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DELETE = withAuth(handleDelete as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const POST = withAuth(handlePost as any);
