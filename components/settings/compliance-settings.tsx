"use client";

/**
 * Compliance Settings Component
 * HIPAA Compliance, BAA Management, and PHI Handling
 * Phase 3: Healthcare Compliance Features
 */

import { useState, useEffect } from "react";
import {
  Shield,
  FileText,
  Loader2,
  Save,
  Check,
  AlertCircle,
  Download,
  Lock,
  Eye,
  Clock,
  CheckCircle,
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
} from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

// ============================================
// Types
// ============================================

interface BAAStatus {
  signed: boolean;
  signed_at: string | null;
  signatory_name: string | null;
  signatory_email: string | null;
  baa_version: string | null;
}

interface PHISettings {
  phi_handling_enabled: boolean;
  phi_in_transcripts: boolean;
  phi_in_recordings: boolean;
  auto_redact_phi: boolean;
  phi_categories: string[];
}

interface RetentionSettings {
  recording_retention_days: number;
  transcript_retention_days: number;
  audit_log_retention_days: number;
}

interface HealthcareTemplate {
  id: string;
  name: string;
  slug: string;
  description: string;
}

interface ComplianceSettings {
  baa: BAAStatus;
  phi: PHISettings;
  retention: RetentionSettings;
  healthcare_template_id: string | null;
}

const DEFAULT_SETTINGS: ComplianceSettings = {
  baa: {
    signed: false,
    signed_at: null,
    signatory_name: null,
    signatory_email: null,
    baa_version: null,
  },
  phi: {
    phi_handling_enabled: false,
    phi_in_transcripts: false,
    phi_in_recordings: false,
    auto_redact_phi: true,
    phi_categories: [],
  },
  retention: {
    recording_retention_days: 2190, // 6 years for HIPAA
    transcript_retention_days: 2190,
    audit_log_retention_days: 2555, // 7 years
  },
  healthcare_template_id: null,
};

const PHI_CATEGORIES = [
  { value: "patient_name", label: "Patient Name" },
  { value: "date_of_birth", label: "Date of Birth" },
  { value: "ssn", label: "Social Security Number" },
  { value: "medical_record", label: "Medical Record Number" },
  { value: "health_plan", label: "Health Plan ID" },
  { value: "account_number", label: "Account Number" },
  { value: "diagnosis", label: "Diagnosis/Conditions" },
  { value: "treatment", label: "Treatment Information" },
  { value: "medications", label: "Medications" },
  { value: "provider_info", label: "Provider Information" },
];

const HEALTHCARE_TEMPLATES: HealthcareTemplate[] = [
  {
    id: "dental",
    name: "Dental Practice",
    slug: "dental",
    description: "Optimized for dental offices with appointment scheduling and treatment discussions",
  },
  {
    id: "medical",
    name: "Medical Practice",
    slug: "medical",
    description: "General medical practice with patient intake and appointment management",
  },
  {
    id: "mental_health",
    name: "Mental Health",
    slug: "mental_health",
    description: "Sensitive handling for therapy practices and counseling centers",
  },
  {
    id: "chiropractic",
    name: "Chiropractic",
    slug: "chiropractic",
    description: "Chiropractic and physical therapy practices",
  },
  {
    id: "optometry",
    name: "Optometry",
    slug: "optometry",
    description: "Eye care and vision services",
  },
  {
    id: "veterinary",
    name: "Veterinary",
    slug: "veterinary",
    description: "Animal healthcare practices (Note: HIPAA does not apply)",
  },
];

// ============================================
// Component
// ============================================

export function ComplianceSettings() {
  const [settings, setSettings] = useState<ComplianceSettings>(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<ComplianceSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // BAA signing dialog
  const [baaDialogOpen, setBaaDialogOpen] = useState(false);
  const [signatoryName, setSignatoryName] = useState("");
  const [signatoryEmail, setSignatoryEmail] = useState("");
  const [agreedToBAA, setAgreedToBAA] = useState(false);
  const [signingBAA, setSigningBAA] = useState(false);

  // Template preview
  const [selectedTemplate, setSelectedTemplate] = useState<HealthcareTemplate | null>(null);
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  // ============================================
  // Data Fetching
  // ============================================

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/dashboard/settings/compliance");
      const data = await response.json();

      if (!response.ok) {
        if (response.status !== 404) {
          throw new Error(data.error || "Failed to fetch compliance settings");
        }
      }

      if (data.data) {
        // Merge with defaults to ensure all properties exist
        const merged: ComplianceSettings = {
          baa: { ...DEFAULT_SETTINGS.baa, ...data.data.baa },
          phi: { ...DEFAULT_SETTINGS.phi, ...data.data.phi },
          retention: { ...DEFAULT_SETTINGS.retention, ...data.data.retention },
          healthcare_template_id: data.data.healthcare_template_id ?? null,
        };
        setSettings(merged);
        setOriginalSettings(merged);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Track changes
  useEffect(() => {
    const changed = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    setHasChanges(changed);
  }, [settings, originalSettings]);

  // ============================================
  // Actions
  // ============================================

  const handleSave = async () => {
    // Validate retention periods
    if (settings.phi.phi_handling_enabled) {
      if (settings.retention.recording_retention_days < 2190) {
        toast({
          title: "Invalid Retention Period",
          description: "HIPAA requires a minimum of 6 years (2190 days) for recording retention",
          variant: "destructive",
        });
        return;
      }
    }

    setSaving(true);
    try {
      const response = await fetch("/api/dashboard/settings/compliance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phi: settings.phi,
          retention: settings.retention,
          healthcare_template_id: settings.healthcare_template_id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save settings");
      }

      setOriginalSettings(settings);
      setHasChanges(false);

      toast({
        title: "Saved",
        description: "Compliance settings updated successfully",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSignBAA = async () => {
    if (!signatoryName || !signatoryEmail) {
      toast({
        title: "Required Fields",
        description: "Please enter signatory name and email",
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
      const response = await fetch("/api/dashboard/settings/compliance/baa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatory_name: signatoryName,
          signatory_email: signatoryEmail,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to sign BAA");
      }

      setSettings((prev) => ({
        ...prev,
        baa: {
          signed: true,
          signed_at: new Date().toISOString(),
          signatory_name: signatoryName,
          signatory_email: signatoryEmail,
          baa_version: data.data?.version || "1.0",
        },
      }));

      setBaaDialogOpen(false);
      setSignatoryName("");
      setSignatoryEmail("");
      setAgreedToBAA(false);

      toast({
        title: "BAA Signed",
        description: "Business Associate Agreement has been signed successfully",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to sign BAA",
        variant: "destructive",
      });
    } finally {
      setSigningBAA(false);
    }
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplate) return;

    setApplyingTemplate(true);
    try {
      const response = await fetch("/api/dashboard/settings/compliance/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: selectedTemplate.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to apply template");
      }

      setSettings((prev) => ({
        ...prev,
        healthcare_template_id: selectedTemplate.id,
      }));

      toast({
        title: "Template Applied",
        description: `${selectedTemplate.name} template has been applied to your settings`,
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to apply template",
        variant: "destructive",
      });
    } finally {
      setApplyingTemplate(false);
    }
  };

  const updatePHISetting = <K extends keyof PHISettings>(
    key: K,
    value: PHISettings[K]
  ) => {
    setSettings((prev) => ({
      ...prev,
      phi: { ...prev.phi, [key]: value },
    }));
  };

  const updateRetentionSetting = <K extends keyof RetentionSettings>(
    key: K,
    value: RetentionSettings[K]
  ) => {
    setSettings((prev) => ({
      ...prev,
      retention: { ...prev.retention, [key]: value },
    }));
  };

  const togglePHICategory = (category: string) => {
    setSettings((prev) => ({
      ...prev,
      phi: {
        ...prev.phi,
        phi_categories: prev.phi.phi_categories.includes(category)
          ? prev.phi.phi_categories.filter((c) => c !== category)
          : [...prev.phi.phi_categories, category],
      },
    }));
  };

  // ============================================
  // Helper Functions
  // ============================================

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // ============================================
  // Render
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* BAA Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Business Associate Agreement (BAA)
              </CardTitle>
              <CardDescription>
                Required for HIPAA compliance when handling Protected Health Information
              </CardDescription>
            </div>
            {settings.baa.signed ? (
              <Badge className="bg-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                Signed
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertCircle className="h-3 w-3 mr-1" />
                Not Signed
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings.baa.signed ? (
            <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-green-800 dark:text-green-200">
                    BAA Signed and Active
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Signed by: {settings.baa.signatory_name} ({settings.baa.signatory_email})
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Date: {settings.baa.signed_at ? formatDate(settings.baa.signed_at) : "Unknown"}
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Version: {settings.baa.baa_version || "1.0"}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => window.open("/api/dashboard/settings/compliance/baa/download", "_blank")}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Signed BAA
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You must sign a Business Associate Agreement before enabling PHI handling.
                  This is required for HIPAA compliance.
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
                  View BAA Document
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* PHI Handling Card - Only show if BAA is signed */}
      {settings.baa.signed && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  PHI Handling
                </CardTitle>
                <CardDescription>
                  Configure how Protected Health Information is handled
                </CardDescription>
              </div>
              <Button onClick={handleSave} disabled={saving || !hasChanges}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Enable PHI Handling */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Lock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <Label className="font-medium">Enable PHI Handling</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow the AI to process and handle Protected Health Information
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.phi.phi_handling_enabled}
                onCheckedChange={(checked) =>
                  updatePHISetting("phi_handling_enabled", checked)
                }
              />
            </div>

            {settings.phi.phi_handling_enabled && (
              <>
                {/* PHI Storage Options */}
                <div className="space-y-4">
                  <Label className="text-base font-medium">PHI Storage Options</Label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <Label>Allow PHI in Transcripts</Label>
                        <p className="text-xs text-muted-foreground">
                          Store PHI within call transcripts
                        </p>
                      </div>
                      <Switch
                        checked={settings.phi.phi_in_transcripts}
                        onCheckedChange={(checked) =>
                          updatePHISetting("phi_in_transcripts", checked)
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <Label>Allow PHI in Recordings</Label>
                        <p className="text-xs text-muted-foreground">
                          Retain PHI in call recordings
                        </p>
                      </div>
                      <Switch
                        checked={settings.phi.phi_in_recordings}
                        onCheckedChange={(checked) =>
                          updatePHISetting("phi_in_recordings", checked)
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <Label>Auto-Redact PHI</Label>
                        <p className="text-xs text-muted-foreground">
                          Automatically redact selected PHI categories
                        </p>
                      </div>
                      <Switch
                        checked={settings.phi.auto_redact_phi}
                        onCheckedChange={(checked) =>
                          updatePHISetting("auto_redact_phi", checked)
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* PHI Categories to Redact */}
                {settings.phi.auto_redact_phi && (
                  <div className="space-y-4">
                    <Label className="text-base font-medium">PHI Categories to Redact</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {PHI_CATEGORIES.map((category) => (
                        <div
                          key={category.value}
                          className="flex items-center space-x-3 p-3 border rounded-lg"
                        >
                          <Checkbox
                            id={`phi-${category.value}`}
                            checked={settings.phi.phi_categories.includes(category.value)}
                            onCheckedChange={() => togglePHICategory(category.value)}
                          />
                          <label
                            htmlFor={`phi-${category.value}`}
                            className="text-sm font-medium cursor-pointer"
                          >
                            {category.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Retention Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Data Retention
          </CardTitle>
          <CardDescription>
            Configure how long data is retained (HIPAA minimum: 6 years)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings.phi.phi_handling_enabled && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                HIPAA requires medical records to be retained for at least 6 years (2190 days).
                Some states require longer retention periods.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="recording-retention">Recording Retention (days)</Label>
              <Input
                id="recording-retention"
                type="number"
                min={settings.phi.phi_handling_enabled ? 2190 : 30}
                value={settings.retention.recording_retention_days}
                onChange={(e) =>
                  updateRetentionSetting(
                    "recording_retention_days",
                    parseInt(e.target.value, 10) || 2190
                  )
                }
              />
              <p className="text-xs text-muted-foreground">
                {settings.phi.phi_handling_enabled ? "Min: 2190 (HIPAA)" : "Min: 30"}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="transcript-retention">Transcript Retention (days)</Label>
              <Input
                id="transcript-retention"
                type="number"
                min={settings.phi.phi_handling_enabled ? 2190 : 30}
                value={settings.retention.transcript_retention_days}
                onChange={(e) =>
                  updateRetentionSetting(
                    "transcript_retention_days",
                    parseInt(e.target.value, 10) || 2190
                  )
                }
              />
              <p className="text-xs text-muted-foreground">
                {settings.phi.phi_handling_enabled ? "Min: 2190 (HIPAA)" : "Min: 30"}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="audit-retention">Audit Log Retention (days)</Label>
              <Input
                id="audit-retention"
                type="number"
                min={settings.phi.phi_handling_enabled ? 2555 : 90}
                value={settings.retention.audit_log_retention_days}
                onChange={(e) =>
                  updateRetentionSetting(
                    "audit_log_retention_days",
                    parseInt(e.target.value, 10) || 2555
                  )
                }
              />
              <p className="text-xs text-muted-foreground">
                {settings.phi.phi_handling_enabled ? "Min: 2555 (7 years)" : "Min: 90"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Healthcare Template Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Healthcare Template
          </CardTitle>
          <CardDescription>
            Apply industry-specific settings and AI prompts for your practice type
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="healthcare-template">Select Template</Label>
            <Select
              value={settings.healthcare_template_id || ""}
              onValueChange={(value) => {
                const template = HEALTHCARE_TEMPLATES.find((t) => t.id === value);
                setSelectedTemplate(template || null);
                setSettings((prev) => ({ ...prev, healthcare_template_id: value || null }));
              }}
            >
              <SelectTrigger id="healthcare-template">
                <SelectValue placeholder="Choose a healthcare template" />
              </SelectTrigger>
              <SelectContent>
                {HEALTHCARE_TEMPLATES.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTemplate && (
            <div className="p-4 border rounded-lg bg-muted/50">
              <h4 className="font-medium">{selectedTemplate.name}</h4>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedTemplate.description}
              </p>
              {selectedTemplate.slug === "veterinary" && (
                <Alert className="mt-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Note: HIPAA regulations do not apply to veterinary practices.
                    PHI handling settings will be disabled for this template.
                  </AlertDescription>
                </Alert>
              )}
              <Button
                className="mt-3"
                onClick={handleApplyTemplate}
                disabled={applyingTemplate}
              >
                {applyingTemplate ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Apply Template
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sign BAA Dialog */}
      <Dialog open={baaDialogOpen} onOpenChange={setBaaDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sign Business Associate Agreement</DialogTitle>
            <DialogDescription>
              Complete this form to sign the BAA and enable HIPAA-compliant PHI handling
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="signatory-name">Signatory Name</Label>
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
              <Label htmlFor="signatory-email">Signatory Email</Label>
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
                  By checking this box, I confirm that I am authorized to sign this agreement
                  on behalf of my organization and agree to the terms of the BAA.
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
              disabled={signingBAA || !agreedToBAA || !signatoryName || !signatoryEmail}
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
