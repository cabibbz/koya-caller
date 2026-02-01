/**
 * Nylas Email Client
 * Sends transactional emails via Nylas Messages API
 * Uses a connected business grant to send from the business's own email address
 */

import { getNylasClient } from "./client";
import { logError, logInfo } from "@/lib/logging";

interface SendEmailParams {
  grantId: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Send an email via Nylas Messages API using a connected grant.
 * This sends FROM the business's own email address (white-label).
 */
export async function sendNylasEmail(params: SendEmailParams): Promise<EmailResult> {
  try {
    const nylas = getNylasClient();

    const requestBody: Record<string, unknown> = {
      to: [{ email: params.to }],
      subject: params.subject,
      body: params.html,
    };

    if (params.replyTo) {
      requestBody.replyTo = [{ email: params.replyTo }];
    }

    const response = await nylas.messages.send({
      identifier: params.grantId,
      requestBody: requestBody as any,
    });

    logInfo("Nylas Email", `Sent email to ${params.to}: ${response.data?.id}`);
    return { success: true, id: response.data?.id || undefined };
  } catch (error) {
    logError("Nylas Email", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email via Nylas",
    };
  }
}
