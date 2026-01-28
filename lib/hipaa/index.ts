/**
 * HIPAA Compliance Core Utilities
 *
 * Provides core HIPAA compliance functionality for businesses handling PHI:
 * - PHI access logging for audit trails
 * - HIPAA mode checking and configuration
 * - BAA signature recording
 * - PHI categorization and flagging
 * - Patient consent management
 *
 * HIPAA requires 6-year retention of audit logs.
 * All audit logs are append-only - no updates or deletes permitted.
 */

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hashValue } from "@/lib/security";
import { logError, logErrorWithMeta } from "@/lib/logging";
import crypto from "crypto";

// =============================================================================
// PHI CATEGORIES
// =============================================================================

/**
 * PHI categories that can be detected/redacted in call transcripts
 * Based on HIPAA Safe Harbor de-identification standard
 */
export const PHI_CATEGORIES = [
  "ssn",                // Social Security Number
  "dob",                // Date of Birth
  "medical_record",     // Medical Record Number
  "insurance_id",       // Health Insurance ID
  "diagnosis",          // Diagnosis/condition information
  "medication",         // Medication names and dosages
  "treatment",          // Treatment information
  "provider_name",      // Healthcare provider names
  "facility_name",      // Healthcare facility names
  "appointment_date",   // Medical appointment dates
  "lab_results",        // Laboratory test results
  "genetic_info",       // Genetic information
  "biometric",          // Biometric identifiers
  "full_face_photo",    // Full face photographs
  "geographic",         // Geographic data smaller than state
] as const;

export type PHICategory = typeof PHI_CATEGORIES[number];

/**
 * Consent types for patient authorization
 */
export const CONSENT_TYPES = [
  "voice_recording",     // Consent to record voice calls
  "ai_processing",       // Consent to AI processing of PHI
  "data_storage",        // Consent to store PHI
  "data_sharing",        // Consent to share with third parties
  "marketing",           // Consent for marketing communications
  "research",            // Consent for research use
] as const;

export type ConsentType = typeof CONSENT_TYPES[number];

/**
 * Audit event types for PHI access logging
 */
export const AUDIT_EVENT_TYPES = [
  "phi_access",           // PHI was accessed
  "phi_view",             // PHI was viewed
  "phi_export",           // PHI was exported
  "phi_modify",           // PHI was modified
  "phi_delete",           // PHI was deleted
  "recording_access",     // Recording was accessed
  "transcript_access",    // Transcript was accessed
  "contact_access",       // Contact PHI was accessed
  "consent_recorded",     // Consent was recorded
  "consent_revoked",      // Consent was revoked
  "baa_signed",           // BAA was signed
  "compliance_update",    // Compliance settings updated
  "encryption_key_rotate", // Encryption key was rotated
] as const;

export type AuditEventType = typeof AUDIT_EVENT_TYPES[number];

// =============================================================================
// TYPES
// =============================================================================

export interface PHIAccessParams {
  businessId: string;
  userId: string;
  eventType: AuditEventType;
  resourceType: "call" | "recording" | "transcript" | "contact" | "appointment";
  resourceId: string;
  action: string;
  justification?: string;
  ipAddress?: string;
  userAgent?: string;
  phiCategories?: PHICategory[];
  metadata?: Record<string, unknown>;
}

export interface ComplianceSettings {
  id: string;
  business_id: string;
  hipaa_enabled: boolean;
  require_phi_justification: boolean;
  auto_phi_detection: boolean;
  phi_detection_categories: PHICategory[];
  recording_encryption_enabled: boolean;
  encryption_key_id: string | null;
  audit_log_retention_days: number; // HIPAA minimum is 2190 days (6 years)
  baa_signed_at: string | null;
  baa_signatory_name: string | null;
  baa_signatory_title: string | null;
  baa_signatory_email: string | null;
  baa_document_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatientConsent {
  id: string;
  business_id: string;
  phone_number_hash: string;
  consent_type: ConsentType;
  granted: boolean;
  granted_at: string | null;
  revoked_at: string | null;
  consent_method: "verbal" | "written" | "electronic";
  recorded_by_user_id: string;
  call_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BAASignatoryInfo {
  name: string;
  title: string;
  email: string;
  ipAddress?: string;
  userAgent?: string;
}

// =============================================================================
// PHI ACCESS LOGGING
// =============================================================================

/**
 * Log PHI access to audit table
 *
 * Creates an immutable audit log entry for any PHI access.
 * Audit logs cannot be updated or deleted per HIPAA requirements.
 *
 * @param params - PHI access parameters
 * @returns Audit log entry ID
 */
export async function logPHIAccess(params: PHIAccessParams): Promise<string | null> {
  try {
    const supabase = createAdminClient();

    // Generate unique audit ID
    const auditId = crypto.randomUUID();

    // Create immutable audit log entry
    const { error } = await (supabase as any)
      .from("phi_audit_log")
      .insert({
        id: auditId,
        business_id: params.businessId,
        user_id: params.userId,
        event_type: params.eventType,
        resource_type: params.resourceType,
        resource_id: params.resourceId,
        action: params.action,
        justification: params.justification || null,
        ip_address: params.ipAddress || null,
        user_agent: params.userAgent || null,
        phi_categories: params.phiCategories || [],
        metadata: params.metadata || {},
        created_at: new Date().toISOString(),
        // Audit logs are immutable - no updated_at
      });

    if (error) {
      logErrorWithMeta("HIPAA Audit Log", error, {
        businessId: params.businessId,
        eventType: params.eventType,
        resourceType: params.resourceType,
      });
      return null;
    }

    return auditId;
  } catch (error) {
    logError("HIPAA Audit Log", error);
    return null;
  }
}

// =============================================================================
// HIPAA MODE CHECKING
// =============================================================================

/**
 * Check if a business has HIPAA mode enabled
 *
 * @param businessId - Business ID to check
 * @returns true if HIPAA mode is enabled
 */
export async function checkHIPAAEnabled(businessId: string): Promise<boolean> {
  try {
    const supabase = await createClient();

    const { data, error } = await (supabase as any)
      .from("compliance_settings")
      .select("hipaa_enabled")
      .eq("business_id", businessId)
      .single();

    if (error || !data) {
      return false;
    }

    return data.hipaa_enabled === true;
  } catch (error) {
    logError("HIPAA Check", error);
    return false;
  }
}

// =============================================================================
// COMPLIANCE SETTINGS
// =============================================================================

/**
 * Get compliance settings for a business
 *
 * @param businessId - Business ID
 * @returns Compliance settings or null if not configured
 */
export async function getComplianceSettings(
  businessId: string
): Promise<ComplianceSettings | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await (supabase as any)
      .from("compliance_settings")
      .select("*")
      .eq("business_id", businessId)
      .single();

    if (error && error.code !== "PGRST116") {
      logError("Get Compliance Settings", error);
      return null;
    }

    return data as ComplianceSettings | null;
  } catch (error) {
    logError("Get Compliance Settings", error);
    return null;
  }
}

/**
 * Update compliance settings for a business
 *
 * @param businessId - Business ID
 * @param settings - Partial settings to update
 * @param userId - User making the update (for audit)
 * @returns Updated settings or null on error
 */
export async function updateComplianceSettings(
  businessId: string,
  settings: Partial<Omit<ComplianceSettings, "id" | "business_id" | "created_at" | "updated_at">>,
  userId: string
): Promise<ComplianceSettings | null> {
  try {
    const supabase = createAdminClient();

    // Check if settings exist
    const existing = await getComplianceSettings(businessId);

    let result;

    if (existing) {
      // Update existing settings
      const { data, error } = await (supabase as any)
        .from("compliance_settings")
        .update({
          ...settings,
          updated_at: new Date().toISOString(),
        })
        .eq("business_id", businessId)
        .select()
        .single();

      if (error) {
        logError("Update Compliance Settings", error);
        return null;
      }
      result = data;
    } else {
      // Create new settings with HIPAA-compliant defaults
      const { data, error } = await (supabase as any)
        .from("compliance_settings")
        .insert({
          business_id: businessId,
          hipaa_enabled: settings.hipaa_enabled ?? false,
          require_phi_justification: settings.require_phi_justification ?? true,
          auto_phi_detection: settings.auto_phi_detection ?? true,
          phi_detection_categories: settings.phi_detection_categories ?? [
            "ssn", "dob", "medical_record", "insurance_id", "diagnosis", "medication", "treatment"
          ],
          recording_encryption_enabled: settings.recording_encryption_enabled ?? true,
          encryption_key_id: settings.encryption_key_id ?? null,
          audit_log_retention_days: settings.audit_log_retention_days ?? 2190, // 6 years
          ...settings,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        logError("Create Compliance Settings", error);
        return null;
      }
      result = data;
    }

    // Log the compliance update
    await logPHIAccess({
      businessId,
      userId,
      eventType: "compliance_update",
      resourceType: "contact", // Using contact as closest resource type
      resourceId: businessId,
      action: existing ? "update_compliance_settings" : "create_compliance_settings",
      metadata: {
        previousSettings: existing ? {
          hipaa_enabled: existing.hipaa_enabled,
          require_phi_justification: existing.require_phi_justification,
        } : null,
        newSettings: {
          hipaa_enabled: result?.hipaa_enabled,
          require_phi_justification: result?.require_phi_justification,
        },
      },
    });

    return result as ComplianceSettings;
  } catch (error) {
    logError("Update Compliance Settings", error);
    return null;
  }
}

// =============================================================================
// BAA SIGNATURE
// =============================================================================

/**
 * Record BAA (Business Associate Agreement) signature
 *
 * HIPAA requires covered entities to have BAAs with business associates.
 * This records the electronic signature of the BAA.
 *
 * @param businessId - Business ID
 * @param signatoryInfo - Information about the person signing
 * @returns true if signature was recorded successfully
 */
export async function signBAA(
  businessId: string,
  signatoryInfo: BAASignatoryInfo
): Promise<boolean> {
  try {
    const supabase = createAdminClient();

    // Generate document hash for integrity verification
    const documentContent = JSON.stringify({
      businessId,
      signatory: signatoryInfo,
      timestamp: new Date().toISOString(),
      version: "1.0",
    });
    const documentHash = hashValue(documentContent);

    // Update compliance settings with BAA signature
    const { data: _data, error } = await (supabase as any)
      .from("compliance_settings")
      .upsert({
        business_id: businessId,
        baa_signed_at: new Date().toISOString(),
        baa_signatory_name: signatoryInfo.name,
        baa_signatory_title: signatoryInfo.title,
        baa_signatory_email: signatoryInfo.email,
        baa_document_hash: documentHash,
        hipaa_enabled: true, // Enable HIPAA mode upon BAA signature
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "business_id",
      })
      .select()
      .single();

    if (error) {
      logError("Sign BAA", error);
      return false;
    }

    // Create audit log entry for BAA signature
    // Get user ID from email lookup or use a system identifier
    const { data: userData } = await (supabase as any)
      .from("users")
      .select("id")
      .eq("email", signatoryInfo.email)
      .single();

    await logPHIAccess({
      businessId,
      userId: userData?.id || "system",
      eventType: "baa_signed",
      resourceType: "contact",
      resourceId: businessId,
      action: "sign_baa",
      ipAddress: signatoryInfo.ipAddress,
      userAgent: signatoryInfo.userAgent,
      metadata: {
        signatoryName: signatoryInfo.name,
        signatoryTitle: signatoryInfo.title,
        signatoryEmail: signatoryInfo.email,
        documentHash,
      },
    });

    return true;
  } catch (error) {
    logError("Sign BAA", error);
    return false;
  }
}

// =============================================================================
// PHI FLAGGING
// =============================================================================

/**
 * Mark a call as containing PHI
 *
 * Flags a call record with detected PHI categories for compliance tracking.
 *
 * @param callId - Call ID to flag
 * @param categories - PHI categories detected
 * @param userId - User flagging the call (optional, for manual flagging)
 * @returns true if call was flagged successfully
 */
export async function markCallAsPHI(
  callId: string,
  categories: PHICategory[],
  userId?: string
): Promise<boolean> {
  try {
    const supabase = createAdminClient();

    // Get call to determine business ID
    const { data: call, error: callError } = await (supabase as any)
      .from("calls")
      .select("id, business_id")
      .eq("id", callId)
      .single();

    if (callError || !call) {
      logError("Mark Call as PHI - Call not found", callError);
      return false;
    }

    // Update call with PHI flag
    const { error } = await (supabase as any)
      .from("calls")
      .update({
        phi_detected: true,
        phi_categories: categories,
        phi_flagged_at: new Date().toISOString(),
        phi_flagged_by: userId || "system",
      })
      .eq("id", callId);

    if (error) {
      logError("Mark Call as PHI", error);
      return false;
    }

    // Log PHI detection
    await logPHIAccess({
      businessId: call.business_id,
      userId: userId || "system",
      eventType: "phi_modify",
      resourceType: "call",
      resourceId: callId,
      action: "flag_phi_detected",
      phiCategories: categories,
      metadata: {
        detectionMethod: userId ? "manual" : "automatic",
        categoriesCount: categories.length,
      },
    });

    return true;
  } catch (error) {
    logError("Mark Call as PHI", error);
    return false;
  }
}

// =============================================================================
// PATIENT CONSENT MANAGEMENT
// =============================================================================

/**
 * Hash phone number for consent lookup
 * Uses HMAC with a secret key for consistent but secure hashing
 */
function hashPhoneNumber(phone: string): string {
  const secret = process.env.HIPAA_PHONE_HASH_SECRET || "default-hipaa-secret-change-in-production";
  // Normalize phone number (remove non-digits)
  const normalized = phone.replace(/\D/g, "");
  return crypto.createHmac("sha256", secret).update(normalized).digest("hex");
}

/**
 * Check if a patient has given consent for a specific type
 *
 * @param businessId - Business ID
 * @param phone - Patient phone number
 * @param consentType - Type of consent to check
 * @returns true if consent is granted, false otherwise
 */
export async function checkPatientConsent(
  businessId: string,
  phone: string,
  consentType: ConsentType
): Promise<boolean> {
  try {
    const supabase = await createClient();

    const phoneHash = hashPhoneNumber(phone);

    const { data, error } = await (supabase as any)
      .from("patient_consents")
      .select("granted, revoked_at")
      .eq("business_id", businessId)
      .eq("phone_number_hash", phoneHash)
      .eq("consent_type", consentType)
      .single();

    if (error || !data) {
      return false;
    }

    // Check if consent is granted and not revoked
    return data.granted === true && data.revoked_at === null;
  } catch (error) {
    logError("Check Patient Consent", error);
    return false;
  }
}

/**
 * Get all consents for a phone number
 *
 * @param businessId - Business ID
 * @param phone - Patient phone number
 * @returns Array of consent records
 */
export async function getPatientConsents(
  businessId: string,
  phone: string
): Promise<PatientConsent[]> {
  try {
    const supabase = await createClient();

    const phoneHash = hashPhoneNumber(phone);

    const { data, error } = await (supabase as any)
      .from("patient_consents")
      .select("*")
      .eq("business_id", businessId)
      .eq("phone_number_hash", phoneHash)
      .order("created_at", { ascending: false });

    if (error) {
      logError("Get Patient Consents", error);
      return [];
    }

    return (data || []) as PatientConsent[];
  } catch (error) {
    logError("Get Patient Consents", error);
    return [];
  }
}

export interface RecordConsentParams {
  businessId: string;
  phone: string;
  consentType: ConsentType;
  granted: boolean;
  consentMethod: "verbal" | "written" | "electronic";
  userId: string;
  callId?: string;
  notes?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Record patient consent
 *
 * @param params - Consent recording parameters
 * @returns Consent record ID or null on error
 */
export async function recordPatientConsent(
  params: RecordConsentParams
): Promise<string | null> {
  try {
    const supabase = createAdminClient();

    const phoneHash = hashPhoneNumber(params.phone);
    const consentId = crypto.randomUUID();

    // Check for existing consent of this type
    const { data: existing } = await (supabase as any)
      .from("patient_consents")
      .select("id, granted")
      .eq("business_id", params.businessId)
      .eq("phone_number_hash", phoneHash)
      .eq("consent_type", params.consentType)
      .single();

    if (existing) {
      // Update existing consent
      const updateData: Record<string, unknown> = {
        granted: params.granted,
        consent_method: params.consentMethod,
        recorded_by_user_id: params.userId,
        notes: params.notes || null,
        updated_at: new Date().toISOString(),
      };

      if (params.granted) {
        updateData.granted_at = new Date().toISOString();
        updateData.revoked_at = null;
      } else {
        updateData.revoked_at = new Date().toISOString();
      }

      if (params.callId) {
        updateData.call_id = params.callId;
      }

      const { error } = await (supabase as any)
        .from("patient_consents")
        .update(updateData)
        .eq("id", existing.id);

      if (error) {
        logError("Update Patient Consent", error);
        return null;
      }

      // Log consent change
      await logPHIAccess({
        businessId: params.businessId,
        userId: params.userId,
        eventType: params.granted ? "consent_recorded" : "consent_revoked",
        resourceType: "contact",
        resourceId: existing.id,
        action: params.granted ? "grant_consent" : "revoke_consent",
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: {
          consentType: params.consentType,
          consentMethod: params.consentMethod,
          previouslyGranted: existing.granted,
        },
      });

      return existing.id;
    } else {
      // Create new consent record
      const { data: _data, error } = await (supabase as any)
        .from("patient_consents")
        .insert({
          id: consentId,
          business_id: params.businessId,
          phone_number_hash: phoneHash,
          consent_type: params.consentType,
          granted: params.granted,
          granted_at: params.granted ? new Date().toISOString() : null,
          revoked_at: params.granted ? null : new Date().toISOString(),
          consent_method: params.consentMethod,
          recorded_by_user_id: params.userId,
          call_id: params.callId || null,
          notes: params.notes || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        logError("Record Patient Consent", error);
        return null;
      }

      // Log new consent
      await logPHIAccess({
        businessId: params.businessId,
        userId: params.userId,
        eventType: params.granted ? "consent_recorded" : "consent_revoked",
        resourceType: "contact",
        resourceId: consentId,
        action: "create_consent",
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: {
          consentType: params.consentType,
          consentMethod: params.consentMethod,
          granted: params.granted,
        },
      });

      return consentId;
    }
  } catch (error) {
    logError("Record Patient Consent", error);
    return null;
  }
}

/**
 * Revoke patient consent
 *
 * @param businessId - Business ID
 * @param phone - Patient phone number
 * @param consentType - Type of consent to revoke
 * @param userId - User revoking consent
 * @returns true if consent was revoked
 */
export async function revokePatientConsent(
  businessId: string,
  phone: string,
  consentType: ConsentType,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<boolean> {
  const result = await recordPatientConsent({
    businessId,
    phone,
    consentType,
    granted: false,
    consentMethod: "electronic",
    userId,
    ipAddress,
    userAgent,
    notes: "Consent revoked",
  });

  return result !== null;
}

// =============================================================================
// PHI DETECTION PATTERNS
// =============================================================================

/**
 * Regex patterns for detecting PHI in text
 * Used for automatic PHI detection in call transcripts
 */
export const PHI_DETECTION_PATTERNS: Record<PHICategory, RegExp[]> = {
  ssn: [
    /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, // SSN format
    /\bsocial\s*security\b/gi,
  ],
  dob: [
    /\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](\d{2}|\d{4})\b/g, // Date formats
    /\bdate\s*of\s*birth\b/gi,
    /\bbirthday\b/gi,
    /\bborn\s*on\b/gi,
  ],
  medical_record: [
    /\bMR[#N]?\s*:?\s*\d+\b/gi, // MRN formats
    /\bmedical\s*record\s*(number|#)?\b/gi,
    /\bpatient\s*ID\b/gi,
  ],
  insurance_id: [
    /\b[A-Z]{2,3}\d{6,12}\b/g, // Common insurance ID format
    /\binsurance\s*(id|number|#)\b/gi,
    /\bmember\s*ID\b/gi,
    /\bgroup\s*(number|#)\b/gi,
  ],
  diagnosis: [
    /\bICD[-\s]?10\s*:?\s*[A-Z]\d{2}(\.\d{1,2})?\b/gi, // ICD-10 codes
    /\bdiagnos(is|ed)\b/gi,
    /\bcondition\b/gi,
  ],
  medication: [
    /\b\d+\s*mg\b/gi, // Dosage
    /\bprescri(be|ption)\b/gi,
    /\bmedication\b/gi,
    /\bdrug\b/gi,
    /\bdosage\b/gi,
  ],
  treatment: [
    /\btreatment\b/gi,
    /\bprocedure\b/gi,
    /\bsurgery\b/gi,
    /\btherapy\b/gi,
  ],
  provider_name: [
    /\b(Dr\.|Doctor)\s+[A-Z][a-z]+/g,
    /\bphysician\b/gi,
  ],
  facility_name: [
    /\bhospital\b/gi,
    /\bclinic\b/gi,
    /\bmedical\s*center\b/gi,
  ],
  appointment_date: [
    /\bappointment\b/gi,
    /\bscheduled\s*for\b/gi,
  ],
  lab_results: [
    /\blab\s*results?\b/gi,
    /\btest\s*results?\b/gi,
    /\bblood\s*work\b/gi,
  ],
  genetic_info: [
    /\bgenetic\b/gi,
    /\bDNA\b/g,
    /\bgenomic\b/gi,
  ],
  biometric: [
    /\bbiometric\b/gi,
    /\bfingerprint\b/gi,
  ],
  full_face_photo: [], // Cannot detect in text
  geographic: [
    /\b\d{5}(-\d{4})?\b/g, // ZIP codes
  ],
};

/**
 * Detect PHI categories in text
 *
 * @param text - Text to analyze
 * @param categoriesToCheck - Specific categories to check (optional)
 * @returns Array of detected PHI categories
 */
export function detectPHIInText(
  text: string,
  categoriesToCheck?: PHICategory[]
): PHICategory[] {
  const categories = categoriesToCheck || (PHI_CATEGORIES as unknown as PHICategory[]);
  const detected: PHICategory[] = [];

  for (const category of categories) {
    const patterns = PHI_DETECTION_PATTERNS[category];
    if (!patterns || patterns.length === 0) continue;

    for (const pattern of patterns) {
      // Reset regex state
      pattern.lastIndex = 0;
      if (pattern.test(text)) {
        detected.push(category);
        break; // Only need to find one match per category
      }
    }
  }

  return Array.from(new Set(detected)); // Remove duplicates
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  hashPhoneNumber, // For use in consent lookup
};
