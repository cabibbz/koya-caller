/**
 * Individual Contact API Route
 * /api/dashboard/contacts/[id]
 *
 * GET - Get a single contact by ID
 * PATCH - Update a contact
 * DELETE - Delete a contact
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import {
  getContactById,
  updateContact,
  deleteContact,
  getContactCallHistory,
  getContactAppointments,
} from "@/lib/db/contacts";
import { withDashboardRateLimit } from "@/lib/rate-limit/middleware";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function handleGet(request: NextRequest, context?: RouteParams) {
  try {
    if (!context?.params) {
      return NextResponse.json({ error: "Missing route parameters" }, { status: 400 });
    }
    const { id } = await context.params;

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await getBusinessByUserId(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const contact = await getContactById(id);

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    // Verify contact belongs to user's business
    if (contact.business_id !== business.id) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    // Fetch call history and appointments in parallel
    const [callHistory, appointments] = await Promise.all([
      getContactCallHistory(business.id, contact.phone_number, 50),
      getContactAppointments(business.id, contact.phone_number, 50),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...contact,
        callHistory,
        appointments,
      },
    });
  } catch (error) {
    logError("Dashboard Contact GET", error);
    return NextResponse.json(
      { error: "Failed to fetch contact" },
      { status: 500 }
    );
  }
}

async function handlePatch(request: NextRequest, context?: RouteParams) {
  try {
    if (!context?.params) {
      return NextResponse.json({ error: "Missing route parameters" }, { status: 400 });
    }
    const { id } = await context.params;

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await getBusinessByUserId(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Verify contact exists and belongs to user's business
    const existingContact = await getContactById(id);
    if (!existingContact || existingContact.business_id !== business.id) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, email, notes, vip_status } = body;

    // Build updates object, only including defined fields
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (notes !== undefined) updates.notes = notes;
    if (vip_status !== undefined) updates.vip_status = vip_status;

    // Validate at least one field is being updated
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "At least one field must be provided for update" },
        { status: 400 }
      );
    }

    const updatedContact = await updateContact(id, updates);

    return NextResponse.json({
      success: true,
      data: updatedContact,
    });
  } catch (error) {
    logError("Dashboard Contact PATCH", error);
    return NextResponse.json(
      { error: "Failed to update contact" },
      { status: 500 }
    );
  }
}

async function handleDelete(request: NextRequest, context?: RouteParams) {
  try {
    if (!context?.params) {
      return NextResponse.json({ error: "Missing route parameters" }, { status: 400 });
    }
    const { id } = await context.params;

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await getBusinessByUserId(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Verify contact exists and belongs to user's business
    const existingContact = await getContactById(id);
    if (!existingContact || existingContact.business_id !== business.id) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    await deleteContact(id);

    return NextResponse.json({
      success: true,
      message: "Contact deleted",
    });
  } catch (error) {
    logError("Dashboard Contact DELETE", error);
    return NextResponse.json(
      { error: "Failed to delete contact" },
      { status: 500 }
    );
  }
}

export const GET = withDashboardRateLimit(handleGet);
export const PATCH = withDashboardRateLimit(handlePatch);
export const DELETE = withDashboardRateLimit(handleDelete);
