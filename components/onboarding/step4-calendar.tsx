"use client";

/**
 * Koya Caller - Onboarding Step 4: Calendar
 * Calendar provider selection and booking settings
 * Spec Reference: Part 5, Lines 283-320
 */

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Calendar, ExternalLink, CheckCircle, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useOnboarding } from "@/lib/onboarding/context";
import { saveStep4Data, loadExistingCalendarSettings } from "@/lib/onboarding/actions";
import { ProgressIndicator } from "./progress-indicator";
import { OnboardingNavigation, StepHeader } from "./navigation";
import {
  type Step4FormData,
  type CalendarProvider,
  CALENDAR_PROVIDER_OPTIONS,
  DURATION_OPTIONS,
  BUFFER_OPTIONS,
  ADVANCE_BOOKING_OPTIONS,
  DEFAULT_STEP4_DATA,
} from "@/types/onboarding";

// Google icon SVG
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

// Microsoft icon SVG
function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.4 24H0V12.6h11.4V24z" fill="#00A4EF"/>
      <path d="M24 24H12.6V12.6H24V24z" fill="#FFB900"/>
      <path d="M11.4 11.4H0V0h11.4v11.4z" fill="#F25022"/>
      <path d="M24 11.4H12.6V0H24v11.4z" fill="#7FBA00"/>
    </svg>
  );
}

export function Step4Calendar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    state,
    setStep4Data,
    setSaving,
    setError,
    completeStep,
  } = useOnboarding();

  const [formData, setFormData] = useState<Step4FormData>(
    state.step4Data || DEFAULT_STEP4_DATA
  );
  const [isLoading, setIsLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Check for OAuth callback params
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success) {
      setSuccessMessage(success);
      // Reload settings to get updated connection status
      loadExistingCalendarSettings().then((existing) => {
        if (existing) {
          setFormData(existing);
          setStep4Data(existing);
        }
      });
      // Clear URL params
      router.replace("/onboarding/calendar", { scroll: false });
    }

    if (error) {
      setError(error);
      router.replace("/onboarding/calendar", { scroll: false });
    }
  }, [searchParams, router, setError, setStep4Data]);

  // Load existing data on mount
  useEffect(() => {
    async function loadData() {
      try {
        const existing = await loadExistingCalendarSettings();
        if (existing) {
          setFormData(existing);
          setStep4Data(existing);
        }
      } catch (_error) {
        // Error handled silently
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [setStep4Data]);

  const handleProviderSelect = (provider: CalendarProvider) => {
    setFormData((prev) => ({
      ...prev,
      provider,
      isConnected: false,
      calendarId: null,
    }));
  };

  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnectCalendar = async () => {
    if (formData.provider === "built_in") {
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // First, check if OAuth is available for this provider
      const response = await fetch("/api/dashboard/settings/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: formData.provider,
          returnUrl: "/onboarding/calendar",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to initiate connection");
      }

      if (!data.success && data.message) {
        // Provider not configured
        throw new Error(data.message);
      }

      if (data.initiateUrl) {
        // Call the OAuth initiation endpoint
        const authResponse = await fetch(data.initiateUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ returnUrl: data.returnUrl }),
        });

        const authData = await authResponse.json();

        if (!authResponse.ok) {
          throw new Error(authData.error || "Failed to start OAuth");
        }

        if (authData.authUrl) {
          // Redirect to OAuth provider
          window.location.href = authData.authUrl;
        }
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to connect calendar"
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      
      await saveStep4Data(formData);
      setStep4Data(formData);
      completeStep(4);
      
      router.push("/onboarding/calls");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to save calendar settings"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndExit = async () => {
    try {
      setSaving(true);
      setError(null);
      await saveStep4Data(formData);
      setStep4Data(formData);
      router.push("/dashboard");
    } catch (error) {
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
        title="Calendar Integration"
        description="Choose how you want to manage appointments"
      />

      {/* Success Display */}
      {successMessage && (
        <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4 text-green-400 flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          {successMessage}
        </div>
      )}

      {/* Error Display */}
      {state.error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-red-400 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          {state.error}
        </div>
      )}

      {/* Calendar Provider Selection */}
      <div className="space-y-4">
        <Label className="text-base font-medium">
          How do you want to manage appointments?
        </Label>
        
        <div className="grid gap-4 md:grid-cols-3">
          {CALENDAR_PROVIDER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleProviderSelect(option.value)}
              className={`relative flex flex-col items-center gap-3 rounded-lg border-2 p-6 text-center transition-all ${
                formData.provider === option.value
                  ? "border-primary bg-primary/5"
                  : "border-muted hover:border-muted-foreground/50"
              }`}
            >
              {/* Icon */}
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                {option.icon === "google" && <GoogleIcon className="h-6 w-6" />}
                {option.icon === "microsoft" && <MicrosoftIcon className="h-6 w-6" />}
                {option.icon === "calendar" && <Calendar className="h-6 w-6 text-primary" />}
              </div>
              
              {/* Label */}
              <div className="font-medium">{option.label}</div>
              
              {/* Description */}
              <div className="text-sm text-muted-foreground">
                {option.description}
              </div>
              
              {/* Selected indicator */}
              {formData.provider === option.value && (
                <div className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Connect Button for Google/Outlook */}
      {(formData.provider === "google" || formData.provider === "outlook") && (
        <div className="rounded-lg border border-muted bg-muted/30 p-6">
          {formData.isConnected ? (
            <div className="flex items-center gap-3 text-green-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>
                Connected to {formData.provider === "google" ? "Google Calendar" : "Microsoft Outlook"}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-muted-foreground">
                Connect your {formData.provider === "google" ? "Google" : "Microsoft"} account to sync appointments automatically.
              </p>
              <Button onClick={handleConnectCalendar} className="gap-2" disabled={isConnecting}>
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                {isConnecting ? "Connecting..." : `Connect ${formData.provider === "google" ? "Google Calendar" : "Microsoft Outlook"}`}
              </Button>
              <p className="text-xs text-muted-foreground">
                You can skip this step and connect later from your dashboard.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Built-in Scheduler Info */}
      {formData.provider === "built_in" && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-6">
          <div className="flex items-start gap-3">
            <Calendar className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-primary">Built-in Scheduler Selected</p>
              <p className="mt-1 text-sm text-muted-foreground">
                We&apos;ll manage your availability based on your business hours. Koya will handle 
                booking appointments directly without needing an external calendar account.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Booking Settings */}
      <div className="space-y-6 rounded-lg border border-muted bg-card p-6">
        <h3 className="text-lg font-medium">Booking Settings</h3>
        
        {/* Default Duration */}
        <div className="space-y-2">
          <Label htmlFor="duration">Default appointment duration</Label>
          <div className="flex gap-4">
            <Select
              value={formData.defaultDurationMinutes.toString()}
              onValueChange={(value) => {
                const minutes = parseInt(value);
                setFormData((prev) => ({
                  ...prev,
                  defaultDurationMinutes: minutes,
                  customDurationMinutes: minutes === 0 ? 45 : null,
                }));
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {formData.defaultDurationMinutes === 0 && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={15}
                  max={240}
                  value={formData.customDurationMinutes || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      customDurationMinutes: parseInt(e.target.value) || null,
                    }))
                  }
                  className="w-24"
                  placeholder="45"
                />
                <span className="text-sm text-muted-foreground">minutes</span>
              </div>
            )}
          </div>
        </div>

        {/* Buffer Time */}
        <div className="space-y-2">
          <Label htmlFor="buffer">Buffer between appointments</Label>
          <Select
            value={formData.bufferMinutes.toString()}
            onValueChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                bufferMinutes: parseInt(value),
              }))
            }
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUFFER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value.toString()}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Advance Booking */}
        <div className="space-y-2">
          <Label htmlFor="advance">How far out can customers book?</Label>
          <Select
            value={formData.advanceBookingDays.toString()}
            onValueChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                advanceBookingDays: parseInt(value),
              }))
            }
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ADVANCE_BOOKING_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value.toString()}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Require Email */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="requireEmail">Require customer email</Label>
            <p className="text-sm text-muted-foreground">
              Ask callers for their email when booking
            </p>
          </div>
          <Switch
            id="requireEmail"
            checked={formData.requireEmail}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({
                ...prev,
                requireEmail: checked,
              }))
            }
          />
        </div>
      </div>

      {/* Navigation */}
      <OnboardingNavigation
        onBack={() => router.push("/onboarding/faqs")}
        onNext={handleSave}
        onSaveAndExit={handleSaveAndExit}
        isSubmitting={state.isSaving}
      />
    </div>
  );
}
