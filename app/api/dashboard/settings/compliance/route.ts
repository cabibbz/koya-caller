/**
 * Compliance Settings API Route
 *
 * Manages HIPAA compliance settings for businesses:
 * - GET: Fetch compliance settings
 * - PUT: Update settings (requires admin)
 * - POST: Sign BAA agreement
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { getClientIp } from "@/lib/security";
import {
  getComplianceSettings,
  updateComplianceSettings,
  signBAA,
  type PHICategory,
  PHI_CATEGORIES,
} from "@/lib/hipaa";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

// =============================================================================
// GET - Fetch Compliance Settings
// =============================================================================

async function handleGet(
  _request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    const settings = await getComplianceSettings(business.id);

    // Build response in the format the component expects
    const baaStatus = {
      signed: !!settings?.baa_signed_at,
      signed_at: settings?.baa_signed_at || null,
      signatory_name: settings?.baa_signatory_name || null,
      signatory_email: settings?.baa_signatory_email || null,
      baa_version: "1.0",
    };

    const phiSettings = {
      phi_handling_enabled: settings?.hipaa_enabled || false,
      phi_in_transcripts: settings?.auto_phi_detection ? !(settings?.require_phi_justification) : false,
      phi_in_recordings: settings?.recording_encryption_enabled || false,
      auto_redact_phi: settings?.auto_phi_detection || false,
      phi_categories: settings?.phi_detection_categories || [],
    };

    const retentionSettings = {
      recording_retention_days: settings?.audit_log_retention_days || 2190,
      transcript_retention_days: settings?.audit_log_retention_days || 2190,
      audit_log_retention_days: settings?.audit_log_retention_days || 2190,
    };

    return success({
      baa: baaStatus,
      phi: phiSettings,
      retention: retentionSettings,
      healthcare_template_id: null,
      availablePHICategories: PHI_CATEGORIES,
    });
  } catch (error) {
    logError("Compliance Settings GET", error);
    return errors.internalError("Failed to fetch compliance settings");
  }
}

// =============================================================================
// PUT - Update Compliance Settings
// =============================================================================

async function handlePut(
  request: NextRequest,
  { business, user }: BusinessAuthContext
) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate PHI categories if provided
    if (body.phi_detection_categories) {
      const invalidCategories = body.phi_detection_categories.filter(
        (cat: string) => !PHI_CATEGORIES.includes(cat as PHICategory)
      );
      if (invalidCategories.length > 0) {
        return errors.validationError("Invalid PHI categories", {
          invalidCategories,
          validCategories: PHI_CATEGORIES,
        });
      }
    }

    // Validate retention days (minimum 6 years for HIPAA)
    if (body.audit_log_retention_days !== undefined) {
      const minRetention = 2190; // 6 years
      if (body.audit_log_retention_days < minRetention) {
        return errors.validationError(
          "Audit log retention must be at least 6 years (2190 days) for HIPAA compliance",
          { minimum: minRetention }
        );
      }
    }

    // Map component format to database format
    const updateData: Record<string, unknown> = {};

    // Handle PHI settings from component format
    if (body.phi) {
      if (body.phi.phi_handling_enabled !== undefined) {
        updateData.hipaa_enabled = body.phi.phi_handling_enabled;
      }
      if (body.phi.auto_redact_phi !== undefined) {
        updateData.auto_phi_detection = body.phi.auto_redact_phi;
      }
      if (body.phi.phi_in_recordings !== undefined) {
        updateData.recording_encryption_enabled = body.phi.phi_in_recordings;
      }
      if (body.phi.phi_categories !== undefined) {
        updateData.phi_detection_categories = body.phi.phi_categories;
      }
      if (body.phi.phi_in_transcripts !== undefined) {
        updateData.require_phi_justification = !body.phi.phi_in_transcripts;
      }
    }

    // Handle retention settings from component format
    if (body.retention) {
      if (body.retention.audit_log_retention_days !== undefined) {
        updateData.audit_log_retention_days = body.retention.audit_log_retention_days;
      }
    }

    // Also handle direct field updates (backwards compatibility)
    const directFields = [
      "hipaa_enabled",
      "require_phi_justification",
      "auto_phi_detection",
      "phi_detection_categories",
      "recording_encryption_enabled",
      "audit_log_retention_days",
    ];

    for (const field of directFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Update settings
    const updated = await updateComplianceSettings(
      business.id,
      updateData,
      user.id
    );

    if (!updated) {
      return errors.internalError("Failed to update compliance settings");
    }

    return success(updated);
  } catch (error) {
    logError("Compliance Settings PUT", error);
    return errors.internalError("Failed to update compliance settings");
  }
}

// =============================================================================
// POST - Sign BAA Agreement
// =============================================================================

async function handlePost(
  request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate required fields for BAA signature
    const { name, title, email, acknowledged } = body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return errors.badRequest("Valid signatory name is required");
    }

    if (!title || typeof title !== "string" || title.trim().length < 2) {
      return errors.badRequest("Valid signatory title is required");
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return errors.badRequest("Valid signatory email is required");
    }

    if (acknowledged !== true) {
      return errors.badRequest("BAA terms must be acknowledged");
    }

    // Check if BAA already signed
    const existingSettings = await getComplianceSettings(business.id);
    if (existingSettings?.baa_signed_at) {
      return errors.conflict("BAA already signed");
    }

    // Sign the BAA
    const signed = await signBAA(business.id, {
      name: name.trim(),
      title: title.trim(),
      email: email.trim().toLowerCase(),
      ipAddress: getClientIp(request) || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    if (!signed) {
      return errors.internalError("Failed to record BAA signature");
    }

    // Get updated settings
    const updated = await getComplianceSettings(business.id);

    return success({
      message: "BAA signed successfully. HIPAA mode has been enabled.",
      ...updated,
    });
  } catch (error) {
    logError("BAA Signature POST", error);
    return errors.internalError("Failed to sign BAA");
  }
}

// =============================================================================
// Route Handlers
// =============================================================================

export const GET = withAuth(handleGet);
export const PUT = withAuth(handlePut);
export const POST = withAuth(handlePost);
