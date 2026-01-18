"use client";

/**
 * Step 1: Business Type Selector
 * Spec Reference: Part 5, Lines 216-220
 * - Searchable dropdown with 20+ business types
 * - "Other" option with text field for custom business types
 * - On selection: "Loading Koya's template for [type]..."
 * - Template pre-fills next screens
 */

import { useState, useEffect, useTransition, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ChevronDown, Check, Search, X } from "lucide-react";
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
import type { BusinessTypeOption } from "@/types/onboarding";
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
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sort and filter business types based on search query
  const filteredBusinessTypes = useMemo(() => {
    const sorted = [...businessTypes].sort((a, b) =>
      a.type_name.localeCompare(b.type_name)
    );

    if (!searchQuery.trim()) {
      return sorted;
    }

    const query = searchQuery.toLowerCase();
    return sorted.filter(
      (t) =>
        t.type_name.toLowerCase().includes(query) ||
        t.type_slug.toLowerCase().includes(query)
    );
  }, [businessTypes, searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isDropdownOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isDropdownOpen]);

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
      } catch (_err) {
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
      } catch (_err) {
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

        <div className="relative" ref={dropdownRef}>
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
            <div className="absolute z-50 mt-2 w-full rounded-lg border border-border bg-card shadow-lg">
              {/* Search Input */}
              <div className="p-2 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search business types..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-8 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable Business Types List */}
              <div className="max-h-64 overflow-auto p-2">
                {filteredBusinessTypes.length > 0 ? (
                  <>
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                      {searchQuery
                        ? `${filteredBusinessTypes.length} result${filteredBusinessTypes.length === 1 ? "" : "s"}`
                        : `${businessTypes.length} business types`}
                    </div>
                    {filteredBusinessTypes.map((type) => (
                      <DropdownItem
                        key={type.type_slug}
                        label={type.type_name}
                        selected={selectedType === type.type_slug}
                        onClick={() => {
                          handleTypeSelect(type.type_slug, type.type_name);
                          setSearchQuery("");
                        }}
                      />
                    ))}
                  </>
                ) : (
                  <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                    No matching business types found.
                    <br />
                    <span className="text-primary">
                      Select &quot;Other&quot; below to describe your business.
                    </span>
                  </div>
                )}

                {/* Other option - always visible at the bottom */}
                <div className="border-t border-border mt-2 pt-2">
                  <DropdownItem
                    label="Other - I'll describe my business"
                    selected={selectedType === "other"}
                    onClick={() => {
                      handleTypeSelect("other", "Other");
                      setSearchQuery("");
                    }}
                    highlight
                  />
                </div>
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
  highlight,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
        selected
          ? "bg-primary/10 text-primary"
          : highlight
            ? "text-primary/80 hover:bg-primary/5 hover:text-primary font-medium"
            : "text-foreground hover:bg-muted"
      )}
    >
      {label}
      {selected && <Check className="h-4 w-4" />}
    </button>
  );
}
