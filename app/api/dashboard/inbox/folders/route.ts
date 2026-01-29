/**
 * Folders API
 * GET /api/dashboard/inbox/folders — list email folders
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";
import { getNylasGrant } from "@/lib/nylas/calendar";
import { listFolders } from "@/lib/nylas/messages";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (request: NextRequest, { business }) => {
  const grant = await getNylasGrant(business.id);
  if (!grant) {
    return NextResponse.json(
      { error: "No email account connected" },
      { status: 400 }
    );
  }

  try {
    const folders = await listFolders(grant.grantId);
    return NextResponse.json({ folders });
  } catch (err) {
    logError("Folders API", err);
    return NextResponse.json(
      { error: "Failed to fetch folders" },
      { status: 500 }
    );
  }
});
