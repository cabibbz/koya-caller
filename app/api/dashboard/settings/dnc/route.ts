/**
 * DNC List API Route
 * /api/dashboard/settings/dnc
 *
 * GET: List DNC entries
 * POST: Add DNC entry
 * DELETE: Remove DNC entry
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

// GET - List DNC entries
async function handleGet(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    // Parse query params
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);
    const search = searchParams.get("search") || "";

    // Query DNC list
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("do_not_call")
      .select("*", { count: "exact" })
      .eq("business_id", business.id)
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(`phone_number.ilike.%${search}%,reason.ilike.%${search}%`);
    }

    // Apply pagination
    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      // Table might not exist - return empty list
      if (error.code === "PGRST205" || error.code === "42P01") {
        return success({
          entries: [],
          pagination: {
            page,
            pageSize,
            total: 0,
            totalPages: 0,
          },
        });
      }
      throw error;
    }

    return success({
      entries: data || [],
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (error) {
    logError("DNC GET", error);
    return errors.internalError("Failed to fetch DNC list");
  }
}

// POST - Add DNC entry
async function handlePost(
  request: NextRequest,
  { business, supabase, user }: BusinessAuthContext
) {
  try {
    const body = await request.json();

    if (!body.phone_number) {
      return errors.badRequest("phone_number is required");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("do_not_call")
      .insert({
        business_id: business.id,
        phone_number: body.phone_number,
        reason: body.reason || "User requested",
        added_by: user.id,
      })
      .select()
      .single();

    if (error) {
      // Table might not exist
      if (error.code === "PGRST205" || error.code === "42P01") {
        return errors.serviceUnavailable("DNC feature is not yet configured");
      }
      throw error;
    }

    return success(data);
  } catch (error) {
    logError("DNC POST", error);
    return errors.internalError("Failed to add DNC entry");
  }
}

// DELETE - Remove DNC entry
async function handleDelete(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    const body = await request.json();

    if (!body.id) {
      return errors.badRequest("id is required");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("do_not_call")
      .delete()
      .eq("id", body.id)
      .eq("business_id", business.id);

    if (error) {
      if (error.code === "PGRST205" || error.code === "42P01") {
        return errors.serviceUnavailable("DNC feature is not yet configured");
      }
      throw error;
    }

    return success({ message: "DNC entry removed" });
  } catch (error) {
    logError("DNC DELETE", error);
    return errors.internalError("Failed to remove DNC entry");
  }
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
export const DELETE = withAuth(handleDelete);
