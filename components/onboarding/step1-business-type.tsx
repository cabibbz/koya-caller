"use client";

/**
 * Step 1: Business Type Selector
 * Spec Reference: Part 5, Lines 216-220
 * - Dropdown with 20+ business types
 * - "Other" option with text field
 * - On selection: "Loading Koya's template for [type]..."
 * - Template pre-fills next screens
 */

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useOnboarding } from "@/lib/onboarding/context";
import {
  getBusinessTemplates,
  getBusinessTemplate,
  saveBusinessType,
} from "@/lib/onboarding/actions";
import { StepHeader, OnboardingNavigation } from "./navigation";
import type { BusinessTypeOption, BusinessTemplate } from "@/types/onboarding";
import {
  templateServiceToFormData,
  templateFAQToFormData,
  DEFAULT_BUSINESS_HOURS,
} from "@/types/onboarding";

interface Step1BusinessTypeProps {
  initialBusinessTypes?: BusinessTypeOption[];
  initialSelectedType?: string;
}

export function Step1BusinessType({
  initialBusinessTypes = [],
  initialSelectedType,
}: Step1BusinessTypeProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const {
    state,
    setBusinessType,
    setTemplateLoaded,
    setStep2Data,
    setStep3Data,
    goNext,
    setError,
  } = useOnboarding();

  const [businessTypes, setBusinessTypes] =
    useState<BusinessTypeOption[]>(initialBusinessTypes);
  const [selectedType, setSelectedType] = useState<string | null>(
    initialSelectedType || state.businessType
  );
  const [otherText, setOtherText] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");

  // Load business types on mount if not provided
  useEffect(() => {
    if (businessTypes.length === 0) {
      getBusinessTemplates()
        .then(setBusinessTypes)
        .catch((err) => setError(err.message));
    }
  }, [businessTypes.length, setError]);

  const selectedTypeName =
    businessTypes.find((t) => t.type_slug === selectedType)?.type_name ||
    (selectedType === "other" ? "Other" : "");

  const handleTypeSelect = async (typeSlug: string, typeName: string) => {
    setSelectedType(typeSlug);
    setIsDropdownOpen(false);

    if (typeSlug !== "other") {
      // Load template for selected type
      setIsLoadingTemplate(true);
      setLoadingMessage(`Loading Koya's template for ${typeName}...`);

      try {
        const template = await getBusinessTemplate(typeSlug);

        if (template) {
          // Pre-fill Step 2 data
          const services = template.default_services.map((s, i) =>
            templateServiceToFormData(s, i)
          );
          setStep2Data({
            services,
            pricingApproach: "quote",
            serviceArea: "",
            differentiator: "",
            businessHours: DEFAULT_BUSINESS_HOURS,
          });

          // Pre-fill Step 3 data
          const faqs = template.default_faqs.map((f, i) =>
            templateFAQToFormData(f, i)
          );
          setStep3Data({
            faqs,
            additionalKnowledge: "",
            neverSay: "",
          });

          setBusinessType(typeSlug, typeName);
          setTemplateLoaded(true);
        }
      } catch (err) {
        console.error("Failed to load template:", err);
        setError("Failed to load business template. Please try again.");
      } finally {
        setIsLoadingTemplate(false);
        setLoadingMessage("");
      }
    } else {
      // "Other" selected - set up empty template
      setBusinessType("other", otherText || "Other Business");
      setStep2Data({
        services: [],
        pricingApproach: "quote",
        serviceArea: "",
        differentiator: "",
        businessHours: DEFAULT_BUSINESS_HOURS,
      });
      setStep3Data({
        faqs: [],
        additionalKnowledge: "",
        neverSay: "",
      });
      setTemplateLoaded(true);
    }
  };

  const handleNext = async () => {
    if (!selectedType) {
      setError("Please select a business type");
      return;
    }

    if (selectedType === "other" && !otherText.trim()) {
      setError("Please describe your business type");
      return;
    }

    startTransition(async () => {
      try {
        const typeName =
          selectedType === "other"
            ? otherText.trim()
            : businessTypes.find((t) => t.type_slug === selectedType)
                ?.type_name || selectedType;

        await saveBusinessType(selectedType, typeName);

        if (selectedType === "other") {
          setBusinessType("other", typeName);
        }

        goNext();
        router.push("/onboarding/services");
      } catch (err) {
        console.error("Failed to save business type:", err);
        setError("Failed to save. Please try again.");
      }
    });
  };

  const isValid =
    selectedType && (selectedType !== "other" || otherText.trim().length > 0);

  return (
    <div className="mx-auto max-w-2xl">
      <StepHeader
        title="What type of business do you have?"
        description="We'll customize Koya with knowledge specific to your industry."
        badge="Step 1 of 8"
      />

      {/* Business Type Dropdown */}
      <div className="space-y-4">
        <Label htmlFor="business-type">Business Type</Label>

        <div className="relative">
          <button
            type="button"
            id="business-type"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            disabled={isLoadingTemplate}
            className={cn(
              "flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors",
              "hover:border-primary/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
              isLoadingTemplate && "cursor-wait opacity-70"
            )}
          >
            <span
              className={cn(
                selectedType ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {isLoadingTemplate
                ? loadingMessage
                : selectedTypeName || "Select your business type"}
            </span>
            {isLoadingTemplate ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <ChevronDown
                className={cn(
                  "h-5 w-5 text-muted-foreground transition-transform",
                  isDropdownOpen && "rotate-180"
                )}
              />
            )}
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute z-50 mt-2 max-h-80 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
              {/* Grouped by category */}
              <div className="p-2">
                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Home Services
                </div>
                {businessTypes
                  .filter((t) =>
                    [
                      "hvac",
                      "plumbing",
                      "electrical",
                      "roofing",
                      "landscaping",
                      "cleaning",
                      "pest_control",
                    ].includes(t.type_slug)
                  )
                  .map((type) => (
                    <DropdownItem
                      key={type.type_slug}
                      label={type.type_name}
                      selected={selectedType === type.type_slug}
                      onClick={() =>
                        handleTypeSelect(type.type_slug, type.type_name)
                      }
                    />
                  ))}

                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Automotive
                </div>
                {businessTypes
                  .filter((t) =>
                    ["auto_repair", "auto_detailing"].includes(t.type_slug)
                  )
                  .map((type) => (
                    <DropdownItem
                      key={type.type_slug}
                      label={type.type_name}
                      selected={selectedType === type.type_slug}
                      onClick={() =>
                        handleTypeSelect(type.type_slug, type.type_name)
                      }
                    />
                  ))}

                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Medical & Wellness
                </div>
                {businessTypes
                  .filter((t) =>
                    [
                      "dental",
                      "chiropractic",
                      "med_spa",
                      "massage",
                      "salon",
                    ].includes(t.type_slug)
                  )
                  .map((type) => (
                    <DropdownItem
                      key={type.type_slug}
                      label={type.type_name}
                      selected={selectedType === type.type_slug}
                      onClick={() =>
                        handleTypeSelect(type.type_slug, type.type_name)
                      }
                    />
                  ))}

                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Professional Services
                </div>
                {businessTypes
                  .filter((t) =>
                    ["legal", "accounting", "real_estate", "insurance"].includes(
                      t.type_slug
                    )
                  )
                  .map((type) => (
                    <DropdownItem
                      key={type.type_slug}
                      label={type.type_name}
                      selected={selectedType === type.type_slug}
                      onClick={() =>
                        handleTypeSelect(type.type_slug, type.type_name)
                      }
                    />
                  ))}

                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Food & Hospitality
                </div>
                {businessTypes
                  .filter((t) => ["restaurant"].includes(t.type_slug))
                  .map((type) => (
                    <DropdownItem
                      key={type.type_slug}
                      label={type.type_name}
                      selected={selectedType === type.type_slug}
                      onClick={() =>
                        handleTypeSelect(type.type_slug, type.type_name)
                      }
                    />
                  ))}

                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Creative & Pet Services
                </div>
                {businessTypes
                  .filter((t) =>
                    ["photography", "pet_care"].includes(t.type_slug)
                  )
                  .map((type) => (
                    <DropdownItem
                      key={type.type_slug}
                      label={type.type_name}
                      selected={selectedType === type.type_slug}
                      onClick={() =>
                        handleTypeSelect(type.type_slug, type.type_name)
                      }
                    />
                  ))}

                <div className="border-t border-border my-2" />
                <DropdownItem
                  label="Other (I'll describe it)"
                  selected={selectedType === "other"}
                  onClick={() => handleTypeSelect("other", "Other")}
                />
              </div>
            </div>
          )}
        </div>

        {/* "Other" text field */}
        {selectedType === "other" && (
          <div className="mt-4 space-y-2">
            <Label htmlFor="other-type">Describe your business</Label>
            <Input
              id="other-type"
              placeholder="e.g., Pet grooming, Photography studio..."
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              className="bg-card"
            />
          </div>
        )}
      </div>

      {/* Template Preview */}
      {state.templateLoaded && selectedType !== "other" && (
        <div className="mt-8 rounded-lg border border-success/30 bg-success/5 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-success/20 p-2">
              <Check className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="font-medium text-foreground">Template loaded!</p>
              <p className="text-sm text-muted-foreground">
                We&apos;ve pre-filled your services and FAQs based on{" "}
                {selectedTypeName} businesses. You can customize everything in
                the next steps.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {state.error && (
        <div className="mt-4 rounded-lg border border-error/30 bg-error/5 p-4 text-sm text-error">
          {state.error}
        </div>
      )}

      {/* Navigation */}
      <div className="mt-8">
        <OnboardingNavigation
          onNext={handleNext}
          nextDisabled={!isValid || isLoadingTemplate}
          showBack={false}
          isSubmitting={isPending}
        />
      </div>
    </div>
  );
}

// Helper component for dropdown items
function DropdownItem({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
        selected
          ? "bg-primary/10 text-primary"
          : "text-foreground hover:bg-muted"
      )}
    >
      {label}
      {selected && <Check className="h-4 w-4" />}
    </button>
  );
}
