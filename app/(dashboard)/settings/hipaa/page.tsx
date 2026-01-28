/**
 * HIPAA Settings Page - Server Component
 * Phase 3: Healthcare Compliance Features
 *
 * Provides comprehensive HIPAA compliance management:
 * - HIPAA Mode Toggle
 * - PHI Audit Log Viewer
 * - Data Encryption Status
 * - Consent Management
 * - BAA Status & Management
 * - Compliance Checklist
 */

import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { getComplianceSettings, checkHIPAAEnabled } from "@/lib/hipaa";
import { getAuditStatistics } from "@/lib/hipaa/audit";
import { HIPAASettingsClient } from "./hipaa-client";

export const metadata: Metadata = {
  title: "HIPAA Compliance Settings | Koya Caller",
  description:
    "Manage HIPAA compliance settings, PHI audit logs, encryption, and patient consent records.",
};

export const dynamic = "force-dynamic";

export default async function HIPAASettingsPage() {
  // Get authenticated user
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // Get user's business
  const business = await getBusinessByUserId(user.id);
  if (!business) {
    redirect("/onboarding");
  }

  // Fetch HIPAA-related data in parallel
  const [complianceSettings, hipaaEnabled, auditStats] = await Promise.all([
    getComplianceSettings(business.id),
    checkHIPAAEnabled(business.id),
    getAuditStatistics(business.id, 30).catch(() => null),
  ]);

  return (
    <div className="p-6 lg:p-8">
      <HIPAASettingsClient
        businessId={business.id}
        userEmail={user.email || ""}
        initialSettings={complianceSettings}
        hipaaEnabled={hipaaEnabled}
        auditStats={auditStats}
      />
    </div>
  );
}
