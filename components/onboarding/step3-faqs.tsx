"use client";

/**
 * Step 3: FAQs & Knowledge
 * Spec Reference: Part 5, Lines 262-280
 * - Template FAQs with "Accept All Defaults"
 * - Edit/Delete/Keep each FAQ
 * - AI highlight flagged items
 * - Add custom FAQs
 * - Additional knowledge text
 * - Things Koya should NEVER say
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  AlertTriangle,
  CheckSquare,
  Square,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useOnboarding } from "@/lib/onboarding/context";
import { saveStep3Data } from "@/lib/onboarding/actions";
import { StepHeader, OnboardingNavigation } from "./navigation";
import { type FAQFormData, createEmptyFAQ } from "@/types/onboarding";

export function Step3FAQs() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { state, setStep3Data, goNext, goBack, setError } = useOnboarding();

  // Initialize form data from state or defaults
  const [faqs, setFaqs] = useState<FAQFormData[]>(state.step3Data?.faqs || []);
  const [additionalKnowledge, setAdditionalKnowledge] = useState(
    state.step3Data?.additionalKnowledge || ""
  );
  const [neverSay, setNeverSay] = useState(state.step3Data?.neverSay || "");

  // UI State
  const [editingFAQId, setEditingFAQId] = useState<string | null>(null);

  // Count FAQs that need attention (AI flagged)
  const needsAttentionCount = faqs.filter((f) => f.needsAttention).length;

  // Handlers
  const handleAcceptAllDefaults = () => {
    setFaqs((prev) => prev.map((f) => ({ ...f, isSelected: true })));
  };

  const handleSelectAll = () => {
    setFaqs((prev) => prev.map((f) => ({ ...f, isSelected: true })));
  };

  const handleDeselectAll = () => {
    setFaqs((prev) => prev.map((f) => ({ ...f, isSelected: false })));
  };

  const handleDeleteSelected = () => {
    setFaqs((prev) => prev.filter((f) => !f.isSelected));
  };

  const handleToggleFAQ = (index: number) => {
    setFaqs((prev) =>
      prev.map((f, i) =>
        i === index ? { ...f, isSelected: !f.isSelected } : f
      )
    );
  };

  const handleAddFAQ = () => {
    const newFAQ = createEmptyFAQ(faqs.length);
    setFaqs((prev) => [...prev, newFAQ]);
    setEditingFAQId(`new-${faqs.length}`);
  };

  const handleUpdateFAQ = (index: number, updates: Partial<FAQFormData>) => {
    setFaqs((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...updates } : f))
    );
  };

  const handleDeleteFAQ = (index: number) => {
    setFaqs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleNext = async () => {
    // Validation - check for empty Q/A pairs in selected FAQs
    const selectedFAQs = faqs.filter((f) => f.isSelected);
    const invalidFAQ = selectedFAQs.find(
      (f) => !f.question.trim() || !f.answer.trim()
    );
    if (invalidFAQ) {
      setError("All selected FAQs must have both a question and answer");
      return;
    }

    // Save to context
    const formData = {
      faqs,
      additionalKnowledge,
      neverSay,
    };
    setStep3Data(formData);

    startTransition(async () => {
      try {
        await saveStep3Data(formData);
        goNext();
        router.push("/onboarding/calendar");
      } catch (err) {
        setError("Failed to save. Please try again.");
      }
    });
  };

  const handleBack = () => {
    // Save current state before going back
    setStep3Data({
      faqs,
      additionalKnowledge,
      neverSay,
    });
    goBack();
    router.push("/onboarding/services");
  };

  const selectedCount = faqs.filter((f) => f.isSelected).length;

  return (
    <div className="mx-auto max-w-3xl">
      <StepHeader
        title="FAQs & Knowledge"
        description="Help Koya answer your customers' questions accurately."
        badge="Step 3 of 8"
      />

      {/* AI Attention Banner */}
      {needsAttentionCount > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-4">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-warning" />
          <div>
            <p className="font-medium text-foreground">
              {needsAttentionCount} FAQ{needsAttentionCount > 1 ? "s" : ""} may
              need your attention
            </p>
            <p className="text-sm text-muted-foreground">
              Review the highlighted items to make sure they&apos;re accurate for
              your business.
            </p>
          </div>
        </div>
      )}

      {/* Template FAQs Section */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Template FAQs</h2>
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

        {/* FAQ List */}
        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <FAQItem
              key={faq.id || `faq-${index}`}
              faq={faq}
              index={index}
              isEditing={editingFAQId === (faq.id || `new-${index}`)}
              onToggle={() => handleToggleFAQ(index)}
              onEdit={() =>
                setEditingFAQId(
                  editingFAQId === (faq.id || `new-${index}`)
                    ? null
                    : faq.id || `new-${index}`
                )
              }
              onUpdate={(updates) => handleUpdateFAQ(index, updates)}
              onDelete={() => handleDeleteFAQ(index)}
            />
          ))}

          {faqs.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">
                No FAQs yet. Add questions your customers frequently ask.
              </p>
            </div>
          )}
        </div>

        {/* Add FAQ Button */}
        <Button
          type="button"
          variant="outline"
          onClick={handleAddFAQ}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Custom FAQ
        </Button>
      </section>

      {/* Additional Knowledge */}
      <section className="mt-8 space-y-4">
        <div>
          <Label
            htmlFor="additional-knowledge"
            className="text-lg font-semibold"
          >
            Additional Knowledge
          </Label>
          <p className="text-sm text-muted-foreground">
            Anything else Koya should know? Special policies, instructions, etc.
          </p>
        </div>
        <textarea
          id="additional-knowledge"
          value={additionalKnowledge}
          onChange={(e) => setAdditionalKnowledge(e.target.value)}
          placeholder="e.g., We require 50% deposit for jobs over $500. Weekend appointments have a $50 surcharge..."
          className="min-h-[120px] w-full rounded-lg border border-border bg-card px-4 py-3 placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </section>

      {/* Never Say */}
      <section className="mt-8 space-y-4">
        <div>
          <Label htmlFor="never-say" className="text-lg font-semibold">
            Things Koya Should NEVER Say
          </Label>
          <p className="text-sm text-muted-foreground">
            Optional: Competitor names, sensitive topics, etc.
          </p>
        </div>
        <textarea
          id="never-say"
          value={neverSay}
          onChange={(e) => setNeverSay(e.target.value)}
          placeholder="e.g., Don't mention competitor company names. Never discuss refund policy on the phone..."
          className="min-h-[100px] w-full rounded-lg border border-border bg-card px-4 py-3 placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
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
          isSubmitting={isPending}
        />
      </div>
    </div>
  );
}

// FAQ Item Component
interface FAQItemProps {
  faq: FAQFormData;
  index: number;
  isEditing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onUpdate: (updates: Partial<FAQFormData>) => void;
  onDelete: () => void;
}

function FAQItem({
  faq,
  index,
  isEditing,
  onToggle,
  onEdit,
  onUpdate,
  onDelete,
}: FAQItemProps) {
  const [localData, setLocalData] = useState(faq);

  const handleSave = () => {
    onUpdate(localData);
    onEdit(); // Close editing
  };

  const handleCancel = () => {
    setLocalData(faq);
    onEdit(); // Close editing
  };

  if (isEditing) {
    return (
      <Card className="border-primary">
        <CardContent className="space-y-4 p-4">
          <div>
            <Label>Question</Label>
            <Input
              value={localData.question}
              onChange={(e) =>
                setLocalData({ ...localData, question: e.target.value })
              }
              placeholder="What do customers frequently ask?"
              className="mt-1 bg-card"
            />
          </div>

          <div>
            <Label>Answer</Label>
            <textarea
              value={localData.answer}
              onChange={(e) =>
                setLocalData({ ...localData, answer: e.target.value })
              }
              placeholder="How should Koya respond?"
              className="mt-1 min-h-[100px] w-full rounded-lg border border-border bg-card px-3 py-2 placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancel}
            >
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
        !faq.isSelected && "opacity-60",
        faq.needsAttention && "border-warning"
      )}
    >
      <CardContent className="flex items-start gap-4 p-4">
        <button
          type="button"
          onClick={onToggle}
          className="mt-1 flex-shrink-0"
        >
          {faq.isSelected ? (
            <CheckSquare className="h-5 w-5 text-primary" />
          ) : (
            <Square className="h-5 w-5 text-muted-foreground" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="font-medium">
              Q: {faq.question || "No question set"}
            </div>
            {faq.needsAttention && (
              <AlertTriangle className="h-4 w-4 flex-shrink-0 text-warning" />
            )}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            A: {faq.answer || "No answer set"}
          </div>
          {faq.isCustom && (
            <div className="mt-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              Custom
            </div>
          )}
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
