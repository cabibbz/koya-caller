/**
 * Koya Caller - Trial Expiry Background Jobs
 *
 * Handles trial period email notifications:
 * - 3 days before expiry warning
 * - 1 day before expiry warning
 * - On expiry notification
 *
 * Also checks for expired trials and updates their status
 */

import { inngest } from "../client";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { logError, logInfo } from "@/lib/logging";

// =============================================================================
// Check All Trials for Expiry (Scheduled Job)
// =============================================================================

/**
 * Scheduled job to check all trialing businesses for expiry notifications
 * Runs every hour
 */
export const checkTrialExpiry = inngest.createFunction(
  {
    id: "trial-check-expiry",
    name: "Check Trial Expiry",
  },
  { cron: "0 * * * *" }, // Every hour
  async ({ step }) => {
    const supabase = createAdminClient();

    // Fetch all trialing businesses
    const businesses = await step.run("fetch-trialing-businesses", async () => {
      const { data, error } = await (supabase as any)
        .from("businesses")
        .select(`
          id,
          name,
          trial_ends_at,
          trial_minutes_used,
          trial_minutes_limit,
          trial_email_3day_sent,
          trial_email_1day_sent,
          trial_email_expired_sent,
          users!inner (
            email
          )
        `)
        .eq("subscription_status", "trialing")
        .not("trial_ends_at", "is", null);

      if (error) {
        throw new Error(`Failed to fetch businesses: ${error.message}`);
      }

      return data || [];
    });

    if (businesses.length === 0) {
      return { checked: 0, emails: { threeDayWarning: 0, oneDayWarning: 0, expired: 0 } };
    }

    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

    let threeDayWarnings = 0;
    let oneDayWarnings = 0;
    let expiredNotifications = 0;

    for (const business of businesses) {
      const trialEndsAt = new Date(business.trial_ends_at);
      const ownerEmail = business.users?.email;

      if (!ownerEmail) continue;

      // Check for expired trial
      if (trialEndsAt <= now && !business.trial_email_expired_sent) {
        await step.run(`expired-email-${business.id}`, async () => {
          await sendTrialExpiredEmail(ownerEmail, business.name, business.id);

          // Update status and email flag
          await (supabase as any)
            .from("businesses")
            .update({
              subscription_status: "trial_expired",
              trial_email_expired_sent: true,
            })
            .eq("id", business.id);
        });

        expiredNotifications++;
        continue;
      }

      // Check for 1-day warning (trial ends within 1 day)
      if (trialEndsAt <= oneDayFromNow && trialEndsAt > now && !business.trial_email_1day_sent) {
        await step.run(`1day-warning-${business.id}`, async () => {
          await sendTrialWarningEmail(ownerEmail, business.name, 1, business.id);

          await (supabase as any)
            .from("businesses")
            .update({ trial_email_1day_sent: true })
            .eq("id", business.id);
        });

        oneDayWarnings++;
        continue;
      }

      // Check for 3-day warning (trial ends within 3 days)
      if (trialEndsAt <= threeDaysFromNow && trialEndsAt > oneDayFromNow && !business.trial_email_3day_sent) {
        await step.run(`3day-warning-${business.id}`, async () => {
          await sendTrialWarningEmail(ownerEmail, business.name, 3, business.id);

          await (supabase as any)
            .from("businesses")
            .update({ trial_email_3day_sent: true })
            .eq("id", business.id);
        });

        threeDayWarnings++;
      }
    }

    logInfo("Trial Expiry Check", `Checked ${businesses.length} businesses, sent ${threeDayWarnings} 3-day warnings, ${oneDayWarnings} 1-day warnings, ${expiredNotifications} expired notifications`);

    return {
      checked: businesses.length,
      emails: {
        threeDayWarning: threeDayWarnings,
        oneDayWarning: oneDayWarnings,
        expired: expiredNotifications,
      },
    };
  }
);

// =============================================================================
// Send Trial Warning Email (Event-triggered)
// =============================================================================

/**
 * Send trial warning email - triggered by event
 */
export const sendTrialWarningEvent = inngest.createFunction(
  {
    id: "trial-warning-send",
    name: "Send Trial Warning Email",
    retries: 3,
  },
  { event: "trial/warning.send" as any },
  async ({ event, step }) => {
    const { businessId, daysRemaining } = event.data as { businessId: string; daysRemaining: number };
    const supabase = createAdminClient();

    // Fetch business details
    const businessData = await step.run("fetch-business", async () => {
      const { data, error } = await (supabase as any)
        .from("businesses")
        .select(`
          id,
          name,
          subscription_status,
          trial_email_3day_sent,
          trial_email_1day_sent,
          users!inner (
            email
          )
        `)
        .eq("id", businessId)
        .single();

      if (error || !data) {
        throw new Error("Business not found");
      }

      return data;
    });

    // Check if still trialing
    if (businessData.subscription_status !== "trialing") {
      return { skipped: true, reason: "Not in trial anymore" };
    }

    // Check if already sent
    if (daysRemaining === 3 && businessData.trial_email_3day_sent) {
      return { skipped: true, reason: "3-day warning already sent" };
    }
    if (daysRemaining === 1 && businessData.trial_email_1day_sent) {
      return { skipped: true, reason: "1-day warning already sent" };
    }

    const ownerEmail = businessData.users?.email;
    if (!ownerEmail) {
      return { skipped: true, reason: "No owner email" };
    }

    // Send the email
    await step.run("send-email", async () => {
      await sendTrialWarningEmail(ownerEmail, businessData.name, daysRemaining, businessId);
    });

    // Update flag
    await step.run("update-flag", async () => {
      const updateField = daysRemaining === 3 ? "trial_email_3day_sent" : "trial_email_1day_sent";
      await (supabase as any)
        .from("businesses")
        .update({ [updateField]: true })
        .eq("id", businessId);
    });

    return { success: true, businessId, daysRemaining };
  }
);

// =============================================================================
// Send Trial Expired Email (Event-triggered)
// =============================================================================

/**
 * Send trial expired email - triggered by event
 */
export const sendTrialExpiredEvent = inngest.createFunction(
  {
    id: "trial-expired-send",
    name: "Send Trial Expired Email",
    retries: 3,
  },
  { event: "trial/expired.send" as any },
  async ({ event, step }) => {
    const { businessId } = event.data as { businessId: string };
    const supabase = createAdminClient();

    // Fetch business details
    const businessData = await step.run("fetch-business", async () => {
      const { data, error } = await (supabase as any)
        .from("businesses")
        .select(`
          id,
          name,
          trial_email_expired_sent,
          users!inner (
            email
          )
        `)
        .eq("id", businessId)
        .single();

      if (error || !data) {
        throw new Error("Business not found");
      }

      return data;
    });

    // Check if already sent
    if (businessData.trial_email_expired_sent) {
      return { skipped: true, reason: "Expired email already sent" };
    }

    const ownerEmail = businessData.users?.email;
    if (!ownerEmail) {
      return { skipped: true, reason: "No owner email" };
    }

    // Send the email
    await step.run("send-email", async () => {
      await sendTrialExpiredEmail(ownerEmail, businessData.name, businessId);
    });

    // Update status and flag
    await step.run("update-status", async () => {
      await (supabase as any)
        .from("businesses")
        .update({
          subscription_status: "trial_expired",
          trial_email_expired_sent: true,
        })
        .eq("id", businessId);
    });

    return { success: true, businessId };
  }
);

// =============================================================================
// Email Helper Functions
// =============================================================================

async function sendTrialWarningEmail(
  to: string,
  businessName: string,
  daysRemaining: number,
  businessId: string
): Promise<void> {
  const upgradeUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/settings?tab=billing`;

  const subject =
    daysRemaining === 1
      ? `Your Koya trial expires tomorrow - Don't lose your AI receptionist!`
      : `Your Koya trial expires in ${daysRemaining} days`;

  const urgencyText =
    daysRemaining === 1
      ? "This is your last chance to upgrade before your AI receptionist stops answering calls."
      : `You have ${daysRemaining} days left to upgrade and keep your AI receptionist running.`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${daysRemaining === 1 ? "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)" : "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)"}; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .timer { font-size: 48px; margin: 10px 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
        .highlight-box { background: ${daysRemaining === 1 ? "#FEE2E2" : "#FEF3C7"}; border-left: 4px solid ${daysRemaining === 1 ? "#EF4444" : "#F59E0B"}; padding: 16px 20px; border-radius: 4px; margin: 20px 0; }
        .feature-list { margin: 20px 0; padding-left: 20px; }
        .feature-list li { margin: 8px 0; }
        .button { display: inline-block; background: linear-gradient(135deg, #3B82F6, #8B5CF6); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; }
        .cta { text-align: center; margin: 30px 0; }
        .footer { text-align: center; margin-top: 24px; color: #9ca3af; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="timer">${daysRemaining === 1 ? "24h" : daysRemaining + " days"}</div>
          <h1>Your Trial is ${daysRemaining === 1 ? "Almost Over" : "Ending Soon"}</h1>
        </div>
        <div class="content">
          <p>Hi there,</p>

          <div class="highlight-box">
            <strong>${urgencyText}</strong>
          </div>

          <p>During your trial, Koya has been ready to:</p>
          <ul class="feature-list">
            <li>Answer every call professionally, 24/7</li>
            <li>Book appointments directly into your calendar</li>
            <li>Take messages and send instant notifications</li>
            <li>Handle multiple calls simultaneously</li>
          </ul>

          <p>Don't let your AI receptionist go offline. Upgrade now and keep providing exceptional phone service to your customers.</p>

          <div class="cta">
            <a href="${upgradeUrl}" class="button">Upgrade Now - Keep Koya Active</a>
          </div>

          <p style="color: #6b7280; font-size: 14px;">Plans start at just $99/month with 200 minutes included.</p>
        </div>
        <div class="footer">
          <p>Koya - Your AI Phone Receptionist for ${businessName}</p>
          <p>You're receiving this because your trial is ending soon.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Your Koya trial ${daysRemaining === 1 ? "expires tomorrow" : `expires in ${daysRemaining} days`}

${urgencyText}

Upgrade now to keep your AI receptionist active: ${upgradeUrl}

Plans start at just $99/month with 200 minutes included.

--
Koya - Your AI Phone Receptionist for ${businessName}
  `.trim();

  try {
    await sendEmail({ to, subject, html, text });
    logInfo("Trial Warning Email", `Sent ${daysRemaining}-day warning to ${to} for business ${businessId}`);
  } catch (error) {
    logError("Trial Warning Email", error);
    throw error;
  }
}

async function sendTrialExpiredEmail(
  to: string,
  businessName: string,
  businessId: string
): Promise<void> {
  const upgradeUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/settings?tab=billing`;

  const subject = `Your Koya trial has ended - Reactivate your AI receptionist`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #6B7280 0%, #4B5563 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .status-icon { font-size: 48px; margin: 10px 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
        .alert-box { background: #FEE2E2; border-left: 4px solid #EF4444; padding: 16px 20px; border-radius: 4px; margin: 20px 0; }
        .impact-list { margin: 20px 0; padding-left: 20px; color: #6b7280; }
        .impact-list li { margin: 8px 0; }
        .button { display: inline-block; background: linear-gradient(135deg, #3B82F6, #8B5CF6); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; }
        .cta { text-align: center; margin: 30px 0; }
        .footer { text-align: center; margin-top: 24px; color: #9ca3af; font-size: 12px; }
        .reassurance { background: white; padding: 16px; border-radius: 8px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="status-icon">&#9888;</div>
          <h1>Trial Period Ended</h1>
        </div>
        <div class="content">
          <p>Hi there,</p>

          <div class="alert-box">
            <strong>Your 14-day free trial has ended.</strong> Your AI receptionist is now inactive and won't answer calls.
          </div>

          <p>While your trial is expired:</p>
          <ul class="impact-list">
            <li>Incoming calls won't be answered by Koya</li>
            <li>No new appointments can be booked via phone</li>
            <li>Missed call alerts are paused</li>
          </ul>

          <div class="reassurance">
            <strong>Good news:</strong> All your settings, FAQs, and preferences are saved. Upgrade now and Koya will be back online instantly - no reconfiguration needed!
          </div>

          <div class="cta">
            <a href="${upgradeUrl}" class="button">Reactivate Koya Now</a>
          </div>

          <p style="color: #6b7280; font-size: 14px; text-align: center;">
            Plans start at just $99/month. Cancel anytime.
          </p>
        </div>
        <div class="footer">
          <p>Koya - Your AI Phone Receptionist for ${businessName}</p>
          <p>Questions? Reply to this email for support.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Your Koya trial has ended

Your 14-day free trial has ended. Your AI receptionist is now inactive and won't answer calls.

Reactivate your AI receptionist: ${upgradeUrl}

All your settings are saved - upgrade and Koya will be back online instantly!

Plans start at just $99/month. Cancel anytime.

--
Koya - Your AI Phone Receptionist for ${businessName}
  `.trim();

  try {
    await sendEmail({ to, subject, html, text });
    logInfo("Trial Expired Email", `Sent expired notification to ${to} for business ${businessId}`);
  } catch (error) {
    logError("Trial Expired Email", error);
    throw error;
  }
}
