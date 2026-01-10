/**
 * Koya Caller - Inngest Module
 * Session 21: Background Jobs
 * Spec Reference: Part 16, Lines 1918-1968
 *
 * Central export for all Inngest functions and client.
 */

// Export the client
export { inngest } from "./client";
export type { KoyaEvents } from "./client";

// Export all functions
export {
  processPromptRegeneration,
  processRegenerationQueue,
} from "./functions/prompt-regeneration";

export {
  checkExpiringTokens,
  refreshCalendarToken,
} from "./functions/calendar-refresh";

export {
  checkUsageAlerts,
  sendUsageAlertEvent,
  resetUsageAlerts,
} from "./functions/usage-alerts";

export {
  checkAppointmentReminders,
  sendAppointmentReminderEvent,
} from "./functions/appointment-reminders";

export {
  sendMissedCallAlertEvent,
  sendFollowUpText,
} from "./functions/missed-call-alerts";

export {
  sendWeeklyReports,
  sendWeeklyReportEvent,
} from "./functions/weekly-reports";

export {
  checkScheduledPosts,
  publishScheduledPost,
} from "./functions/blog-publish";

// Collect all functions for the serve handler
import { processPromptRegeneration, processRegenerationQueue } from "./functions/prompt-regeneration";
import { checkExpiringTokens, refreshCalendarToken } from "./functions/calendar-refresh";
import { checkUsageAlerts, sendUsageAlertEvent, resetUsageAlerts } from "./functions/usage-alerts";
import { checkAppointmentReminders, sendAppointmentReminderEvent } from "./functions/appointment-reminders";
import { sendMissedCallAlertEvent, sendFollowUpText } from "./functions/missed-call-alerts";
import { sendWeeklyReports, sendWeeklyReportEvent } from "./functions/weekly-reports";
import { checkScheduledPosts, publishScheduledPost } from "./functions/blog-publish";

export const functions = [
  // Prompt regeneration
  processPromptRegeneration,
  processRegenerationQueue,
  // Calendar token refresh
  checkExpiringTokens,
  refreshCalendarToken,
  // Usage alerts
  checkUsageAlerts,
  sendUsageAlertEvent,
  resetUsageAlerts,
  // Appointment reminders
  checkAppointmentReminders,
  sendAppointmentReminderEvent,
  // Missed call & follow-up alerts
  sendMissedCallAlertEvent,
  sendFollowUpText,
  // Weekly reports
  sendWeeklyReports,
  sendWeeklyReportEvent,
  // Blog scheduled publishing
  checkScheduledPosts,
  publishScheduledPost,
];
