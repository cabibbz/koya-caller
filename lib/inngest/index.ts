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
  syncExternalCalendars,
  syncBusinessCalendar,
  triggerCalendarSync,
} from "./functions/calendar-sync";

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

export {
  sendSuspiciousAuthAlert,
} from "./functions/suspicious-auth-alerts";

export {
  checkTrialExpiry,
  sendTrialWarningEvent,
  sendTrialExpiredEvent,
} from "./functions/trial-expiry";

export {
  checkPendingDeletions,
  processScheduledDeletion,
  processDeletionCancellation,
  cleanupExpiredExports,
} from "./functions/account-deletion";

export {
  processWebhookRetries,
  retryWebhookDelivery,
} from "./functions/webhook-retries";

export {
  processFailedWebhookRetries,
  cleanupOldFailedWebhooks,
  retryFailedWebhook,
} from "./functions/webhook-retry";

export {
  processOutboundCallQueue,
  checkAppointmentReminderCalls,
  retryOutboundCall,
  resetOutboundDailyCounters,
  cleanupOutboundQueue,
} from "./functions/outbound-calls";

// Collect all functions for the serve handler
import { processPromptRegeneration, processRegenerationQueue } from "./functions/prompt-regeneration";
import { syncExternalCalendars, syncBusinessCalendar } from "./functions/calendar-sync";
import { checkUsageAlerts, sendUsageAlertEvent, resetUsageAlerts } from "./functions/usage-alerts";
import { checkAppointmentReminders, sendAppointmentReminderEvent } from "./functions/appointment-reminders";
import { sendMissedCallAlertEvent, sendFollowUpText } from "./functions/missed-call-alerts";
import { sendWeeklyReports, sendWeeklyReportEvent } from "./functions/weekly-reports";
import { checkScheduledPosts, publishScheduledPost } from "./functions/blog-publish";
import { sendSuspiciousAuthAlert } from "./functions/suspicious-auth-alerts";
import { checkTrialExpiry, sendTrialWarningEvent, sendTrialExpiredEvent } from "./functions/trial-expiry";
import {
  checkPendingDeletions,
  processScheduledDeletion,
  processDeletionCancellation,
  cleanupExpiredExports,
} from "./functions/account-deletion";
import {
  processWebhookRetries,
  retryWebhookDelivery,
} from "./functions/webhook-retries";
import {
  processFailedWebhookRetries,
  cleanupOldFailedWebhooks,
  retryFailedWebhook,
} from "./functions/webhook-retry";
import {
  processOutboundCallQueue,
  checkAppointmentReminderCalls,
  retryOutboundCall,
  resetOutboundDailyCounters,
  cleanupOutboundQueue,
} from "./functions/outbound-calls";

export const functions = [
  // Prompt regeneration
  processPromptRegeneration,
  processRegenerationQueue,
  // Calendar sync
  syncExternalCalendars,
  syncBusinessCalendar,
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
  // Authentication security alerts
  sendSuspiciousAuthAlert,
  // Trial expiry emails
  checkTrialExpiry,
  sendTrialWarningEvent,
  sendTrialExpiredEvent,
  // Privacy/GDPR account deletion
  checkPendingDeletions,
  processScheduledDeletion,
  processDeletionCancellation,
  cleanupExpiredExports,
  // Webhook delivery retries (outbound)
  processWebhookRetries,
  retryWebhookDelivery,
  // Failed incoming webhook retries
  processFailedWebhookRetries,
  cleanupOldFailedWebhooks,
  retryFailedWebhook,
  // Outbound calls
  processOutboundCallQueue,
  checkAppointmentReminderCalls,
  retryOutboundCall,
  resetOutboundDailyCounters,
  cleanupOutboundQueue,
];
