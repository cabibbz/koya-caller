/**
 * Koya Caller - Twilio Integration
 * Session 12: Full Twilio Integration
 * 
 * Spec Reference: Part 12, Lines 1534-1594
 * 
 * Provides:
 * - Twilio client initialization
 * - SMS sending functions
 * - Phone number management
 */

import Twilio from "twilio";

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
}

export interface SMSResult {
  success: boolean;
  sid?: string;
  error?: string;
}

// ============================================
// Core SMS Function
// ============================================

/**
 * Send an SMS message via Twilio
 * 
 * Uses Messaging Service SID if available (for A2P 10DLC compliance),
 * otherwise uses the provided 'from' number.
 */
export async function sendSMS(params: SendSMSParams): Promise<SMSResult> {
  const { to, from, body } = params;
  
  // Validate phone number format
  if (!to.match(/^\+1\d{10}$/)) {
    return { success: false, error: "Invalid phone number format" };
  }
  
  // Check if Twilio is configured
  if (!isTwilioConfigured()) {
    // Mock mode - Twilio not configured
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
  notes?: string;
}): Promise<SMSResult> {
  const { to, from, businessName, serviceName, dateTime, notes } = params;
  
  let body = `${businessName} - Appointment Confirmed!\n\n`;
  body += `Service: ${serviceName}\n`;
  body += `When: ${dateTime}\n`;
  if (notes) {
    body += `\n${notes}`;
  }
  body += `\nReply CANCEL to cancel.`;
  
  return sendSMS({ to, from, body, messageType: "booking_confirmation" });
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
  reminderType: "1hr" | "24hr";
}): Promise<SMSResult> {
  const { to, from, businessName, serviceName, dateTime, reminderType } = params;
  
  const timeframe = reminderType === "1hr" ? "in 1 hour" : "tomorrow";
  
  const body = `Reminder: Your ${serviceName} appointment at ${businessName} is ${timeframe}.\n\nScheduled: ${dateTime}\n\nReply CANCEL to cancel.`;
  
  return sendSMS({ to, from, body, messageType: "reminder" });
}

/**
 * Send message alert to business owner
 */
export async function sendMessageAlert(params: {
  to: string;           // Owner's phone
  from: string;
  callerPhone: string;
  callerName?: string;
  message: string;
}): Promise<SMSResult> {
  const { to, from, callerPhone, callerName, message } = params;
  
  const callerInfo = callerName ? `${callerName} (${callerPhone})` : callerPhone;
  const truncatedMessage = message.length > 100 ? message.substring(0, 97) + "..." : message;
  
  const body = `Koya Message:\nFrom: ${callerInfo}\n\n"${truncatedMessage}"\n\nView in dashboard for full details.`;
  
  return sendSMS({ to, from, body, messageType: "message_alert" });
}

/**
 * Send missed call alert to business owner
 */
export async function sendMissedCallAlert(params: {
  to: string;           // Owner's phone
  from: string;
  callerPhone: string;
  callerName?: string;
  callTime: string;     // Pre-formatted time
}): Promise<SMSResult> {
  const { to, from, callerPhone, callerName, callTime } = params;
  
  const callerInfo = callerName ? `${callerName} (${callerPhone})` : callerPhone;
  
  const body = `Koya: Missed call\nFrom: ${callerInfo}\nAt: ${callTime}\n\nCall back or view in dashboard.`;
  
  return sendSMS({ to, from, body, messageType: "message_alert" });
}

/**
 * Send usage alert to business owner
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
  
  return sendSMS({ to, from, body, messageType: "usage_alert" });
}

/**
 * Send transfer alert to business owner
 * (when a call is transferred/escalated)
 */
export async function sendTransferAlert(params: {
  to: string;           // Owner's phone
  from: string;
  callerPhone: string;
  callerName?: string;
  reason: string;
}): Promise<SMSResult> {
  const { to, from, callerPhone, callerName, reason } = params;
  
  const callerInfo = callerName ? `${callerName} (${callerPhone})` : callerPhone;
  
  const body = `Koya Transfer Alert:\nCall from ${callerInfo}\nReason: ${reason}\n\nCaller is being connected to you now.`;
  
  return sendSMS({ to, from, body, messageType: "transfer_alert" });
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

// ============================================
// Utility Functions
// ============================================

/**
 * Format phone number for display: +14155551234 -> (415) 555-1234
 */
export function formatPhoneDisplay(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    const area = digits.slice(1, 4);
    const prefix = digits.slice(4, 7);
    const line = digits.slice(7, 11);
    return `(${area}) ${prefix}-${line}`;
  }
  return e164;
}

/**
 * Validate E.164 format for US numbers
 */
export function isValidE164(phone: string): boolean {
  return /^\+1\d{10}$/.test(phone);
}

/**
 * Convert various phone formats to E.164
 */
export function toE164(phone: string): string | null {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, "");
  
  // Handle different lengths
  if (digits.length === 10) {
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  
  return null;
}

// Re-export types
export type { Twilio };
