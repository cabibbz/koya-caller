"use client";

/**
 * Koya Caller - Onboarding Step 6: Language Settings
 * Language selection and Spanish configuration
 * Spec Reference: Part 5, Lines 372-420
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Globe, Languages } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { useOnboarding } from "@/lib/onboarding/context";
import { saveStep6Data, loadExistingLanguageSettings } from "@/lib/onboarding/actions";
import { ProgressIndicator } from "./progress-indicator";
import { OnboardingNavigation, StepHeader } from "./navigation";
import {
  type Step6FormData,
  type LanguageMode,
  LANGUAGE_MODE_OPTIONS,
  DEFAULT_STEP6_DATA,
} from "@/types/onboarding";

export function Step6Language() {
  const router = useRouter();
  const {
    state,
    setStep6Data,
    setSaving,
    setError,
    completeStep,
  } = useOnboarding();

  const [formData, setFormData] = useState<Step6FormData>(
    state.step6Data || DEFAULT_STEP6_DATA
  );
  const [isLoading, setIsLoading] = useState(true);

  // Load existing data on mount
  useEffect(() => {
    async function loadData() {
      try {
        const existing = await loadExistingLanguageSettings();
        if (existing) {
          setFormData(existing);
          setStep6Data(existing);
        }
      } catch (_error) {
        // Error handled silently
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [setStep6Data]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      
      await saveStep6Data(formData);
      setStep6Data(formData);
      completeStep(6);
      
      router.push("/onboarding/voice");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to save language settings"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndExit = async () => {
    try {
      setSaving(true);
      setError(null);
      await saveStep6Data(formData);
      setStep6Data(formData);
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
        title="Language Settings"
        description="Choose which languages Koya should support"
      />

      {/* Error Display */}
      {state.error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-red-400">
          {state.error}
        </div>
      )}

      {/* Language Selection */}
      <div className="space-y-6 rounded-lg border border-muted bg-card p-6">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-medium">What languages do your customers speak?</h3>
        </div>

        <div className="space-y-4">
          {/* English - Always Enabled */}
          <div className="flex items-center justify-between rounded-lg border border-muted bg-muted/30 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <span className="text-lg">🇺🇸</span>
              </div>
              <div>
                <p className="font-medium">English</p>
                <p className="text-sm text-muted-foreground">Always enabled</p>
              </div>
            </div>
            <Switch checked={true} disabled />
          </div>

          {/* Spanish Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-muted p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <span className="text-lg">🇪🇸</span>
              </div>
              <div>
                <p className="font-medium">Spanish / Español</p>
                <p className="text-sm text-muted-foreground">
                  Enable bilingual support for Spanish-speaking callers
                </p>
              </div>
            </div>
            <Switch
              checked={formData.spanishEnabled}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  spanishEnabled: checked,
                }))
              }
            />
          </div>
        </div>
      </div>

      {/* Spanish Settings (shown when enabled) */}
      {formData.spanishEnabled && (
        <>
          {/* Language Mode */}
          <div className="space-y-6 rounded-lg border border-muted bg-card p-6">
            <div className="flex items-center gap-2">
              <Languages className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-medium">How should Koya handle language?</h3>
            </div>

            <div className="space-y-3">
              {LANGUAGE_MODE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-4 transition-all ${
                    formData.languageMode === option.value
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="languageMode"
                      value={option.value}
                      checked={formData.languageMode === option.value}
                      onChange={() =>
                        setFormData((prev) => ({
                          ...prev,
                          languageMode: option.value as LanguageMode,
                        }))
                      }
                      className="h-4 w-4 text-primary"
                    />
                    <span className="font-medium">{option.label}</span>
                  </div>
                  <p className="ml-7 text-sm text-muted-foreground">
                    {option.description}
                  </p>
                </label>
              ))}
            </div>

            {/* Additional context based on mode */}
            {formData.languageMode === "auto" && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
                <p className="font-medium text-primary">Auto-detect mode</p>
                <p className="mt-1 text-muted-foreground">
                  Koya will listen to the first few words from the caller and respond in 
                  their language. This works best when you have a mixed customer base.
                </p>
              </div>
            )}

            {formData.languageMode === "ask" && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
                <p className="font-medium text-primary">Interactive menu</p>
                <p className="mt-1 text-muted-foreground">
                  Koya will greet callers with: &quot;For English, press 1. Para español, 
                  oprima 2.&quot; This gives callers clear control over their language preference.
                </p>
              </div>
            )}

            {formData.languageMode === "spanish_default" && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
                <p className="font-medium text-primary">Spanish-first mode</p>
                <p className="mt-1 text-muted-foreground">
                  Koya will greet callers in Spanish by default, but will automatically 
                  switch to English if the caller responds in English.
                </p>
              </div>
            )}
          </div>

          {/* Spanish Greetings */}
          <div className="space-y-6 rounded-lg border border-muted bg-card p-6">
            <h3 className="text-lg font-medium">Spanish Greetings (Optional)</h3>
            <p className="text-sm text-muted-foreground">
              Customize what Koya says in Spanish. Leave blank to use automatically 
              generated greetings based on your business information.
            </p>

            {/* Spanish Greeting */}
            <div className="space-y-2">
              <Label htmlFor="greetingSpanish">Spanish greeting</Label>
              <Textarea
                id="greetingSpanish"
                placeholder="¡Hola! Gracias por llamar a [Nombre del Negocio]. Soy Koya, su asistente virtual. ¿En qué puedo ayudarle hoy?"
                value={formData.greetingSpanish}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    greetingSpanish: e.target.value,
                  }))
                }
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                The greeting Koya uses when speaking Spanish
              </p>
            </div>

            {/* Spanish After-Hours Greeting */}
            <div className="space-y-2">
              <Label htmlFor="afterHoursGreetingSpanish">Spanish after-hours greeting</Label>
              <Textarea
                id="afterHoursGreetingSpanish"
                placeholder="¡Hola! Gracias por llamar a [Nombre del Negocio]. Actualmente estamos cerrados, pero con gusto puedo ayudarle a programar una cita o tomar un mensaje..."
                value={formData.afterHoursGreetingSpanish}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    afterHoursGreetingSpanish: e.target.value,
                  }))
                }
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Used when calls come in outside of business hours
              </p>
            </div>
          </div>
        </>
      )}

      {/* Info when Spanish is disabled */}
      {!formData.spanishEnabled && (
        <div className="rounded-lg border border-muted bg-muted/30 p-6 text-center">
          <Globe className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">
            Enable Spanish support above to configure bilingual settings.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            You can always enable this later from your dashboard.
          </p>
        </div>
      )}

      {/* Navigation */}
      <OnboardingNavigation
        onBack={() => router.push("/onboarding/calls")}
        onNext={handleSave}
        onSaveAndExit={handleSaveAndExit}
        isSubmitting={state.isSaving}
      />
    </div>
  );
}
