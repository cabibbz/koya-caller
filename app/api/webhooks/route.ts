/**
 * Webhooks API Route
 * GET /api/webhooks - List all webhooks for the business
 * POST /api/webhooks - Create a new webhook
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { withDashboardRateLimit } from "@/lib/rate-limit/middleware";
import crypto from "crypto";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

// Valid webhook events
const VALID_EVENTS = [
  "call.started",
  "call.completed",
  "appointment.booked",
  "appointment.cancelled",
  "message.taken",
  "lead.captured",
  "payment.collected",
];

async function handleGET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await getBusinessByUserId(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const { data: webhooks, error } = await (supabase as any)
      .from("business_webhooks")
      .select("id, name, url, events, is_active, created_at, updated_at")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ webhooks: webhooks || [] });
  } catch (error) {
    logError("Get Webhooks", error);
    return NextResponse.json(
      { error: "Failed to fetch webhooks" },
      { status: 500 }
    );
  }
}

async function handlePOST(request: NextRequest) {
  try {
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
    const { name, url, events } = body;

    // Validate required fields
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Webhook name is required" },
        { status: 400 }
      );
    }

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Webhook URL is required" },
        { status: 400 }
      );
    }

    // Validate URL format and prevent SSRF
    try {
      const parsedUrl = new URL(url);

      // Only allow HTTPS in production
      if (process.env.NODE_ENV === "production" && parsedUrl.protocol !== "https:") {
        return NextResponse.json(
          { error: "Webhook URL must use HTTPS" },
          { status: 400 }
        );
      }

      // Block private/internal hostnames (SSRF prevention)
      const hostname = parsedUrl.hostname.toLowerCase();
      const blockedPatterns = [
        /^localhost$/,
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
        /^192\.168\./,
        /^0\./,
        /^169\.254\./,  // Link-local
        /^::1$/,        // IPv6 localhost
        /^fc00:/,       // IPv6 private
        /^fe80:/,       // IPv6 link-local
        /\.local$/,     // mDNS
        /\.internal$/,  // Internal domains
      ];

      if (blockedPatterns.some(pattern => pattern.test(hostname))) {
        return NextResponse.json(
          { error: "Webhook URL cannot point to private or internal addresses" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid webhook URL" },
        { status: 400 }
      );
    }

    // Validate events
    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: "At least one event must be selected" },
        { status: 400 }
      );
    }

    const invalidEvents = events.filter((e) => !VALID_EVENTS.includes(e));
    if (invalidEvents.length > 0) {
      // Don't expose which specific events are invalid to avoid leaking system structure
      return NextResponse.json(
        { error: "One or more selected events are invalid", validEvents: VALID_EVENTS },
        { status: 400 }
      );
    }

    // Generate a signing secret
    const secret = crypto.randomBytes(32).toString("hex");

    // Create webhook
    const { data: webhook, error } = await (supabase as any)
      .from("business_webhooks")
      .insert({
        business_id: business.id,
        name: name.trim(),
        url: url.trim(),
        events,
        secret,
        is_active: true,
      })
      .select("id, name, url, events, secret, is_active, created_at")
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

    return NextResponse.json({ webhook }, { status: 201 });
  } catch (error) {
    logError("Create Webhook", error);
    return NextResponse.json(
      { error: "Failed to create webhook" },
      { status: 500 }
    );
  }
}

export const GET = withDashboardRateLimit(handleGET);
export const POST = withDashboardRateLimit(handlePOST);
