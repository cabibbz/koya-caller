/**
 * Koya Caller - Missed Call Alerts
 * Sends SMS and/or email alerts when a call is missed
 */

import { inngest } from "../client";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMissedCallAlert, formatPhoneDisplay } from "@/lib/twilio";
import { sendMissedCallEmail } from "@/lib/email";
import { DateTime } from "luxon";
import { getDashboardUrl } from "@/lib/config";

// =============================================================================
// Missed Call Alert Event Handler
// =============================================================================

export const sendMissedCallAlertEvent = inngest.createFunction(
  {
    id: "missed-call-alert-send",
    name: "Send Missed Call Alert",
    retries: 3,
  },
  { event: "call/missed.alert" },
  async ({ event, step }) => {
    const {
      callId,
      businessId,
      callerPhone,
      callerName,
      callTime,
    } = event.data;

    const supabase = createAdminClient();

    // Fetch business and notification settings
    const businessData = await step.run("fetch-business-data", async () => {
      const { data, error } = await (supabase as any)
        .from("businesses")
        .select(`
          id,
          name,
          timezone,
          users!inner (
            id,
            email,
            phone
          ),
          phone_numbers (
            number
          ),
          notification_settings (
            sms_missed,
            email_missed
          )
        `)
        .eq("id", businessId)
        .single();

      if (error || !data) {
        throw new Error(`Business not found: ${businessId}`);
      }

      return data;
    });

    const settings = businessData.notification_settings || {};
    const ownerPhone = businessData.users?.phone;
    const ownerEmail = businessData.users?.email;
    const fromNumber = businessData.phone_numbers?.[0]?.number || process.env.TWILIO_PHONE_NUMBER;

    // Format call time in business timezone
    const formattedTime = DateTime.fromISO(callTime)
      .setZone(businessData.timezone || "America/New_York")
      .toFormat("EEEE, MMMM d 'at' h:mm a");

    const results: { sms?: boolean; email?: boolean } = {};

    // Send SMS alert if enabled
    if (settings.sms_missed !== false && ownerPhone) {
      await step.run("send-sms-alert", async () => {
        const result = await sendMissedCallAlert({
          to: ownerPhone,
          from: fromNumber || "+10000000000",
          callerPhone: formatPhoneDisplay(callerPhone),
          callerName,
          callTime: formattedTime,
        });
        results.sms = result.success;
      });
    }

    // Send email alert if enabled
    if (settings.email_missed !== false && ownerEmail) {
      await step.run("send-email-alert", async () => {
        const dashboardUrl = getDashboardUrl(`/calls?id=${callId}`);

        const result = await sendMissedCallEmail({
          to: ownerEmail,
          businessName: businessData.name,
          callerPhone: formatPhoneDisplay(callerPhone),
          callerName,
          callTime: formattedTime,
          dashboardUrl,
        });
        results.email = result.success;
      });
    }

    return {
      success: true,
      callId,
      businessId,
      alerts: results,
    };
  }
);

// =============================================================================
// Follow-up Text After Call
// =============================================================================

export const sendFollowUpText = inngest.createFunction(
  {
    id: "call-followup-send",
    name: "Send Follow-up Text After Call",
    retries: 3,
  },
  { event: "call/followup.send" },
  async ({ event, step }) => {
    const {
      callId,
      businessId,
      callerPhone,
      outcome,
      serviceName,
    } = event.data;

    const supabase = createAdminClient();

    // Fetch business settings
    const businessData = await step.run("fetch-business", async () => {
      const { data, error } = await (supabase as any)
        .from("businesses")
        .select(`
          name,
          notification_settings (
            sms_followup_enabled,
            sms_followup_template
          ),
          phone_numbers (
            number
          )
        `)
        .eq("id", businessId)
        .single();

      if (error || !data) {
        throw new Error("Business not found");
      }

      return data;
    });

    const settings = businessData.notification_settings || {};

    // Check if follow-up texts are enabled
    if (!settings.sms_followup_enabled) {
      return { skipped: true, reason: "Follow-up texts disabled" };
    }

    const fromNumber = businessData.phone_numbers?.[0]?.number || process.env.TWILIO_PHONE_NUMBER;

    // Generate appropriate message based on outcome
    let message = settings.sms_followup_template || "";

    if (!message) {
      switch (outcome) {
        case "booked":
          message = `Thanks for booking with ${businessData.name}! We look forward to seeing you. Reply HELP for assistance.`;
          break;
        case "info":
          message = `Thanks for calling ${businessData.name}! If you have any other questions, feel free to call back anytime.`;
          break;
        case "message":
          message = `Thanks for leaving a message with ${businessData.name}. We'll get back to you soon!`;
          break;
        default:
          // Don't send for missed calls or other outcomes
          return { skipped: true, reason: `No template for outcome: ${outcome}` };
      }
    }

    // Replace template variables
    message = message
      .replace("{business_name}", businessData.name)
      .replace("{service}", serviceName || "your appointment");

    // Send the SMS
    await step.run("send-followup-sms", async () => {
      const { sendSMS } = await import("@/lib/twilio");
      await sendSMS({
        to: callerPhone,
        from: fromNumber,
        body: message,
        messageType: "booking_confirmation",
      });
    });

    // Record that follow-up was sent
    await step.run("record-followup", async () => {
      await (supabase as any)
        .from("calls")
        .update({ followup_sent_at: new Date().toISOString() })
        .eq("id", callId);
    });

    return {
      success: true,
      callId,
      outcome,
      messageSent: message,
    };
  }
);
