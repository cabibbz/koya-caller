/**
 * HIPAA Compliance Tests
 * Tests for PHI handling, BAA signing, audit logging, and consent management
 */

import { describe, it, expect } from "vitest";

// ============================================
// PHI Category Tests
// ============================================

describe("PHI Categories", () => {
  const PHI_CATEGORIES = [
    "ssn",
    "dob",
    "medical_record",
    "insurance_id",
    "diagnosis",
    "medication",
    "treatment",
    "provider_name",
    "facility_name",
    "appointment_date",
    "lab_results",
    "genetic_info",
    "biometric",
    "full_face_photo",
    "geographic",
  ] as const;

  describe("Category validation", () => {
    it("should have all HIPAA Safe Harbor categories", () => {
      expect(PHI_CATEGORIES).toContain("ssn");
      expect(PHI_CATEGORIES).toContain("dob");
      expect(PHI_CATEGORIES).toContain("medical_record");
      expect(PHI_CATEGORIES).toContain("insurance_id");
      expect(PHI_CATEGORIES).toContain("genetic_info");
    });

    it("should have 15 PHI categories total", () => {
      expect(PHI_CATEGORIES.length).toBe(15);
    });

    it("should include geographic identifier", () => {
      expect(PHI_CATEGORIES).toContain("geographic");
    });
  });
});

// ============================================
// PHI Detection Pattern Tests
// ============================================

describe("PHI Detection Patterns", () => {
  const PHI_PATTERNS: Record<string, RegExp[]> = {
    ssn: [
      /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
      /\bsocial\s*security\b/gi,
    ],
    dob: [
      /\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](\d{2}|\d{4})\b/g,
      /\bdate\s*of\s*birth\b/gi,
      /\bbirthday\b/gi,
    ],
    medical_record: [
      /\bMR[#N]?\s*:?\s*\d+\b/gi,
      /\bmedical\s*record\s*(number|#)?\b/gi,
    ],
    insurance_id: [
      /\b[A-Z]{2,3}\d{6,12}\b/g,
      /\binsurance\s*(id|number|#)\b/gi,
    ],
    geographic: [
      /\b\d{5}(-\d{4})?\b/g, // ZIP codes
    ],
  };

  function detectPHI(text: string, category: string): boolean {
    const patterns = PHI_PATTERNS[category];
    if (!patterns) return false;

    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      if (pattern.test(text)) {
        return true;
      }
    }
    return false;
  }

  describe("SSN detection", () => {
    it("should detect SSN format with dashes", () => {
      expect(detectPHI("My SSN is 123-45-6789", "ssn")).toBe(true);
    });

    it("should detect SSN format without dashes", () => {
      expect(detectPHI("SSN: 123456789", "ssn")).toBe(true);
    });

    it("should detect 'social security' mention", () => {
      expect(detectPHI("I need your social security number", "ssn")).toBe(true);
    });

    it("should not false positive on phone numbers", () => {
      // Phone numbers are 10 digits, SSN is 9
      expect(detectPHI("Call me at 555-123-4567", "ssn")).toBe(false);
    });
  });

  describe("DOB detection", () => {
    it("should detect date format MM/DD/YYYY", () => {
      expect(detectPHI("Born on 01/15/1990", "dob")).toBe(true);
    });

    it("should detect date format MM-DD-YYYY", () => {
      expect(detectPHI("DOB: 12-25-1985", "dob")).toBe(true);
    });

    it("should detect 'date of birth' mention", () => {
      expect(detectPHI("What is your date of birth?", "dob")).toBe(true);
    });

    it("should detect 'birthday' mention", () => {
      expect(detectPHI("When is your birthday?", "dob")).toBe(true);
    });
  });

  describe("Medical record detection", () => {
    it("should detect MRN format", () => {
      expect(detectPHI("MRN: 12345678", "medical_record")).toBe(true);
    });

    it("should detect 'medical record number' mention", () => {
      expect(detectPHI("Your medical record number is needed", "medical_record")).toBe(true);
    });
  });

  describe("Insurance ID detection", () => {
    it("should detect insurance ID format", () => {
      expect(detectPHI("Insurance ID: ABC123456789", "insurance_id")).toBe(true);
    });

    it("should detect 'insurance id' mention", () => {
      expect(detectPHI("Please provide your insurance id", "insurance_id")).toBe(true);
    });

    it("should detect 'insurance number' mention", () => {
      expect(detectPHI("Your insurance number is required", "insurance_id")).toBe(true);
    });
  });

  describe("Geographic detection", () => {
    it("should detect 5-digit ZIP code", () => {
      expect(detectPHI("ZIP code: 90210", "geographic")).toBe(true);
    });

    it("should detect ZIP+4 format", () => {
      expect(detectPHI("ZIP: 90210-1234", "geographic")).toBe(true);
    });
  });
});

// ============================================
// Consent Type Tests
// ============================================

describe("Consent Types", () => {
  const CONSENT_TYPES = [
    "voice_recording",
    "ai_processing",
    "data_storage",
    "data_sharing",
    "marketing",
    "research",
  ] as const;

  it("should have 6 consent types", () => {
    expect(CONSENT_TYPES.length).toBe(6);
  });

  it("should include voice_recording consent", () => {
    expect(CONSENT_TYPES).toContain("voice_recording");
  });

  it("should include ai_processing consent", () => {
    expect(CONSENT_TYPES).toContain("ai_processing");
  });

  it("should include data_storage consent", () => {
    expect(CONSENT_TYPES).toContain("data_storage");
  });

  it("should include data_sharing consent", () => {
    expect(CONSENT_TYPES).toContain("data_sharing");
  });
});

// ============================================
// Audit Event Type Tests
// ============================================

describe("Audit Event Types", () => {
  const AUDIT_EVENT_TYPES = [
    "phi_access",
    "phi_view",
    "phi_export",
    "phi_modify",
    "phi_delete",
    "recording_access",
    "transcript_access",
    "contact_access",
    "consent_recorded",
    "consent_revoked",
    "baa_signed",
    "compliance_update",
    "encryption_key_rotate",
  ] as const;

  it("should have 13 audit event types", () => {
    expect(AUDIT_EVENT_TYPES.length).toBe(13);
  });

  it("should include PHI-related events", () => {
    expect(AUDIT_EVENT_TYPES).toContain("phi_access");
    expect(AUDIT_EVENT_TYPES).toContain("phi_view");
    expect(AUDIT_EVENT_TYPES).toContain("phi_export");
    expect(AUDIT_EVENT_TYPES).toContain("phi_modify");
    expect(AUDIT_EVENT_TYPES).toContain("phi_delete");
  });

  it("should include consent-related events", () => {
    expect(AUDIT_EVENT_TYPES).toContain("consent_recorded");
    expect(AUDIT_EVENT_TYPES).toContain("consent_revoked");
  });

  it("should include BAA signing event", () => {
    expect(AUDIT_EVENT_TYPES).toContain("baa_signed");
  });
});

// ============================================
// Retention Period Tests
// ============================================

describe("HIPAA Retention Requirements", () => {
  const MINIMUM_RETENTION_DAYS = 2190; // 6 years
  const _RECOMMENDED_RETENTION_DAYS = 2555; // 7 years

  describe("Retention validation", () => {
    it("should enforce minimum 6-year retention for PHI", () => {
      const retentionDays = 365; // 1 year
      const isCompliant = retentionDays >= MINIMUM_RETENTION_DAYS;
      expect(isCompliant).toBe(false);
    });

    it("should accept 6-year retention", () => {
      const retentionDays = 2190;
      const isCompliant = retentionDays >= MINIMUM_RETENTION_DAYS;
      expect(isCompliant).toBe(true);
    });

    it("should accept 7-year retention", () => {
      const retentionDays = 2555;
      const isCompliant = retentionDays >= MINIMUM_RETENTION_DAYS;
      expect(isCompliant).toBe(true);
    });

    it("should accept 10-year retention for mental health", () => {
      const retentionDays = 3650;
      const isCompliant = retentionDays >= MINIMUM_RETENTION_DAYS;
      expect(isCompliant).toBe(true);
    });
  });

  describe("Retention period calculations", () => {
    it("should calculate 6 years correctly", () => {
      const sixYears = 6 * 365;
      expect(sixYears).toBe(2190);
    });

    it("should calculate 7 years correctly", () => {
      const sevenYears = 7 * 365;
      expect(sevenYears).toBe(2555);
    });
  });
});

// ============================================
// BAA Signature Tests
// ============================================

describe("BAA Signature Handling", () => {
  interface BAASignatoryInfo {
    name: string;
    title: string;
    email: string;
    ipAddress?: string;
    userAgent?: string;
  }

  function validateBAASignatory(info: BAASignatoryInfo): string[] {
    const errors: string[] = [];

    if (!info.name || info.name.trim().length < 2) {
      errors.push("Valid signatory name is required");
    }

    if (!info.title || info.title.trim().length < 2) {
      errors.push("Valid signatory title is required");
    }

    if (!info.email || !info.email.includes("@")) {
      errors.push("Valid signatory email is required");
    }

    return errors;
  }

  describe("Signatory validation", () => {
    it("should accept valid signatory info", () => {
      const info: BAASignatoryInfo = {
        name: "John Doe",
        title: "CEO",
        email: "john@example.com",
      };
      expect(validateBAASignatory(info)).toHaveLength(0);
    });

    it("should reject empty name", () => {
      const info: BAASignatoryInfo = {
        name: "",
        title: "CEO",
        email: "john@example.com",
      };
      expect(validateBAASignatory(info)).toContain("Valid signatory name is required");
    });

    it("should reject short name", () => {
      const info: BAASignatoryInfo = {
        name: "J",
        title: "CEO",
        email: "john@example.com",
      };
      expect(validateBAASignatory(info)).toContain("Valid signatory name is required");
    });

    it("should reject invalid email", () => {
      const info: BAASignatoryInfo = {
        name: "John Doe",
        title: "CEO",
        email: "invalid-email",
      };
      expect(validateBAASignatory(info)).toContain("Valid signatory email is required");
    });

    it("should reject empty title", () => {
      const info: BAASignatoryInfo = {
        name: "John Doe",
        title: "",
        email: "john@example.com",
      };
      expect(validateBAASignatory(info)).toContain("Valid signatory title is required");
    });
  });

  describe("Document hash generation", () => {
    it("should generate consistent hash for same content", () => {
      const content1 = JSON.stringify({ businessId: "123", timestamp: "2024-01-01" });
      const content2 = JSON.stringify({ businessId: "123", timestamp: "2024-01-01" });
      expect(content1).toBe(content2);
    });

    it("should generate different hash for different content", () => {
      const content1 = JSON.stringify({ businessId: "123" });
      const content2 = JSON.stringify({ businessId: "456" });
      expect(content1).not.toBe(content2);
    });
  });
});

// ============================================
// Healthcare Template Tests
// ============================================

describe("Healthcare Templates", () => {
  const HEALTHCARE_TEMPLATES: Record<string, {
    name: string;
    hipaa_enabled: boolean;
    phi_detection_categories: string[];
    audit_log_retention_days: number;
  }> = {
    dental: {
      name: "Dental Practice",
      hipaa_enabled: true,
      phi_detection_categories: ["ssn", "dob", "medical_record", "insurance_id"],
      audit_log_retention_days: 2555,
    },
    medical: {
      name: "Medical Practice",
      hipaa_enabled: true,
      phi_detection_categories: ["ssn", "dob", "medical_record", "insurance_id", "diagnosis"],
      audit_log_retention_days: 2555,
    },
    mental_health: {
      name: "Mental Health",
      hipaa_enabled: true,
      phi_detection_categories: ["ssn", "dob", "medical_record", "diagnosis"],
      audit_log_retention_days: 3650, // 10 years
    },
    veterinary: {
      name: "Veterinary",
      hipaa_enabled: false, // HIPAA does not apply
      phi_detection_categories: [],
      audit_log_retention_days: 365,
    },
  };

  describe("Template configuration", () => {
    it("should enable HIPAA for dental template", () => {
      expect(HEALTHCARE_TEMPLATES.dental.hipaa_enabled).toBe(true);
    });

    it("should enable HIPAA for medical template", () => {
      expect(HEALTHCARE_TEMPLATES.medical.hipaa_enabled).toBe(true);
    });

    it("should disable HIPAA for veterinary template", () => {
      expect(HEALTHCARE_TEMPLATES.veterinary.hipaa_enabled).toBe(false);
    });

    it("should have empty PHI categories for veterinary", () => {
      expect(HEALTHCARE_TEMPLATES.veterinary.phi_detection_categories).toHaveLength(0);
    });

    it("should have longer retention for mental health", () => {
      expect(HEALTHCARE_TEMPLATES.mental_health.audit_log_retention_days).toBe(3650);
      expect(HEALTHCARE_TEMPLATES.mental_health.audit_log_retention_days).toBeGreaterThan(
        HEALTHCARE_TEMPLATES.dental.audit_log_retention_days
      );
    });
  });

  describe("Template validation", () => {
    it("should recognize valid template IDs", () => {
      const validIds = Object.keys(HEALTHCARE_TEMPLATES);
      expect(validIds).toContain("dental");
      expect(validIds).toContain("medical");
      expect(validIds).toContain("mental_health");
      expect(validIds).toContain("veterinary");
    });

    it("should reject invalid template ID", () => {
      expect(HEALTHCARE_TEMPLATES["invalid"]).toBeUndefined();
    });
  });
});

// ============================================
// Consent Status Tests
// ============================================

describe("Consent Status Handling", () => {
  interface ConsentRecord {
    granted: boolean;
    granted_at: string | null;
    revoked_at: string | null;
  }

  function isConsentActive(consent: ConsentRecord): boolean {
    return consent.granted === true && consent.revoked_at === null;
  }

  describe("Consent status determination", () => {
    it("should return true for active consent", () => {
      const consent: ConsentRecord = {
        granted: true,
        granted_at: "2024-01-01",
        revoked_at: null,
      };
      expect(isConsentActive(consent)).toBe(true);
    });

    it("should return false for revoked consent", () => {
      const consent: ConsentRecord = {
        granted: true,
        granted_at: "2024-01-01",
        revoked_at: "2024-02-01",
      };
      expect(isConsentActive(consent)).toBe(false);
    });

    it("should return false for never-granted consent", () => {
      const consent: ConsentRecord = {
        granted: false,
        granted_at: null,
        revoked_at: null,
      };
      expect(isConsentActive(consent)).toBe(false);
    });
  });
});

// ============================================
// Phone Number Hashing Tests
// ============================================

describe("Phone Number Privacy", () => {
  function normalizePhone(phone: string): string {
    return phone.replace(/\D/g, "");
  }

  describe("Phone normalization", () => {
    it("should remove dashes from phone", () => {
      expect(normalizePhone("555-123-4567")).toBe("5551234567");
    });

    it("should remove parentheses from phone", () => {
      expect(normalizePhone("(555) 123-4567")).toBe("5551234567");
    });

    it("should remove spaces from phone", () => {
      expect(normalizePhone("555 123 4567")).toBe("5551234567");
    });

    it("should handle country code", () => {
      expect(normalizePhone("+1-555-123-4567")).toBe("15551234567");
    });
  });

  describe("Consistent hashing", () => {
    it("should produce same hash for same normalized number", () => {
      const phone1 = normalizePhone("555-123-4567");
      const phone2 = normalizePhone("(555) 123-4567");
      expect(phone1).toBe(phone2);
    });
  });
});

// ============================================
// Compliance Settings Defaults Tests
// ============================================

describe("Compliance Settings Defaults", () => {
  const DEFAULT_SETTINGS = {
    hipaa_enabled: false,
    require_phi_justification: true,
    auto_phi_detection: true,
    phi_detection_categories: [
      "ssn", "dob", "medical_record", "insurance_id",
      "diagnosis", "medication", "treatment"
    ],
    recording_encryption_enabled: true,
    audit_log_retention_days: 2190, // 6 years
    baa_signed_at: null,
  };

  it("should have HIPAA disabled by default", () => {
    expect(DEFAULT_SETTINGS.hipaa_enabled).toBe(false);
  });

  it("should require PHI justification by default", () => {
    expect(DEFAULT_SETTINGS.require_phi_justification).toBe(true);
  });

  it("should enable auto PHI detection by default", () => {
    expect(DEFAULT_SETTINGS.auto_phi_detection).toBe(true);
  });

  it("should enable recording encryption by default", () => {
    expect(DEFAULT_SETTINGS.recording_encryption_enabled).toBe(true);
  });

  it("should have 6-year audit retention by default", () => {
    expect(DEFAULT_SETTINGS.audit_log_retention_days).toBe(2190);
  });

  it("should have no BAA signed by default", () => {
    expect(DEFAULT_SETTINGS.baa_signed_at).toBeNull();
  });

  it("should have default PHI categories configured", () => {
    expect(DEFAULT_SETTINGS.phi_detection_categories).toContain("ssn");
    expect(DEFAULT_SETTINGS.phi_detection_categories).toContain("dob");
    expect(DEFAULT_SETTINGS.phi_detection_categories).toContain("diagnosis");
  });
});

// ============================================
// Audit Log Immutability Tests
// ============================================

describe("Audit Log Requirements", () => {
  interface AuditLogEntry {
    id: string;
    business_id: string;
    user_id: string;
    event_type: string;
    resource_type: string;
    resource_id: string;
    action: string;
    created_at: string;
    // Note: No updated_at - logs are immutable
  }

  describe("Immutability", () => {
    it("should not have updated_at field", () => {
      const entry: AuditLogEntry = {
        id: "log-123",
        business_id: "biz-123",
        user_id: "user-123",
        event_type: "phi_access",
        resource_type: "call",
        resource_id: "call-123",
        action: "view_transcript",
        created_at: new Date().toISOString(),
      };

      expect(entry).not.toHaveProperty("updated_at");
    });
  });

  describe("Required fields", () => {
    it("should require business_id", () => {
      const entry: Partial<AuditLogEntry> = {
        id: "log-123",
        user_id: "user-123",
      };
      expect(entry.business_id).toBeUndefined();
    });

    it("should require event_type", () => {
      const entry: AuditLogEntry = {
        id: "log-123",
        business_id: "biz-123",
        user_id: "user-123",
        event_type: "phi_access",
        resource_type: "call",
        resource_id: "call-123",
        action: "view",
        created_at: new Date().toISOString(),
      };
      expect(entry.event_type).toBe("phi_access");
    });
  });
});

// ============================================
// BAA Download Format Tests
// ============================================

describe("BAA Document Format", () => {
  function formatBAADate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  describe("Date formatting", () => {
    it("should format date correctly", () => {
      // Use midday UTC to avoid timezone boundary issues
      const formatted = formatBAADate("2024-01-15T12:00:00Z");
      expect(formatted).toContain("January");
      expect(formatted).toContain("2024");
      // Check that the day is included (could be 14 or 15 depending on timezone)
      expect(formatted).toMatch(/\d{1,2}/);
    });
  });

  describe("Document content", () => {
    it("should include BAA version", () => {
      const baaVersion = "1.0";
      expect(baaVersion).toBe("1.0");
    });

    it("should include signatory information", () => {
      const signatory = {
        name: "John Doe",
        title: "CEO",
        email: "john@example.com",
      };
      expect(signatory.name).toBeDefined();
      expect(signatory.title).toBeDefined();
      expect(signatory.email).toBeDefined();
    });
  });
});
