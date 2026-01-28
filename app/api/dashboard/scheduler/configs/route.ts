/**
 * Scheduler Configs API
 * GET /api/dashboard/scheduler/configs — list configs
 * POST /api/dashboard/scheduler/configs — create config
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";
import { getNylasGrant } from "@/lib/nylas/calendar";
import {
  listSchedulerConfigs,
  createSchedulerConfig,
} from "@/lib/nylas/scheduler";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_request, { business }) => {
  const grant = await getNylasGrant(business.id);
  if (!grant) {
    return NextResponse.json(
      { error: "No account connected" },
      { status: 400 }
    );
  }

  try {
    const configs = await listSchedulerConfigs(grant.grantId);
    return NextResponse.json({ configs });
  } catch (err) {
    logError("Scheduler Configs API", err);
    return NextResponse.json({ configs: [] });
  }
});

export const POST = withAuth(async (request: NextRequest, { business }) => {
  const grant = await getNylasGrant(business.id);
  if (!grant) {
    return NextResponse.json(
      { error: "No account connected" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const config = await createSchedulerConfig(grant.grantId, {
      name: body.name || "Default Booking Page",
      slug: body.slug,
      durationMinutes: body.durationMinutes || 60,
      participantEmail: grant.grantEmail,
    });

    return NextResponse.json({ config });
  } catch (err) {
    logError("Create Scheduler Config API", err);
    return NextResponse.json(
      { error: "Failed to create scheduler config" },
      { status: 500 }
    );
  }
});
