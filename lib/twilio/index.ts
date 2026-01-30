/**
 * Koya Caller - Twilio Integration
 * Session 12: Full Twilio Integration
 *
 * Spec Reference: Part 12, Lines 1534-1594
 *
 * Provides:
 * - Twilio client initialization
 * - SMS sending functions with opt-out checking
 * - Phone number management
 */

import Twilio from "twilio";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SMS_TEMPLATES } from "@/lib/constants/sms-templates";
import { isOptedOut } from "@/lib/db/sms-opt-outs";
// Import phone utilities from shared module to avoid circular dependencies
import { formatPhoneDisplay, isValidE164, toE164 } from "@/lib/utils/phone";
import { logInfo, logError, logWarning } from "@/lib/logging";

// Re-export phone utilities for backward compatibility
export { formatPhoneDisplay, isValidE164, toE164 };

// Environment variables
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

// Check if Twilio is configured
export function isTwilioConfigured(): boolean {
  return !!(accountSid && authToken);
}

// Get Twilio client (singleton pattern)
let twilioClient: Twilio.Twilio | null = null;

export function getTwilioClient(): Twilio.Twilio {
  if (!isTwilioConfigured()) {
    throw new Error("Twilio credentials not configured");
  }
  
  if (!twilioClient) {
    twilioClient = Twilio(accountSid!, authToken!);
  }
  
  return twilioClient;
}

// ============================================
// SMS Types
// ============================================

export type SMSMessageType = 
  | "booking_confirmation"
  | "reminder"
  | "message_alert"
  | "usage_alert"
  | "transfer_alert";

export interface SendSMSParams {
  to: string;           // E.164 format: +14155551234
  from?: string;        // E.164 format, or use messaging service
  body: string;
  messageType: SMSMessageType;
  businessId?: string;  // Required for opt-out checking (TCPA compliance)
  skipOptOutCheck?: boolean; // Set to true for system messages (e.g., usage alerts)
}

export interface SMSResult {
  success: boolean;
  sid?: string;
  error?: string;
  skipped?: boolean;  // True if message was skipped due to opt-out
}

// ============================================
// Core SMS Function
// ============================================

/**
 * Send an SMS message via Twilio
 *
 * Uses Messaging Service SID if available (for A2P 10DLC compliance),
 * otherwise uses the provided 'from' number.
 *
 * TCPA Compliance: Checks opt-out status before sending if businessId provided.
 */
export async function sendSMS(params: SendSMSParams): Promise<SMSResult> {
  const { to, from, body, businessId, skipOptOutCheck } = params;

  // Validate phone number format
  if (!to.match(/^\+1\d{10}$/)) {
    return { success: false, error: "Invalid phone number format" };
  }

  // TCPA Compliance: Check opt-out status before sending
  if (businessId && !skipOptOutCheck) {
    try {
      const supabase = createAdminClient();
      const optedOut = await isOptedOut(supabase, businessId, to);
      if (optedOut) {
        logInfo("SMS", `Skipping send to ***${to.slice(-4)} - number has opted out`);
        return {
          success: false,
          error: "Recipient has opted out of SMS",
          skipped: true,
        };
      }
    } catch (optOutCheckError) {
      // Log error but continue - Twilio also has opt-out handling
      logError("SMS Opt-Out Check", optOutCheckError);
    }
  }

  // Check if Twilio is configured
  if (!isTwilioConfigured()) {
    // Mock mode - Twilio not configured
    logWarning("Twilio Mock", "TWILIO_ACCOUNT_SID/AUTH_TOKEN not configured - SMS not sent. Phone features will NOT work.");
    return { success: true, sid: `SM${Date.now()}mock` };
  }

  try {
    const client = getTwilioClient();

    // Build message params
    const messageParams: {
      to: string;
      body: string;
      from?: string;
      messagingServiceSid?: string;
    } = {
      to,
      body,
    };

    // Use messaging service if available (recommended for A2P 10DLC)
    if (messagingServiceSid) {
      messageParams.messagingServiceSid = messagingServiceSid;
    } else if (from) {
      messageParams.from = from;
    } else {
      return { success: false, error: "No from number or messaging service configured" };
    }

    const message = await client.messages.create(messageParams);

    return { success: true, sid: message.sid };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send SMS",
    };
  }
}

// ============================================
// Template Helpers
// ============================================

type TemplateKey =
  | "booking_confirmation"
  | "reminder_24hr"
  | "reminder_1hr"
  | "missed_call_alert"
  | "message_alert"
  | "transfer_alert";

/**
 * Substitute variables in a template string
 * Variables are in the format {{variable_name}}
 */
function substituteVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

/**
 * Fetch a custom template for a business, or return the default
 */
async function getTemplate(
  businessId: string | undefined,
  templateKey: TemplateKey
): Promise<string> {
  // Return default if no business ID
  if (!businessId) {
    return DEFAULT_SMS_TEMPLATES[templateKey];
  }

  try {
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: templates } = await (supabase as any)
      .from("sms_templates")
      .select(templateKey)
      .eq("business_id", businessId)
      .single();

    // Return custom template if set, otherwise default
    if (templates?.[templateKey]) {
      return templates[templateKey];
    }

    return DEFAULT_SMS_TEMPLATES[templateKey];
  } catch {
    // On any error, fall back to default
    return DEFAULT_SMS_TEMPLATES[templateKey];
  }
}

// ============================================
// Business SMS Templates
// ============================================

/**
 * Send booking confirmation to customer
 */
export async function sendBookingConfirmation(params: {
  to: string;
  from: string;
  businessName: string;
  serviceName: string;
  dateTime: string;  // Pre-formatted date/time string
  customerName?: string;
  notes?: string;
  businessId?: string;  // For custom template lookup
}): Promise<SMSResult> {
  const { to, from, businessName, serviceName, dateTime, customerName, notes, businessId } = params;

  // Get template (custom or default)
  const template = await getTemplate(businessId, "booking_confirmation");

  // Substitute variables
  let body = substituteVariables(template, {
    business_name: businessName,
    service_name: serviceName,
    date_time: dateTime,
    customer_name: customerName || "Valued Customer",
  });

  // Append notes if provided
  if (notes) {
    body += `\n\n${notes}`;
  }

  return sendSMS({ to, from, body, messageType: "booking_confirmation", businessId });
}

/**
 * Send appointment reminder to customer
 */
export async function sendAppointmentReminder(params: {
  to: string;
  from: string;
  businessName: string;
  serviceName: string;
  dateTime: string;
  customerName?: string;
  reminderType: "1hr" | "24hr";
  businessId?: string;  // For custom template lookup
}): Promise<SMSResult> {
  const { to, from, businessName, serviceName, dateTime, customerName, reminderType, businessId } = params;

  // Get template based on reminder type
  const templateKey = reminderType === "1hr" ? "reminder_1hr" : "reminder_24hr";
  const template = await getTemplate(businessId, templateKey);

  // Substitute variables
  const body = substituteVariables(template, {
    business_name: businessName,
    service_name: serviceName,
    date_time: dateTime,
    customer_name: customerName || "Valued Customer",
  });

  return sendSMS({ to, from, body, messageType: "reminder", businessId });
}

/**
 * Send message alert to business owner
 * Note: Owner alerts skip opt-out check as these are system/operational messages
 */
export async function sendMessageAlert(params: {
  to: string;           // Owner's phone
  from: string;
  callerPhone: string;
  callerName?: string;
  message: string;
  businessId?: string;  // For custom template lookup
}): Promise<SMSResult> {
  const { to, from, callerPhone, callerName, message, businessId } = params;

  // Get template (custom or default)
  const template = await getTemplate(businessId, "message_alert");

  // Truncate long messages
  const truncatedMessage = message.length > 100 ? message.substring(0, 97) + "..." : message;

  // Substitute variables
  const body = substituteVariables(template, {
    caller_name: callerName || "Unknown",
    caller_phone: callerPhone,
    message: truncatedMessage,
  });

  // Skip opt-out check for owner alerts (these are operational messages to the business owner)
  return sendSMS({ to, from, body, messageType: "message_alert", skipOptOutCheck: true });
}

/**
 * Send missed call alert to business owner
 * Note: Owner alerts skip opt-out check as these are system/operational messages
 */
export async function sendMissedCallAlert(params: {
  to: string;           // Owner's phone
  from: string;
  callerPhone: string;
  callerName?: string;
  callTime: string;     // Pre-formatted time
  businessId?: string;  // For custom template lookup
}): Promise<SMSResult> {
  const { to, from, callerPhone, callerName, callTime, businessId } = params;

  // Get template (custom or default)
  const template = await getTemplate(businessId, "missed_call_alert");

  // Substitute variables
  const body = substituteVariables(template, {
    caller_name: callerName || "Unknown",
    caller_phone: callerPhone,
    call_time: callTime,
  });

  // Skip opt-out check for owner alerts (these are operational messages to the business owner)
  return sendSMS({ to, from, body, messageType: "message_alert", skipOptOutCheck: true });
}

/**
 * Send usage alert to business owner
 * Note: Owner alerts skip opt-out check as these are system/operational messages
 */
export async function sendUsageAlert(params: {
  to: string;           // Owner's phone
  from: string;
  percentUsed: number;
  minutesUsed: number;
  minutesIncluded: number;
}): Promise<SMSResult> {
  const { to, from, percentUsed, minutesUsed, minutesIncluded } = params;

  let body: string;

  if (percentUsed >= 100) {
    body = `Koya Usage Alert: You've used all ${minutesIncluded} included minutes this cycle. Additional calls will be billed at $0.15/min. Upgrade your plan to get more minutes.`;
  } else if (percentUsed >= 90) {
    body = `Koya Usage Alert: You've used ${percentUsed}% of your minutes (${minutesUsed}/${minutesIncluded}). Consider upgrading to avoid overage charges.`;
  } else if (percentUsed >= 75) {
    body = `Koya Usage Alert: You've used ${percentUsed}% of your minutes this cycle (${minutesUsed}/${minutesIncluded}).`;
  } else {
    body = `Koya: You've used ${percentUsed}% of your minutes (${minutesUsed}/${minutesIncluded}).`;
  }

  // Skip opt-out check for owner alerts (these are operational messages to the business owner)
  return sendSMS({ to, from, body, messageType: "usage_alert", skipOptOutCheck: true });
}

/**
 * Send transfer alert to business owner
 * (when a call is transferred/escalated)
 * Note: Owner alerts skip opt-out check as these are system/operational messages
 */
export async function sendTransferAlert(params: {
  to: string;           // Owner's phone
  from: string;
  callerPhone: string;
  callerName?: string;
  reason: string;
  businessId?: string;  // For custom template lookup
}): Promise<SMSResult> {
  const { to, from, callerPhone, callerName, reason, businessId } = params;

  // Get template (custom or default)
  const template = await getTemplate(businessId, "transfer_alert");

  // Substitute variables
  const body = substituteVariables(template, {
    caller_name: callerName || "Unknown",
    caller_phone: callerPhone,
    reason: reason,
  });

  // Skip opt-out check for owner alerts (these are operational messages to the business owner)
  return sendSMS({ to, from, body, messageType: "transfer_alert", skipOptOutCheck: true });
}

// ============================================
// Phone Number Management
// ============================================

/**
 * Search for available phone numbers
 */
export async function searchPhoneNumbers(
  areaCode: string,
  limit: number = 5
): Promise<Array<{
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
}>> {
  if (!isTwilioConfigured()) {
    // Return mock data for development
    return Array.from({ length: limit }, (_, i) => ({
      phoneNumber: `+1${areaCode}555010${i + 1}`,
      friendlyName: formatPhoneDisplay(`+1${areaCode}555010${i + 1}`),
      locality: "Mock City",
      region: "CA",
    }));
  }
  
  const client = getTwilioClient();
  
  const numbers = await client.availablePhoneNumbers("US")
    .local
    .list({
      areaCode: parseInt(areaCode, 10),
      smsEnabled: true,
      voiceEnabled: true,
      limit,
    });
  
  return numbers.map((num) => ({
    phoneNumber: num.phoneNumber,
    friendlyName: formatPhoneDisplay(num.phoneNumber),
    locality: num.locality || "Unknown",
    region: num.region || "Unknown",
  }));
}

/**
 * Provision (purchase) a phone number
 */
export async function provisionPhoneNumber(params: {
  phoneNumber: string;
  voiceUrl: string;
  voiceFallbackUrl: string;
  smsUrl: string;
  friendlyName: string;
}): Promise<{ sid: string; phoneNumber: string }> {
  const { phoneNumber, voiceUrl, voiceFallbackUrl, smsUrl, friendlyName } = params;
  
  if (!isTwilioConfigured()) {
    // Return mock data for development
    return {
      sid: `PN${Date.now()}mock`,
      phoneNumber,
    };
  }
  
  const client = getTwilioClient();
  
  const incomingPhoneNumber = await client.incomingPhoneNumbers.create({
    phoneNumber,
    voiceUrl,
    voiceFallbackUrl,
    smsUrl,
    friendlyName,
  });
  
  return {
    sid: incomingPhoneNumber.sid,
    phoneNumber: incomingPhoneNumber.phoneNumber,
  };
}

/**
 * Update a phone number's webhook URLs
 */
export async function updatePhoneNumberWebhooks(
  twilioSid: string,
  params: {
    voiceUrl?: string;
    voiceFallbackUrl?: string;
    smsUrl?: string;
  }
): Promise<void> {
  if (!isTwilioConfigured()) {
    // Mock mode - Twilio not configured
    return;
  }
  
  const client = getTwilioClient();
  await client.incomingPhoneNumbers(twilioSid).update(params);
}

/**
 * Release (delete) a phone number
 */
export async function releasePhoneNumber(twilioSid: string): Promise<void> {
  if (!isTwilioConfigured()) {
    // Mock mode - Twilio not configured
    return;
  }
  
  const client = getTwilioClient();
  await client.incomingPhoneNumbers(twilioSid).remove();
}

// Re-export types
export type { Twilio };
