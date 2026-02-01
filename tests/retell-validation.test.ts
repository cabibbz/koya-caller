/**
 * Retell Function Validation Tests
 * Tests for input validation in Retell AI function calls
 */

import { describe, it, expect } from "vitest";
import {
  validateBookAppointment,
  validateCheckAvailability,
  validateTakeMessage,
  validateSendSms,
  validateCreateLead,
  validateCheckReservation,
  validateCheckInventory,
  validateCheckOrderStatus,
  normalizePhoneNumber,
  isValidE164Phone,
  isValidDateFormat,
  isValidTimeFormat,
} from "@/lib/retell/validation";

// =============================================================================
// Phone Number Normalization
// =============================================================================

describe("Phone Number Normalization", () => {
  describe("normalizePhoneNumber", () => {
    it("should preserve leading + and remove other non-digits", () => {
      expect(normalizePhoneNumber("+1 (415) 555-1234")).toBe("+14155551234");
      expect(normalizePhoneNumber("+44 20 7123 4567")).toBe("+442071234567");
    });

    it("should strip non-digits when no leading +", () => {
      expect(normalizePhoneNumber("(415) 555-1234")).toBe("4155551234");
      expect(normalizePhoneNumber("415.555.1234")).toBe("4155551234");
      expect(normalizePhoneNumber("415-555-1234")).toBe("4155551234");
    });

    it("should handle already clean numbers", () => {
      expect(normalizePhoneNumber("4155551234")).toBe("4155551234");
      expect(normalizePhoneNumber("+14155551234")).toBe("+14155551234");
    });
  });

  describe("isValidE164Phone", () => {
    it("should accept valid E.164 numbers", () => {
      expect(isValidE164Phone("+14155551234")).toBe(true);
      expect(isValidE164Phone("+442071234567")).toBe(true);
      expect(isValidE164Phone("14155551234")).toBe(true);
    });

    it("should reject numbers starting with 0", () => {
      expect(isValidE164Phone("04155551234")).toBe(false);
    });

    it("should reject empty or too short numbers", () => {
      expect(isValidE164Phone("")).toBe(false);
      expect(isValidE164Phone("1")).toBe(false);
    });

    it("should reject numbers that are too long", () => {
      expect(isValidE164Phone("123456789012345678")).toBe(false);
    });
  });
});

// =============================================================================
// Date/Time Format Validation
// =============================================================================

describe("Date/Time Format Validation", () => {
  describe("isValidDateFormat", () => {
    it("should accept valid YYYY-MM-DD dates", () => {
      expect(isValidDateFormat("2024-01-15")).toBe(true);
      expect(isValidDateFormat("2024-12-31")).toBe(true);
      expect(isValidDateFormat("2025-06-01")).toBe(true);
    });

    it("should reject invalid date formats", () => {
      expect(isValidDateFormat("01-15-2024")).toBe(false);
      expect(isValidDateFormat("2024/01/15")).toBe(false);
      expect(isValidDateFormat("January 15, 2024")).toBe(false);
      expect(isValidDateFormat("2024-1-15")).toBe(false);
    });

    it("should reject invalid dates that pass format check", () => {
      expect(isValidDateFormat("2024-02-30")).toBe(false); // Feb 30 doesn't exist
      expect(isValidDateFormat("2024-13-01")).toBe(false); // Month 13 doesn't exist
      expect(isValidDateFormat("2024-00-15")).toBe(false); // Month 0 doesn't exist
    });
  });

  describe("isValidTimeFormat", () => {
    it("should accept valid HH:MM times", () => {
      expect(isValidTimeFormat("09:30")).toBe(true);
      expect(isValidTimeFormat("14:00")).toBe(true);
      expect(isValidTimeFormat("23:59")).toBe(true);
      expect(isValidTimeFormat("00:00")).toBe(true);
    });

    it("should reject invalid time formats", () => {
      expect(isValidTimeFormat("9:30")).toBe(false);
      expect(isValidTimeFormat("2:30 PM")).toBe(false);
      expect(isValidTimeFormat("14:00:00")).toBe(false);
    });

    it("should reject invalid times", () => {
      expect(isValidTimeFormat("24:00")).toBe(false);
      expect(isValidTimeFormat("12:60")).toBe(false);
      expect(isValidTimeFormat("99:99")).toBe(false);
    });
  });
});

// =============================================================================
// Book Appointment Validation
// =============================================================================

describe("validateBookAppointment", () => {
  const validInput = {
    date: "2024-01-15",
    time: "14:30",
    customer_name: "John Doe",
    customer_phone: "+14155551234",
    service: "Haircut",
  };

  it("should accept valid input", () => {
    const result = validateBookAppointment(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.date).toBe("2024-01-15");
      expect(result.data.time).toBe("14:30");
      expect(result.data.customer_name).toBe("John Doe");
      expect(result.data.customer_phone).toBe("+14155551234");
      expect(result.data.service).toBe("Haircut");
    }
  });

  it("should normalize phone numbers", () => {
    const input = { ...validInput, customer_phone: "(415) 555-1234" };
    const result = validateBookAppointment(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customer_phone).toBe("4155551234");
    }
  });

  it("should trim customer name", () => {
    const input = { ...validInput, customer_name: "  John Doe  " };
    const result = validateBookAppointment(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customer_name).toBe("John Doe");
    }
  });

  it("should reject invalid date format", () => {
    const input = { ...validInput, date: "01-15-2024" };
    const result = validateBookAppointment(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.date).toBeDefined();
    }
  });

  it("should reject invalid time format", () => {
    const input = { ...validInput, time: "2:30 PM" };
    const result = validateBookAppointment(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.time).toBeDefined();
    }
  });

  it("should reject invalid phone number", () => {
    const input = { ...validInput, customer_phone: "123" };
    const result = validateBookAppointment(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.customer_phone).toBeDefined();
    }
  });

  it("should reject empty customer name", () => {
    const input = { ...validInput, customer_name: "" };
    const result = validateBookAppointment(input);
    expect(result.success).toBe(false);
  });

  it("should reject name that is too short", () => {
    const input = { ...validInput, customer_name: "A" };
    const result = validateBookAppointment(input);
    expect(result.success).toBe(false);
  });

  it("should accept optional email", () => {
    const input = { ...validInput, customer_email: "john@example.com" };
    const result = validateBookAppointment(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customer_email).toBe("john@example.com");
    }
  });

  it("should reject invalid email format", () => {
    const input = { ...validInput, customer_email: "not-an-email" };
    const result = validateBookAppointment(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.customer_email).toBeDefined();
    }
  });

  it("should transform empty email to undefined", () => {
    const input = { ...validInput, customer_email: "" };
    const result = validateBookAppointment(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customer_email).toBeUndefined();
    }
  });

  it("should accept optional notes", () => {
    const input = { ...validInput, notes: "First time customer" };
    const result = validateBookAppointment(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notes).toBe("First time customer");
    }
  });

  it("should trim notes", () => {
    const input = { ...validInput, notes: "  Some notes  " };
    const result = validateBookAppointment(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notes).toBe("Some notes");
    }
  });

  it("should transform empty notes to undefined", () => {
    const input = { ...validInput, notes: "   " };
    const result = validateBookAppointment(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notes).toBeUndefined();
    }
  });
});

// =============================================================================
// Check Availability Validation
// =============================================================================

describe("validateCheckAvailability", () => {
  it("should accept valid date", () => {
    const result = validateCheckAvailability({ date: "2024-01-15" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.date).toBe("2024-01-15");
    }
  });

  it("should accept date with optional service", () => {
    const result = validateCheckAvailability({
      date: "2024-01-15",
      service: "Haircut",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.service).toBe("Haircut");
    }
  });

  it("should reject invalid date format", () => {
    const result = validateCheckAvailability({ date: "January 15" });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// Take Message Validation
// =============================================================================

describe("validateTakeMessage", () => {
  const validInput = {
    caller_name: "Jane Smith",
    caller_phone: "+14155559999",
    message: "Please call me back about my appointment",
    urgency: "normal" as const,
  };

  it("should accept valid input", () => {
    const result = validateTakeMessage(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.caller_name).toBe("Jane Smith");
      expect(result.data.urgency).toBe("normal");
    }
  });

  it("should accept all urgency levels", () => {
    for (const urgency of ["low", "normal", "high", "emergency"] as const) {
      const input = { ...validInput, urgency };
      const result = validateTakeMessage(input);
      expect(result.success).toBe(true);
    }
  });

  it("should reject invalid urgency", () => {
    const input = { ...validInput, urgency: "medium" };
    const result = validateTakeMessage(input as any);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.urgency).toBeDefined();
    }
  });

  it("should reject empty message", () => {
    const input = { ...validInput, message: "" };
    const result = validateTakeMessage(input);
    expect(result.success).toBe(false);
  });

  it("should trim message", () => {
    const input = { ...validInput, message: "  Please call back  " };
    const result = validateTakeMessage(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.message).toBe("Please call back");
    }
  });
});

// =============================================================================
// Send SMS Validation
// =============================================================================

describe("validateSendSms", () => {
  it("should accept valid message", () => {
    const result = validateSendSms({ message: "Your appointment is confirmed" });
    expect(result.success).toBe(true);
  });

  it("should accept message with optional to_number", () => {
    const result = validateSendSms({
      message: "Your appointment is confirmed",
      to_number: "+14155551234",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.to_number).toBe("+14155551234");
    }
  });

  it("should reject empty message", () => {
    const result = validateSendSms({ message: "" });
    expect(result.success).toBe(false);
  });

  it("should reject message that is too long", () => {
    const longMessage = "a".repeat(1601);
    const result = validateSendSms({ message: longMessage });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// Create Lead Validation
// =============================================================================

describe("validateCreateLead", () => {
  const validInput = {
    name: "John Doe",
    phone: "+14155551234",
  };

  it("should accept valid input with required fields only", () => {
    const result = validateCreateLead(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("John Doe");
      expect(result.data.phone).toBe("+14155551234");
    }
  });

  it("should accept all optional fields", () => {
    const input = {
      ...validInput,
      email: "john@example.com",
      interest: "Premium service",
      notes: "Follow up next week",
    };
    const result = validateCreateLead(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("john@example.com");
      expect(result.data.interest).toBe("Premium service");
      expect(result.data.notes).toBe("Follow up next week");
    }
  });

  it("should transform undefined optional fields correctly", () => {
    const result = validateCreateLead(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBeUndefined();
      expect(result.data.interest).toBeUndefined();
      expect(result.data.notes).toBeUndefined();
    }
  });
});

// =============================================================================
// Check Reservation Validation
// =============================================================================

describe("validateCheckReservation", () => {
  it("should accept valid input", () => {
    const result = validateCheckReservation({
      date: "2024-01-15",
      party_size: 4,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.date).toBe("2024-01-15");
      expect(result.data.party_size).toBe(4);
    }
  });

  it("should accept optional time", () => {
    const result = validateCheckReservation({
      date: "2024-01-15",
      time: "19:00",
      party_size: 4,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.time).toBe("19:00");
    }
  });

  it("should reject party size less than 1", () => {
    const result = validateCheckReservation({
      date: "2024-01-15",
      party_size: 0,
    });
    expect(result.success).toBe(false);
  });

  it("should reject party size greater than 100", () => {
    const result = validateCheckReservation({
      date: "2024-01-15",
      party_size: 101,
    });
    expect(result.success).toBe(false);
  });

  it("should reject non-integer party size", () => {
    const result = validateCheckReservation({
      date: "2024-01-15",
      party_size: 3.5,
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// Check Inventory Validation
// =============================================================================

describe("validateCheckInventory", () => {
  it("should accept valid input with product name only", () => {
    const result = validateCheckInventory({ product_name: "Widget A" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.product_name).toBe("Widget A");
      expect(result.data.quantity).toBe(1); // default value
    }
  });

  it("should accept valid input with product name and quantity", () => {
    const result = validateCheckInventory({
      product_name: "Widget A",
      quantity: 5,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.product_name).toBe("Widget A");
      expect(result.data.quantity).toBe(5);
    }
  });

  it("should reject empty product name", () => {
    const result = validateCheckInventory({ product_name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.product_name).toBeDefined();
    }
  });

  it("should reject product name that is too long", () => {
    const longName = "a".repeat(201);
    const result = validateCheckInventory({ product_name: longName });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.product_name).toBeDefined();
    }
  });

  it("should accept product name at max length", () => {
    const maxName = "a".repeat(200);
    const result = validateCheckInventory({ product_name: maxName });
    expect(result.success).toBe(true);
  });

  it("should reject quantity less than 1", () => {
    const result = validateCheckInventory({
      product_name: "Widget A",
      quantity: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.quantity).toBeDefined();
    }
  });

  it("should reject quantity greater than 10000", () => {
    const result = validateCheckInventory({
      product_name: "Widget A",
      quantity: 10001,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.quantity).toBeDefined();
    }
  });

  it("should reject non-integer quantity", () => {
    const result = validateCheckInventory({
      product_name: "Widget A",
      quantity: 2.5,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.quantity).toBeDefined();
    }
  });

  it("should accept maximum valid quantity", () => {
    const result = validateCheckInventory({
      product_name: "Widget A",
      quantity: 10000,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantity).toBe(10000);
    }
  });
});

// =============================================================================
// Check Order Status Validation
// =============================================================================

describe("validateCheckOrderStatus", () => {
  it("should accept valid input with order ID only", () => {
    const result = validateCheckOrderStatus({ order_id: "ORD-12345" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.order_id).toBe("ORD-12345");
    }
  });

  it("should accept valid input with order ID and customer phone", () => {
    const result = validateCheckOrderStatus({
      order_id: "ORD-12345",
      customer_phone: "+14155551234",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.order_id).toBe("ORD-12345");
      expect(result.data.customer_phone).toBe("+14155551234");
    }
  });

  it("should accept valid input with order ID and customer email", () => {
    const result = validateCheckOrderStatus({
      order_id: "ORD-12345",
      customer_email: "john@example.com",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.order_id).toBe("ORD-12345");
      expect(result.data.customer_email).toBe("john@example.com");
    }
  });

  it("should accept valid input with all fields", () => {
    const result = validateCheckOrderStatus({
      order_id: "ORD-12345",
      customer_phone: "+14155551234",
      customer_email: "john@example.com",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.order_id).toBe("ORD-12345");
      expect(result.data.customer_phone).toBe("+14155551234");
      expect(result.data.customer_email).toBe("john@example.com");
    }
  });

  it("should reject empty order ID", () => {
    const result = validateCheckOrderStatus({ order_id: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.order_id).toBeDefined();
    }
  });

  it("should reject order ID that is too long", () => {
    const longId = "a".repeat(101);
    const result = validateCheckOrderStatus({ order_id: longId });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.order_id).toBeDefined();
    }
  });

  it("should accept order ID at max length", () => {
    const maxId = "a".repeat(100);
    const result = validateCheckOrderStatus({ order_id: maxId });
    expect(result.success).toBe(true);
  });

  it("should reject invalid customer email format", () => {
    const result = validateCheckOrderStatus({
      order_id: "ORD-12345",
      customer_email: "not-an-email",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.customer_email).toBeDefined();
    }
  });

  it("should handle undefined optional fields", () => {
    const result = validateCheckOrderStatus({ order_id: "ORD-12345" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customer_phone).toBeUndefined();
      expect(result.data.customer_email).toBeUndefined();
    }
  });
});

// =============================================================================
// User-Friendly Error Messages
// =============================================================================

describe("User-Friendly Error Messages", () => {
  it("should provide friendly date error message", () => {
    const result = validateBookAppointment({
      date: "invalid",
      time: "14:30",
      customer_name: "John Doe",
      customer_phone: "+14155551234",
      service: "Haircut",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("date");
    }
  });

  it("should provide friendly phone error message", () => {
    const result = validateBookAppointment({
      date: "2024-01-15",
      time: "14:30",
      customer_name: "John Doe",
      customer_phone: "123",
      service: "Haircut",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("phone");
    }
  });
});
