/**
 * Prompt Regeneration Trigger API Route
 * Session 17: Dashboard - Appointments & Knowledge
 * Spec Reference: Part 7, Line 720
 *
 * Triggers automatic prompt regeneration and Retell agent update
 * when knowledge is modified.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { queuePromptRegeneration } from "@/lib/claude/queue";
import type { RegenerationTrigger } from "@/lib/claude/types";

export async function POST(request: NextRequest) {
  try {
    // Rate limit check
    const ip = getClientIP(request.headers);
    const rateLimitResult = await checkRateLimit("dashboard", ip);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    const supabase = await createClient();

    // Verify auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get business
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (businessError || !business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const actualBusinessId = (business as { id: string }).id;
    const body = await request.json();
    const { businessId, triggerType } = body;

    // Verify the business ID matches (security check)
    if (businessId && businessId !== actualBusinessId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Valid trigger types
    const validTriggers: RegenerationTrigger[] = [
      "services_update",
      "faqs_update",
      "knowledge_update",
      "settings_update",
      "language_update",
    ];

    const trigger = validTriggers.includes(triggerType) 
      ? triggerType as RegenerationTrigger 
      : "settings_update";

    // Queue the regeneration
    const result = await queuePromptRegeneration(supabase, actualBusinessId, trigger);

    if (!result.success) {
      // Don't fail the request - regeneration is best-effort
      return NextResponse.json({ 
        success: true, 
        queued: false, 
        message: "Save successful, regeneration will be retried" 
      });
    }

    // Optionally trigger immediate processing in development
    if (process.env.NODE_ENV === "development") {
      // In dev, we might want immediate regeneration
      // For production, a cron job handles the queue
      try {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
        await fetch(`${baseUrl}/api/claude/process-queue`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
      } catch (_err) {
        // Ignore errors - queue processing is async
      }
    }

    return NextResponse.json({ success: true, queued: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
