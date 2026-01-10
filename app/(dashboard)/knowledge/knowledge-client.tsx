"use client";

/**
 * Koya's Knowledge Client Component
 * Session 17: Dashboard - Appointments & Knowledge
 * Spec Reference: Part 7, Lines 718-746
 *
 * All save buttons trigger prompt regeneration (Line 720, 727, 733, 741, 746)
 */

import { useState, useCallback } from "react";
import {
  Save,
  Plus,
  Trash2,
  GripVertical,
  Loader2,
  CheckCircle,
  AlertCircle,
  Brain,
  Briefcase,
  HelpCircle,
  Building2,
  FileText,
  Clock,
  RefreshCw,
  Globe,
  Sparkles,
  X,
  Check,
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
  Textarea,
  Switch,
  Badge,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Alert,
  AlertDescription,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Checkbox,
} from "@/components/ui";
import type { Service, FAQ, BusinessHours } from "@/types";

// Extracted content from website scraping
interface ExtractedContent {
  businessName?: string;
  businessType?: string;
  address?: string;
  serviceArea?: string;
  differentiator?: string;
  services: Array<{
    name: string;
    description: string;
    duration_minutes?: number;
    price?: number;
  }>;
  faqs: Array<{
    question: string;
    answer: string;
  }>;
  additionalInfo?: string;
}

interface KnowledgeClientProps {
  businessId: string;
  initialBusiness: {
    name: string;
    address: string | null;
    website: string | null;
    service_area: string | null;
    differentiator: string | null;
  };
  initialServices: Service[];
  initialFaqs: FAQ[];
  initialKnowledge: { content: string | null; never_say: string | null };
  initialBusinessHours: BusinessHours[];
  spanishEnabled: boolean;
  lastPromptGenerated: string | null;
}

type Tab = "services" | "faqs" | "business" | "additional";

const PRICE_TYPES = [
  { value: "fixed", label: "Fixed Price" },
  { value: "quote", label: "Call for Quote" },
  { value: "hidden", label: "Don't Mention" },
];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function KnowledgeClient({
  businessId,
  initialBusiness,
  initialServices,
  initialFaqs,
  initialKnowledge,
  initialBusinessHours,
  spanishEnabled,
  lastPromptGenerated,
}: KnowledgeClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("services");
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Services state
  const [services, setServices] = useState<Service[]>(initialServices);
  const [servicesModified, setServicesModified] = useState(false);

  // FAQs state
  const [faqs, setFaqs] = useState<FAQ[]>(initialFaqs);
  const [faqsModified, setFaqsModified] = useState(false);

  // Business info state
  const [business, setBusiness] = useState(initialBusiness);
  // Initialize business hours with defaults if empty (Issue 3 fix)
  const [businessHours, setBusinessHours] = useState<BusinessHours[]>(() => {
    if (initialBusinessHours.length > 0) {
      return initialBusinessHours;
    }
    // Create default hours for all 7 days
    return DAY_NAMES.map((_, index) => ({
      id: `default-${index}`,
      business_id: businessId,
      day_of_week: index,
      is_closed: index === 0 || index === 6, // Closed weekends by default
      open_time: "09:00",
      close_time: "17:00",
      created_at: new Date().toISOString(),
    })) as BusinessHours[];
  });
  const [businessModified, setBusinessModified] = useState(false);

  // Knowledge state
  const [knowledge, setKnowledge] = useState(initialKnowledge);
  const [knowledgeModified, setKnowledgeModified] = useState(false);

  // Website import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importUrl, setImportUrl] = useState(initialBusiness.website || "");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [extractedContent, setExtractedContent] = useState<ExtractedContent | null>(null);
  const [selectedServices, setSelectedServices] = useState<Set<number>>(new Set());
  const [selectedFaqs, setSelectedFaqs] = useState<Set<number>>(new Set());
  const [importBusinessInfo, setImportBusinessInfo] = useState(true);
  const [importAdditionalInfo, setImportAdditionalInfo] = useState(true);

  // Trigger prompt regeneration
  const triggerRegeneration = useCallback(async (triggerType: string) => {
    setRegenerating(true);
    try {
      const res = await fetch("/api/dashboard/knowledge/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, triggerType }),
      });

      if (!res.ok) {
        console.error("Failed to trigger regeneration");
      }
    } catch (err) {
      console.error("Regeneration error:", err);
    } finally {
      setRegenerating(false);
    }
  }, [businessId]);

  // Save services - Line 727
  const saveServices = async () => {
    // Validate: all services must have names
    const invalidServices = services.filter(s => !s.name || s.name.trim() === "");
    if (invalidServices.length > 0) {
      setError("All services must have a name");
      return;
    }
    
    setSaving(true);
    setError(null);
    try {
      // Filter out temp IDs and clean data for API
      const cleanedServices = services.map(s => ({
        ...s,
        name: s.name.trim(),
        description: s.description?.trim() || null,
      }));
      
      const res = await fetch("/api/dashboard/knowledge/services", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ services: cleanedServices }),
      });

      if (!res.ok) {
        throw new Error("Failed to save services");
      }

      setServicesModified(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      // Trigger regeneration
      await triggerRegeneration("services_update");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Save FAQs - Line 733
  const saveFaqs = async () => {
    // Validate: FAQs must have both question and answer
    const invalidFaqs = faqs.filter(f => !f.question?.trim() || !f.answer?.trim());
    if (invalidFaqs.length > 0) {
      setError("All FAQs must have both a question and answer");
      return;
    }
    
    setSaving(true);
    setError(null);
    try {
      // Clean data for API
      const cleanedFaqs = faqs.map(f => ({
        ...f,
        question: f.question.trim(),
        answer: f.answer.trim(),
      }));
      
      const res = await fetch("/api/dashboard/knowledge/faqs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faqs: cleanedFaqs }),
      });

      if (!res.ok) {
        throw new Error("Failed to save FAQs");
      }

      setFaqsModified(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      // Trigger regeneration
      await triggerRegeneration("faqs_update");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Save business info - Line 741
  const saveBusinessInfo = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/knowledge/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business, businessHours }),
      });

      if (!res.ok) {
        throw new Error("Failed to save business info");
      }

      setBusinessModified(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      // Trigger regeneration
      await triggerRegeneration("settings_update");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Save additional knowledge - Line 746
  const saveKnowledge = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/knowledge/additional", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledge }),
      });

      if (!res.ok) {
        throw new Error("Failed to save knowledge");
      }

      setKnowledgeModified(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      // Trigger regeneration
      await triggerRegeneration("knowledge_update");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Service helpers
  const addService = () => {
    const newService: Partial<Service> & { id: string; name: string } = {
      id: `temp-${crypto.randomUUID()}`,
      name: "",
      description: "",
      duration_minutes: 60,
      price_cents: null,
      price_type: "quote",
      is_bookable: true,
      sort_order: services.length,
    };
    setServices([...services, newService as Service]);
    setServicesModified(true);
  };

  const updateService = (index: number, updates: Partial<Service>) => {
    const updated = [...services];
    updated[index] = { ...updated[index], ...updates };
    setServices(updated);
    setServicesModified(true);
  };

  const removeService = (index: number) => {
    setServices(services.filter((_, i) => i !== index));
    setServicesModified(true);
  };

  // FAQ helpers
  const addFaq = () => {
    const newFaq: Partial<FAQ> & { id: string } = {
      id: `temp-${crypto.randomUUID()}`,
      question: "",
      answer: "",
      sort_order: faqs.length,
    };
    setFaqs([...faqs, newFaq as FAQ]);
    setFaqsModified(true);
  };

  const updateFaq = (index: number, updates: Partial<FAQ>) => {
    const updated = [...faqs];
    updated[index] = { ...updated[index], ...updates };
    setFaqs(updated);
    setFaqsModified(true);
  };

  const removeFaq = (index: number) => {
    setFaqs(faqs.filter((_, i) => i !== index));
    setFaqsModified(true);
  };

  // Business hours helper
  const updateBusinessHour = (dayOfWeek: number, updates: Partial<BusinessHours>) => {
    const updated = businessHours.map((h) =>
      h.day_of_week === dayOfWeek ? { ...h, ...updates } : h
    );
    setBusinessHours(updated);
    setBusinessModified(true);
  };

  // Website import helpers
  const resetImportState = () => {
    setExtractedContent(null);
    setImportError(null);
    setSelectedServices(new Set());
    setSelectedFaqs(new Set());
    setImportBusinessInfo(true);
    setImportAdditionalInfo(true);
  };

  const scrapeWebsite = async () => {
    if (!importUrl.trim()) {
      setImportError("Please enter a website URL");
      return;
    }

    setImporting(true);
    setImportError(null);
    setExtractedContent(null);

    try {
      const res = await fetch("/api/dashboard/knowledge/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl }),
      });

      const data = await res.json();

      if (!data.success) {
        setImportError(data.error || "Failed to scrape website");
        return;
      }

      setExtractedContent(data.data);
      // Select all by default
      setSelectedServices(new Set(data.data.services.map((_: unknown, i: number) => i)));
      setSelectedFaqs(new Set(data.data.faqs.map((_: unknown, i: number) => i)));
    } catch (err) {
      setImportError("An error occurred while scraping the website");
      console.error("Scrape error:", err);
    } finally {
      setImporting(false);
    }
  };

  const toggleServiceSelection = (index: number) => {
    const newSelected = new Set(selectedServices);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedServices(newSelected);
  };

  const toggleFaqSelection = (index: number) => {
    const newSelected = new Set(selectedFaqs);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedFaqs(newSelected);
  };

  const applyImportedContent = () => {
    if (!extractedContent) return;

    // Import selected services
    if (selectedServices.size > 0) {
      const newServices: Service[] = extractedContent.services
        .filter((_, i) => selectedServices.has(i))
        .map((s, i) => ({
          id: `temp-${crypto.randomUUID()}`,
          business_id: businessId,
          name: s.name,
          description: s.description || null,
          duration_minutes: s.duration_minutes || 60,
          price_cents: s.price ? Math.round(s.price * 100) : null,
          price_type: s.price ? "fixed" : "quote",
          is_bookable: true,
          sort_order: services.length + i,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })) as Service[];

      setServices([...services, ...newServices]);
      setServicesModified(true);
    }

    // Import selected FAQs
    if (selectedFaqs.size > 0) {
      const newFaqs: FAQ[] = extractedContent.faqs
        .filter((_, i) => selectedFaqs.has(i))
        .map((f, i) => ({
          id: `temp-${crypto.randomUUID()}`,
          business_id: businessId,
          question: f.question,
          answer: f.answer,
          sort_order: faqs.length + i,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })) as FAQ[];

      setFaqs([...faqs, ...newFaqs]);
      setFaqsModified(true);
    }

    // Import business info
    if (importBusinessInfo) {
      const updates: typeof business = { ...business };
      if (extractedContent.address && !business.address) {
        updates.address = extractedContent.address;
      }
      if (extractedContent.serviceArea && !business.service_area) {
        updates.service_area = extractedContent.serviceArea;
      }
      if (extractedContent.differentiator && !business.differentiator) {
        updates.differentiator = extractedContent.differentiator;
      }
      if (JSON.stringify(updates) !== JSON.stringify(business)) {
        setBusiness(updates);
        setBusinessModified(true);
      }
    }

    // Import additional info
    if (importAdditionalInfo && extractedContent.additionalInfo) {
      const currentContent = knowledge.content || "";
      const newContent = currentContent
        ? `${currentContent}\n\n${extractedContent.additionalInfo}`
        : extractedContent.additionalInfo;
      setKnowledge({ ...knowledge, content: newContent });
      setKnowledgeModified(true);
    }

    // Close dialog and reset
    setImportDialogOpen(false);
    resetImportState();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const tabs = [
    { id: "services" as const, label: "Services", icon: Briefcase, modified: servicesModified },
    { id: "faqs" as const, label: "FAQs", icon: HelpCircle, modified: faqsModified },
    { id: "business" as const, label: "Business Info", icon: Building2, modified: businessModified },
    { id: "additional" as const, label: "Additional", icon: FileText, modified: knowledgeModified },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            Koya&apos;s Knowledge
          </h1>
          <p className="text-muted-foreground">
            Edit what Koya knows about your business
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setImportDialogOpen(true);
              resetImportState();
            }}
          >
            <Globe className="w-4 h-4 mr-2" />
            Import from Website
          </Button>
          {lastPromptGenerated && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              Last updated: {new Date(lastPromptGenerated).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      {/* Regeneration notice */}
      <Alert>
        <RefreshCw className="h-4 w-4" />
        <AlertDescription>
          Changes you save here will automatically update Koya&apos;s knowledge and responses.
          {regenerating && " Updating Koya..."}
        </AlertDescription>
      </Alert>

      {/* Success/Error messages */}
      {saveSuccess && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-600">
            Changes saved successfully! Koya is being updated.
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b pb-2">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab(tab.id)}
            className="relative"
          >
            <tab.icon className="w-4 h-4 mr-2" />
            {tab.label}
            {tab.modified && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full" />
            )}
          </Button>
        ))}
      </div>

      {/* Services Tab - Lines 722-727 */}
      {activeTab === "services" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Services</CardTitle>
                <CardDescription>
                  List the services your business offers. Koya will use this to answer questions and book appointments.
                </CardDescription>
              </div>
              <Button onClick={addService} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Service
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {services.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No services added yet. Click &quot;Add Service&quot; to get started.
              </div>
            ) : (
              services.map((service, index) => (
                <div
                  key={service.id}
                  className="flex gap-4 p-4 border rounded-lg bg-muted/20"
                >
                  <div className="flex items-center text-muted-foreground cursor-move">
                    <GripVertical className="w-5 h-5" />
                  </div>
                  <div className="flex-1 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Service Name</Label>
                      <Input
                        value={service.name}
                        onChange={(e) => updateService(index, { name: e.target.value })}
                        placeholder="e.g., AC Repair"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Duration (min)</Label>
                      <Input
                        type="number"
                        value={service.duration_minutes}
                        onChange={(e) =>
                          updateService(index, { duration_minutes: parseInt(e.target.value) || 60 })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Price Type</Label>
                      <Select
                        value={service.price_type}
                        onValueChange={(v) => updateService(index, { price_type: v as "fixed" | "quote" | "hidden" })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRICE_TYPES.map((pt) => (
                            <SelectItem key={pt.value} value={pt.value}>
                              {pt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {service.price_type === "fixed" && (
                      <div>
                        <Label className="text-xs">Price ($)</Label>
                        <Input
                          type="number"
                          value={service.price_cents ? service.price_cents / 100 : ""}
                          onChange={(e) =>
                            updateService(index, {
                              price_cents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null,
                            })
                          }
                          placeholder="0.00"
                        />
                      </div>
                    )}
                    <div className="sm:col-span-2 lg:col-span-3">
                      <Label className="text-xs">Description</Label>
                      <Textarea
                        value={service.description || ""}
                        onChange={(e) => updateService(index, { description: e.target.value })}
                        placeholder="Brief description of this service..."
                        rows={2}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={service.is_bookable}
                        onCheckedChange={(checked) => updateService(index, { is_bookable: checked })}
                      />
                      <Label className="text-xs">Bookable</Label>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeService(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}

            {/* Save button */}
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={saveServices} disabled={saving || !servicesModified}>
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* FAQs Tab - Lines 729-733 */}
      {activeTab === "faqs" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>FAQs</CardTitle>
                <CardDescription>
                  Common questions and answers. Koya will use these to respond to callers.
                </CardDescription>
              </div>
              <Button onClick={addFaq} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add FAQ
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {faqs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No FAQs added yet. Click &quot;Add FAQ&quot; to get started.
              </div>
            ) : (
              faqs.map((faq, index) => (
                <div
                  key={faq.id}
                  className="flex gap-4 p-4 border rounded-lg bg-muted/20"
                >
                  <div className="flex items-start pt-2 text-muted-foreground cursor-move">
                    <GripVertical className="w-5 h-5" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <Label className="text-xs">Question</Label>
                      <Input
                        value={faq.question}
                        onChange={(e) => updateFaq(index, { question: e.target.value })}
                        placeholder="e.g., What are your hours?"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Answer</Label>
                      <Textarea
                        value={faq.answer}
                        onChange={(e) => updateFaq(index, { answer: e.target.value })}
                        placeholder="e.g., We're open Monday through Friday, 8am to 6pm."
                        rows={3}
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeFaq(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}

            {/* Save button */}
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={saveFaqs} disabled={saving || !faqsModified}>
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Business Info Tab - Lines 735-741 */}
      {activeTab === "business" && (
        <Card>
          <CardHeader>
            <CardTitle>Business Information</CardTitle>
            <CardDescription>
              Basic information about your business that Koya will share with callers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Business Name</Label>
                <Input
                  value={business.name}
                  onChange={(e) => {
                    setBusiness({ ...business, name: e.target.value });
                    setBusinessModified(true);
                  }}
                />
              </div>
              <div>
                <Label>Website</Label>
                <Input
                  value={business.website || ""}
                  onChange={(e) => {
                    setBusiness({ ...business, website: e.target.value });
                    setBusinessModified(true);
                  }}
                  placeholder="https://yourbusiness.com"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Address</Label>
                <Input
                  value={business.address || ""}
                  onChange={(e) => {
                    setBusiness({ ...business, address: e.target.value });
                    setBusinessModified(true);
                  }}
                  placeholder="123 Main St, City, State ZIP"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Service Area</Label>
                <Input
                  value={business.service_area || ""}
                  onChange={(e) => {
                    setBusiness({ ...business, service_area: e.target.value });
                    setBusinessModified(true);
                  }}
                  placeholder="e.g., Greater Denver Metro Area, within 25 miles of downtown"
                />
              </div>
            </div>

            {/* Business Hours */}
            <div>
              <Label className="text-base font-medium">Business Hours</Label>
              <p className="text-sm text-muted-foreground mb-3">
                When is your business open to receive calls?
              </p>
              <div className="space-y-2">
                {DAY_NAMES.map((dayName, dayIndex) => {
                  const hours = businessHours.find((h) => h.day_of_week === dayIndex) || {
                    day_of_week: dayIndex,
                    is_closed: true,
                    open_time: "09:00",
                    close_time: "17:00",
                  };

                  return (
                    <div key={dayIndex} className="flex items-center gap-4">
                      <div className="w-24 font-medium text-sm">{dayName}</div>
                      <Switch
                        checked={!hours.is_closed}
                        onCheckedChange={(checked) =>
                          updateBusinessHour(dayIndex, { is_closed: !checked })
                        }
                      />
                      {!hours.is_closed ? (
                        <>
                          <Input
                            type="time"
                            value={hours.open_time || "09:00"}
                            onChange={(e) =>
                              updateBusinessHour(dayIndex, { open_time: e.target.value })
                            }
                            className="w-32"
                          />
                          <span className="text-muted-foreground">to</span>
                          <Input
                            type="time"
                            value={hours.close_time || "17:00"}
                            onChange={(e) =>
                              updateBusinessHour(dayIndex, { close_time: e.target.value })
                            }
                            className="w-32"
                          />
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">Closed</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Languages */}
            <div>
              <Label className="text-base font-medium">Languages</Label>
              <div className="flex items-center gap-4 mt-2">
                <Badge variant="default">English</Badge>
                {spanishEnabled && <Badge variant="secondary">Spanish</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Language settings can be changed in Settings → Language
              </p>
            </div>

            {/* Save button */}
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={saveBusinessInfo} disabled={saving || !businessModified}>
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Additional Knowledge Tab - Lines 743-746 */}
      {activeTab === "additional" && (
        <Card>
          <CardHeader>
            <CardTitle>Additional Knowledge</CardTitle>
            <CardDescription>
              Extra information and guidelines for Koya to follow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Freeform notes */}
            <div>
              <Label>Additional Information</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Any extra details Koya should know (policies, special instructions, etc.)
              </p>
              <Textarea
                value={knowledge.content || ""}
                onChange={(e) => {
                  setKnowledge({ ...knowledge, content: e.target.value });
                  setKnowledgeModified(true);
                }}
                placeholder="e.g., We offer a 10% discount for seniors. We don't provide services on holidays. Always recommend scheduling a consultation first for complex projects..."
                rows={6}
              />
            </div>

            {/* Things not to say */}
            <div>
              <Label>Things NOT to Say</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Topics or phrases Koya should avoid mentioning
              </p>
              <Textarea
                value={knowledge.never_say || ""}
                onChange={(e) => {
                  setKnowledge({ ...knowledge, never_say: e.target.value });
                  setKnowledgeModified(true);
                }}
                placeholder="e.g., Never mention competitor names. Don't discuss pricing over the phone. Avoid promising same-day service..."
                rows={4}
              />
            </div>

            {/* Save button */}
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={saveKnowledge} disabled={saving || !knowledgeModified}>
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Website Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => {
        setImportDialogOpen(open);
        if (!open) resetImportState();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Import Content from Website
            </DialogTitle>
            <DialogDescription>
              Enter your website URL and we&apos;ll use AI to extract services, FAQs, and business information.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* URL Input */}
            <div className="space-y-2">
              <Label htmlFor="website-url">Website URL</Label>
              <div className="flex gap-2">
                <Input
                  id="website-url"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://yourbusiness.com"
                  disabled={importing}
                />
                <Button onClick={scrapeWebsite} disabled={importing || !importUrl.trim()}>
                  {importing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Analyze"
                  )}
                </Button>
              </div>
              {importError && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {importError}
                </p>
              )}
            </div>

            {/* Loading State */}
            {importing && (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                <p className="text-sm text-muted-foreground mt-2">
                  Analyzing website content...
                </p>
              </div>
            )}

            {/* Extracted Content Preview */}
            {extractedContent && !importing && (
              <div className="space-y-6">
                {/* Services Section */}
                {extractedContent.services.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium">
                        Services Found ({extractedContent.services.length})
                      </Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (selectedServices.size === extractedContent.services.length) {
                            setSelectedServices(new Set());
                          } else {
                            setSelectedServices(new Set(extractedContent.services.map((_, i) => i)));
                          }
                        }}
                      >
                        {selectedServices.size === extractedContent.services.length ? "Deselect All" : "Select All"}
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {extractedContent.services.map((service, index) => (
                        <div
                          key={index}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedServices.has(index)
                              ? "bg-primary/5 border-primary"
                              : "bg-muted/30 hover:bg-muted/50"
                          }`}
                          onClick={() => toggleServiceSelection(index)}
                        >
                          <Checkbox
                            checked={selectedServices.has(index)}
                            onCheckedChange={() => toggleServiceSelection(index)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{service.name}</p>
                            {service.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {service.description}
                              </p>
                            )}
                          </div>
                          {service.price && (
                            <Badge variant="secondary">${service.price}</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* FAQs Section */}
                {extractedContent.faqs.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium">
                        FAQs Found ({extractedContent.faqs.length})
                      </Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (selectedFaqs.size === extractedContent.faqs.length) {
                            setSelectedFaqs(new Set());
                          } else {
                            setSelectedFaqs(new Set(extractedContent.faqs.map((_, i) => i)));
                          }
                        }}
                      >
                        {selectedFaqs.size === extractedContent.faqs.length ? "Deselect All" : "Select All"}
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {extractedContent.faqs.map((faq, index) => (
                        <div
                          key={index}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedFaqs.has(index)
                              ? "bg-primary/5 border-primary"
                              : "bg-muted/30 hover:bg-muted/50"
                          }`}
                          onClick={() => toggleFaqSelection(index)}
                        >
                          <Checkbox
                            checked={selectedFaqs.has(index)}
                            onCheckedChange={() => toggleFaqSelection(index)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{faq.question}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {faq.answer}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Business Info Section */}
                {(extractedContent.address || extractedContent.serviceArea || extractedContent.differentiator) && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="import-business-info"
                        checked={importBusinessInfo}
                        onCheckedChange={(checked) => setImportBusinessInfo(checked as boolean)}
                      />
                      <Label htmlFor="import-business-info" className="text-base font-medium cursor-pointer">
                        Business Information
                      </Label>
                    </div>
                    {importBusinessInfo && (
                      <div className="ml-7 p-3 rounded-lg bg-muted/30 text-sm space-y-1">
                        {extractedContent.address && (
                          <p><span className="text-muted-foreground">Address:</span> {extractedContent.address}</p>
                        )}
                        {extractedContent.serviceArea && (
                          <p><span className="text-muted-foreground">Service Area:</span> {extractedContent.serviceArea}</p>
                        )}
                        {extractedContent.differentiator && (
                          <p><span className="text-muted-foreground">Differentiator:</span> {extractedContent.differentiator}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Additional Info Section */}
                {extractedContent.additionalInfo && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="import-additional-info"
                        checked={importAdditionalInfo}
                        onCheckedChange={(checked) => setImportAdditionalInfo(checked as boolean)}
                      />
                      <Label htmlFor="import-additional-info" className="text-base font-medium cursor-pointer">
                        Additional Information
                      </Label>
                    </div>
                    {importAdditionalInfo && (
                      <div className="ml-7 p-3 rounded-lg bg-muted/30 text-sm">
                        <p className="text-muted-foreground line-clamp-3">{extractedContent.additionalInfo}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Import Button */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => {
                    setImportDialogOpen(false);
                    resetImportState();
                  }}>
                    Cancel
                  </Button>
                  <Button
                    onClick={applyImportedContent}
                    disabled={selectedServices.size === 0 && selectedFaqs.size === 0 && !importBusinessInfo && !importAdditionalInfo}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Import Selected ({selectedServices.size + selectedFaqs.size} items)
                  </Button>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!extractedContent && !importing && (
              <div className="text-center py-8 text-muted-foreground">
                <Globe className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Enter your website URL and click Analyze to extract content</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
