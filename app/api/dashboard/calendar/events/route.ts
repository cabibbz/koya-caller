/**
 * Calendar Events API
 * GET /api/dashboard/calendar/events — list events from ALL connected calendars (Nylas)
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";
import { getAllNylasGrants, getCalendarEventsFromAllGrants } from "@/lib/nylas/calendar";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (request: NextRequest, { business }) => {
  const grants = await getAllNylasGrants(business.id);
  if (grants.length === 0) {
    return NextResponse.json(
      { error: "No calendar connected", events: [] },
      { status: 200 } // Return 200 with empty events instead of error
    );
  }

  const { searchParams } = new URL(request.url);
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");

  if (!startParam || !endParam) {
    return NextResponse.json(
      { error: "Missing start and end query parameters (unix seconds)" },
      { status: 400 }
    );
  }

  try {
    // Fetch events from ALL connected calendars
    const events = await getCalendarEventsFromAllGrants(
      business.id,
      parseInt(startParam),
      parseInt(endParam)
    );

    // Include connected calendar info in response
    const connectedCalendars = grants.map(g => ({
      provider: g.grantProvider,
      email: g.grantEmail,
      isPrimary: g.isPrimary,
    }));

    return NextResponse.json({
      events,
      connectedCalendars,
    });
  } catch (err) {
    logError("Calendar Events API", err);
    return NextResponse.json(
      { error: "Failed to fetch calendar events" },
      { status: 500 }
    );
  }
});
