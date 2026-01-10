"use client";

/**
 * Step 2: Make It Yours - Services Customization
 * Spec Reference: Part 5, Lines 222-260
 * - Header: "This is a starting point. Make it accurate for YOUR business."
 * - Services with "Accept All Defaults" button
 * - Each service editable: Name, Description, Duration, Price, Bookable
 * - Add custom services, Bulk actions
 * - Pricing approach, Service area, Differentiator, Business hours
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Clock,
  DollarSign,
  Calendar,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useOnboarding } from "@/lib/onboarding/context";
import { saveStep2Data } from "@/lib/onboarding/actions";
import { StepHeader, OnboardingNavigation } from "./navigation";
import {
  type ServiceFormData,
  type PricingApproach,
  type BusinessHoursFormData,
  PRICING_APPROACH_OPTIONS,
  DEFAULT_BUSINESS_HOURS,
  DAY_NAMES,
  createEmptyService,
  formatPrice,
  parsePriceInput,
} from "@/types/onboarding";

export function Step2Services() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { state, setStep2Data, goNext, goBack, setError } = useOnboarding();

  // Initialize form data from state or defaults
  const [services, setServices] = useState<ServiceFormData[]>(
    state.step2Data?.services || []
  );
  const [pricingApproach, setPricingApproach] = useState<PricingApproach>(
    state.step2Data?.pricingApproach || "quote"
  );
  const [serviceArea, setServiceArea] = useState(
    state.step2Data?.serviceArea || ""
  );
  const [differentiator, setDifferentiator] = useState(
    state.step2Data?.differentiator || ""
  );
  const [businessHours, setBusinessHours] = useState<BusinessHoursFormData[]>(
    state.step2Data?.businessHours || DEFAULT_BUSINESS_HOURS
  );

  // UI State
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [showHours, setShowHours] = useState(false);

  // Handlers
  const handleAcceptAllDefaults = () => {
    setServices((prev) => prev.map((s) => ({ ...s, isSelected: true })));
  };

  const handleSelectAll = () => {
    setServices((prev) => prev.map((s) => ({ ...s, isSelected: true })));
  };

  const handleDeselectAll = () => {
    setServices((prev) => prev.map((s) => ({ ...s, isSelected: false })));
  };

  const handleDeleteSelected = () => {
    setServices((prev) => prev.filter((s) => !s.isSelected));
  };

  const handleToggleService = (index: number) => {
    setServices((prev) =>
      prev.map((s, i) =>
        i === index ? { ...s, isSelected: !s.isSelected } : s
      )
    );
  };

  const handleAddService = () => {
    const newService = createEmptyService(services.length);
    setServices((prev) => [...prev, newService]);
    setEditingServiceId(`new-${services.length}`);
  };

  const handleUpdateService = (index: number, updates: Partial<ServiceFormData>) => {
    setServices((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...updates } : s))
    );
  };

  const handleDeleteService = (index: number) => {
    setServices((prev) => prev.filter((_, i) => i !== index));
  };

  const handleHoursChange = (
    dayIndex: number,
    field: keyof BusinessHoursFormData,
    value: string | boolean
  ) => {
    setBusinessHours((prev) =>
      prev.map((h, i) => (i === dayIndex ? { ...h, [field]: value } : h))
    );
  };

  const handleNext = async () => {
    // Validation
    const selectedServices = services.filter((s) => s.isSelected);

    if (selectedServices.length === 0) {
      setError("Please select at least one service");
      return;
    }

    if (!serviceArea.trim()) {
      setError("Please enter your service area");
      return;
    }

    // Check for empty service names
    const invalidService = selectedServices.find((s) => !s.name.trim());
    if (invalidService) {
      setError("All services must have a name");
      return;
    }

    // Save to context
    const formData = {
      services,
      pricingApproach,
      serviceArea,
      differentiator,
      businessHours,
    };
    setStep2Data(formData);

    startTransition(async () => {
      try {
        await saveStep2Data(formData);
        goNext();
        router.push("/onboarding/faqs");
      } catch (err) {
        console.error("Failed to save services:", err);
        setError("Failed to save. Please try again.");
      }
    });
  };

  const handleBack = () => {
    // Save current state before going back
    setStep2Data({
      services,
      pricingApproach,
      serviceArea,
      differentiator,
      businessHours,
    });
    goBack();
    router.push("/onboarding");
  };

  const selectedCount = services.filter((s) => s.isSelected).length;
  const isValid = selectedCount > 0 && serviceArea.trim().length > 0;

  return (
    <div className="mx-auto max-w-3xl">
      <StepHeader
        title="Make It Yours"
        description="This is a starting point. Make it accurate for YOUR business."
        badge="Step 2 of 8"
      />

      {/* Services Section */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Services</h2>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAcceptAllDefaults}
            >
              <Check className="mr-2 h-4 w-4" />
              Accept All Defaults
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
            >
              Select All
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDeselectAll}
            >
              Deselect All
            </Button>
            {selectedCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-error"
                onClick={handleDeleteSelected}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Selected
              </Button>
            )}
          </div>
        </div>

        {/* Service List */}
        <div className="space-y-3">
          {services.map((service, index) => (
            <ServiceItem
              key={service.id || `service-${index}`}
              service={service}
              index={index}
              isEditing={editingServiceId === (service.id || `new-${index}`)}
              onToggle={() => handleToggleService(index)}
              onEdit={() =>
                setEditingServiceId(
                  editingServiceId === (service.id || `new-${index}`)
                    ? null
                    : service.id || `new-${index}`
                )
              }
              onUpdate={(updates) => handleUpdateService(index, updates)}
              onDelete={() => handleDeleteService(index)}
              pricingApproach={pricingApproach}
            />
          ))}

          {services.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-muted-foreground">
                No services yet. Add your first service below.
              </p>
            </div>
          )}
        </div>

        {/* Add Service Button */}
        <Button
          type="button"
          variant="outline"
          onClick={handleAddService}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Custom Service
        </Button>
      </section>

      {/* Pricing Approach */}
      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold">Pricing Approach</h2>
        <div className="space-y-2">
          {PRICING_APPROACH_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border border-border p-4 transition-colors",
                pricingApproach === option.value &&
                  "border-primary bg-primary/5"
              )}
            >
              <input
                type="radio"
                name="pricing"
                value={option.value}
                checked={pricingApproach === option.value}
                onChange={() => setPricingApproach(option.value)}
                className="h-4 w-4 text-primary"
              />
              <span className="text-sm">{option.label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Service Area */}
      <section className="mt-8 space-y-4">
        <div>
          <Label htmlFor="service-area" className="text-lg font-semibold">
            Service Area <span className="text-error">*</span>
          </Label>
          <p className="text-sm text-muted-foreground">
            Where do you serve customers?
          </p>
        </div>
        <Input
          id="service-area"
          placeholder="e.g., Greater Phoenix area, Within 25 miles of downtown..."
          value={serviceArea}
          onChange={(e) => setServiceArea(e.target.value)}
          className="bg-card"
        />
      </section>

      {/* Differentiator */}
      <section className="mt-8 space-y-4">
        <div>
          <Label htmlFor="differentiator" className="text-lg font-semibold">
            What Makes You Different?
          </Label>
          <p className="text-sm text-muted-foreground">
            Optional, but helps Koya sell your business
          </p>
        </div>
        <Input
          id="differentiator"
          placeholder='e.g., "Family owned since 1985", "Same-day service available"...'
          value={differentiator}
          onChange={(e) => setDifferentiator(e.target.value)}
          className="bg-card"
        />
      </section>

      {/* Business Hours */}
      <section className="mt-8 space-y-4">
        <button
          type="button"
          onClick={() => setShowHours(!showHours)}
          className="flex w-full items-center justify-between"
        >
          <div>
            <h2 className="text-lg font-semibold">Business Hours</h2>
            <p className="text-sm text-muted-foreground">
              Pre-filled 9-5 Mon-Fri. Click to customize.
            </p>
          </div>
          {showHours ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </button>

        {showHours && (
          <div className="space-y-3 rounded-lg border border-border p-4">
            {businessHours.map((day, index) => (
              <div
                key={day.day_of_week}
                className="flex flex-wrap items-center gap-3"
              >
                <div className="w-24 font-medium">{DAY_NAMES[index]}</div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={day.is_closed}
                    onChange={(e) =>
                      handleHoursChange(index, "is_closed", e.target.checked)
                    }
                    className="h-4 w-4 rounded"
                  />
                  <span className="text-sm text-muted-foreground">Closed</span>
                </label>
                {!day.is_closed && (
                  <>
                    <Input
                      type="time"
                      value={day.open_time}
                      onChange={(e) =>
                        handleHoursChange(index, "open_time", e.target.value)
                      }
                      className="w-32 bg-card"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={day.close_time}
                      onChange={(e) =>
                        handleHoursChange(index, "close_time", e.target.value)
                      }
                      className="w-32 bg-card"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

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
          onBack={handleBack}
          nextDisabled={!isValid}
          isSubmitting={isPending}
        />
      </div>
    </div>
  );
}

// Service Item Component
interface ServiceItemProps {
  service: ServiceFormData;
  index: number;
  isEditing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onUpdate: (updates: Partial<ServiceFormData>) => void;
  onDelete: () => void;
  pricingApproach: PricingApproach;
}

function ServiceItem({
  service,
  index,
  isEditing,
  onToggle,
  onEdit,
  onUpdate,
  onDelete,
  pricingApproach,
}: ServiceItemProps) {
  const [localData, setLocalData] = useState(service);

  const handleSave = () => {
    onUpdate(localData);
    onEdit(); // Close editing
  };

  const handleCancel = () => {
    setLocalData(service);
    onEdit(); // Close editing
  };

  if (isEditing) {
    return (
      <Card className="border-primary">
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Name</Label>
              <Input
                value={localData.name}
                onChange={(e) =>
                  setLocalData({ ...localData, name: e.target.value })
                }
                placeholder="Service name"
                className="mt-1 bg-card"
              />
            </div>
            <div>
              <Label>Duration (minutes)</Label>
              <Input
                type="number"
                value={localData.duration_minutes}
                onChange={(e) =>
                  setLocalData({
                    ...localData,
                    duration_minutes: parseInt(e.target.value) || 60,
                  })
                }
                className="mt-1 bg-card"
              />
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Input
              value={localData.description}
              onChange={(e) =>
                setLocalData({ ...localData, description: e.target.value })
              }
              placeholder="Brief description"
              className="mt-1 bg-card"
            />
          </div>

          {pricingApproach !== "hidden" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Price Type</Label>
                <select
                  value={localData.price_type}
                  onChange={(e) =>
                    setLocalData({
                      ...localData,
                      price_type: e.target.value as "fixed" | "quote" | "hidden",
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2"
                >
                  <option value="fixed">Fixed Price</option>
                  <option value="quote">Call for Quote</option>
                </select>
              </div>
              {localData.price_type === "fixed" && (
                <div>
                  <Label>Price ($)</Label>
                  <Input
                    type="text"
                    value={
                      localData.price_cents
                        ? (localData.price_cents / 100).toFixed(2)
                        : ""
                    }
                    onChange={(e) =>
                      setLocalData({
                        ...localData,
                        price_cents: parsePriceInput(e.target.value),
                      })
                    }
                    placeholder="0.00"
                    className="mt-1 bg-card"
                  />
                </div>
              )}
            </div>
          )}

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={localData.is_bookable}
                onChange={(e) =>
                  setLocalData({ ...localData, is_bookable: e.target.checked })
                }
                className="h-4 w-4 rounded"
              />
              <span className="text-sm">Can be booked via Koya</span>
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
              <X className="mr-1 h-4 w-4" />
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSave}>
              <Check className="mr-1 h-4 w-4" />
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "transition-colors",
        !service.isSelected && "opacity-60"
      )}
    >
      <CardContent className="flex items-center gap-4 p-4">
        <button type="button" onClick={onToggle} className="flex-shrink-0">
          {service.isSelected ? (
            <CheckSquare className="h-5 w-5 text-primary" />
          ) : (
            <Square className="h-5 w-5 text-muted-foreground" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="font-medium">{service.name || "Untitled Service"}</div>
          {service.description && (
            <div className="truncate text-sm text-muted-foreground">
              {service.description}
            </div>
          )}
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {service.duration_minutes} min
            </span>
            {pricingApproach !== "hidden" && (
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                {service.price_type === "fixed"
                  ? formatPrice(service.price_cents) || "Free"
                  : "Quote"}
              </span>
            )}
            {service.is_bookable && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Bookable
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-error"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
