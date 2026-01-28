/**
 * Koya Caller - Email Service
 * Uses Nylas Messages API for transactional emails (sends from business's own email)
 * Falls back to mock mode if no Nylas API key is configured
 */

import { sendNylasEmail } from "@/lib/nylas/email";
import { getNylasGrant } from "@/lib/nylas/calendar";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/logging";

const NYLAS_API_KEY = process.env.NYLAS_API_KEY;

export function isEmailConfigured(): boolean {
  return !!NYLAS_API_KEY;
}

interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

// =============================================================================
// Core Email Function
// =============================================================================

/**
 * Send an email. Attempts to find a Nylas grant for the business to send
 * from the business's own email. Falls back to mock if not available.
 *
 * @param params.businessId - Optional business ID to look up Nylas grant for sending
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  businessId?: string;
}): Promise<EmailResult> {
  if (!NYLAS_API_KEY) {
    // Mock mode - Nylas not configured
    return { success: true, id: `mock_${Date.now()}` };
  }

  // Try to find a Nylas grant to send from
  let grantId: string | null = null;

  if (params.businessId) {
    try {
      const grant = await getNylasGrant(params.businessId);
      if (grant) {
        grantId = grant.grantId;
      }
    } catch {
      // Fall through to fallback
    }
  }

  // If no specific business grant, try to find any active grant as a system sender
  if (!grantId) {
    try {
      const supabase = createAdminClient();
      const { data } = await (supabase as any)
        .from("calendar_integrations")
        .select("grant_id")
        .eq("grant_status", "active")
        .not("grant_id", "is", null)
        .limit(1)
        .single();
      if (data?.grant_id) {
        grantId = data.grant_id;
      }
    } catch {
      // No grant available
    }
  }

  if (!grantId) {
    // No Nylas grant available - mock mode
    logError("Email", "No Nylas grant available for sending email, using mock");
    return { success: true, id: `mock_no_grant_${Date.now()}` };
  }

  return sendNylasEmail({
    grantId,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });
}

// =============================================================================
// Email Templates
// =============================================================================

export async function sendMissedCallEmail(params: {
  to: string;
  businessName: string;
  callerPhone: string;
  callerName?: string;
  callTime: string;
  dashboardUrl: string;
}): Promise<EmailResult> {
  const { to, businessName, callerPhone, callerName, callTime, dashboardUrl } = params;

  const callerDisplay = callerName ? `${callerName} (${callerPhone})` : callerPhone;

  const subject = `Missed call from ${callerDisplay}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%); padding: 30px; border-radius: 12px 12px 0 0; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
        .call-info { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #EF4444; }
        .call-info h3 { margin: 0 0 10px 0; color: #EF4444; }
        .detail { margin: 8px 0; }
        .label { color: #6b7280; font-size: 14px; }
        .value { font-weight: 600; }
        .button { display: inline-block; background: #3B82F6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; }
        .footer { text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Koya - Missed Call Alert</h1>
        </div>
        <div class="content">
          <div class="call-info">
            <h3>You missed a call</h3>
            <div class="detail">
              <span class="label">Caller:</span>
              <span class="value">${callerDisplay}</span>
            </div>
            <div class="detail">
              <span class="label">Time:</span>
              <span class="value">${callTime}</span>
            </div>
          </div>
          <p>Consider calling back to follow up with this customer.</p>
          <a href="${dashboardUrl}" class="button">View in Dashboard</a>
        </div>
        <div class="footer">
          <p>Koya - Your AI Phone Receptionist for ${businessName}</p>
          <p>You're receiving this because you have missed call alerts enabled.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Missed Call Alert - ${businessName}

Caller: ${callerDisplay}
Time: ${callTime}

View in dashboard: ${dashboardUrl}

--
Koya - Your AI Phone Receptionist
  `.trim();

  return sendEmail({ to, subject, html, text });
}

export async function sendWeeklyReportEmail(params: {
  to: string;
  businessName: string;
  weekStartDate: string;
  stats: {
    totalCalls: number;
    appointmentsBooked: number;
    missedCalls: number;
    avgCallDuration: string;
    topOutcome: string;
    minutesUsed: number;
    minutesIncluded: number;
  };
  dashboardUrl: string;
}): Promise<EmailResult> {
  const { to, businessName, weekStartDate, stats, dashboardUrl } = params;

  const subject = `Your Koya Weekly Report - ${weekStartDate}`;

  const usagePercent = Math.round((stats.minutesUsed / stats.minutesIncluded) * 100);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .header p { color: rgba(255,255,255,0.9); margin: 10px 0 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
        .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px; }
        .stat-card { background: white; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-value { font-size: 32px; font-weight: 700; color: #3B82F6; }
        .stat-label { color: #6b7280; font-size: 14px; margin-top: 5px; }
        .usage-bar { background: #e5e7eb; border-radius: 9999px; height: 12px; overflow: hidden; margin: 10px 0; }
        .usage-fill { background: linear-gradient(90deg, #3B82F6, #8B5CF6); height: 100%; border-radius: 9999px; }
        .button { display: inline-block; background: #3B82F6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; }
        .footer { text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Weekly Report</h1>
          <p>${businessName} - Week of ${weekStartDate}</p>
        </div>
        <div class="content">
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">${stats.totalCalls}</div>
              <div class="stat-label">Total Calls</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${stats.appointmentsBooked}</div>
              <div class="stat-label">Appointments Booked</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${stats.missedCalls}</div>
              <div class="stat-label">Missed Calls</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${stats.avgCallDuration}</div>
              <div class="stat-label">Avg Duration</div>
            </div>
          </div>

          <div class="stat-card" style="margin-bottom: 20px;">
            <div class="stat-label">Minutes Used</div>
            <div class="usage-bar">
              <div class="usage-fill" style="width: ${Math.min(usagePercent, 100)}%"></div>
            </div>
            <div>${stats.minutesUsed} / ${stats.minutesIncluded} minutes (${usagePercent}%)</div>
          </div>

          <div style="text-align: center;">
            <a href="${dashboardUrl}" class="button">View Full Analytics</a>
          </div>
        </div>
        <div class="footer">
          <p>Koya - Your AI Phone Receptionist</p>
          <p>You're receiving this weekly report because you have email reports enabled.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to, subject, html });
}

export async function sendBookingConfirmationEmail(params: {
  to: string;
  businessName: string;
  customerName: string;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
  businessPhone: string;
  businessAddress?: string;
}): Promise<EmailResult> {
  const {
    to,
    businessName,
    customerName,
    serviceName,
    appointmentDate,
    appointmentTime,
    businessPhone,
    businessAddress,
  } = params;

  const subject = `Appointment Confirmed - ${businessName}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .checkmark { font-size: 48px; margin-bottom: 10px; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
        .appointment-card { background: white; padding: 24px; border-radius: 12px; border: 1px solid #e5e7eb; }
        .detail-row { display: flex; padding: 12px 0; border-bottom: 1px solid #f3f4f6; }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { color: #6b7280; width: 120px; flex-shrink: 0; }
        .detail-value { font-weight: 600; color: #111827; }
        .footer { text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px; }
        .note { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 12px 16px; margin-top: 20px; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="checkmark">&#10003;</div>
          <h1>Appointment Confirmed!</h1>
        </div>
        <div class="content">
          <p>Hi ${customerName},</p>
          <p>Your appointment has been booked successfully!</p>

          <div class="appointment-card">
            <div class="detail-row">
              <span class="detail-label">Service</span>
              <span class="detail-value">${serviceName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Date</span>
              <span class="detail-value">${appointmentDate}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Time</span>
              <span class="detail-value">${appointmentTime}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Location</span>
              <span class="detail-value">${businessName}${businessAddress ? `<br>${businessAddress}` : ""}</span>
            </div>
          </div>

          <div class="note">
            <strong>Need to reschedule?</strong> Call us at ${businessPhone} at least 24 hours before your appointment.
          </div>
        </div>
        <div class="footer">
          <p>See you soon!</p>
          <p>${businessName}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Appointment Confirmed - ${businessName}

Hi ${customerName},

Your appointment has been booked!

Service: ${serviceName}
Date: ${appointmentDate}
Time: ${appointmentTime}
Location: ${businessName}${businessAddress ? `, ${businessAddress}` : ""}

Need to reschedule? Call us at ${businessPhone} at least 24 hours before your appointment.

See you soon!
${businessName}
  `.trim();

  return sendEmail({ to, subject, html, text });
}

export async function sendAppointmentReminderEmail(params: {
  to: string;
  businessName: string;
  customerName: string;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
  businessPhone: string;
  businessAddress?: string;
}): Promise<EmailResult> {
  const {
    to,
    businessName,
    customerName,
    serviceName,
    appointmentDate,
    appointmentTime,
    businessPhone,
    businessAddress,
  } = params;

  const subject = `Reminder: Your appointment tomorrow at ${businessName}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .bell { font-size: 48px; margin-bottom: 10px; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
        .appointment-card { background: white; padding: 24px; border-radius: 12px; border: 2px solid #3B82F6; }
        .detail-row { display: flex; padding: 12px 0; border-bottom: 1px solid #f3f4f6; }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { color: #6b7280; width: 120px; flex-shrink: 0; }
        .detail-value { font-weight: 600; color: #111827; }
        .footer { text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="bell">&#128276;</div>
          <h1>Appointment Reminder</h1>
        </div>
        <div class="content">
          <p>Hi ${customerName},</p>
          <p>This is a friendly reminder about your upcoming appointment!</p>

          <div class="appointment-card">
            <div class="detail-row">
              <span class="detail-label">Service</span>
              <span class="detail-value">${serviceName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Date</span>
              <span class="detail-value">${appointmentDate}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Time</span>
              <span class="detail-value">${appointmentTime}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Location</span>
              <span class="detail-value">${businessName}${businessAddress ? `<br>${businessAddress}` : ""}</span>
            </div>
          </div>

          <p style="margin-top: 20px; color: #6b7280;">
            Can't make it? Please call us at ${businessPhone} as soon as possible.
          </p>
        </div>
        <div class="footer">
          <p>See you soon!</p>
          <p>${businessName}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to, subject, html });
}

export async function sendWelcomeEmail(params: {
  to: string;
  businessName: string;
  ownerName?: string;
  dashboardUrl: string;
}): Promise<EmailResult> {
  const { to, businessName, ownerName, dashboardUrl } = params;

  const greeting = ownerName ? `Hi ${ownerName}` : "Welcome";
  const subject = `Welcome to Koya! Your AI receptionist is ready`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%); padding: 40px 30px; border-radius: 12px 12px 0 0; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 28px; }
        .header p { color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
        .step { background: white; padding: 20px; border-radius: 8px; margin-bottom: 16px; display: flex; align-items: flex-start; gap: 16px; }
        .step-number { background: linear-gradient(135deg, #3B82F6, #8B5CF6); color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; flex-shrink: 0; }
        .step-content h3 { margin: 0 0 4px 0; font-size: 16px; }
        .step-content p { margin: 0; color: #6b7280; font-size: 14px; }
        .button { display: inline-block; background: linear-gradient(135deg, #3B82F6, #8B5CF6); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; }
        .cta { text-align: center; margin-top: 24px; }
        .footer { text-align: center; margin-top: 24px; color: #9ca3af; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Koya!</h1>
          <p>Your AI receptionist for ${businessName} is ready</p>
        </div>
        <div class="content">
          <p>${greeting},</p>
          <p>Great news - your AI phone receptionist is all set up and ready to answer calls for ${businessName}!</p>

          <p><strong>Here's what to do next:</strong></p>

          <div class="step">
            <div class="step-number">1</div>
            <div class="step-content">
              <h3>Set up call forwarding</h3>
              <p>Forward your business number to your new Koya number so we can start answering calls.</p>
            </div>
          </div>

          <div class="step">
            <div class="step-number">2</div>
            <div class="step-content">
              <h3>Make a test call</h3>
              <p>Call your Koya number to hear how Koya greets callers and handles conversations.</p>
            </div>
          </div>

          <div class="step">
            <div class="step-number">3</div>
            <div class="step-content">
              <h3>Customize your settings</h3>
              <p>Adjust greetings, transfer rules, and notification preferences in your dashboard.</p>
            </div>
          </div>

          <div class="cta">
            <a href="${dashboardUrl}" class="button">Go to Dashboard</a>
          </div>
        </div>
        <div class="footer">
          <p>Questions? Reply to this email or check out our help center.</p>
          <p>Koya - Your AI Phone Receptionist</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Welcome to Koya!

${greeting},

Great news - your AI phone receptionist is all set up and ready to answer calls for ${businessName}!

Here's what to do next:

1. Set up call forwarding
   Forward your business number to your new Koya number.

2. Make a test call
   Call your Koya number to hear how Koya greets callers.

3. Customize your settings
   Adjust greetings, transfer rules, and notifications.

Go to Dashboard: ${dashboardUrl}

Questions? Reply to this email or check out our help center.

Koya - Your AI Phone Receptionist
  `.trim();

  return sendEmail({ to, subject, html, text });
}

export async function sendDailySummaryEmail(params: {
  to: string;
  businessName: string;
  date: string;
  stats: {
    totalCalls: number;
    appointmentsBooked: number;
    messagesLeft: number;
    avgCallDuration: string;
    missedCalls: number;
  };
  recentCalls: Array<{
    time: string;
    callerPhone: string;
    outcome: string;
    duration: string;
  }>;
  dashboardUrl: string;
}): Promise<EmailResult> {
  const { to, businessName, date, stats, recentCalls, dashboardUrl } = params;

  const subject = `Daily Summary for ${date} - ${businessName}`;

  const callsHtml = recentCalls
    .slice(0, 5)
    .map(
      (call) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #f3f4f6;">${call.time}</td>
        <td style="padding: 12px; border-bottom: 1px solid #f3f4f6;">${call.callerPhone}</td>
        <td style="padding: 12px; border-bottom: 1px solid #f3f4f6;">${call.outcome}</td>
        <td style="padding: 12px; border-bottom: 1px solid #f3f4f6;">${call.duration}</td>
      </tr>
    `
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .header p { color: rgba(255,255,255,0.9); margin: 8px 0 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
        .stats-row { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
        .stat-box { background: white; padding: 16px; border-radius: 8px; flex: 1; min-width: 100px; text-align: center; }
        .stat-value { font-size: 28px; font-weight: 700; color: #3B82F6; }
        .stat-label { font-size: 12px; color: #6b7280; margin-top: 4px; }
        table { width: 100%; background: white; border-radius: 8px; border-collapse: collapse; margin-top: 16px; }
        th { text-align: left; padding: 12px; background: #f3f4f6; font-size: 12px; color: #6b7280; text-transform: uppercase; }
        .button { display: inline-block; background: #3B82F6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; }
        .footer { text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Daily Summary</h1>
          <p>${businessName} - ${date}</p>
        </div>
        <div class="content">
          <div class="stats-row">
            <div class="stat-box">
              <div class="stat-value">${stats.totalCalls}</div>
              <div class="stat-label">Total Calls</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${stats.appointmentsBooked}</div>
              <div class="stat-label">Booked</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${stats.messagesLeft}</div>
              <div class="stat-label">Messages</div>
            </div>
          </div>

          ${
            recentCalls.length > 0
              ? `
            <h3 style="margin-bottom: 0;">Recent Calls</h3>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Caller</th>
                  <th>Outcome</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                ${callsHtml}
              </tbody>
            </table>
          `
              : `<p style="color: #6b7280; text-align: center;">No calls today.</p>`
          }

          <div style="text-align: center; margin-top: 24px;">
            <a href="${dashboardUrl}" class="button">View Full Dashboard</a>
          </div>
        </div>
        <div class="footer">
          <p>Koya - Your AI Phone Receptionist</p>
          <p>You're receiving this because you have daily summaries enabled.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to, subject, html });
}

export async function sendCalendarDisconnectEmail(params: {
  to: string;
  businessName: string;
  provider: "google" | "outlook";
  reason: "manual" | "auth_failure" | "token_expired";
  reconnectUrl: string;
}): Promise<EmailResult> {
  const { to, businessName, provider, reason, reconnectUrl } = params;

  const providerName = provider === "google" ? "Google Calendar" : "Outlook Calendar";

  const reasonMessages = {
    manual: "You disconnected your calendar integration.",
    auth_failure: "We were unable to refresh your calendar access. Your authorization may have been revoked.",
    token_expired: "Your calendar connection expired and could not be renewed automatically.",
  };

  const subject = `Calendar Disconnected - ${businessName}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .warning-icon { font-size: 48px; margin-bottom: 10px; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
        .alert-box { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px 20px; border-radius: 4px; margin-bottom: 20px; }
        .alert-box h3 { margin: 0 0 8px 0; color: #92400E; }
        .alert-box p { margin: 0; color: #78350F; }
        .info-card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .info-row { display: flex; padding: 8px 0; }
        .info-label { color: #6b7280; width: 120px; }
        .info-value { font-weight: 600; }
        .button { display: inline-block; background: #3B82F6; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; }
        .cta { text-align: center; margin-top: 20px; }
        .footer { text-align: center; margin-top: 24px; color: #9ca3af; font-size: 12px; }
        .impact { background: white; padding: 16px; border-radius: 8px; margin-top: 16px; }
        .impact h4 { margin: 0 0 8px 0; font-size: 14px; color: #374151; }
        .impact ul { margin: 0; padding-left: 20px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="warning-icon">&#9888;</div>
          <h1>Calendar Disconnected</h1>
        </div>
        <div class="content">
          <div class="alert-box">
            <h3>${providerName} has been disconnected</h3>
            <p>${reasonMessages[reason]}</p>
          </div>

          <div class="info-card">
            <div class="info-row">
              <span class="info-label">Business:</span>
              <span class="info-value">${businessName}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Calendar:</span>
              <span class="info-value">${providerName}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Status:</span>
              <span class="info-value" style="color: #DC2626;">Disconnected</span>
            </div>
          </div>

          <div class="impact">
            <h4>What this means:</h4>
            <ul>
              <li>Koya will use the built-in calendar for scheduling</li>
              <li>New appointments won't sync to ${providerName}</li>
              <li>Existing calendar events are unaffected</li>
            </ul>
          </div>

          <div class="cta">
            <p>To restore calendar sync, reconnect your calendar in settings:</p>
            <a href="${reconnectUrl}" class="button">Reconnect Calendar</a>
          </div>
        </div>
        <div class="footer">
          <p>Koya - Your AI Phone Receptionist for ${businessName}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Calendar Disconnected - ${businessName}

${providerName} has been disconnected from your Koya account.

Reason: ${reasonMessages[reason]}

What this means:
- Koya will use the built-in calendar for scheduling
- New appointments won't sync to ${providerName}
- Existing calendar events are unaffected

To restore calendar sync, visit: ${reconnectUrl}

--
Koya - Your AI Phone Receptionist
  `.trim();

  return sendEmail({ to, subject, html, text });
}

export async function sendPayoutFailedEmail(params: {
  to: string;
  businessName: string;
  amountCents: number;
  currency: string;
  failureCode: string | null;
  failureMessage: string | null;
  stripeAccountId: string;
  dashboardUrl: string;
}): Promise<EmailResult> {
  const { to, businessName, amountCents, currency, failureCode, failureMessage, dashboardUrl } = params;

  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);

  const failureReasons: Record<string, string> = {
    account_closed: "The bank account has been closed.",
    account_frozen: "The bank account has been frozen.",
    bank_account_restricted: "The bank account has restrictions that prevent this transfer.",
    could_not_process: "The bank could not process this payout.",
    declined: "The bank declined this payout.",
    insufficient_funds: "There are insufficient funds in the Stripe account.",
    invalid_account_number: "The bank account number is invalid.",
    no_account: "The bank account no longer exists.",
  };

  const userFriendlyReason = failureCode
    ? failureReasons[failureCode] || failureMessage || "An unknown error occurred."
    : failureMessage || "An unknown error occurred.";

  const subject = `Payout Failed - ${formattedAmount} to your bank account`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
    .alert-box { background: #FEE2E2; border-left: 4px solid #DC2626; padding: 16px 20px; border-radius: 4px; margin-bottom: 20px; }
    .info-card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e5e7eb; }
    .button { display: inline-block; background: #3B82F6; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>Payout Failed</h1></div>
    <div class="content">
      <div class="alert-box">
        <strong>Your payout of ${formattedAmount} could not be completed</strong>
        <p style="margin:8px 0 0 0">${userFriendlyReason}</p>
      </div>
      <div class="info-card">
        <p><strong>Business:</strong> ${businessName}</p>
        <p><strong>Amount:</strong> ${formattedAmount}</p>
        <p><strong>Status:</strong> <span style="color:#DC2626">Failed</span></p>
        ${failureCode ? `<p><strong>Error Code:</strong> ${failureCode}</p>` : ""}
      </div>
      <p><strong>What to do next:</strong></p>
      <ol>
        <li>Verify your bank account details are correct in Stripe</li>
        <li>Ensure your bank account can receive transfers</li>
        <li>Contact your bank if the issue persists</li>
      </ol>
      <p style="text-align:center;margin-top:24px">
        <a href="${dashboardUrl}" class="button">Go to Payment Settings</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  const text = `Payout Failed - ${businessName}\n\nYour payout of ${formattedAmount} could not be completed.\nReason: ${userFriendlyReason}\n${failureCode ? `Error Code: ${failureCode}\n` : ""}\nUpdate your payout settings: ${dashboardUrl}`;

  return sendEmail({ to, subject, html, text });
}

export async function sendPaymentFailedEmail(params: {
  to: string;
  businessName: string;
  amountCents: number;
  currency: string;
  failureCode: string | null;
  failureMessage: string | null;
  customerEmail?: string | null;
  appointmentId?: string;
  dashboardUrl: string;
}): Promise<EmailResult> {
  const { to, businessName, amountCents, currency, failureCode, failureMessage, customerEmail, appointmentId, dashboardUrl } = params;

  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);

  const failureReasons: Record<string, string> = {
    card_declined: "The card was declined by the issuer.",
    expired_card: "The card has expired.",
    incorrect_cvc: "The CVC number was incorrect.",
    processing_error: "An error occurred while processing the card.",
    insufficient_funds: "The card has insufficient funds.",
    lost_card: "The card has been reported lost.",
    stolen_card: "The card has been reported stolen.",
    fraudulent: "The payment was flagged as potentially fraudulent.",
    authentication_required: "The payment requires additional authentication.",
  };

  const userFriendlyReason = failureCode
    ? failureReasons[failureCode] || failureMessage || "The payment could not be processed."
    : failureMessage || "The payment could not be processed.";

  const subject = `Payment Failed - ${formattedAmount}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
    .alert-box { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px 20px; border-radius: 4px; margin-bottom: 20px; }
    .info-card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e5e7eb; }
    .button { display: inline-block; background: #3B82F6; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .footer { text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>Payment Failed</h1></div>
    <div class="content">
      <div class="alert-box">
        <strong>A payment of ${formattedAmount} could not be processed</strong>
        <p style="margin:8px 0 0 0">${userFriendlyReason}</p>
      </div>
      <div class="info-card">
        <p><strong>Business:</strong> ${businessName}</p>
        <p><strong>Amount:</strong> ${formattedAmount}</p>
        ${customerEmail ? `<p><strong>Customer:</strong> ${customerEmail}</p>` : ""}
        ${appointmentId ? `<p><strong>Appointment ID:</strong> ${appointmentId}</p>` : ""}
        <p><strong>Status:</strong> <span style="color:#D97706">Failed</span></p>
        ${failureCode ? `<p><strong>Error Code:</strong> ${failureCode}</p>` : ""}
      </div>
      <p><strong>What to do next:</strong></p>
      <ul>
        <li>Contact the customer to request an alternative payment method</li>
        <li>If this was for an appointment, consider following up to reschedule</li>
        <li>Check your dashboard for more details on the failed payment</li>
      </ul>
      <p style="text-align:center;margin-top:24px">
        <a href="${dashboardUrl}" class="button">View Payment Details</a>
      </p>
    </div>
    <div class="footer">
      <p>Koya - Your AI Phone Receptionist</p>
    </div>
  </div>
</body>
</html>`;

  const text = `Payment Failed - ${businessName}\n\nA payment of ${formattedAmount} could not be processed.\nReason: ${userFriendlyReason}\n${customerEmail ? `Customer: ${customerEmail}\n` : ""}${failureCode ? `Error Code: ${failureCode}\n` : ""}\nView details: ${dashboardUrl}`;

  return sendEmail({ to, subject, html, text });
}

export async function sendTransferFailedEmail(params: {
  to: string;
  businessName: string;
  amountCents: number;
  currency: string;
  transferId: string;
  dashboardUrl: string;
}): Promise<EmailResult> {
  const { to, businessName, amountCents, currency, transferId, dashboardUrl } = params;

  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);

  const subject = `Transfer Failed - ${formattedAmount}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
    .alert-box { background: #FEE2E2; border-left: 4px solid #DC2626; padding: 16px 20px; border-radius: 4px; margin-bottom: 20px; }
    .info-card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e5e7eb; }
    .button { display: inline-block; background: #3B82F6; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .footer { text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>Transfer Failed</h1></div>
    <div class="content">
      <div class="alert-box">
        <strong>A transfer of ${formattedAmount} to your Stripe account could not be completed</strong>
        <p style="margin:8px 0 0 0">The funds will be returned to the platform and we will attempt the transfer again.</p>
      </div>
      <div class="info-card">
        <p><strong>Business:</strong> ${businessName}</p>
        <p><strong>Amount:</strong> ${formattedAmount}</p>
        <p><strong>Transfer ID:</strong> ${transferId}</p>
        <p><strong>Status:</strong> <span style="color:#DC2626">Failed</span></p>
      </div>
      <p><strong>What to do next:</strong></p>
      <ul>
        <li>Verify your Stripe account details are correct</li>
        <li>Ensure your account is fully verified and active</li>
        <li>Contact support if the issue persists</li>
      </ul>
      <p style="text-align:center;margin-top:24px">
        <a href="${dashboardUrl}" class="button">Check Payment Settings</a>
      </p>
    </div>
    <div class="footer">
      <p>Koya - Your AI Phone Receptionist</p>
    </div>
  </div>
</body>
</html>`;

  const text = `Transfer Failed - ${businessName}\n\nA transfer of ${formattedAmount} to your Stripe account could not be completed.\nTransfer ID: ${transferId}\n\nPlease verify your Stripe account details are correct.\n\nCheck settings: ${dashboardUrl}`;

  return sendEmail({ to, subject, html, text });
}

export async function sendAdminAlertEmail(params: {
  to: string;
  alertType: "webhook_failure" | "plan_mismatch" | "payment_error" | "system_error";
  title: string;
  description: string;
  details: Record<string, string | number | boolean | null | undefined>;
  severity: "low" | "medium" | "high" | "critical";
  dashboardUrl?: string;
}): Promise<EmailResult> {
  const { to, alertType, title, description, details, severity, dashboardUrl } = params;

  const severityColors = {
    low: { bg: "#DBEAFE", border: "#3B82F6", text: "#1E40AF" },
    medium: { bg: "#FEF3C7", border: "#F59E0B", text: "#92400E" },
    high: { bg: "#FED7AA", border: "#EA580C", text: "#9A3412" },
    critical: { bg: "#FEE2E2", border: "#DC2626", text: "#991B1B" },
  };

  const colors = severityColors[severity];
  const severityLabel = severity.toUpperCase();

  const detailsHtml = Object.entries(details)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `<p><strong>${k}:</strong> ${v}</p>`)
    .join("");

  const subject = `[${severityLabel}] ${alertType.replace(/_/g, " ").toUpperCase()}: ${title}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${colors.border}; padding: 20px; border-radius: 12px 12px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 20px; }
    .header .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 4px; font-size: 12px; color: white; margin-top: 8px; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
    .alert-box { background: ${colors.bg}; border-left: 4px solid ${colors.border}; padding: 16px 20px; border-radius: 4px; margin-bottom: 20px; }
    .alert-box p { margin: 0; color: ${colors.text}; }
    .details-card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e5e7eb; }
    .details-card p { margin: 8px 0; font-size: 14px; }
    .button { display: inline-block; background: #3B82F6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; }
    .footer { text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Admin Alert: ${title}</h1>
      <span class="badge">${severityLabel} - ${alertType.replace(/_/g, " ")}</span>
    </div>
    <div class="content">
      <div class="alert-box">
        <p>${description}</p>
      </div>
      ${detailsHtml ? `<div class="details-card">${detailsHtml}</div>` : ""}
      ${dashboardUrl ? `<p style="text-align:center"><a href="${dashboardUrl}" class="button">View in Dashboard</a></p>` : ""}
      <p style="color:#6b7280;font-size:12px;margin-top:20px">
        This is an automated alert from Koya. Please investigate and take appropriate action.
      </p>
    </div>
    <div class="footer">
      <p>Koya Admin Alerts - ${new Date().toISOString()}</p>
    </div>
  </div>
</body>
</html>`;

  const detailsText = Object.entries(details)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const text = `[${severityLabel}] Admin Alert: ${title}

${description}

Details:
${detailsText}

${dashboardUrl ? `View in Dashboard: ${dashboardUrl}` : ""}

---
Koya Admin Alerts - ${new Date().toISOString()}`;

  return sendEmail({ to, subject, html, text });
}

export async function sendStripeDisconnectEmail(params: {
  to: string;
  businessName: string;
  stripeAccountId: string;
  reconnectUrl: string;
}): Promise<EmailResult> {
  const { to, businessName, stripeAccountId, reconnectUrl } = params;

  const subject = `Stripe Account Disconnected - ${businessName}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .warning-icon { font-size: 48px; margin-bottom: 10px; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
    .alert-box { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px 20px; border-radius: 4px; margin-bottom: 20px; }
    .alert-box h3 { margin: 0 0 8px 0; color: #92400E; }
    .alert-box p { margin: 0; color: #78350F; }
    .info-card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e5e7eb; }
    .impact { background: white; padding: 16px; border-radius: 8px; margin-top: 16px; }
    .impact h4 { margin: 0 0 8px 0; font-size: 14px; color: #374151; }
    .impact ul { margin: 0; padding-left: 20px; color: #6b7280; font-size: 14px; }
    .button { display: inline-block; background: #3B82F6; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .cta { text-align: center; margin-top: 20px; }
    .footer { text-align: center; margin-top: 24px; color: #9ca3af; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="warning-icon">&#9888;</div>
      <h1>Stripe Account Disconnected</h1>
    </div>
    <div class="content">
      <div class="alert-box">
        <h3>Your Stripe account has been disconnected from Koya</h3>
        <p>You or someone with access to your Stripe account has revoked Koya's access.</p>
      </div>

      <div class="info-card">
        <p><strong>Business:</strong> ${businessName}</p>
        <p><strong>Stripe Account:</strong> ${stripeAccountId}</p>
        <p><strong>Status:</strong> <span style="color:#DC2626">Disconnected</span></p>
      </div>

      <div class="impact">
        <h4>What this means:</h4>
        <ul>
          <li>You will no longer be able to collect payments through Koya</li>
          <li>Existing appointment deposits cannot be processed</li>
          <li>Pending payouts may be affected</li>
          <li>Payment collection features are now disabled</li>
        </ul>
      </div>

      <div class="cta">
        <p>To restore payment collection, reconnect your Stripe account:</p>
        <a href="${reconnectUrl}" class="button">Reconnect Stripe</a>
      </div>
    </div>
    <div class="footer">
      <p>Koya - Your AI Phone Receptionist for ${businessName}</p>
      <p>If you did not disconnect your account, please contact support immediately.</p>
    </div>
  </div>
</body>
</html>`;

  const text = `Stripe Account Disconnected - ${businessName}

Your Stripe account has been disconnected from Koya.

Stripe Account: ${stripeAccountId}
Status: Disconnected

What this means:
- You will no longer be able to collect payments through Koya
- Existing appointment deposits cannot be processed
- Pending payouts may be affected
- Payment collection features are now disabled

To restore payment collection, reconnect your Stripe account: ${reconnectUrl}

If you did not disconnect your account, please contact support immediately.

--
Koya - Your AI Phone Receptionist`;

  return sendEmail({ to, subject, html, text });
}
