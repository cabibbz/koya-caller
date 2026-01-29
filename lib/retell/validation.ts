/**
 * Retell Function Input Validation
 * Type-safe validation for Retell AI function call inputs
 *
 * Validates date, time, phone, and other inputs from voice AI
 * to ensure data integrity before database operations.
 */

import { z } from "zod";
import { logWarning } from "@/lib/logging";
import { createAdminClient } from "@/lib/supabase/server";

// =============================================================================
// Validation Patterns
// =============================================================================

/**
 * Date format: YYYY-MM-DD
 * Examples: 2024-01-15, 2025-12-31
 */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Time format: HH:MM (24-hour)
 * Examples: 09:30, 14:00, 23:59
 */
const TIME_PATTERN = /^\d{2}:\d{2}$/;

/**
 * E.164 phone format (after normalization)
 * Examples: +14155551234, +442071234567
 * Minimum 10 digits (US domestic), maximum 15 digits (E.164 max)
 * Optional leading +
 */
const E164_PATTERN = /^\+?[1-9]\d{9,14}$/;

// =============================================================================
// Phone Number Normalization
// =============================================================================

/**
 * Valid phone input pattern - only allows digits, spaces, dashes, parentheses, dots, and leading +
 * This prevents inputs like "+abc123" from being normalized to "+123"
 */
const VALID_PHONE_INPUT_PATTERN = /^[+]?[\d\s\-().]+$/;

/**
 * Normalize a phone number to E.164-like format
 * Strips all non-digit characters except leading +
 * Returns empty string if input contains invalid characters
 */
export function normalizePhoneNumber(phone: string): string {
  // Check that input only contains valid phone characters before normalization
  if (!VALID_PHONE_INPUT_PATTERN.test(phone)) {
    return ""; // Return empty string for invalid input, which will fail E164 validation
  }
  // Preserve leading + if present
  const hasPlus = phone.startsWith("+");
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Validate a phone number against E.164 format
 */
export function isValidE164Phone(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  return E164_PATTERN.test(normalized);
}

// =============================================================================
// Date/Time Validation Helpers
// =============================================================================

/**
 * Validate date format and ensure it's a real date
 */
export function isValidDateFormat(date: string): boolean {
  if (!DATE_PATTERN.test(date)) {
    return false;
  }

  // Parse and validate the date is real (e.g., no Feb 30)
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);

  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

/**
 * Validate time format and ensure it's a valid time
 */
export function isValidTimeFormat(time: string): boolean {
  if (!TIME_PATTERN.test(time)) {
    return false;
  }

  const [hours, minutes] = time.split(":").map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

// =============================================================================
// Zod Schemas
// =============================================================================

/**
 * Custom Zod refinement for date format validation
 */
const dateSchema = z
  .string()
  .refine(isValidDateFormat, {
    message: "Date must be in YYYY-MM-DD format (e.g., 2024-01-15)",
  });

/**
 * Custom Zod refinement for time format validation
 */
const timeSchema = z
  .string()
  .refine(isValidTimeFormat, {
    message: "Time must be in HH:MM format (e.g., 14:30)",
  });

/**
 * Custom Zod refinement for phone validation
 * Transforms to normalized format
 */
const phoneSchema = z
  .string()
  .transform(normalizePhoneNumber)
  .refine(isValidE164Phone, {
    message: "Phone number must be a valid format (e.g., +14155551234 or 4155551234)",
  });

/**
 * Customer name validation
 * - Must be non-empty
 * - Reasonable length (2-100 characters)
 * - Basic sanitization
 */
const customerNameSchema = z
  .string()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name must be 100 characters or less")
  .transform((name) => name.trim())
  .refine((name) => name.length >= 2, {
    message: "Name must be at least 2 characters after trimming",
  });

/**
 * Service name validation (basic string validation)
 * Actual service existence is validated separately against the database
 */
const serviceNameSchema = z
  .string()
  .min(1, "Service name is required")
  .max(200, "Service name must be 200 characters or less")
  .transform((s) => s.trim());

/**
 * Optional email validation
 * Accepts string, null, or undefined; outputs string | undefined
 */
const optionalEmailSchema = z
  .union([z.string().email("Invalid email format"), z.literal("")])
  .optional()
  .transform((e): string | undefined => (e && e.length > 0 ? e : undefined));

/**
 * Optional notes validation
 * Accepts string, null, or undefined; outputs string | undefined
 */
const optionalNotesSchema = z
  .string()
  .max(1000, "Notes must be 1000 characters or less")
  .optional()
  .transform((n): string | undefined => {
    if (!n) return undefined;
    const trimmed = n.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  });

// =============================================================================
// Function-Specific Schemas
// =============================================================================

/**
 * Schema for book_appointment function arguments
 */
export const BookAppointmentSchema = z.object({
  date: dateSchema,
  time: timeSchema,
  customer_name: customerNameSchema,
  customer_phone: phoneSchema,
  customer_email: optionalEmailSchema,
  service: serviceNameSchema,
  notes: optionalNotesSchema,
});

export type BookAppointmentInput = z.infer<typeof BookAppointmentSchema>;

/**
 * Schema for check_availability function arguments
 */
export const CheckAvailabilitySchema = z.object({
  date: dateSchema,
  service: serviceNameSchema.optional(),
});

export type CheckAvailabilityInput = z.infer<typeof CheckAvailabilitySchema>;

/**
 * Schema for take_message function arguments
 */
export const TakeMessageSchema = z.object({
  caller_name: customerNameSchema,
  caller_phone: phoneSchema,
  message: z
    .string()
    .min(1, "Message is required")
    .max(2000, "Message must be 2000 characters or less")
    .transform((m) => m.trim()),
  urgency: z.enum(["low", "normal", "high", "emergency"], {
    errorMap: () => ({ message: "Urgency must be low, normal, high, or emergency" }),
  }),
});

export type TakeMessageInput = z.infer<typeof TakeMessageSchema>;

/**
 * Schema for send_sms function arguments
 */
export const SendSmsSchema = z.object({
  message: z
    .string()
    .min(1, "Message is required")
    .max(1600, "Message must be 1600 characters or less"),
  to_number: phoneSchema.optional(),
});

export type SendSmsInput = z.infer<typeof SendSmsSchema>;

/**
 * Schema for send_email function arguments
 */
export const SendEmailSchema = z.object({
  to_email: z
    .string()
    .email("Please provide a valid email address"),
  subject: z
    .string()
    .min(1, "Subject is required")
    .max(200, "Subject must be 200 characters or less"),
  body: z
    .string()
    .min(1, "Email body is required")
    .max(10000, "Email body must be 10000 characters or less"),
});

export type SendEmailInput = z.infer<typeof SendEmailSchema>;

/**
 * Optional interest validation
 * Accepts string, null, or undefined; outputs string | undefined
 */
const optionalInterestSchema = z
  .string()
  .max(500, "Interest must be 500 characters or less")
  .optional()
  .transform((i): string | undefined => {
    if (!i) return undefined;
    const trimmed = i.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  });

/**
 * Schema for create_lead function arguments
 */
export const CreateLeadSchema = z.object({
  name: customerNameSchema,
  email: optionalEmailSchema,
  phone: phoneSchema,
  interest: optionalInterestSchema,
  notes: optionalNotesSchema,
});

export type CreateLeadInput = z.infer<typeof CreateLeadSchema>;

/**
 * Schema for check_reservation_availability function arguments
 */
export const CheckReservationSchema = z.object({
  date: dateSchema,
  time: timeSchema.optional(),
  party_size: z
    .number()
    .int("Party size must be a whole number")
    .min(1, "Party size must be at least 1")
    .max(100, "Party size must be 100 or less"),
});

export type CheckReservationInput = z.infer<typeof CheckReservationSchema>;

/**
 * Schema for check_inventory function arguments
 */
export const CheckInventorySchema = z.object({
  product_name: z.string().min(1, "Product name is required").max(200),
  quantity: z.number().int().min(1).max(10000).default(1),
});

export type CheckInventoryInput = z.infer<typeof CheckInventorySchema>;

/**
 * Schema for check_order_status function arguments
 */
export const CheckOrderStatusSchema = z.object({
  order_id: z.string().min(1, "Order ID is required").max(100),
  customer_phone: phoneSchema.optional(),
  customer_email: z.string().email().optional(),
});

export type CheckOrderStatusInput = z.infer<typeof CheckOrderStatusSchema>;

/**
 * Schema for process_payment function arguments
 */
export const ProcessPaymentSchema = z.object({
  amount_cents: z
    .number()
    .int("Amount must be a whole number")
    .min(50, "Amount must be at least 50 cents")
    .max(99999999, "Amount exceeds maximum allowed"),
  payment_type: z.enum(["deposit", "balance", "full"], {
    errorMap: () => ({ message: "Payment type must be deposit, balance, or full" }),
  }),
  appointment_id: z
    .string()
    .uuid("Invalid appointment ID format")
    .optional(),
  customer_phone: phoneSchema.optional(),
  customer_email: optionalEmailSchema,
  description: z
    .string()
    .max(500, "Description must be 500 characters or less")
    .optional()
    .transform((d): string | undefined => d?.trim() || undefined),
});

export type ProcessPaymentInput = z.infer<typeof ProcessPaymentSchema>;

/**
 * Schema for transfer_call function arguments
 */
export const TransferCallSchema = z.object({
  transfer_to: phoneSchema,
  reason: z
    .string()
    .min(1, "Transfer reason is required")
    .max(500, "Reason must be 500 characters or less")
    .transform((r) => r.trim()),
  warm_transfer: z.boolean().optional().default(false),
  announce_caller: z.boolean().optional().default(true),
});

export type TransferCallInput = z.infer<typeof TransferCallSchema>;

/**
 * Schema for end_call function arguments
 */
export const EndCallSchema = z.object({
  reason: z.enum(
    [
      "completed",
      "customer_request",
      "transfer",
      "voicemail",
      "no_response",
      "after_hours",
      "error",
      "spam",
    ],
    {
      errorMap: () => ({
        message: "Reason must be one of: completed, customer_request, transfer, voicemail, no_response, after_hours, error, spam",
      }),
    }
  ),
  summary: z
    .string()
    .max(1000, "Summary must be 1000 characters or less")
    .optional()
    .transform((s): string | undefined => s?.trim() || undefined),
  follow_up_required: z.boolean().optional().default(false),
});

export type EndCallInput = z.infer<typeof EndCallSchema>;

// =============================================================================
// Validation Result Types
// =============================================================================

export interface ValidationSuccess<T> {
  success: true;
  data: T;
}

export interface ValidationError {
  success: false;
  error: string;
  fieldErrors: Record<string, string>;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate input against a Zod schema with user-friendly error messages
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown,
  context: string
): ValidationResult<T> {
  const result = schema.safeParse(input);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  // Extract field-level errors
  const fieldErrors: Record<string, string> = {};
  const errorMessages: string[] = [];

  for (const issue of result.error.issues) {
    const field = issue.path.join(".");
    const message = issue.message;

    if (field) {
      fieldErrors[field] = message;
    }
    errorMessages.push(field ? `${field}: ${message}` : message);
  }

  // Log validation failure for debugging (only field names to avoid PII leakage)
  const inputFields = input && typeof input === "object" ? Object.keys(input as object).join(", ") : "unknown";
  logWarning(
    `${context} Validation`,
    `Validation failed: ${errorMessages.join("; ")} | Fields: ${inputFields}`
  );

  // Create user-friendly error message
  const userMessage = createUserFriendlyError(fieldErrors);

  return {
    success: false,
    error: userMessage,
    fieldErrors,
  };
}

/**
 * Create a user-friendly error message for the AI to relay to the caller
 */
function createUserFriendlyError(fieldErrors: Record<string, string>): string {
  const errorParts: string[] = [];

  for (const [field, error] of Object.entries(fieldErrors)) {
    switch (field) {
      case "date":
        errorParts.push("I didn't quite catch the date. Could you give me the date in a format like January 15th, 2024?");
        break;
      case "time":
        errorParts.push("I need the time in a format like 2:30 PM or 14:30.");
        break;
      case "customer_phone":
      case "caller_phone":
      case "phone":
        errorParts.push("Could you repeat your phone number? I want to make sure I have it right.");
        break;
      case "customer_name":
      case "caller_name":
      case "name":
        errorParts.push("I didn't catch your name clearly. Could you spell it for me?");
        break;
      case "service":
        errorParts.push("Which service would you like to book?");
        break;
      case "message":
        errorParts.push("What message would you like me to pass along?");
        break;
      case "urgency":
        errorParts.push("How urgent is this - is it an emergency, high priority, normal, or low priority?");
        break;
      case "party_size":
        errorParts.push("How many people will be in your party?");
        break;
      default:
        // Use the actual error message for unknown fields
        errorParts.push(error);
    }
  }

  // Return the first error (most relevant for a phone conversation)
  return errorParts[0] || "I need a bit more information to complete this request.";
}

// =============================================================================
// Service Validation
// =============================================================================

/**
 * Validate that a service exists for the given business
 * Returns the service info if found, or null if not found
 */
export async function validateServiceExists(
  businessId: string,
  serviceName: string
): Promise<{
  exists: boolean;
  service?: { id: string; name: string; duration_minutes: number };
  suggestion?: string;
}> {
  const supabase = createAdminClient();

  // First try exact match (case-insensitive)
  const { data: exactMatch } = await supabase
    .from("services")
    .select("id, name, duration_minutes")
    .eq("business_id", businessId)
    .ilike("name", serviceName)
    .single();

  if (exactMatch) {
    return {
      exists: true,
      service: exactMatch as { id: string; name: string; duration_minutes: number },
    };
  }

  // Try partial match - escape SQL wildcards to prevent pattern injection
  const escapedServiceName = serviceName.replace(/%/g, "\\%").replace(/_/g, "\\_");
  const { data: partialMatches } = await supabase
    .from("services")
    .select("id, name, duration_minutes")
    .eq("business_id", businessId)
    .ilike("name", `%${escapedServiceName}%`)
    .limit(3);

  const matches = partialMatches as Array<{ id: string; name: string; duration_minutes: number }> | null;

  if (matches && matches.length > 0) {
    // If there's exactly one partial match, use it
    if (matches.length === 1) {
      return {
        exists: true,
        service: matches[0],
      };
    }

    // Multiple matches - suggest options
    const suggestions = matches.map((s) => s.name).join(", ");
    return {
      exists: false,
      suggestion: `Did you mean one of these: ${suggestions}?`,
    };
  }

  // No matches - get all available services for suggestion
  const { data: allServices } = await supabase
    .from("services")
    .select("name")
    .eq("business_id", businessId)
    .eq("is_bookable", true)
    .order("sort_order")
    .limit(5);

  const available = allServices as Array<{ name: string }> | null;

  if (available && available.length > 0) {
    const availableList = available.map((s) => s.name).join(", ");
    return {
      exists: false,
      suggestion: `I don't see that service. Our available services are: ${availableList}. Which would you like?`,
    };
  }

  return {
    exists: false,
    suggestion: "I couldn't find that service. Could you tell me more about what you're looking for?",
  };
}

// =============================================================================
// Convenience Validators
// =============================================================================

/**
 * Validate book_appointment inputs
 */
export function validateBookAppointment(
  input: unknown
): ValidationResult<BookAppointmentInput> {
  return validateInput(BookAppointmentSchema, input, "Book Appointment");
}

/**
 * Validate check_availability inputs
 */
export function validateCheckAvailability(
  input: unknown
): ValidationResult<CheckAvailabilityInput> {
  return validateInput(CheckAvailabilitySchema, input, "Check Availability");
}

/**
 * Validate take_message inputs
 */
export function validateTakeMessage(
  input: unknown
): ValidationResult<TakeMessageInput> {
  return validateInput(TakeMessageSchema, input, "Take Message");
}

/**
 * Validate send_sms inputs
 */
export function validateSendSms(
  input: unknown
): ValidationResult<SendSmsInput> {
  return validateInput(SendSmsSchema, input, "Send SMS");
}

/**
 * Validate send_email inputs
 */
export function validateSendEmail(
  input: unknown
): ValidationResult<SendEmailInput> {
  return validateInput(SendEmailSchema, input, "Send Email");
}

/**
 * Validate create_lead inputs
 */
export function validateCreateLead(
  input: unknown
): ValidationResult<CreateLeadInput> {
  return validateInput(CreateLeadSchema, input, "Create Lead");
}

/**
 * Validate check_reservation_availability inputs
 */
export function validateCheckReservation(
  input: unknown
): ValidationResult<CheckReservationInput> {
  return validateInput(CheckReservationSchema, input, "Check Reservation");
}

/**
 * Validate check_inventory inputs
 */
export function validateCheckInventory(
  input: unknown
): ValidationResult<CheckInventoryInput> {
  return validateInput(CheckInventorySchema, input, "Check Inventory") as ValidationResult<CheckInventoryInput>;
}

/**
 * Validate check_order_status inputs
 */
export function validateCheckOrderStatus(
  input: unknown
): ValidationResult<CheckOrderStatusInput> {
  return validateInput(CheckOrderStatusSchema, input, "Check Order Status");
}

/**
 * Validate process_payment inputs
 */
export function validateProcessPayment(
  input: unknown
): ValidationResult<ProcessPaymentInput> {
  return validateInput(ProcessPaymentSchema, input, "Process Payment");
}

/**
 * Validate transfer_call inputs
 */
export function validateTransferCall(
  input: unknown
): ValidationResult<TransferCallInput> {
  return validateInput(TransferCallSchema, input, "Transfer Call") as ValidationResult<TransferCallInput>;
}

/**
 * Validate end_call inputs
 */
export function validateEndCall(
  input: unknown
): ValidationResult<EndCallInput> {
  return validateInput(EndCallSchema, input, "End Call") as ValidationResult<EndCallInput>;
}
