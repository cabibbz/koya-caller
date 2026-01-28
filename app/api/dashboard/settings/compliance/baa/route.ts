/**
 * BAA Signing API Route
 * /api/dashboard/settings/compliance/baa
 *
 * POST: Sign Business Associate Agreement
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { getClientIp } from "@/lib/security";
import { getComplianceSettings, signBAA } from "@/lib/hipaa";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

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

    // The component sends signatory_name and signatory_email
    const signatoryName = body.signatory_name;
    const signatoryEmail = body.signatory_email;

    if (!signatoryName || typeof signatoryName !== "string" || signatoryName.trim().length < 2) {
      return errors.badRequest("Valid signatory name is required");
    }

    if (!signatoryEmail || typeof signatoryEmail !== "string" || !signatoryEmail.includes("@")) {
      return errors.badRequest("Valid signatory email is required");
    }

    // Check if BAA already signed
    const existingSettings = await getComplianceSettings(business.id);
    if (existingSettings?.baa_signed_at) {
      return errors.conflict("BAA already signed");
    }

    // Sign the BAA
    const signed = await signBAA(business.id, {
      name: signatoryName.trim(),
      title: "Authorized Representative", // Default title
      email: signatoryEmail.trim().toLowerCase(),
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
      data: {
        version: "1.0",
        signed_at: updated?.baa_signed_at,
        signatory_name: updated?.baa_signatory_name,
      },
    });
  } catch (error) {
    logError("BAA Signature POST", error);
    return errors.internalError("Failed to sign BAA");
  }
}

// =============================================================================
// Route Handlers
// =============================================================================

export const POST = withAuth(handlePost);
