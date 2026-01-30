/**
 * Koya Caller - TwiML Generator
 * Session 12: Full Twilio Integration
 * 
 * Spec Reference: Part 12, Lines 1573-1594 (TwiML fallback)
 * 
 * Generates TwiML (Twilio Markup Language) responses for voice calls.
 * Used as fallback when Retell is unavailable.
 */

// ============================================
// TwiML Response Types
// ============================================

export interface TwiMLOptions {
  voice?: "alice" | "man" | "woman" | "Polly.Joanna" | "Polly.Matthew";
  language?: "en-US" | "es-US";
}

// ============================================
// TwiML Builders
// ============================================

/**
 * Create base TwiML response wrapper
 */
function wrapResponse(content: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
${content}
</Response>`;
}

/**
 * Generate a Say element with optional voice
 */
function say(text: string, options: TwiMLOptions = {}): string {
  const voice = options.voice || "Polly.Joanna";
  const language = options.language || "en-US";
  return `  <Say voice="${voice}" language="${language}">${escapeXml(text)}</Say>`;
}

/**
 * Generate a Pause element
 */
function pause(lengthSeconds: number = 1): string {
  return `  <Pause length="${lengthSeconds}"/>`;
}

/**
 * Generate a Gather element for collecting input
 */
function gather(
  content: string,
  options: {
    numDigits?: number;
    action?: string;
    method?: "GET" | "POST";
    timeout?: number;
    input?: "dtmf" | "speech" | "dtmf speech";
  } = {}
): string {
  const attrs: string[] = [];
  if (options.numDigits) attrs.push(`numDigits="${options.numDigits}"`);
  if (options.action) attrs.push(`action="${escapeXml(options.action)}"`);
  if (options.method) attrs.push(`method="${options.method}"`);
  if (options.timeout) attrs.push(`timeout="${options.timeout}"`);
  if (options.input) attrs.push(`input="${options.input}"`);
  
  return `  <Gather ${attrs.join(" ")}>
${content}
  </Gather>`;
}

/**
 * Generate a Record element for voicemail
 */
function record(options: {
  action?: string;
  method?: "GET" | "POST";
  maxLength?: number;
  playBeep?: boolean;
  finishOnKey?: string;
  transcribe?: boolean;
  transcribeCallback?: string;
} = {}): string {
  const attrs: string[] = [];
  if (options.action) attrs.push(`action="${escapeXml(options.action)}"`);
  if (options.method) attrs.push(`method="${options.method}"`);
  if (options.maxLength) attrs.push(`maxLength="${options.maxLength}"`);
  if (options.playBeep !== undefined) attrs.push(`playBeep="${options.playBeep}"`);
  if (options.finishOnKey) attrs.push(`finishOnKey="${options.finishOnKey}"`);
  if (options.transcribe) attrs.push(`transcribe="${options.transcribe}"`);
  if (options.transcribeCallback) attrs.push(`transcribeCallback="${escapeXml(options.transcribeCallback)}"`);
  
  return `  <Record ${attrs.join(" ")}/>`;
}

/**
 * Generate a Dial element for call transfer
 */
function dial(number: string, options: {
  action?: string;
  method?: "GET" | "POST";
  timeout?: number;
  callerId?: string;
  record?: "do-not-record" | "record-from-answer" | "record-from-ringing";
} = {}): string {
  const attrs: string[] = [];
  if (options.action) attrs.push(`action="${escapeXml(options.action)}"`);
  if (options.method) attrs.push(`method="${options.method}"`);
  if (options.timeout) attrs.push(`timeout="${options.timeout}"`);
  if (options.callerId) attrs.push(`callerId="${options.callerId}"`);
  if (options.record) attrs.push(`record="${options.record}"`);
  
  return `  <Dial ${attrs.join(" ")}>${escapeXml(number)}</Dial>`;
}

/**
 * Generate a Hangup element
 */
function hangup(): string {
  return `  <Hangup/>`;
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ============================================
// Pre-built TwiML Responses
// ============================================

/**
 * Basic fallback greeting when Retell is unavailable
 */
export function generateFallbackGreeting(params: {
  businessName: string;
  hasBackupNumber: boolean;
  appUrl: string;
}): string {
  const { businessName, hasBackupNumber, appUrl } = params;
  
  const greeting = say(
    `Thank you for calling ${businessName}. Our AI assistant is temporarily unavailable.`
  );
  
  if (hasBackupNumber) {
    const options = gather(
      say("Press 1 to leave a message, or press 2 to speak with someone directly."),
      {
        numDigits: 1,
        action: `${appUrl}/api/twilio/fallback/menu`,
        method: "POST",
        timeout: 5,
      }
    );
    
    return wrapResponse(`
${greeting}
${pause(1)}
${options}
${say("We didn't receive your selection. Please leave a message after the beep.")}`);
  } else {
    return wrapResponse(`
${greeting}
${pause(1)}
${say("Please leave a message after the beep and we'll get back to you as soon as possible.")}
${record({
  maxLength: 120,
  playBeep: true,
  finishOnKey: "#",
  action: `${appUrl}/api/twilio/fallback/recording`,
  method: "POST",
})}`);
  }
}

/**
 * Handle menu selection from fallback
 */
export function generateFallbackMenuResponse(params: {
  digit: string;
  backupNumber?: string;
  appUrl: string;
}): string {
  const { digit, backupNumber, appUrl } = params;
  
  if (digit === "1") {
    // Leave a message
    return wrapResponse(`
${say("Please leave your message after the beep. Press pound when finished.")}
${record({
  maxLength: 120,
  playBeep: true,
  finishOnKey: "#",
  action: `${appUrl}/api/twilio/fallback/recording`,
  method: "POST",
})}`);
  } else if (digit === "2" && backupNumber) {
    // Transfer to backup number
    return wrapResponse(`
${say("Please hold while we connect you.")}
${dial(backupNumber, {
  timeout: 30,
  action: `${appUrl}/api/twilio/fallback/dial-status`,
  method: "POST",
})}`);
  } else {
    // Invalid selection or no backup
    return wrapResponse(`
${say("I'm sorry, that's not a valid option. Please leave a message after the beep.")}
${record({
  maxLength: 120,
  playBeep: true,
  finishOnKey: "#",
  action: `${appUrl}/api/twilio/fallback/recording`,
  method: "POST",
})}`);
  }
}

/**
 * Response after recording is complete
 */
export function generateRecordingComplete(): string {
  return wrapResponse(`
${say("Thank you for your message. Someone will get back to you shortly. Goodbye.")}
${hangup()}`);
}

/**
 * Handle dial status (when transfer attempt completes)
 */
export function generateDialStatusResponse(params: {
  dialCallStatus: string;
  appUrl: string;
}): string {
  const { dialCallStatus, appUrl } = params;
  
  // If call wasn't answered, offer voicemail
  if (dialCallStatus !== "completed" && dialCallStatus !== "answered") {
    return wrapResponse(`
${say("We were unable to connect you. Please leave a message after the beep.")}
${record({
  maxLength: 120,
  playBeep: true,
  finishOnKey: "#",
  action: `${appUrl}/api/twilio/fallback/recording`,
  method: "POST",
})}`);
  }
  
  // Call was connected and completed
  return wrapResponse(`${hangup()}`);
}

/**
 * After-hours greeting
 */
export function generateAfterHoursGreeting(params: {
  businessName: string;
  businessHours?: string;  // e.g., "Monday through Friday, 9am to 5pm"
  canBook?: boolean;
  appUrl: string;
}): string {
  const { businessName, businessHours, canBook, appUrl } = params;
  
  let greeting = `Thank you for calling ${businessName}. We are currently closed.`;
  
  if (businessHours) {
    greeting += ` Our business hours are ${businessHours}.`;
  }
  
  if (canBook) {
    greeting += " You can still book an appointment by staying on the line.";
  }
  
  return wrapResponse(`
${say(greeting)}
${pause(1)}
${say("Please leave a message after the beep and we'll get back to you on the next business day.")}
${record({
  maxLength: 120,
  playBeep: true,
  finishOnKey: "#",
  action: `${appUrl}/api/twilio/fallback/recording`,
  method: "POST",
})}`);
}

/**
 * Minutes exhausted greeting
 */
export function generateMinutesExhaustedGreeting(params: {
  businessName: string;
  hasBackupNumber: boolean;
  backupNumber?: string;
  appUrl: string;
}): string {
  const { businessName, hasBackupNumber, backupNumber, appUrl } = params;
  
  const greeting = say(
    `Thank you for calling ${businessName}. We're experiencing high call volume.`
  );
  
  if (hasBackupNumber && backupNumber) {
    return wrapResponse(`
${greeting}
${pause(1)}
${say("Please hold while we connect you to a team member.")}
${dial(backupNumber, {
  timeout: 30,
  action: `${appUrl}/api/twilio/fallback/dial-status`,
  method: "POST",
})}`);
  } else {
    return wrapResponse(`
${greeting}
${pause(1)}
${say("Please leave a message after the beep and we'll get back to you as soon as possible.")}
${record({
  maxLength: 120,
  playBeep: true,
  finishOnKey: "#",
  action: `${appUrl}/api/twilio/fallback/recording`,
  method: "POST",
})}`);
  }
}

/**
 * Spanish fallback greeting
 */
export function generateSpanishFallbackGreeting(params: {
  businessName: string;
  appUrl: string;
}): string {
  const { businessName, appUrl } = params;
  
  return wrapResponse(`
${say(
  `Gracias por llamar a ${businessName}. Nuestro asistente no está disponible en este momento.`,
  { language: "es-US", voice: "Polly.Joanna" }
)}
${pause(1)}
${say(
  "Por favor deje un mensaje después del tono y le responderemos lo antes posible.",
  { language: "es-US", voice: "Polly.Joanna" }
)}
${record({
  maxLength: 120,
  playBeep: true,
  finishOnKey: "#",
  action: `${appUrl}/api/twilio/fallback/recording`,
  method: "POST",
})}`);
}

// ============================================
// Simple TwiML for specific use cases
// ============================================

/**
 * Simple say response
 */
export function simpleSay(text: string, language: "en-US" | "es-US" = "en-US"): string {
  return wrapResponse(say(text, { language }));
}

/**
 * Simple hangup response
 */
export function simpleHangup(): string {
  return wrapResponse(hangup());
}

/**
 * Redirect to another URL
 */
export function redirect(url: string): string {
  return wrapResponse(`  <Redirect>${escapeXml(url)}</Redirect>`);
}
