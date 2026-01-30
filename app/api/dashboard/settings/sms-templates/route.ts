/**
 * SMS Templates API Route
 * Manage customizable SMS notification templates
 *
 * GET: Fetch SMS templates
 * PUT: Update SMS templates
 * POST: Preview a template with sample data (no auth required)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { DEFAULT_SMS_TEMPLATES } from "@/lib/constants/sms-templates";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

// =============================================================================
// GET Handler - Fetch SMS templates
// =============================================================================

async function handleGet(
  _request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    // Get templates (may not exist yet)
    // Using maybeSingle() since the row may not exist for new businesses
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: templates, error } = await (supabase as any)
      .from("sms_templates")
      .select("*")
      .eq("business_id", business.id)
      .maybeSingle();

    // Log error if it's not just "no rows found"
    if (error) {
      logError("SMS Templates GET - Query error", error);
    }

    // Return templates with defaults for any null values
    return success({
      templates: {
        booking_confirmation: templates?.booking_confirmation || null,
        reminder_24hr: templates?.reminder_24hr || null,
        reminder_1hr: templates?.reminder_1hr || null,
        missed_call_alert: templates?.missed_call_alert || null,
        message_alert: templates?.message_alert || null,
        transfer_alert: templates?.transfer_alert || null,
      },
      defaults: DEFAULT_SMS_TEMPLATES,
    });
  } catch (error) {
    logError("SMS Templates GET", error);
    return errors.internalError("Failed to fetch SMS templates");
  }
}

// =============================================================================
// PUT Handler - Update SMS templates
// =============================================================================

async function handlePut(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    const body = await request.json();
    const {
      bookingConfirmation,
      reminder24hr,
      reminder1hr,
      missedCallAlert,
      messageAlert,
      transferAlert,
    } = body;

    // Build update object (only include fields that were provided)
    const updateData: Record<string, string | null> = {
      updated_at: new Date().toISOString(),
    };

    // Allow null to reset to default, or string to set custom
    if (bookingConfirmation !== undefined) {
      updateData.booking_confirmation = bookingConfirmation || null;
    }
    if (reminder24hr !== undefined) {
      updateData.reminder_24hr = reminder24hr || null;
    }
    if (reminder1hr !== undefined) {
      updateData.reminder_1hr = reminder1hr || null;
    }
    if (missedCallAlert !== undefined) {
      updateData.missed_call_alert = missedCallAlert || null;
    }
    if (messageAlert !== undefined) {
      updateData.message_alert = messageAlert || null;
    }
    if (transferAlert !== undefined) {
      updateData.transfer_alert = transferAlert || null;
    }

    // Upsert (create if not exists, update if exists)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("sms_templates")
      .upsert(
        {
          business_id: business.id,
          ...updateData,
        },
        { onConflict: "business_id" }
      );

    if (error) {
      logError("SMS Templates PUT", error);
      return errors.internalError("Failed to update templates");
    }

    return success({ message: "Templates updated successfully" });
  } catch (error) {
    logError("SMS Templates PUT", error);
    return errors.internalError("Failed to update templates");
  }
}

// =============================================================================
// POST Handler - Preview a template with sample data (public endpoint)
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { template, type } = body;

    if (!template || !type) {
      return NextResponse.json({ error: "Template and type required" }, { status: 400 });
    }

    // Sample data for preview
    const sampleData: Record<string, Record<string, string>> = {
      booking_confirmation: {
        business_name: "Acme Services",
        service_name: "Consultation",
        date_time: "Monday, January 20 at 2:00 PM",
        customer_name: "John Smith",
      },
      reminder_24hr: {
        business_name: "Acme Services",
        service_name: "Consultation",
        date_time: "Tuesday, January 21 at 2:00 PM",
        customer_name: "John Smith",
      },
      reminder_1hr: {
        business_name: "Acme Services",
        service_name: "Consultation",
        date_time: "Today at 3:00 PM",
        customer_name: "John Smith",
      },
      missed_call_alert: {
        caller_name: "Jane Doe",
        caller_phone: "(555) 123-4567",
        call_time: "2:45 PM",
      },
      message_alert: {
        caller_name: "Jane Doe",
        caller_phone: "(555) 123-4567",
        message: "Hi, I wanted to ask about your availability next week.",
      },
      transfer_alert: {
        caller_name: "Jane Doe",
        caller_phone: "(555) 123-4567",
        reason: "Caller requested to speak with a human",
      },
    };

    const data = sampleData[type] || {};

    // Replace variables in template
    let preview = template;
    for (const [key, value] of Object.entries(data)) {
      preview = preview.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }

    return NextResponse.json({ preview });
  } catch (error) {
    logError("SMS Templates Preview", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withAuth(handleGet);
export const PUT = withAuth(handlePut);
