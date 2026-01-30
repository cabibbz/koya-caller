/**
 * Calendar Events API
 * GET /api/dashboard/calendar/events — list events from Nylas
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";
import { getNylasGrant, getCalendarEvents } from "@/lib/nylas/calendar";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (request: NextRequest, { business }) => {
  const grant = await getNylasGrant(business.id);
  if (!grant) {
    return NextResponse.json(
      { error: "No calendar connected" },
      { status: 400 }
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
    const events = await getCalendarEvents(
      grant.grantId,
      grant.calendarId || "primary",
      parseInt(startParam),
      parseInt(endParam)
    );

    const mapped = events.map((e: any) => {
      const when = (e as any).when || {};
      return {
        id: e.id,
        title: (e as any).title || "",
        description: (e as any).description || "",
        start: when.startTime ? when.startTime * 1000 : 0,
        end: when.endTime ? when.endTime * 1000 : 0,
        location: (e as any).location || "",
        status: (e as any).status || "confirmed",
        participants: (e as any).participants || [],
        conferencing: (e as any).conferencing || null,
      };
    });

    return NextResponse.json({ events: mapped });
  } catch (err) {
    logError("Calendar Events API", err);
    return NextResponse.json(
      { error: "Failed to fetch calendar events" },
      { status: 500 }
    );
  }
});
