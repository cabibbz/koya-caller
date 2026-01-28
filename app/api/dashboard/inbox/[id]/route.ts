/**
 * Single Message API
 * GET /api/dashboard/inbox/[id] — get message
 * PUT /api/dashboard/inbox/[id] — update (read/unread/starred)
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";
import { getNylasGrant } from "@/lib/nylas/calendar";
import { getMessage, updateMessage } from "@/lib/nylas/messages";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

function extractId(request: NextRequest): string {
  const segments = request.nextUrl.pathname.split("/");
  return segments[segments.length - 1];
}

export const GET = withAuth(
  async (request: NextRequest, { business }) => {
    const messageId = extractId(request);
    const grant = await getNylasGrant(business.id);
    if (!grant) {
      return NextResponse.json({ error: "No account connected" }, { status: 400 });
    }

    try {
      const message = await getMessage(grant.grantId, messageId);

      // Auto-mark as read
      await updateMessage(grant.grantId, messageId, { unread: false }).catch(() => {});

      return NextResponse.json(message);
    } catch (err) {
      logError("Inbox Message API", err);
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }
  }
);

export const PUT = withAuth(
  async (request: NextRequest, { business }) => {
    const messageId = extractId(request);
    const grant = await getNylasGrant(business.id);
    if (!grant) {
      return NextResponse.json({ error: "No account connected" }, { status: 400 });
    }

    try {
      const body = await request.json();
      const updates: { unread?: boolean; starred?: boolean } = {};
      if (body.unread !== undefined) updates.unread = body.unread;
      if (body.starred !== undefined) updates.starred = body.starred;

      await updateMessage(grant.grantId, messageId, updates);
      return NextResponse.json({ success: true });
    } catch (err) {
      logError("Inbox Message Update API", err);
      return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }
  }
);
