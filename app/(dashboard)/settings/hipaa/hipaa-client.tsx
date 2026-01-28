"use client";

/**
 * HIPAA Settings Client Component
 * Phase 3: Healthcare Compliance Features
 *
 * Comprehensive HIPAA compliance dashboard with:
 * 1. HIPAA Compliance Toggle
 * 2. PHI Audit Log Viewer
 * 3. Data Encryption Status
 * 4. Consent Management
 * 5. BAA (Business Associate Agreement) Status
 * 6. Compliance Checklist
 */

import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  FileText,
  Loader2,
  AlertCircle,
  Download,
  Lock,
  Eye,
  Clock,
  CheckCircle,
  Users,
  Key,
  ClipboardCheck,
  Search,
  XCircle,
  ChevronDown,
  ChevronUp,
  Filter,
  Activity,
  ShieldCheck,
  ShieldAlert,
  FileCheck,
  Database,
  UserCheck,
} from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Input,
  Label,
  Switch,
  Checkbox,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Alert,
  AlertDescription,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { SkeletonTableRow } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";

// ============================================
// Types
// ============================================

interface ComplianceSettings {
  id: string;
  business_id: string;
  hipaa_enabled: boolean;
  require_phi_justification: boolean;
  auto_phi_detection: boolean;
  phi_detection_categories: string[];
  recording_encryption_enabled: boolean;
  encryption_key_id: string | null;
  audit_log_retention_days: number;
  baa_signed_at: string | null;
  baa_signatory_name: string | null;
  baa_signatory_title: string | null;
  baa_signatory_email: string | null;
  baa_document_hash: string | null;
  created_at: string;
  updated_at: string;
}

interface AuditLogEntry {
  id: string;
  business_id: string;
  user_id: string;
  event_type: string;
  resource_type: string;
  resource_id: string;
  action: string;
  justification: string | null;
  ip_address: string | null;
  user_agent: string | null;
  phi_categories: string[];
  metadata: Record<string, unknown>;
  created_at: string;
}

interface AuditStats {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByDay: Record<string, number>;
  uniqueUsers: number;
  phiAccessCount: number;
}

interface ConsentRecord {
  phone: string;
  consentType: string;
  granted: boolean;
  grantedAt: string | null;
  method: string | null;
}

interface HIPAASettingsClientProps {
  businessId: string;
  userEmail: string;
  initialSettings: ComplianceSettings | null;
  hipaaEnabled: boolean;
  auditStats: AuditStats | null;
}

// ============================================
// Constants
// ============================================

const COMPLIANCE_CHECKLIST = [
  {
    id: "baa_signed",
    label: "Business Associate Agreement (BAA) Signed",
    description: "Required legal agreement for handling PHI",
    required: true,
    category: "legal",
  },
  {
    id: "hipaa_enabled",
    label: "HIPAA Mode Enabled",
    description: "Enables all HIPAA compliance features",
    required: true,
    category: "system",
  },
  {
    id: "encryption_enabled",
    label: "Data Encryption Enabled",
    description: "AES-256 encryption for all PHI at rest",
    required: true,
    category: "technical",
  },
  {
    id: "audit_logging",
    label: "Audit Logging Active",
    description: "All PHI access is logged and retained for 6+ years",
    required: true,
    category: "technical",
  },
  {
    id: "phi_detection",
    label: "PHI Auto-Detection Enabled",
    description: "Automatic detection and flagging of PHI in transcripts",
    required: false,
    category: "system",
  },
  {
    id: "access_controls",
    label: "Access Controls Configured",
    description: "Role-based access control for PHI",
    required: true,
    category: "administrative",
  },
  {
    id: "retention_policy",
    label: "Retention Policy Set",
    description: "Data retention period meets HIPAA requirements (6+ years)",
    required: true,
    category: "administrative",
  },
  {
    id: "consent_tracking",
    label: "Patient Consent Tracking",
    description: "System to track patient consent for data handling",
    required: false,
    category: "administrative",
  },
];

const EVENT_TYPE_LABELS: Record<string, string> = {
  phi_access: "PHI Access",
  phi_view: "PHI View",
  phi_export: "PHI Export",
  phi_modify: "PHI Modify",
  phi_delete: "PHI Delete",
  recording_access: "Recording Access",
  transcript_access: "Transcript Access",
  contact_access: "Contact Access",
  consent_recorded: "Consent Recorded",
  consent_revoked: "Consent Revoked",
  baa_signed: "BAA Signed",
  compliance_update: "Compliance Update",
  encryption_key_rotate: "Key Rotation",
};

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  call: "Call",
  recording: "Recording",
  transcript: "Transcript",
  contact: "Contact",
  appointment: "Appointment",
};

// ============================================
// Component
// ============================================

export function HIPAASettingsClient({
  businessId: _businessId,
  userEmail,
  initialSettings,
  hipaaEnabled: initialHipaaEnabled,
  auditStats: initialAuditStats,
}: HIPAASettingsClientProps) {
  // Core state
  const [settings, setSettings] = useState<ComplianceSettings | null>(
    initialSettings
  );
  const [hipaaEnabled, setHipaaEnabled] = useState(initialHipaaEnabled);
  const [saving, setSaving] = useState(false);

  // Error state for component-level error handling
  const [componentError, setComponentError] = useState<string | null>(null);

  // Audit log state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditStats, setAuditStats] = useState<AuditStats | null>(
    initialAuditStats
  );
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);
  const [auditLogFilters, setAuditLogFilters] = useState({
    eventType: "",
    resourceType: "",
    startDate: "",
    endDate: "",
  });
  const [auditLogPagination, setAuditLogPagination] = useState({
    offset: 0,
    limit: 20,
    hasMore: false,
    totalCount: 0,
  });

  // Consent management state
  const [consentPhone, setConsentPhone] = useState("");
  const [consentRecords, setConsentRecords] = useState<ConsentRecord[]>([]);
  const [loadingConsent, setLoadingConsent] = useState(false);

  // BAA dialog state
  const [baaDialogOpen, setBaaDialogOpen] = useState(false);
  const [signatoryName, setSignatoryName] = useState("");
  const [signatoryTitle, setSignatoryTitle] = useState("");
  const [signatoryEmail, setSignatoryEmail] = useState(userEmail);
  const [agreedToBAA, setAgreedToBAA] = useState(false);
  const [signingBAA, setSigningBAA] = useState(false);

  // UI state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["overview", "baa", "compliance"])
  );

  // ============================================
  // Data Fetching
  // ============================================

  const fetchAuditLogs = useCallback(
    async (reset = false, overrideOffset?: number) => {
      if (!hipaaEnabled) return;

      setLoadingAuditLogs(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", auditLogPagination.limit.toString());
        // Use overrideOffset if provided, otherwise use reset logic or current offset
        const effectiveOffset = overrideOffset !== undefined
          ? overrideOffset
          : (reset ? 0 : auditLogPagination.offset);
        params.set("offset", effectiveOffset.toString());

        if (auditLogFilters.eventType) {
          params.set("event_types", auditLogFilters.eventType);
        }
        if (auditLogFilters.resourceType) {
          params.set("resource_type", auditLogFilters.resourceType);
        }
        if (auditLogFilters.startDate) {
          params.set("start_date", auditLogFilters.startDate);
        }
        if (auditLogFilters.endDate) {
          params.set("end_date", auditLogFilters.endDate);
        }

        const response = await fetch(
          `/api/dashboard/compliance/audit?${params.toString()}`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch audit logs");
        }

        if (data.data) {
          setAuditLogs(reset ? data.data.entries : data.data.entries);
          setAuditLogPagination({
            offset: reset ? 0 : auditLogPagination.offset,
            limit: auditLogPagination.limit,
            hasMore: data.data.pagination?.hasMore || false,
            totalCount: data.data.totalCount || 0,
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error
          ? error.message
          : "Failed to fetch audit logs";
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
        // Set component error for persistent failures
        if (reset) {
          setComponentError(`Failed to load audit logs: ${errorMessage}`);
        }
      } finally {
        setLoadingAuditLogs(false);
      }
    },
    [hipaaEnabled, auditLogFilters, auditLogPagination.limit, auditLogPagination.offset]
  );

  const fetchAuditStats = useCallback(async () => {
    if (!hipaaEnabled) return;

    try {
      const response = await fetch(
        "/api/dashboard/compliance/audit?stats_only=true&stats_days=30"
      );
      const data = await response.json();

      if (response.ok && data.data) {
        setAuditStats(data.data);
      }
    } catch {
      // Silently fail - stats are not critical
    }
  }, [hipaaEnabled]);

  const fetchConsentRecords = useCallback(async () => {
    if (!consentPhone || !hipaaEnabled) return;

    setLoadingConsent(true);
    try {
      const response = await fetch(
        `/api/dashboard/compliance/consent?phone=${encodeURIComponent(consentPhone)}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch consent records");
      }

      if (data.data?.consents) {
        const records: ConsentRecord[] = Object.entries(data.data.consents).map(
          ([type, info]) => ({
            phone: data.data.phone,
            consentType: type,
            granted: (info as { granted: boolean }).granted,
            grantedAt: (info as { grantedAt: string | null }).grantedAt,
            method: (info as { method: string | null }).method,
          })
        );
        setConsentRecords(records);
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to fetch consent records",
        variant: "destructive",
      });
    } finally {
      setLoadingConsent(false);
    }
  }, [consentPhone, hipaaEnabled]);

  // Initial fetch
  useEffect(() => {
    if (hipaaEnabled) {
      fetchAuditLogs(true);
      fetchAuditStats();
    }
  }, [hipaaEnabled, fetchAuditLogs, fetchAuditStats]);

  // ============================================
  // Actions
  // ============================================

  const handleToggleHIPAA = async (enabled: boolean) => {
    // If trying to enable without BAA signed, show warning
    if (enabled && !settings?.baa_signed_at) {
      toast({
        title: "BAA Required",
        description:
          "You must sign the Business Associate Agreement before enabling HIPAA mode.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/dashboard/settings/compliance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hipaa_enabled: enabled }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update HIPAA settings");
      }

      setHipaaEnabled(enabled);
      setSettings((prev) =>
        prev ? { ...prev, hipaa_enabled: enabled } : prev
      );

      toast({
        title: enabled ? "HIPAA Mode Enabled" : "HIPAA Mode Disabled",
        description: enabled
          ? "All HIPAA compliance features are now active."
          : "HIPAA compliance features have been disabled.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update HIPAA settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSignBAA = async () => {
    if (!signatoryName || !signatoryTitle || !signatoryEmail) {
      toast({
        title: "Required Fields",
        description: "Please complete all signatory fields",
        variant: "destructive",
      });
      return;
    }

    if (!agreedToBAA) {
      toast({
        title: "Agreement Required",
        description: "Please agree to the Business Associate Agreement",
        variant: "destructive",
      });
      return;
    }

    setSigningBAA(true);
    try {
      const response = await fetch("/api/dashboard/settings/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: signatoryName,
          title: signatoryTitle,
          email: signatoryEmail,
          acknowledged: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to sign BAA");
      }

      // Update local state
      setSettings((prev) =>
        prev
          ? {
              ...prev,
              baa_signed_at: new Date().toISOString(),
              baa_signatory_name: signatoryName,
              baa_signatory_title: signatoryTitle,
              baa_signatory_email: signatoryEmail,
              hipaa_enabled: true,
            }
          : prev
      );
      setHipaaEnabled(true);
      setBaaDialogOpen(false);

      // Reset form
      setSignatoryName("");
      setSignatoryTitle("");
      setAgreedToBAA(false);

      toast({
        title: "BAA Signed Successfully",
        description:
          "Business Associate Agreement has been signed. HIPAA mode is now enabled.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to sign BAA",
        variant: "destructive",
      });
    } finally {
      setSigningBAA(false);
    }
  };

  const handleExportAuditLogs = async () => {
    try {
      const params = new URLSearchParams();
      params.set("format", "csv");

      if (auditLogFilters.startDate) {
        params.set("start_date", auditLogFilters.startDate);
      }
      if (auditLogFilters.endDate) {
        params.set("end_date", auditLogFilters.endDate);
      }

      window.open(
        `/api/dashboard/compliance/audit?${params.toString()}`,
        "_blank"
      );
    } catch {
      toast({
        title: "Error",
        description: "Failed to export audit logs",
        variant: "destructive",
      });
    }
  };

  // ============================================
  // Helpers
  // ============================================

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateShort = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getComplianceScore = () => {
    let completed = 0;
    const total = COMPLIANCE_CHECKLIST.filter((item) => item.required).length;

    if (settings?.baa_signed_at) completed++;
    if (hipaaEnabled) completed++;
    if (settings?.recording_encryption_enabled) completed++;
    if (hipaaEnabled) completed++; // Audit logging is automatic when HIPAA is enabled
    if (settings?.audit_log_retention_days && settings.audit_log_retention_days >= 2190) completed++;
    if (hipaaEnabled) completed++; // Access controls are automatic

    return { completed, total, percentage: Math.round((completed / total) * 100) };
  };

  const isChecklistItemComplete = (id: string) => {
    switch (id) {
      case "baa_signed":
        return !!settings?.baa_signed_at;
      case "hipaa_enabled":
        return hipaaEnabled;
      case "encryption_enabled":
        return settings?.recording_encryption_enabled ?? false;
      case "audit_logging":
        return hipaaEnabled;
      case "phi_detection":
        return settings?.auto_phi_detection ?? false;
      case "access_controls":
        return hipaaEnabled;
      case "retention_policy":
        return (settings?.audit_log_retention_days ?? 0) >= 2190;
      case "consent_tracking":
        return hipaaEnabled;
      default:
        return false;
    }
  };

  const complianceScore = getComplianceScore();

  // ============================================
  // Render
  // ============================================

  // Show error state if there's a component-level error
  if (componentError) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {componentError}
            <Button
              variant="link"
              className="ml-2 p-0 h-auto"
              onClick={() => {
                setComponentError(null);
                window.location.reload();
              }}
            >
              Reload page
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            HIPAA Compliance
          </h1>
          <p className="text-muted-foreground">
            Manage HIPAA compliance settings, audit logs, and patient consent
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hipaaEnabled ? (
            <Badge variant="success" className="text-sm py-1 px-3">
              <ShieldCheck className="h-4 w-4 mr-1" />
              HIPAA Mode Active
            </Badge>
          ) : (
            <Badge variant="warning" className="text-sm py-1 px-3">
              <ShieldAlert className="h-4 w-4 mr-1" />
              HIPAA Mode Inactive
            </Badge>
          )}
        </div>
      </div>

      {/* Compliance Overview Card */}
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => toggleSection("overview")}
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Compliance Overview
              </CardTitle>
              <CardDescription>
                Current HIPAA compliance status and statistics
              </CardDescription>
            </div>
            {expandedSections.has("overview") ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        {expandedSections.has("overview") && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Compliance Score */}
              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    Compliance Score
                  </span>
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-bold">
                      {complianceScore.percentage}%
                    </span>
                    <span className="text-sm text-muted-foreground mb-1">
                      ({complianceScore.completed}/{complianceScore.total})
                    </span>
                  </div>
                  <Progress
                    value={complianceScore.percentage}
                    className="h-2"
                    indicatorClassName={
                      complianceScore.percentage === 100
                        ? "bg-green-500"
                        : complianceScore.percentage >= 75
                          ? "bg-yellow-500"
                          : "bg-red-500"
                    }
                  />
                </div>
              </div>

              {/* PHI Access Events (30 days) */}
              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    PHI Access (30 days)
                  </span>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <span className="text-3xl font-bold">
                    {auditStats?.phiAccessCount ?? 0}
                  </span>
                  <span className="text-sm text-muted-foreground ml-1">
                    events
                  </span>
                </div>
              </div>

              {/* Unique Users */}
              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    Active Users
                  </span>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <span className="text-3xl font-bold">
                    {auditStats?.uniqueUsers ?? 0}
                  </span>
                  <span className="text-sm text-muted-foreground ml-1">
                    users
                  </span>
                </div>
              </div>

              {/* Total Audit Events */}
              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    Total Events
                  </span>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <span className="text-3xl font-bold">
                    {auditStats?.totalEvents ?? 0}
                  </span>
                  <span className="text-sm text-muted-foreground ml-1">
                    logged
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* HIPAA Mode Toggle Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`p-3 rounded-lg ${hipaaEnabled ? "bg-green-100 dark:bg-green-900" : "bg-muted"}`}
              >
                <Shield
                  className={`h-6 w-6 ${hipaaEnabled ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}
                />
              </div>
              <div>
                <h3 className="font-semibold text-lg">HIPAA Compliance Mode</h3>
                <p className="text-sm text-muted-foreground">
                  Enable all HIPAA compliance features including audit logging,
                  encryption, and access controls
                </p>
              </div>
            </div>
            <Switch
              checked={hipaaEnabled}
              onCheckedChange={handleToggleHIPAA}
              disabled={saving || (!settings?.baa_signed_at && !hipaaEnabled)}
            />
          </div>

          {!settings?.baa_signed_at && (
            <Alert className="mt-4" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You must sign a Business Associate Agreement (BAA) before
                enabling HIPAA mode.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* BAA Status Card */}
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => toggleSection("baa")}
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                Business Associate Agreement (BAA)
              </CardTitle>
              <CardDescription>
                Required legal agreement for handling Protected Health
                Information
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {settings?.baa_signed_at ? (
                <Badge variant="success">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Signed
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  Not Signed
                </Badge>
              )}
              {expandedSections.has("baa") ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </div>
        </CardHeader>
        {expandedSections.has("baa") && (
          <CardContent>
            {settings?.baa_signed_at ? (
              <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div className="space-y-2 flex-1">
                    <p className="font-medium text-green-800 dark:text-green-200">
                      BAA Signed and Active
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-sm text-green-700 dark:text-green-300">
                      <div>
                        <span className="font-medium">Signed by:</span>{" "}
                        {settings.baa_signatory_name}
                      </div>
                      <div>
                        <span className="font-medium">Title:</span>{" "}
                        {settings.baa_signatory_title || "N/A"}
                      </div>
                      <div>
                        <span className="font-medium">Email:</span>{" "}
                        {settings.baa_signatory_email}
                      </div>
                      <div>
                        <span className="font-medium">Date:</span>{" "}
                        {formatDateShort(settings.baa_signed_at)}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          window.open(
                            "/api/dashboard/settings/compliance/baa/download",
                            "_blank"
                          )
                        }
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Signed BAA
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    You must sign a Business Associate Agreement before enabling
                    HIPAA compliance features. This is legally required for
                    handling Protected Health Information.
                  </AlertDescription>
                </Alert>
                <div className="flex items-center gap-4">
                  <Button onClick={() => setBaaDialogOpen(true)}>
                    <FileText className="h-4 w-4 mr-2" />
                    Sign BAA
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.open("/legal/baa", "_blank")}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View BAA Template
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Data Encryption Status Card */}
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => toggleSection("encryption")}
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Data Encryption Status
              </CardTitle>
              <CardDescription>
                AES-256 encryption for all PHI data at rest
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {settings?.recording_encryption_enabled ? (
                <Badge variant="success">
                  <Lock className="h-3 w-3 mr-1" />
                  Encrypted
                </Badge>
              ) : (
                <Badge variant="warning">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Not Enabled
                </Badge>
              )}
              {expandedSections.has("encryption") ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </div>
        </CardHeader>
        {expandedSections.has("encryption") && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Recordings</span>
                </div>
                <div className="flex items-center gap-2">
                  {settings?.recording_encryption_enabled ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-600 dark:text-green-400">
                        AES-256-GCM Encrypted
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-red-600 dark:text-red-400">
                        Not Encrypted
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Transcripts</span>
                </div>
                <div className="flex items-center gap-2">
                  {hipaaEnabled ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-600 dark:text-green-400">
                        Database Encrypted
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-red-600 dark:text-red-400">
                        Standard Storage
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Encryption Key</span>
                </div>
                <div className="flex items-center gap-2">
                  {settings?.encryption_key_id ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-muted-foreground">
                        Key ID: {settings.encryption_key_id.slice(0, 8)}...
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm text-muted-foreground">
                        No key configured
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {hipaaEnabled && (
              <Alert>
                <Lock className="h-4 w-4" />
                <AlertDescription>
                  All PHI data is encrypted at rest using AES-256-GCM
                  encryption. Encryption keys are managed securely and rotated
                  according to HIPAA requirements.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        )}
      </Card>

      {/* PHI Audit Log Viewer */}
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => toggleSection("audit")}
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                PHI Audit Log
              </CardTitle>
              <CardDescription>
                View all PHI access events (retained for 6+ years per HIPAA
                requirements)
              </CardDescription>
            </div>
            {expandedSections.has("audit") ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        {expandedSections.has("audit") && (
          <CardContent className="space-y-4">
            {!hipaaEnabled ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Audit logs are only available when HIPAA mode is enabled.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {/* Filters */}
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Event Type</Label>
                    <Select
                      value={auditLogFilters.eventType}
                      onValueChange={(value) =>
                        setAuditLogFilters((prev) => ({
                          ...prev,
                          eventType: value,
                        }))
                      }
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="All events" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All events</SelectItem>
                        {Object.entries(EVENT_TYPE_LABELS).map(
                          ([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Resource Type</Label>
                    <Select
                      value={auditLogFilters.resourceType}
                      onValueChange={(value) =>
                        setAuditLogFilters((prev) => ({
                          ...prev,
                          resourceType: value,
                        }))
                      }
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All types</SelectItem>
                        {Object.entries(RESOURCE_TYPE_LABELS).map(
                          ([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Start Date</Label>
                    <Input
                      type="date"
                      value={auditLogFilters.startDate}
                      onChange={(e) =>
                        setAuditLogFilters((prev) => ({
                          ...prev,
                          startDate: e.target.value,
                        }))
                      }
                      className="w-[150px]"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">End Date</Label>
                    <Input
                      type="date"
                      value={auditLogFilters.endDate}
                      onChange={(e) =>
                        setAuditLogFilters((prev) => ({
                          ...prev,
                          endDate: e.target.value,
                        }))
                      }
                      className="w-[150px]"
                    />
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchAuditLogs(true)}
                    disabled={loadingAuditLogs}
                  >
                    {loadingAuditLogs ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Filter className="h-4 w-4" />
                    )}
                    <span className="ml-2">Apply</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportAuditLogs}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>

                {/* Audit Log Table */}
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Event Type</TableHead>
                        <TableHead>Resource</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>IP Address</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingAuditLogs ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell colSpan={6}>
                              <SkeletonTableRow columns={6} />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : auditLogs.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center py-8 text-muted-foreground"
                          >
                            No audit log entries found
                          </TableCell>
                        </TableRow>
                      ) : (
                        auditLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="whitespace-nowrap">
                              {formatDate(log.created_at)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {EVENT_TYPE_LABELS[log.event_type] ||
                                  log.event_type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-xs">
                                {RESOURCE_TYPE_LABELS[log.resource_type] ||
                                  log.resource_type}
                                :{log.resource_id.slice(0, 8)}...
                              </span>
                            </TableCell>
                            <TableCell>{log.action}</TableCell>
                            <TableCell>
                              <span className="font-mono text-xs">
                                {log.user_id.slice(0, 8)}...
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {log.ip_address || "N/A"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {auditLogs.length > 0 && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Showing {auditLogs.length} of{" "}
                      {auditLogPagination.totalCount} entries
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={auditLogPagination.offset === 0}
                        onClick={() => {
                          const newOffset = Math.max(0, auditLogPagination.offset - auditLogPagination.limit);
                          setAuditLogPagination((prev) => ({
                            ...prev,
                            offset: newOffset,
                          }));
                          fetchAuditLogs(false, newOffset);
                        }}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!auditLogPagination.hasMore}
                        onClick={() => {
                          const newOffset = auditLogPagination.offset + auditLogPagination.limit;
                          setAuditLogPagination((prev) => ({
                            ...prev,
                            offset: newOffset,
                          }));
                          fetchAuditLogs(false, newOffset);
                        }}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        )}
      </Card>

      {/* Consent Management Card */}
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => toggleSection("consent")}
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Consent Management
              </CardTitle>
              <CardDescription>
                View and manage patient consent records for PHI handling
              </CardDescription>
            </div>
            {expandedSections.has("consent") ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        {expandedSections.has("consent") && (
          <CardContent className="space-y-4">
            {!hipaaEnabled ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Consent management is only available when HIPAA mode is
                  enabled.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {/* Phone Number Search */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Input
                      placeholder="Enter phone number to lookup consent records..."
                      value={consentPhone}
                      onChange={(e) => setConsentPhone(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={fetchConsentRecords}
                    disabled={loadingConsent || !consentPhone}
                  >
                    {loadingConsent ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Search className="h-4 w-4 mr-2" />
                    )}
                    Search
                  </Button>
                </div>

                {/* Consent Records Table */}
                {consentRecords.length > 0 && (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Consent Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Granted At</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {consentRecords.map((record) => (
                          <TableRow key={record.consentType}>
                            <TableCell className="font-medium">
                              {record.consentType
                                .replace(/_/g, " ")
                                .replace(/\b\w/g, (l) => l.toUpperCase())}
                            </TableCell>
                            <TableCell>
                              {record.granted ? (
                                <Badge variant="success">Granted</Badge>
                              ) : (
                                <Badge variant="destructive">Not Granted</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {record.method
                                ? record.method
                                    .replace(/\b\w/g, (l) => l.toUpperCase())
                                : "N/A"}
                            </TableCell>
                            <TableCell>
                              {record.grantedAt
                                ? formatDate(record.grantedAt)
                                : "N/A"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <Alert>
                  <Users className="h-4 w-4" />
                  <AlertDescription>
                    Patient consents are recorded during calls and can be
                    managed here. Phone numbers are hashed for privacy
                    protection.
                  </AlertDescription>
                </Alert>
              </>
            )}
          </CardContent>
        )}
      </Card>

      {/* Compliance Checklist Card */}
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => toggleSection("compliance")}
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Compliance Checklist
              </CardTitle>
              <CardDescription>
                Track your progress towards full HIPAA compliance
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  complianceScore.percentage === 100 ? "success" : "warning"
                }
              >
                {complianceScore.completed}/{complianceScore.total} Complete
              </Badge>
              {expandedSections.has("compliance") ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </div>
        </CardHeader>
        {expandedSections.has("compliance") && (
          <CardContent>
            <div className="space-y-3">
              {COMPLIANCE_CHECKLIST.map((item) => {
                const isComplete = isChecklistItemComplete(item.id);
                return (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 p-3 border rounded-lg ${
                      isComplete
                        ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
                        : item.required
                          ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
                          : ""
                    }`}
                  >
                    <div className="mt-0.5">
                      {isComplete ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : item.required ? (
                        <XCircle className="h-5 w-5 text-red-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-yellow-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.label}</span>
                        {item.required && (
                          <Badge variant="outline" className="text-xs">
                            Required
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Sign BAA Dialog */}
      <Dialog open={baaDialogOpen} onOpenChange={setBaaDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sign Business Associate Agreement</DialogTitle>
            <DialogDescription>
              Complete this form to sign the BAA and enable HIPAA-compliant PHI
              handling
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="signatory-name">Signatory Name *</Label>
              <Input
                id="signatory-name"
                placeholder="Full legal name"
                value={signatoryName}
                onChange={(e) => setSignatoryName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Person authorized to sign legal agreements for your organization
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="signatory-title">Title *</Label>
              <Input
                id="signatory-title"
                placeholder="e.g., Practice Manager, Owner, CEO"
                value={signatoryTitle}
                onChange={(e) => setSignatoryTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signatory-email">Email *</Label>
              <Input
                id="signatory-email"
                type="email"
                placeholder="email@example.com"
                value={signatoryEmail}
                onChange={(e) => setSignatoryEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                A copy of the signed BAA will be sent to this email
              </p>
            </div>

            <div className="flex items-start space-x-3 p-4 border rounded-lg bg-muted/50">
              <Checkbox
                id="agree-baa"
                checked={agreedToBAA}
                onCheckedChange={(checked) => setAgreedToBAA(checked === true)}
              />
              <div className="space-y-1">
                <label
                  htmlFor="agree-baa"
                  className="text-sm font-medium cursor-pointer"
                >
                  I agree to the Business Associate Agreement
                </label>
                <p className="text-xs text-muted-foreground">
                  By checking this box, I confirm that I am authorized to sign
                  this agreement on behalf of my organization and agree to
                  comply with all HIPAA requirements.
                </p>
              </div>
            </div>

            <Button
              variant="link"
              className="px-0"
              onClick={() => window.open("/legal/baa", "_blank")}
            >
              <Download className="h-4 w-4 mr-2" />
              Download BAA Document (PDF)
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBaaDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSignBAA}
              disabled={
                signingBAA ||
                !agreedToBAA ||
                !signatoryName ||
                !signatoryTitle ||
                !signatoryEmail
              }
            >
              {signingBAA ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Sign BAA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
