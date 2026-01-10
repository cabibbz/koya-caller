/**
 * Koya Caller - Email Service
 * Uses Resend for transactional emails
 */

import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "koya@notifications.koyacaller.com";

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!RESEND_API_KEY) {
    console.warn("[Email] Resend API key not configured");
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(RESEND_API_KEY);
  }
  return resendClient;
}

export function isEmailConfigured(): boolean {
  return !!RESEND_API_KEY;
}

interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

// =============================================================================
// Core Email Function
// =============================================================================

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<EmailResult> {
  const client = getResendClient();

  if (!client) {
    console.log("[Email] Mock mode - would send:", { to: params.to, subject: params.subject });
    return { success: true, id: `mock_${Date.now()}` };
  }

  try {
    const result = await client.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    if (result.error) {
      console.error("[Email] Send error:", result.error);
      return { success: false, error: result.error.message };
    }

    console.log("[Email] Sent:", result.data?.id);
    return { success: true, id: result.data?.id };
  } catch (error) {
    console.error("[Email] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
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
