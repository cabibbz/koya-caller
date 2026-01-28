/**
 * Global Search API Route
 * Feature: Command Palette Global Search
 *
 * GET /api/dashboard/search
 * Query params: q (search query)
 * Returns: Grouped search results (calls, appointments, contacts, faqs, pages)
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { globalSearch, getRecentItems } from "@/lib/db/search";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

async function handleGet(
  request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    // Parse query parameter
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const limitParam = searchParams.get("limit");
    const parsedLimit = limitParam ? parseInt(limitParam, 10) : 5;
    // Validate limit parameter to prevent NaN and negative values
    const limit = Number.isNaN(parsedLimit) || parsedLimit < 1 ? 5 : Math.min(parsedLimit, 10);

    // If no query, return recent items
    if (!query.trim()) {
      const recentItems = await getRecentItems(business.id, limit);
      return success({
        query: "",
        results: {
          calls: recentItems,
          appointments: [],
          contacts: [],
          faqs: [],
          pages: [],
        },
        totalCount: recentItems.length,
      });
    }

    // Perform global search
    const results = await globalSearch(business.id, query, limit);

    // Calculate total count
    const totalCount =
      results.calls.length +
      results.appointments.length +
      results.contacts.length +
      results.faqs.length +
      results.pages.length;

    return success({
      query,
      results,
      totalCount,
    });
  } catch (error) {
    logError("Global Search GET", error);
    return errors.internalError("Failed to perform search");
  }
}

// Apply auth middleware with rate limiting: 60 req/min per user
export const GET = withAuth(handleGet);
