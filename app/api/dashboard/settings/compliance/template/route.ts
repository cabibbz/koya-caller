/**
 * Healthcare Template API Route
 * /api/dashboard/settings/compliance/template
 *
 * GET: List available healthcare templates
 * POST: Apply a healthcare template to compliance settings
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { createAdminClient } from "@/lib/supabase/admin";
import { logPHIAccess } from "@/lib/hipaa";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

// Healthcare template configurations
const HEALTHCARE_TEMPLATES: Record<string, {
  name: string;
  phi_detection_categories: string[];
  hipaa_enabled: boolean;
  require_phi_justification: boolean;
  auto_phi_detection: boolean;
  recording_encryption_enabled: boolean;
  audit_log_retention_days: number;
}> = {
  dental: {
    name: "Dental Practice",
    phi_detection_categories: [
      "ssn", "dob", "medical_record", "insurance_id",
      "diagnosis", "treatment", "medication", "provider_name"
    ],
    hipaa_enabled: true,
    require_phi_justification: true,
    auto_phi_detection: true,
    recording_encryption_enabled: true,
    audit_log_retention_days: 2555, // 7 years
  },
  medical: {
    name: "Medical Practice",
    phi_detection_categories: [
      "ssn", "dob", "medical_record", "insurance_id",
      "diagnosis", "treatment", "medication", "provider_name",
      "lab_results", "genetic_info"
    ],
    hipaa_enabled: true,
    require_phi_justification: true,
    auto_phi_detection: true,
    recording_encryption_enabled: true,
    audit_log_retention_days: 2555,
  },
  mental_health: {
    name: "Mental Health",
    phi_detection_categories: [
      "ssn", "dob", "medical_record", "insurance_id",
      "diagnosis", "treatment", "medication", "provider_name"
    ],
    hipaa_enabled: true,
    require_phi_justification: true,
    auto_phi_detection: true,
    recording_encryption_enabled: true,
    audit_log_retention_days: 3650, // 10 years for mental health
  },
  chiropractic: {
    name: "Chiropractic",
    phi_detection_categories: [
      "ssn", "dob", "medical_record", "insurance_id",
      "diagnosis", "treatment", "provider_name"
    ],
    hipaa_enabled: true,
    require_phi_justification: true,
    auto_phi_detection: true,
    recording_encryption_enabled: true,
    audit_log_retention_days: 2555,
  },
  optometry: {
    name: "Optometry",
    phi_detection_categories: [
      "ssn", "dob", "medical_record", "insurance_id",
      "diagnosis", "treatment", "medication", "provider_name"
    ],
    hipaa_enabled: true,
    require_phi_justification: true,
    auto_phi_detection: true,
    recording_encryption_enabled: true,
    audit_log_retention_days: 2555,
  },
  veterinary: {
    name: "Veterinary",
    phi_detection_categories: [], // HIPAA does not apply
    hipaa_enabled: false,
    require_phi_justification: false,
    auto_phi_detection: false,
    recording_encryption_enabled: false,
    audit_log_retention_days: 365, // 1 year standard
  },
};

function getTemplateDescription(templateId: string): string {
  const descriptions: Record<string, string> = {
    dental: "Optimized for dental offices with appointment scheduling and treatment discussions",
    medical: "General medical practice with patient intake and appointment management",
    mental_health: "Sensitive handling for therapy practices and counseling centers",
    chiropractic: "Chiropractic and physical therapy practices",
    optometry: "Eye care and vision services",
    veterinary: "Animal healthcare practices (Note: HIPAA does not apply)",
  };
  return descriptions[templateId] || "";
}

// =============================================================================
// GET - List Available Templates
// =============================================================================

async function handleGet(
  _request: NextRequest,
  _context: BusinessAuthContext
) {
  try {
    // Return available templates
    const templates = Object.entries(HEALTHCARE_TEMPLATES).map(([id, config]) => ({
      id,
      name: config.name,
      hipaa_enabled: config.hipaa_enabled,
      description: getTemplateDescription(id),
    }));

    return success(templates);
  } catch (error) {
    logError("Healthcare Template GET", error);
    return errors.internalError("Failed to fetch templates");
  }
}

// =============================================================================
// POST - Apply Healthcare Template
// =============================================================================

async function handlePost(
  request: NextRequest,
  { business, user }: BusinessAuthContext
) {
  try {
    // Parse request body
    const body = await request.json();
    const { template_id } = body;

    if (!template_id || typeof template_id !== "string") {
      return errors.badRequest("template_id is required");
    }

    // Get template configuration
    const template = HEALTHCARE_TEMPLATES[template_id];
    if (!template) {
      return errors.badRequest("Invalid template_id");
    }

    // Apply template to compliance settings
    const adminSupabase = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: settings, error: updateError } = await (adminSupabase as any)
      .from("compliance_settings")
      .upsert({
        business_id: business.id,
        hipaa_enabled: template.hipaa_enabled,
        require_phi_justification: template.require_phi_justification,
        auto_phi_detection: template.auto_phi_detection,
        phi_detection_categories: template.phi_detection_categories,
        recording_encryption_enabled: template.recording_encryption_enabled,
        audit_log_retention_days: template.audit_log_retention_days,
        healthcare_template_id: template_id,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "business_id",
      })
      .select()
      .single();

    if (updateError) {
      logError("Template Apply", updateError);
      return errors.internalError("Failed to apply template");
    }

    // Log the template application for audit
    await logPHIAccess({
      businessId: business.id,
      userId: user.id,
      eventType: "compliance_update",
      resourceType: "contact",
      resourceId: business.id,
      action: "apply_healthcare_template",
      metadata: {
        template_id,
        template_name: template.name,
        hipaa_enabled: template.hipaa_enabled,
      },
    });

    return success({
      message: `${template.name} template applied successfully`,
      data: {
        template_id,
        template_name: template.name,
        settings,
      },
    });
  } catch (error) {
    logError("Healthcare Template POST", error);
    return errors.internalError("Failed to apply template");
  }
}

// =============================================================================
// Route Handlers
// =============================================================================

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
