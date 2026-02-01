/**
 * Koya Caller - Suspicious Authentication Alerts
 * Sends alerts when multiple failed login attempts are detected
 */

import { inngest } from "../client";
import { sendEmail } from "@/lib/email";
import { getAuthEventsByEmail } from "@/lib/db/auth-events";
import { DateTime } from "luxon";
import { getDashboardUrl } from "@/lib/config";

// =============================================================================
// Event Types (add to client.ts KoyaEvents if needed)
// =============================================================================

export interface SuspiciousAuthEventData {
  email: string;
  failureCount: number;
  ipAddress?: string;
  userAgent?: string;
  triggeredAt: string;
}

// =============================================================================
// Suspicious Auth Alert Handler
// =============================================================================

/**
 * Sends alert when 5+ failed login attempts are detected for an email
 * Triggered by auth/suspicious-activity.detected event
 */
export const sendSuspiciousAuthAlert = inngest.createFunction(
  {
    id: "suspicious-auth-alert-send",
    name: "Send Suspicious Auth Alert",
    retries: 3,
  },
  { event: "auth/suspicious-activity.detected" },
  async ({ event, step }) => {
    const {
      email,
      failureCount,
      ipAddress,
      userAgent: _userAgent,
      triggeredAt,
    } = event.data as SuspiciousAuthEventData;

    // Get admin email from environment
    const adminEmail = process.env.ADMIN_ALERT_EMAIL || process.env.FROM_EMAIL;

    if (!adminEmail) {
      return {
        success: false,
        reason: "No admin email configured",
      };
    }

    // Fetch recent auth events for this email for context
    const recentEvents = await step.run("fetch-recent-events", async () => {
      return getAuthEventsByEmail(email, 10);
    });

    // Format the alert time
    const formattedTime = DateTime.fromISO(triggeredAt)
      .setZone("America/New_York")
      .toFormat("EEEE, MMMM d 'at' h:mm a ZZZZ");

    // Build unique IPs list
    const uniqueIps = Array.from(new Set(recentEvents.map(e => e.ip_address).filter(Boolean)));

    // Send alert email
    const emailResult = await step.run("send-alert-email", async () => {
      const dashboardUrl = getDashboardUrl("/admin/security");

      const eventsHtml = recentEvents
        .slice(0, 5)
        .map(e => `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-size: 14px;">
              ${DateTime.fromISO(e.created_at).toFormat("MMM d, h:mm a")}
            </td>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-size: 14px;">
              ${e.event_type === "login_failed" ? '<span style="color: #DC2626;">Failed</span>' : '<span style="color: #059669;">Success</span>'}
            </td>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-size: 14px;">
              ${e.ip_address || "Unknown"}
            </td>
            <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-size: 14px;">
              ${e.failure_reason || "-"}
            </td>
          </tr>
        `)
        .join("");

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .alert-icon { font-size: 48px; margin-bottom: 10px; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
            .alert-box { background: #FEF2F2; border-left: 4px solid #DC2626; padding: 16px 20px; border-radius: 4px; margin-bottom: 20px; }
            .alert-box h3 { margin: 0 0 8px 0; color: #991B1B; }
            .alert-box p { margin: 0; color: #7F1D1D; }
            .info-card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .info-row { display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
            .info-row:last-child { border-bottom: none; }
            .info-label { color: #6b7280; width: 140px; flex-shrink: 0; }
            .info-value { font-weight: 600; color: #111827; word-break: break-all; }
            table { width: 100%; background: white; border-radius: 8px; border-collapse: collapse; margin-top: 16px; }
            th { text-align: left; padding: 8px; background: #f3f4f6; font-size: 12px; color: #6b7280; text-transform: uppercase; }
            .button { display: inline-block; background: #DC2626; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; }
            .footer { text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="alert-icon">&#9888;</div>
              <h1>Suspicious Login Activity</h1>
            </div>
            <div class="content">
              <div class="alert-box">
                <h3>Multiple failed login attempts detected</h3>
                <p>${failureCount} failed attempts for ${email} in the last 15 minutes</p>
              </div>

              <div class="info-card">
                <div class="info-row">
                  <span class="info-label">Email:</span>
                  <span class="info-value">${email}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Failed Attempts:</span>
                  <span class="info-value" style="color: #DC2626;">${failureCount}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Detected At:</span>
                  <span class="info-value">${formattedTime}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">IP Address(es):</span>
                  <span class="info-value">${uniqueIps.length > 0 ? uniqueIps.join(", ") : "Unknown"}</span>
                </div>
                ${ipAddress ? `
                <div class="info-row">
                  <span class="info-label">Latest IP:</span>
                  <span class="info-value">${ipAddress}</span>
                </div>
                ` : ""}
              </div>

              ${recentEvents.length > 0 ? `
              <h3 style="margin-bottom: 0;">Recent Attempts</h3>
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Status</th>
                    <th>IP</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  ${eventsHtml}
                </tbody>
              </table>
              ` : ""}

              <div style="text-align: center; margin-top: 24px;">
                <p style="color: #6b7280; margin-bottom: 16px;">
                  The account will be automatically locked after 10 failed attempts.
                </p>
                <a href="${dashboardUrl}" class="button">View Security Dashboard</a>
              </div>
            </div>
            <div class="footer">
              <p>Koya Security Alert</p>
              <p>This is an automated security notification.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const text = `
Suspicious Login Activity Detected

${failureCount} failed login attempts for ${email} in the last 15 minutes.

Details:
- Email: ${email}
- Failed Attempts: ${failureCount}
- Detected At: ${formattedTime}
- IP Address(es): ${uniqueIps.length > 0 ? uniqueIps.join(", ") : "Unknown"}

The account will be automatically locked after 10 failed attempts.

View Security Dashboard: ${dashboardUrl}

--
Koya Security Alert
      `.trim();

      return sendEmail({
        to: adminEmail,
        subject: `[SECURITY] Suspicious login activity: ${email}`,
        html,
        text,
      });
    });

    return {
      success: emailResult.success,
      email,
      failureCount,
      alertSentTo: adminEmail,
    };
  }
);
