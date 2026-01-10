"use client";

/**
 * Koya Caller - Onboarding Step 5: Call Handling
 * Transfer settings and after-hours behavior
 * Spec Reference: Part 5, Lines 322-370
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Phone, Clock, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

import { useOnboarding } from "@/lib/onboarding/context";
import {
  saveStep5Data,
  loadExistingCallSettings,
  getCurrentBusiness,
} from "@/lib/onboarding/actions";
import { ProgressIndicator } from "./progress-indicator";
import { OnboardingNavigation, StepHeader } from "./navigation";
import {
  type Step5FormData,
  type TransferHoursType,
  TRANSFER_HOURS_OPTIONS,
  DEFAULT_STEP5_DATA,
} from "@/types/onboarding";

export function Step5CallHandling() {
  const router = useRouter();
  const {
    state,
    setStep5Data,
    setSaving,
    setError,
    completeStep,
  } = useOnboarding();

  const [formData, setFormData] = useState<Step5FormData>(
    state.step5Data || DEFAULT_STEP5_DATA
  );
  const [isLoading, setIsLoading] = useState(true);
  const [showAfterHoursGreeting, setShowAfterHoursGreeting] = useState(false);

  // Load existing data on mount
  useEffect(() => {
    async function loadData() {
      try {
        // Try to get business phone from signup
        const business = await getCurrentBusiness();
        
        // Load existing settings
        const existing = await loadExistingCallSettings();
        if (existing) {
          setFormData(existing);
          setStep5Data(existing);
          setShowAfterHoursGreeting(!!existing.afterHoursGreeting);
        } else if (business?.user_id) {
          // Pre-fill transfer number from user's phone if available
          // This would come from signup data
        }
      } catch (error) {
        console.error("Error loading call settings:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [setStep5Data]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      
      await saveStep5Data(formData);
      setStep5Data(formData);
      completeStep(5);
      
      router.push("/onboarding/language");
    } catch (error) {
      console.error("Error saving call settings:", error);
      setError(
        error instanceof Error ? error.message : "Failed to save call settings"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndExit = async () => {
    try {
      setSaving(true);
      setError(null);
      await saveStep5Data(formData);
      setStep5Data(formData);
      router.push("/dashboard");
    } catch (error) {
      console.error("Error saving:", error);
      setError(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ProgressIndicator />
      
      <StepHeader
        title="Call Handling"
        description="Configure how Koya handles transfers and after-hours calls"
      />

      {/* Error Display */}
      {state.error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-red-400">
          {state.error}
        </div>
      )}

      {/* Transfer Settings */}
      <div className="space-y-6 rounded-lg border border-muted bg-card p-6">
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-medium">Transfer Settings</h3>
        </div>
        
        {/* Transfer Numbers */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="transferNumber">Primary transfer number</Label>
            <Input
              id="transferNumber"
              type="tel"
              placeholder="(555) 123-4567"
              value={formData.transferNumber}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  transferNumber: e.target.value,
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              The number Koya will transfer calls to when needed
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="backupNumber">Backup transfer number (optional)</Label>
            <Input
              id="backupNumber"
              type="tel"
              placeholder="(555) 987-6543"
              value={formData.backupTransferNumber}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  backupTransferNumber: e.target.value,
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Used if primary number doesn&apos;t answer
            </p>
          </div>
        </div>

        {/* Transfer Triggers */}
        <div className="space-y-3">
          <Label className="text-base">When should Koya transfer?</Label>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Checkbox
                id="transferOnRequest"
                checked={formData.transferOnRequest}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    transferOnRequest: checked === true,
                  }))
                }
              />
              <label htmlFor="transferOnRequest" className="text-sm leading-tight cursor-pointer">
                <span className="font-medium">When caller asks for a human</span>
                <p className="text-muted-foreground">
                  &quot;Can I speak to someone?&quot;, &quot;Transfer me please&quot;, etc.
                </p>
              </label>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="transferOnEmergency"
                checked={formData.transferOnEmergency}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    transferOnEmergency: checked === true,
                  }))
                }
              />
              <label htmlFor="transferOnEmergency" className="text-sm leading-tight cursor-pointer">
                <span className="font-medium">For emergencies</span>
                <p className="text-muted-foreground">
                  When caller mentions urgent issues or emergencies
                </p>
              </label>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="transferOnUpset"
                checked={formData.transferOnUpset}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    transferOnUpset: checked === true,
                  }))
                }
              />
              <label htmlFor="transferOnUpset" className="text-sm leading-tight cursor-pointer">
                <span className="font-medium">When caller seems upset</span>
                <p className="text-muted-foreground">
                  Koya detects frustration or anger in the caller&apos;s tone
                </p>
              </label>
            </div>
          </div>

          {/* Custom Keywords */}
          <div className="mt-4 space-y-2">
            <Label htmlFor="keywords">Custom transfer keywords (optional)</Label>
            <Input
              id="keywords"
              placeholder="manager, supervisor, complaint"
              value={formData.transferKeywords}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  transferKeywords: e.target.value,
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated words that will trigger a transfer
            </p>
          </div>
        </div>

        {/* Transfer Hours */}
        <div className="space-y-3">
          <Label className="text-base">Transfer availability</Label>
          
          <div className="space-y-2">
            {TRANSFER_HOURS_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${
                  formData.transferHoursType === option.value
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/50"
                }`}
              >
                <input
                  type="radio"
                  name="transferHours"
                  value={option.value}
                  checked={formData.transferHoursType === option.value}
                  onChange={() =>
                    setFormData((prev) => ({
                      ...prev,
                      transferHoursType: option.value as TransferHoursType,
                    }))
                  }
                  className="h-4 w-4 text-primary"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* No Answer Behavior Info */}
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-amber-500" />
            <div className="text-sm">
              <p className="font-medium text-amber-500">If transfer isn&apos;t answered (within 30 seconds)</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>• Koya returns to the call</li>
                <li>• Takes a detailed message from the caller</li>
                <li>• Immediately sends you an SMS with caller name, phone, reason, and urgency</li>
                <li>• Includes a &quot;Tap to call back&quot; link</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* After Hours Behavior */}
      <div className="space-y-6 rounded-lg border border-muted bg-card p-6">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-medium">After Hours Behavior</h3>
        </div>

        <div className="space-y-4">
          {/* After Hours Enabled */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="afterHoursEnabled">Koya answers after hours</Label>
              <p className="text-sm text-muted-foreground">
                Koya will still pick up calls outside business hours
              </p>
            </div>
            <Switch
              id="afterHoursEnabled"
              checked={formData.afterHoursEnabled}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  afterHoursEnabled: checked,
                }))
              }
            />
          </div>

          {formData.afterHoursEnabled && (
            <>
              {/* Can Book After Hours */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="canBook">Can book appointments after hours</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow callers to schedule appointments outside business hours
                  </p>
                </div>
                <Switch
                  id="canBook"
                  checked={formData.afterHoursCanBook}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      afterHoursCanBook: checked,
                    }))
                  }
                />
              </div>

              {/* Message Only Mode */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="messageOnly">Take message only mode</Label>
                  <p className="text-sm text-muted-foreground">
                    After hours, only take messages without providing other services
                  </p>
                </div>
                <Switch
                  id="messageOnly"
                  checked={formData.afterHoursMessageOnly}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      afterHoursMessageOnly: checked,
                    }))
                  }
                />
              </div>

              {/* Custom After Hours Greeting */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="afterHoursGreeting">Different after-hours greeting</Label>
                  <Switch
                    id="showGreeting"
                    checked={showAfterHoursGreeting}
                    onCheckedChange={setShowAfterHoursGreeting}
                  />
                </div>
                
                {showAfterHoursGreeting && (
                  <Textarea
                    id="afterHoursGreeting"
                    placeholder="Hi, thanks for calling [Business Name]. We're currently closed, but I'd be happy to help you schedule an appointment or take a message..."
                    value={formData.afterHoursGreeting}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        afterHoursGreeting: e.target.value,
                      }))
                    }
                    rows={3}
                    className="mt-2"
                  />
                )}
              </div>
            </>
          )}

          {!formData.afterHoursEnabled && (
            <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
              <p>
                When disabled, calls after hours will go to voicemail or ring through 
                to your transfer number (if available during those hours).
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <OnboardingNavigation
        onBack={() => router.push("/onboarding/calendar")}
        onNext={handleSave}
        onSaveAndExit={handleSaveAndExit}
        isSubmitting={state.isSaving}
      />
    </div>
  );
}
