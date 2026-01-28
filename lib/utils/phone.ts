/**
 * Phone Number Utility Functions
 *
 * Extracted from lib/twilio/index.ts to avoid circular dependencies.
 * These functions are used by both lib/twilio and lib/db/sms-opt-outs.
 */

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
