/**
 * Dashboard Contacts API Route
 * Customer/Contact Management feature
 * PRODUCT_ROADMAP.md Section 2.3
 *
 * GET /api/dashboard/contacts
 * Query params: search, vipOnly, tier, limit, offset
 * Returns: Paginated list of contacts with filters
 *
 * POST /api/dashboard/contacts
 * Body: { phone_number, name?, email?, notes?, vip_status? }
 * Returns: Created contact
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { getContactsByBusinessId, createContact } from "@/lib/db/contacts";
import { logError } from "@/lib/logging";
import type { CallerTier } from "@/types";

export const dynamic = "force-dynamic";

async function handleGet(
  request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const vipOnly = searchParams.get("vipOnly") === "true";
    const tier = searchParams.get("tier") as CallerTier | undefined;
    const parsedLimit = parseInt(searchParams.get("limit") || "50", 10);
    const parsedOffset = parseInt(searchParams.get("offset") || "0", 10);
    // Validate pagination parameters to prevent abuse
    const limit = Number.isNaN(parsedLimit) || parsedLimit < 1 ? 50 : Math.min(parsedLimit, 200);
    const offset = Number.isNaN(parsedOffset) || parsedOffset < 0 ? 0 : parsedOffset;

    // Get filtered contacts
    const { contacts, total } = await getContactsByBusinessId(business.id, {
      search,
      vipOnly,
      tier,
      limit,
      offset,
    });

    return success({
      contacts,
      total,
      limit,
      offset,
      hasMore: offset + contacts.length < total,
    });
  } catch (error) {
    logError("Dashboard Contacts GET", error);
    return errors.internalError("Failed to fetch contacts");
  }
}

async function handlePost(
  request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    // Parse request body
    const body = await request.json();
    const { phone_number, name, email, notes, vip_status } = body;

    // Validate required fields
    if (!phone_number) {
      return errors.badRequest("Phone number is required");
    }

    // Create contact
    const contact = await createContact(business.id, {
      phone_number,
      name,
      email,
      notes,
      vip_status,
    });

    return success(contact);
  } catch (error) {
    logError("Dashboard Contacts POST", error);

    // Check for unique constraint violation
    if (error instanceof Error && error.message.includes("duplicate")) {
      return errors.conflict("A contact with this phone number already exists");
    }

    return errors.internalError("Failed to create contact");
  }
}

// Apply auth middleware with rate limiting: 60 req/min per user
export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
