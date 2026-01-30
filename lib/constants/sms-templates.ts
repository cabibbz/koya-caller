/**
 * Default SMS Templates
 * Used when custom templates are not set
 */

export const DEFAULT_SMS_TEMPLATES = {
  booking_confirmation: `{{business_name}} - Appointment Confirmed!

Service: {{service_name}}
When: {{date_time}}

Reply CANCEL to cancel.`,

  reminder_24hr: `Reminder: Your {{service_name}} appointment at {{business_name}} is tomorrow.

Scheduled: {{date_time}}

Reply CANCEL to cancel.`,

  reminder_1hr: `Reminder: Your {{service_name}} appointment at {{business_name}} is in 1 hour.

Scheduled: {{date_time}}

Reply CANCEL to cancel.`,

  missed_call_alert: `Koya: Missed call
From: {{caller_name}} ({{caller_phone}})
At: {{call_time}}

Call back or view in dashboard.`,

  message_alert: `Koya Message:
From: {{caller_name}} ({{caller_phone}})

"{{message}}"

View in dashboard for full details.`,

  transfer_alert: `Koya Transfer Alert:
Call from {{caller_name}} ({{caller_phone}})
Reason: {{reason}}

Caller is being connected to you now.`,
};
