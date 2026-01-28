/**
 * Individual Webhook API Route
 * GET /api/webhooks/[id] - Get webhook details
 * PATCH /api/webhooks/[id] - Update webhook
 * DELETE /api/webhooks/[id] - Delete webhook
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { withDashboardRateLimit } from "@/lib/rate-limit/middleware";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

const VALID_EVENTS = [
  "call.started",
  "call.completed",
  "appointment.booked",
  "appointment.cancelled",
  "message.taken",
  "lead.captured",
  "payment.collected",
];

async function handleGET(
  request: NextRequest,
  context?: { params: Promise<{ id: string }> }
) {
  try {
    if (!context) {
      return NextResponse.json({ error: "Missing context" }, { status: 400 });
    }
    const { id } = await context.params;

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await getBusinessByUserId(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Note: secret is intentionally excluded - it should only be shown once at creation
    const { data: webhook, error } = await (supabase as any)
      .from("business_webhooks")
      .select("id, name, url, events, is_active, created_at, updated_at")
      .eq("id", id)
      .eq("business_id", business.id)
      .single();

    if (error || !webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    return NextResponse.json({ webhook });
  } catch (error) {
    logError("Get Webhook", error);
    return NextResponse.json(
      { error: "Failed to fetch webhook" },
      { status: 500 }
    );
  }
}

async function handlePATCH(
  request: NextRequest,
  context?: { params: Promise<{ id: string }> }
) {
  try {
    if (!context) {
      return NextResponse.json({ error: "Missing context" }, { status: 400 });
    }
    const { id } = await context.params;

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await getBusinessByUserId(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    // Validate and add fields to update
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        return NextResponse.json(
          { error: "Invalid webhook name" },
          { status: 400 }
        );
      }
      updates.name = body.name.trim();
    }

    if (body.url !== undefined) {
      try {
        new URL(body.url);
        updates.url = body.url.trim();
      } catch {
        return NextResponse.json(
          { error: "Invalid webhook URL" },
          { status: 400 }
        );
      }
    }

    if (body.events !== undefined) {
      if (!Array.isArray(body.events) || body.events.length === 0) {
        return NextResponse.json(
          { error: "At least one event must be selected" },
          { status: 400 }
        );
      }
      const invalidEvents = body.events.filter((e: string) => !VALID_EVENTS.includes(e));
      if (invalidEvents.length > 0) {
        return NextResponse.json(
          { error: `Invalid events: ${invalidEvents.join(", ")}` },
          { status: 400 }
        );
      }
      updates.events = body.events;
    }

    if (body.is_active !== undefined) {
      updates.is_active = Boolean(body.is_active);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();

    const { data: webhook, error } = await (supabase as any)
      .from("business_webhooks")
      .update(updates)
      .eq("id", id)
      .eq("business_id", business.id)
      .select("id, name, url, events, is_active, created_at, updated_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A webhook with this name already exists" },
          { status: 409 }
        );
      }
      throw error;
    }

    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    return NextResponse.json({ webhook });
  } catch (error) {
    logError("Update Webhook", error);
    return NextResponse.json(
      { error: "Failed to update webhook" },
      { status: 500 }
    );
  }
}

async function handleDELETE(
  request: NextRequest,
  context?: { params: Promise<{ id: string }> }
) {
  try {
    if (!context) {
      return NextResponse.json({ error: "Missing context" }, { status: 400 });
    }
    const { id } = await context.params;

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await getBusinessByUserId(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const { error } = await (supabase as any)
      .from("business_webhooks")
      .delete()
      .eq("id", id)
      .eq("business_id", business.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError("Delete Webhook", error);
    return NextResponse.json(
      { error: "Failed to delete webhook" },
      { status: 500 }
    );
  }
}

export const GET = withDashboardRateLimit(handleGET);
export const PATCH = withDashboardRateLimit(handlePATCH);
export const DELETE = withDashboardRateLimit(handleDELETE);
