/**
 * Patient Consent API Route
 *
 * Manages patient consent for HIPAA compliance:
 * - GET: Check consent status for a phone number
 * - POST: Record new consent
 * - DELETE: Revoke consent
 *
 * Phone numbers are hashed for storage to protect patient identity.
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { getClientIp, sanitizePhone } from "@/lib/security";
import {
  checkHIPAAEnabled,
  checkPatientConsent,
  getPatientConsents,
  recordPatientConsent,
  revokePatientConsent,
  CONSENT_TYPES,
  type ConsentType,
} from "@/lib/hipaa";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

// =============================================================================
// GET - Check Consent Status
// =============================================================================

async function handleGet(
  request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    // Check if HIPAA mode is enabled
    const hipaaEnabled = await checkHIPAAEnabled(business.id);
    if (!hipaaEnabled) {
      return errors.forbidden("HIPAA mode not enabled. Consent management is only available when HIPAA mode is enabled.");
    }

    // Parse query parameters
    const url = new URL(request.url);
    const phone = url.searchParams.get("phone");
    const consentType = url.searchParams.get("consent_type") as ConsentType | null;

    // Validate phone number
    if (!phone) {
      return errors.badRequest("Phone number is required");
    }

    const sanitizedPhone = sanitizePhone(phone);
    if (!sanitizedPhone) {
      return errors.badRequest("Invalid phone number format");
    }

    // Check specific consent type or get all consents
    if (consentType) {
      // Validate consent type
      if (!CONSENT_TYPES.includes(consentType)) {
        return errors.validationError("Invalid consent type", {
          validTypes: CONSENT_TYPES,
        });
      }

      const hasConsent = await checkPatientConsent(
        business.id,
        sanitizedPhone,
        consentType
      );

      return success({
        phone: sanitizedPhone.slice(-4).padStart(sanitizedPhone.length, "*"),
        consentType,
        granted: hasConsent,
      });
    } else {
      // Get all consents for this phone number
      const consents = await getPatientConsents(business.id, sanitizedPhone);

      // Build consent status map
      const consentStatus: Record<string, { granted: boolean; grantedAt: string | null; method: string | null }> = {};
      for (const type of CONSENT_TYPES) {
        const consent = consents.find((c) => c.consent_type === type);
        consentStatus[type] = {
          granted: consent?.granted === true && consent?.revoked_at === null,
          grantedAt: consent?.granted_at || null,
          method: consent?.consent_method || null,
        };
      }

      return success({
        phone: sanitizedPhone.slice(-4).padStart(sanitizedPhone.length, "*"),
        consents: consentStatus,
        history: consents.map((c) => ({
          type: c.consent_type,
          granted: c.granted,
          grantedAt: c.granted_at,
          revokedAt: c.revoked_at,
          method: c.consent_method,
          recordedAt: c.created_at,
        })),
        availableConsentTypes: CONSENT_TYPES,
      });
    }
  } catch (error) {
    logError("Consent GET", error);
    return errors.internalError("Failed to check consent status");
  }
}

// =============================================================================
// POST - Record New Consent
// =============================================================================

async function handlePost(
  request: NextRequest,
  { business, user }: BusinessAuthContext
) {
  try {
    // Check if HIPAA mode is enabled
    const hipaaEnabled = await checkHIPAAEnabled(business.id);
    if (!hipaaEnabled) {
      return errors.forbidden("HIPAA mode not enabled. Consent management is only available when HIPAA mode is enabled.");
    }

    // Parse request body
    const body = await request.json();
    const {
      phone,
      consent_type: consentType,
      granted,
      consent_method: consentMethod,
      call_id: callId,
      notes,
    } = body;

    // Validate required fields
    if (!phone) {
      return errors.badRequest("Phone number is required");
    }

    const sanitizedPhone = sanitizePhone(phone);
    if (!sanitizedPhone) {
      return errors.badRequest("Invalid phone number format");
    }

    if (!consentType) {
      return errors.badRequest("Consent type is required");
    }

    if (!CONSENT_TYPES.includes(consentType as ConsentType)) {
      return errors.validationError("Invalid consent type", {
        validTypes: CONSENT_TYPES,
      });
    }

    if (typeof granted !== "boolean") {
      return errors.badRequest("Granted must be a boolean (true or false)");
    }

    // Validate consent method
    const validMethods = ["verbal", "written", "electronic"];
    if (!consentMethod || !validMethods.includes(consentMethod)) {
      return errors.validationError("Valid consent method is required", {
        validMethods,
      });
    }

    // Record consent
    const consentId = await recordPatientConsent({
      businessId: business.id,
      phone: sanitizedPhone,
      consentType: consentType as ConsentType,
      granted,
      consentMethod,
      userId: user.id,
      callId,
      notes,
      ipAddress: getClientIp(request) || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    if (!consentId) {
      return errors.internalError("Failed to record consent");
    }

    return success({
      message: granted ? "Consent recorded successfully" : "Consent revocation recorded",
      consentId,
      phone: sanitizedPhone.slice(-4).padStart(sanitizedPhone.length, "*"),
      consentType,
      granted,
      consentMethod,
    });
  } catch (error) {
    logError("Consent POST", error);
    return errors.internalError("Failed to record consent");
  }
}

// =============================================================================
// DELETE - Revoke Consent
// =============================================================================

async function handleDelete(
  request: NextRequest,
  { business, user }: BusinessAuthContext
) {
  try {
    // Check if HIPAA mode is enabled
    const hipaaEnabled = await checkHIPAAEnabled(business.id);
    if (!hipaaEnabled) {
      return errors.forbidden("HIPAA mode not enabled. Consent management is only available when HIPAA mode is enabled.");
    }

    // Parse query parameters
    const url = new URL(request.url);
    const phone = url.searchParams.get("phone");
    const consentType = url.searchParams.get("consent_type") as ConsentType | null;

    // Validate required fields
    if (!phone) {
      return errors.badRequest("Phone number is required");
    }

    const sanitizedPhone = sanitizePhone(phone);
    if (!sanitizedPhone) {
      return errors.badRequest("Invalid phone number format");
    }

    if (!consentType) {
      return errors.badRequest("Consent type is required");
    }

    if (!CONSENT_TYPES.includes(consentType)) {
      return errors.validationError("Invalid consent type", {
        validTypes: CONSENT_TYPES,
      });
    }

    // Revoke consent
    const revokeSuccess = await revokePatientConsent(
      business.id,
      sanitizedPhone,
      consentType,
      user.id,
      getClientIp(request) || undefined,
      request.headers.get("user-agent") || undefined
    );

    if (!revokeSuccess) {
      return errors.internalError("Failed to revoke consent");
    }

    return success({
      message: "Consent revoked successfully",
      phone: sanitizedPhone.slice(-4).padStart(sanitizedPhone.length, "*"),
      consentType,
      revoked: true,
    });
  } catch (error) {
    logError("Consent DELETE", error);
    return errors.internalError("Failed to revoke consent");
  }
}

// =============================================================================
// Route Handlers
// =============================================================================

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
export const DELETE = withAuth(handleDelete);
