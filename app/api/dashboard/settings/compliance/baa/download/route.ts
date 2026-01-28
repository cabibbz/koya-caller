/**
 * BAA Download API Route
 * /api/dashboard/settings/compliance/baa/download
 *
 * GET: Download signed BAA document
 */

import { NextRequest, NextResponse } from "next/server";
import {
  withAuth,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { getComplianceSettings } from "@/lib/hipaa";
import { APP_CONFIG } from "@/lib/config";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

// =============================================================================
// GET - Download Signed BAA
// =============================================================================

async function handleGet(
  _request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    // Get compliance settings to verify BAA is signed
    const settings = await getComplianceSettings(business.id);

    if (!settings?.baa_signed_at) {
      return errors.notFound("BAA has not been signed");
    }

    // Generate BAA document content
    const signedDate = new Date(settings.baa_signed_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const baaContent = `
BUSINESS ASSOCIATE AGREEMENT
============================

This Business Associate Agreement ("Agreement") is entered into as of ${signedDate}
between Koya Caller ("Covered Entity") and the undersigned Business Associate.

HIPAA COMPLIANCE CERTIFICATION
------------------------------

This document certifies that a Business Associate Agreement has been executed
in compliance with the Health Insurance Portability and Accountability Act (HIPAA)
and the Health Information Technology for Economic and Clinical Health (HITECH) Act.

SIGNED BY:
----------
Name: ${settings.baa_signatory_name}
Title: ${settings.baa_signatory_title || "Authorized Representative"}
Email: ${settings.baa_signatory_email}
Date: ${signedDate}

AGREEMENT VERSION: 1.0

DOCUMENT VERIFICATION
--------------------
Document Hash: ${settings.baa_document_hash || "N/A"}
Signed At: ${settings.baa_signed_at}

This electronic signature and agreement are binding and enforceable.

================================================================================
For questions about this agreement, please contact ${APP_CONFIG.contact.compliance}
================================================================================
`.trim();

    // Return as plain text file download
    return new NextResponse(baaContent, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
        "Content-Disposition": `attachment; filename="BAA-${business.id.slice(0, 8)}-signed.txt"`,
      },
    });
  } catch (error) {
    logError("BAA Download", error);
    return errors.internalError("Failed to download BAA");
  }
}

export const GET = withAuth(handleGet);
