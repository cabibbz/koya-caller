/**
 * Koya Caller - Appointment Reminder Background Jobs
 * Session 21: Background Jobs
 * Spec Reference: Part 7, Lines 780-783 (Notification Settings)
 *
 * Sends SMS reminders to customers before their appointments.
 * Supports 1-hour and 24-hour reminders based on business settings.
 */

import { inngest } from "../client";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAppointmentReminder } from "@/lib/twilio";
import { DateTime } from "luxon";
import { logInfo } from "@/lib/logging";

// =============================================================================
// Check for Upcoming Appointments (Scheduled Job)
// =============================================================================

/**
 * Scheduled job to find appointments needing reminders
 * Runs every 15 minutes to catch appointments within reminder windows
 */
export const checkAppointmentReminders = inngest.createFunction(
  {
    id: "appointment-check-reminders",
    name: "Check Appointment Reminders",
  },
  { cron: "*/15 * * * *" }, // Every 15 minutes
  async ({ step }) => {
    const supabase = createAdminClient();
    const now = DateTime.now();

    // Find appointments needing 24hr reminders
    // (scheduled between 23-25 hours from now, no reminder sent yet)
    const upcoming24hr = await step.run("fetch-24hr-reminders", async () => {
      const windowStart = now.plus({ hours: 23 }).toISO();
      const windowEnd = now.plus({ hours: 25 }).toISO();

      const { data, error } = await (supabase as any)
        .from("appointments")
        .select(`
          id,
          business_id,
          customer_phone,
          customer_name,
          scheduled_at,
          service_name,
          reminder_24hr_sent_at,
          businesses!inner (
            name,
            timezone,
            notification_settings (
              sms_customer_reminder
            ),
            phone_numbers (
              number
            )
          )
        `)
        .eq("status", "confirmed")
        .gte("scheduled_at", windowStart)
        .lte("scheduled_at", windowEnd)
        .is("reminder_24hr_sent_at", null);

      if (error) {
        return [];
      }

      // Filter to only businesses with 24hr reminders enabled
      return (data || []).filter(
        (apt: any) =>
          apt.businesses?.notification_settings?.sms_customer_reminder === "24hr" ||
          apt.businesses?.notification_settings?.sms_customer_reminder === "both"
      );
    });

    // Find appointments needing 1hr reminders
    // (scheduled between 55-65 minutes from now, no reminder sent yet)
    const upcoming1hr = await step.run("fetch-1hr-reminders", async () => {
      const windowStart = now.plus({ minutes: 55 }).toISO();
      const windowEnd = now.plus({ minutes: 65 }).toISO();

      const { data, error } = await (supabase as any)
        .from("appointments")
        .select(`
          id,
          business_id,
          customer_phone,
          customer_name,
          scheduled_at,
          service_name,
          reminder_1hr_sent_at,
          businesses!inner (
            name,
            timezone,
            notification_settings (
              sms_customer_reminder
            ),
            phone_numbers (
              number
            )
          )
        `)
        .eq("status", "confirmed")
        .gte("scheduled_at", windowStart)
        .lte("scheduled_at", windowEnd)
        .is("reminder_1hr_sent_at", null);

      if (error) {
        return [];
      }

      // Filter to only businesses with 1hr reminders enabled
      return (data || []).filter(
        (apt: any) =>
          apt.businesses?.notification_settings?.sms_customer_reminder === "1hr" ||
          apt.businesses?.notification_settings?.sms_customer_reminder === "both"
      );
    });

    // Send events for each reminder
    const events: Array<{
      name: "appointment/reminder.send";
      data: {
        appointmentId: string;
        businessId: string;
        customerPhone: string;
        customerName: string;
        scheduledAt: string;
        serviceName: string;
        reminderType: "1hr" | "24hr";
      };
    }> = [];

    for (const apt of upcoming24hr) {
      if (apt.customer_phone) {
        events.push({
          name: "appointment/reminder.send",
          data: {
            appointmentId: apt.id,
            businessId: apt.business_id,
            customerPhone: apt.customer_phone,
            customerName: apt.customer_name || "Customer",
            scheduledAt: apt.scheduled_at,
            serviceName: apt.service_name || "Appointment",
            reminderType: "24hr",
          },
        });
      }
    }

    for (const apt of upcoming1hr) {
      if (apt.customer_phone) {
        events.push({
          name: "appointment/reminder.send",
          data: {
            appointmentId: apt.id,
            businessId: apt.business_id,
            customerPhone: apt.customer_phone,
            customerName: apt.customer_name || "Customer",
            scheduledAt: apt.scheduled_at,
            serviceName: apt.service_name || "Appointment",
            reminderType: "1hr",
          },
        });
      }
    }

    if (events.length > 0) {
      await step.sendEvent("send-reminder-events", events);
    }

    return {
      checked: {
        "24hr": upcoming24hr.length,
        "1hr": upcoming1hr.length,
      },
      remindersQueued: events.length,
    };
  }
);

// =============================================================================
// Send Individual Appointment Reminder
// =============================================================================

/**
 * Send a reminder SMS for a specific appointment
 */
export const sendAppointmentReminderEvent = inngest.createFunction(
  {
    id: "appointment-reminder-send",
    name: "Send Appointment Reminder",
    retries: 3,
  },
  { event: "appointment/reminder.send" },
  async ({ event, step }) => {
    const {
      appointmentId,
      businessId,
      customerPhone,
      customerName: _customerName,
      scheduledAt,
      serviceName,
      reminderType,
    } = event.data;

    const supabase = createAdminClient();

    // Fetch business details for formatting
    const businessData = await step.run("fetch-business", async () => {
      const { data, error } = await (supabase as any)
        .from("businesses")
        .select(`
          name,
          timezone,
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

    // Format the date/time in business timezone
    const formattedDateTime = DateTime.fromISO(scheduledAt)
      .setZone(businessData.timezone || "America/New_York")
      .toFormat("EEEE, MMMM d 'at' h:mm a");

    // Send the SMS (includes opt-out check via businessId)
    const smsResult = await step.run("send-reminder-sms", async () => {
      const fromNumber =
        businessData.phone_numbers?.[0]?.number ||
        process.env.TWILIO_PHONE_NUMBER ||
        "+10000000000";

      return await sendAppointmentReminder({
        to: customerPhone,
        from: fromNumber,
        businessName: businessData.name,
        serviceName,
        dateTime: formattedDateTime,
        reminderType,
        businessId, // Pass businessId for opt-out checking (TCPA compliance)
      });
    });

    // If SMS was skipped due to opt-out, still mark as "sent" to avoid retries
    if (smsResult.skipped) {
      logInfo("Appointment Reminder", `SMS skipped - customer opted out: ***${customerPhone.slice(-4)}`);
    }

    // Mark reminder as sent
    await step.run("mark-reminder-sent", async () => {
      const updateField =
        reminderType === "1hr" ? "reminder_1hr_sent_at" : "reminder_24hr_sent_at";

      await (supabase as any)
        .from("appointments")
        .update({ [updateField]: new Date().toISOString() })
        .eq("id", appointmentId);
    });

    return {
      success: true,
      appointmentId,
      reminderType,
      sentTo: customerPhone,
    };
  }
);
