/**
 * Send Email API
 * POST /api/dashboard/inbox/send
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";
import { getNylasGrant } from "@/lib/nylas/calendar";
import { sendMessage } from "@/lib/nylas/messages";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (request: NextRequest, { business }) => {
  const grant = await getNylasGrant(business.id);
  if (!grant) {
    return NextResponse.json({ error: "No account connected" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { to, cc, bcc, subject, htmlBody, replyToMessageId } = body;

    if (!to?.length || !subject) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject" },
        { status: 400 }
      );
    }

    const result = await sendMessage(grant.grantId, {
      to,
      cc,
      bcc,
      subject,
      body: htmlBody || body.body || "",
      replyToMessageId,
    });

    return NextResponse.json({ success: true, messageId: result.id });
  } catch (err) {
    logError("Send Email API", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
});
