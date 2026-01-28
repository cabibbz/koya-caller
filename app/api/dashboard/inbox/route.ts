/**
 * Inbox API
 * GET /api/dashboard/inbox — list messages
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth } from "@/lib/api/auth-middleware";
import { getNylasGrant } from "@/lib/nylas/calendar";
import { listMessages } from "@/lib/nylas/messages";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (request: NextRequest, { business }) => {
  const grant = await getNylasGrant(business.id);
  if (!grant) {
    return NextResponse.json(
      { error: "No email account connected. Connect one in Connections." },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "25");
  const offset = parseInt(searchParams.get("offset") || "0");
  const folderId = searchParams.get("folder") || undefined;
  const unreadParam = searchParams.get("unread");
  const search = searchParams.get("search") || undefined;

  try {
    const result = await listMessages(grant.grantId, {
      limit: Math.min(limit, 50),
      offset,
      folderId,
      unread: unreadParam === "true" ? true : unreadParam === "false" ? false : undefined,
      searchQuery: search,
    });

    return NextResponse.json(result);
  } catch (err) {
    logError("Inbox API", err);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
});
