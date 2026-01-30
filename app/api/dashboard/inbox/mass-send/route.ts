/**
 * Mass Email Send API
 * POST /api/dashboard/inbox/mass-send
 * Sends the same email to multiple recipients
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";
import { getNylasGrant } from "@/lib/nylas/calendar";
import { sendMessage } from "@/lib/nylas/messages";
import { logError, logInfo } from "@/lib/logging";

export const dynamic = "force-dynamic";

interface MassSendRequest {
  recipients: Array<{ email: string; name?: string }>;
  subject: string;
  body: string;
  htmlBody?: string;
}

export const POST = withAuth(async (request: NextRequest, { business }) => {
  const grant = await getNylasGrant(business.id);
  if (!grant) {
    return NextResponse.json(
      { error: "No email account connected. Connect one in Connections." },
      { status: 400 }
    );
  }

  try {
    const body: MassSendRequest = await request.json();
    const { recipients, subject, htmlBody } = body;

    if (!recipients?.length) {
      return NextResponse.json(
        { error: "No recipients provided" },
        { status: 400 }
      );
    }

    if (!subject) {
      return NextResponse.json(
        { error: "Subject is required" },
        { status: 400 }
      );
    }

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = recipients.filter((r) => !emailRegex.test(r.email));
    if (invalidEmails.length > 0) {
      return NextResponse.json(
        { error: `Invalid email addresses: ${invalidEmails.map((e) => e.email).join(", ")}` },
        { status: 400 }
      );
    }

    // Rate limit: max 50 recipients per batch
    if (recipients.length > 50) {
      return NextResponse.json(
        { error: "Maximum 50 recipients per batch" },
        { status: 400 }
      );
    }

    // Send emails one by one to respect provider limits and ensure each gets individual tracking
    const results: Array<{ email: string; success: boolean; error?: string; messageId?: string }> = [];

    for (const recipient of recipients) {
      try {
        const result = await sendMessage(grant.grantId, {
          to: [{ email: recipient.email, name: recipient.name }],
          subject,
          body: htmlBody || body.body || "",
        });

        results.push({
          email: recipient.email,
          success: true,
          messageId: result.id,
        });

        // Small delay between sends to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (err) {
        logError("Mass Email - Single Send", err);
        results.push({
          email: recipient.email,
          success: false,
          error: err instanceof Error ? err.message : "Failed to send",
        });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    logInfo(
      "Mass Email",
      `Business ${business.id}: Sent ${successful}/${recipients.length} emails`
    );

    return NextResponse.json({
      success: true,
      sent: successful,
      failed,
      total: recipients.length,
      results,
    });
  } catch (err) {
    logError("Mass Email API", err);
    return NextResponse.json(
      { error: "Failed to send emails" },
      { status: 500 }
    );
  }
});
