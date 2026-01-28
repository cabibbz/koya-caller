"use client";

/**
 * Koya's Knowledge Client Component
 * Session 17: Dashboard - Appointments & Knowledge
 * Spec Reference: Part 7, Lines 718-746
 *
 * All save buttons trigger prompt regeneration (Line 720, 727, 733, 741, 746)
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  Save,
  Plus,
  Trash2,
  Loader2,
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
  Wand2,
  MessageSquare,
  Download,
  Upload,
  TrendingUp,
  ArrowRight,
  Percent,
} from "lucide-react";
import { SortableList } from "@/components/ui/sortable-list";
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
import { toast } from "@/hooks/use-toast";

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

interface OfferSettings {
  upsellsEnabled: boolean;
  bundlesEnabled: boolean;
  packagesEnabled: boolean;
  membershipsEnabled: boolean;
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
  initialOfferSettings: OfferSettings;
}

type Tab = "services" | "faqs" | "business" | "additional" | "offers";

// Offer sub-tab type
type OfferSubTab = "upsells" | "bundles" | "packages" | "memberships" | "settings";

// Upsell type
interface Upsell {
  id: string;
  source_service_id: string;
  target_service_id: string;
  discount_percent: number;
  pitch_message: string | null;
  trigger_timing: "before_booking" | "after_booking";
  is_active: boolean;
  suggest_when_unavailable: boolean;
  source_service?: { id: string; name: string };
  target_service?: { id: string; name: string };
}

// Bundle type
interface Bundle {
  id: string;
  name: string;
  description: string | null;
  discount_percent: number;
  pitch_message: string | null;
  is_active: boolean;
  services: Array<{ id: string; name: string; duration_minutes: number; price_cents: number | null }>;
}

// Package type
interface Package {
  id: string;
  name: string;
  description: string | null;
  service_id: string | null;
  session_count: number;
  discount_percent: number;
  price_cents: number | null;
  validity_days: number | null;
  pitch_message: string | null;
  min_visits_to_pitch: number;
  is_active: boolean;
  service?: { id: string; name: string } | null;
}

// Membership type
interface Membership {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  billing_period: "monthly" | "quarterly" | "annual";
  benefits: string;
  pitch_message: string | null;
  pitch_after_booking_amount_cents: number | null;
  pitch_after_visit_count: number | null;
  is_active: boolean;
}

// Price types will be translated in the component using t()
const _PRICE_TYPE_KEYS = ["fixed", "quote", "hidden"] as const;

// Day names will be translated in the component using t()
const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

export function KnowledgeClient({
  businessId,
  initialBusiness,
  initialServices,
  initialFaqs,
  initialKnowledge,
  initialBusinessHours,
  spanishEnabled,
  lastPromptGenerated,
  initialOfferSettings,
}: KnowledgeClientProps) {
  const t = useTranslations("knowledge");
  const _tCommon = useTranslations("common");
  const [activeTab, setActiveTab] = useState<Tab>("services");
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

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
    return DAY_KEYS.map((_, index) => ({
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

  // Upsells state
  const [upsells, setUpsells] = useState<Upsell[]>([]);
  const [_upsellsLoaded, setUpsellsLoaded] = useState(false);
  const [upsellsLoading, setUpsellsLoading] = useState(false);
  const upsellsLoadingRef = useRef(false);
  const [_editingUpsell, setEditingUpsell] = useState<Upsell | null>(null);
  const [newUpsell, setNewUpsell] = useState<Partial<Upsell>>({
    source_service_id: "",
    target_service_id: "",
    discount_percent: 0,
    pitch_message: "",
    trigger_timing: "before_booking",
    is_active: true,
    suggest_when_unavailable: false,
  });
  const [savingUpsell, setSavingUpsell] = useState(false);

  // Offers sub-tab state
  const [offerSubTab, setOfferSubTab] = useState<OfferSubTab>("upsells");

  // Bundles state
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [_bundlesLoaded, setBundlesLoaded] = useState(false);
  const [bundlesLoading, setBundlesLoading] = useState(false);
  const bundlesLoadingRef = useRef(false);

  // Packages state
  const [packages, setPackages] = useState<Package[]>([]);
  const [_packagesLoaded, setPackagesLoaded] = useState(false);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const packagesLoadingRef = useRef(false);

  // Memberships state
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [_membershipsLoaded, setMembershipsLoaded] = useState(false);
  const [membershipsLoading, setMembershipsLoading] = useState(false);
  const membershipsLoadingRef = useRef(false);

  // Offer settings state (enable/disable toggles)
  const [offerSettings, setOfferSettings] = useState<OfferSettings>(initialOfferSettings);
  const [offerSettingsModified, setOfferSettingsModified] = useState(false);
  const [savingOfferSettings, setSavingOfferSettings] = useState(false);

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

  // FAQ suggestion state
  const [suggestDialogOpen, setSuggestDialogOpen] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestedFaqs, setSuggestedFaqs] = useState<Array<{ question: string; answer: string }>>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());

  // Knowledge test state
  const [testPanelOpen, setTestPanelOpen] = useState(false);
  const [testQuestion, setTestQuestion] = useState("");
  const [testResponse, setTestResponse] = useState("");
  const [testing, setTesting] = useState(false);

  // Import state
  const [importDialogOpenCsv, setImportDialogOpenCsv] = useState(false);
  const [importType, setImportType] = useState<"services" | "faqs">("services");
  const [importingCsv, setImportingCsv] = useState(false);

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
        // Failed to trigger regeneration
      }
    } catch (_err) {
      // Regeneration error handled silently
    } finally {
      setRegenerating(false);
    }
  }, [businessId]);

  // Save offer settings
  const saveOfferSettings = async () => {
    setSavingOfferSettings(true);
    try {
      const res = await fetch("/api/dashboard/settings/offers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upsellsEnabled: offerSettings.upsellsEnabled,
          bundlesEnabled: offerSettings.bundlesEnabled,
          packagesEnabled: offerSettings.packagesEnabled,
          membershipsEnabled: offerSettings.membershipsEnabled,
        }),
      });

      if (!res.ok) throw new Error("Failed to save offer settings");

      setOfferSettingsModified(false);
      toast({ title: "Offer settings saved", variant: "success" });
    } catch (err) {
      toast({
        title: "Failed to save",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive"
      });
    } finally {
      setSavingOfferSettings(false);
    }
  };

  // Save services - Line 727
  const saveServices = async () => {
    // Validate: all services must have names
    const invalidServices = services.filter(s => !s.name || s.name.trim() === "");
    if (invalidServices.length > 0) {
      toast({ title: "All services must have a name", variant: "warning" });
      return;
    }

    setSaving(true);
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
      toast({ title: "Services saved", variant: "success" });

      // Trigger regeneration
      await triggerRegeneration("services_update");
    } catch (err) {
      toast({
        title: "Failed to save",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Save FAQs - Line 733
  const saveFaqs = async () => {
    // Validate: FAQs must have both question and answer
    const invalidFaqs = faqs.filter(f => !f.question?.trim() || !f.answer?.trim());
    if (invalidFaqs.length > 0) {
      toast({ title: "All FAQs must have both a question and answer", variant: "warning" });
      return;
    }

    setSaving(true);
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
      toast({ title: "FAQs saved", variant: "success" });

      // Trigger regeneration
      await triggerRegeneration("faqs_update");
    } catch (err) {
      toast({
        title: "Failed to save",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Save business info - Line 741
  const saveBusinessInfo = async () => {
    setSaving(true);
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
      toast({ title: "Business info saved", variant: "success" });

      // Trigger regeneration
      await triggerRegeneration("settings_update");
    } catch (err) {
      toast({
        title: "Failed to save",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Save additional knowledge - Line 746
  const saveKnowledge = async () => {
    setSaving(true);
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
      toast({ title: "Knowledge saved", variant: "success" });

      // Trigger regeneration
      await triggerRegeneration("knowledge_update");
    } catch (err) {
      toast({
        title: "Failed to save",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive"
      });
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
    } catch (_err) {
      setImportError("An error occurred while scraping the website");
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
    toast({ title: "Content imported successfully", description: "Don't forget to save your changes", variant: "success" });
  };

  // FAQ suggestion helpers
  const generateFaqSuggestions = async () => {
    setSuggesting(true);
    setSuggestedFaqs([]);
    setSelectedSuggestions(new Set());

    try {
      const res = await fetch("/api/dashboard/knowledge/suggest-faqs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!data.success) {
        toast({ title: "Failed to generate suggestions", description: data.error, variant: "destructive" });
        return;
      }

      setSuggestedFaqs(data.faqs || []);
      setSelectedSuggestions(new Set(data.faqs.map((_: unknown, i: number) => i)));
      setSuggestDialogOpen(true);
    } catch (_err) {
      toast({ title: "Failed to generate suggestions", variant: "destructive" });
    } finally {
      setSuggesting(false);
    }
  };

  const toggleSuggestionSelection = (index: number) => {
    const newSelected = new Set(selectedSuggestions);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedSuggestions(newSelected);
  };

  const applySuggestedFaqs = () => {
    if (selectedSuggestions.size === 0) return;

    const newFaqs: FAQ[] = suggestedFaqs
      .filter((_, i) => selectedSuggestions.has(i))
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
    setSuggestDialogOpen(false);
    setSuggestedFaqs([]);
    setSelectedSuggestions(new Set());
    toast({ title: `Added ${newFaqs.length} FAQs`, description: "Don't forget to save your changes", variant: "success" });
  };

  // Knowledge test helper
  const testKnowledge = async () => {
    if (!testQuestion.trim()) return;

    setTesting(true);
    setTestResponse("");

    try {
      const res = await fetch("/api/dashboard/knowledge/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: testQuestion }),
      });

      const data = await res.json();

      if (!data.success) {
        setTestResponse(`Error: ${data.error}`);
        return;
      }

      setTestResponse(data.response);
    } catch (_err) {
      setTestResponse("Error: Failed to test knowledge. Please try again.");
    } finally {
      setTesting(false);
    }
  };

  // Export helper
  const exportData = (type: "services" | "faqs") => {
    window.open(`/api/dashboard/knowledge/export?type=${type}`, "_blank");
  };

  // Import helper
  const handleCsvImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportingCsv(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", importType);

      const res = await fetch("/api/dashboard/knowledge/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!data.success) {
        toast({ title: "Import failed", description: data.error, variant: "destructive" });
        return;
      }

      toast({
        title: `Imported ${data.imported} ${importType}`,
        description: data.errors?.length ? `${data.errors.length} rows had errors` : "Refresh the page to see changes",
        variant: "success",
      });

      setImportDialogOpenCsv(false);

      // Reload the page to show new data
      window.location.reload();
    } catch (_err) {
      toast({ title: "Import failed", variant: "destructive" });
    } finally {
      setImportingCsv(false);
      // Reset file input
      event.target.value = "";
    }
  };

  // Load upsells when tab is selected
  const loadUpsells = useCallback(async () => {
    if (upsellsLoadingRef.current) return;
    upsellsLoadingRef.current = true;
    setUpsellsLoading(true);
    try {
      const res = await fetch("/api/dashboard/knowledge/upsells");
      if (res.ok) {
        const data = await res.json();
        setUpsells(data.upsells || []);
      } else {
        toast({ title: "Failed to load upsells", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to load upsells", variant: "destructive" });
    } finally {
      setUpsellsLoaded(true);
      setUpsellsLoading(false);
    }
  }, []);

  // Create new upsell
  const createUpsell = async () => {
    if (!newUpsell.source_service_id || !newUpsell.target_service_id) {
      toast({ title: "Please select both services", variant: "warning" });
      return;
    }
    if (newUpsell.source_service_id === newUpsell.target_service_id) {
      toast({ title: "Source and target must be different services", variant: "warning" });
      return;
    }

    setSavingUpsell(true);
    try {
      const res = await fetch("/api/dashboard/knowledge/upsells", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUpsell),
      });

      if (!res.ok) {
        throw new Error("Failed to create upsell");
      }

      const data = await res.json();

      // Add the new upsell with service names
      const sourceService = services.find(s => s.id === newUpsell.source_service_id);
      const targetService = services.find(s => s.id === newUpsell.target_service_id);

      setUpsells([
        {
          ...data.upsell,
          source_service: sourceService ? { id: sourceService.id, name: sourceService.name } : undefined,
          target_service: targetService ? { id: targetService.id, name: targetService.name } : undefined,
        },
        ...upsells,
      ]);

      // Reset form
      setNewUpsell({
        source_service_id: "",
        target_service_id: "",
        discount_percent: 0,
        pitch_message: "",
        trigger_timing: "before_booking",
        is_active: true,
      });

      toast({ title: "Upsell created", variant: "success" });
    } catch (_err) {
      toast({ title: "Failed to create upsell", variant: "destructive" });
    } finally {
      setSavingUpsell(false);
    }
  };

  // Update upsell
  const updateUpsell = async (upsell: Upsell) => {
    setSavingUpsell(true);
    try {
      const res = await fetch("/api/dashboard/knowledge/upsells", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upsell }),
      });

      if (!res.ok) {
        throw new Error("Failed to update upsell");
      }

      // Update local state
      setUpsells(upsells.map(u => u.id === upsell.id ? upsell : u));
      setEditingUpsell(null);
      toast({ title: "Upsell updated", variant: "success" });
    } catch (_err) {
      toast({ title: "Failed to update upsell", variant: "destructive" });
    } finally {
      setSavingUpsell(false);
    }
  };

  // Delete upsell
  const deleteUpsell = async (id: string) => {
    try {
      const res = await fetch(`/api/dashboard/knowledge/upsells?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete upsell");
      }

      setUpsells(upsells.filter(u => u.id !== id));
      toast({ title: "Upsell deleted", variant: "success" });
    } catch (_err) {
      toast({ title: "Failed to delete upsell", variant: "destructive" });
    }
  };

  // Load bundles
  const loadBundles = useCallback(async () => {
    if (bundlesLoadingRef.current) return;
    bundlesLoadingRef.current = true;
    setBundlesLoading(true);
    try {
      const res = await fetch("/api/dashboard/knowledge/bundles");
      if (res.ok) {
        const data = await res.json();
        setBundles(data.bundles || []);
      } else {
        toast({ title: "Failed to load bundles", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to load bundles", variant: "destructive" });
    } finally {
      setBundlesLoaded(true);
      setBundlesLoading(false);
    }
  }, []);

  // Load packages
  const loadPackages = useCallback(async () => {
    if (packagesLoadingRef.current) return;
    packagesLoadingRef.current = true;
    setPackagesLoading(true);
    try {
      const res = await fetch("/api/dashboard/knowledge/packages");
      if (res.ok) {
        const data = await res.json();
        setPackages(data.packages || []);
      } else {
        toast({ title: "Failed to load packages", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to load packages", variant: "destructive" });
    } finally {
      setPackagesLoaded(true);
      setPackagesLoading(false);
    }
  }, []);

  // Load memberships
  const loadMemberships = useCallback(async () => {
    if (membershipsLoadingRef.current) return;
    membershipsLoadingRef.current = true;
    setMembershipsLoading(true);
    try {
      const res = await fetch("/api/dashboard/knowledge/memberships");
      if (res.ok) {
        const data = await res.json();
        setMemberships(data.memberships || []);
      } else {
        toast({ title: "Failed to load memberships", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to load memberships", variant: "destructive" });
    } finally {
      setMembershipsLoaded(true);
      setMembershipsLoading(false);
    }
  }, []);

  // Load offers data when switching to offers tab
  // Using refs in load functions prevents duplicate calls even with React Strict Mode
  useEffect(() => {
    if (activeTab === "offers") {
      if (offerSubTab === "upsells") {
        loadUpsells();
      } else if (offerSubTab === "bundles") {
        loadBundles();
      } else if (offerSubTab === "packages") {
        loadPackages();
      } else if (offerSubTab === "memberships") {
        loadMemberships();
      }
    }
  }, [activeTab, offerSubTab, loadUpsells, loadBundles, loadPackages, loadMemberships]);

  const tabs = [
    { id: "services" as const, label: "Services", icon: Briefcase, modified: servicesModified },
    { id: "faqs" as const, label: "FAQs", icon: HelpCircle, modified: faqsModified },
    { id: "business" as const, label: "Business Info", icon: Building2, modified: businessModified },
    { id: "additional" as const, label: "Additional", icon: FileText, modified: knowledgeModified },
    { id: "offers" as const, label: "Offers", icon: TrendingUp, modified: false },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            {t("title")}
          </h1>
          <p className="text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setTestPanelOpen(!testPanelOpen)}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            {t("testKnowledge")}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setImportDialogOpen(true);
              resetImportState();
            }}
          >
            <Globe className="w-4 h-4 mr-2" />
            {t("importFromWebsite")}
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

      {/* Test Knowledge Panel */}
      {testPanelOpen && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">Test Koya&apos;s Knowledge</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTestPanelOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <CardDescription>
              Ask a question to see how Koya would respond based on your current knowledge base.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={testQuestion}
                onChange={(e) => setTestQuestion(e.target.value)}
                placeholder="e.g., What are your business hours?"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !testing) {
                    testKnowledge();
                  }
                }}
              />
              <Button onClick={testKnowledge} disabled={testing || !testQuestion.trim()}>
                {testing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Ask"
                )}
              </Button>
            </div>

            {testResponse && (
              <div className="p-4 rounded-lg bg-background border">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Brain className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium mb-1">Koya</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{testResponse}</p>
                  </div>
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Note: This tests against your current knowledge. Save changes first for accurate results.
            </p>
          </CardContent>
        </Card>
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
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => exportData("services")}
                  title="Export to CSV"
                  disabled={services.length === 0}
                >
                  <Download className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setImportType("services");
                    setImportDialogOpenCsv(true);
                  }}
                  title="Import from CSV"
                >
                  <Upload className="w-4 h-4" />
                </Button>
                <Button onClick={addService} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Service
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {services.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No services added yet. Click &quot;Add Service&quot; to get started.
              </div>
            ) : (
              <SortableList
                items={services}
                onReorder={(reordered) => {
                  setServices(reordered);
                  setServicesModified(true);
                }}
                renderItem={(service, index) => (
                  <div className="flex gap-4 p-4 border rounded-lg bg-muted/20">
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
                        <Label className="text-xs">{t("priceType")}</Label>
                        <Select
                          value={service.price_type}
                          onValueChange={(v) => updateService(index, { price_type: v as "fixed" | "quote" | "hidden" })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">{t("priceTypeFixed")}</SelectItem>
                            <SelectItem value="quote">{t("priceTypeQuote")}</SelectItem>
                            <SelectItem value="hidden">{t("priceTypeHidden")}</SelectItem>
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
                )}
              />
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
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => exportData("faqs")}
                  title="Export to CSV"
                  disabled={faqs.length === 0}
                >
                  <Download className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setImportType("faqs");
                    setImportDialogOpenCsv(true);
                  }}
                  title="Import from CSV"
                >
                  <Upload className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateFaqSuggestions}
                  disabled={suggesting}
                >
                  {suggesting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Wand2 className="w-4 h-4 mr-2" />
                  )}
                  Generate FAQs
                </Button>
                <Button onClick={addFaq} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add FAQ
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {faqs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No FAQs added yet. Click &quot;Add FAQ&quot; to get started.
              </div>
            ) : (
              <SortableList
                items={faqs}
                onReorder={(reordered) => {
                  setFaqs(reordered);
                  setFaqsModified(true);
                }}
                renderItem={(faq, index) => (
                  <div className="flex gap-4 p-4 border rounded-lg bg-muted/20">
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
                )}
              />
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
            <CardTitle>{t("businessInformation")}</CardTitle>
            <CardDescription>
              {t("businessInfoDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>{t("businessName")}</Label>
                <Input
                  value={business.name}
                  onChange={(e) => {
                    setBusiness({ ...business, name: e.target.value });
                    setBusinessModified(true);
                  }}
                />
              </div>
              <div>
                <Label>{t("website")}</Label>
                <Input
                  value={business.website || ""}
                  onChange={(e) => {
                    setBusiness({ ...business, website: e.target.value });
                    setBusinessModified(true);
                  }}
                  placeholder={t("websitePlaceholder")}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>{t("address")}</Label>
                <Input
                  value={business.address || ""}
                  onChange={(e) => {
                    setBusiness({ ...business, address: e.target.value });
                    setBusinessModified(true);
                  }}
                  placeholder={t("addressPlaceholder")}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>{t("serviceArea")}</Label>
                <Input
                  value={business.service_area || ""}
                  onChange={(e) => {
                    setBusiness({ ...business, service_area: e.target.value });
                    setBusinessModified(true);
                  }}
                  placeholder={t("serviceAreaPlaceholder")}
                />
              </div>
            </div>

            {/* Business Hours */}
            <div>
              <Label className="text-base font-medium">{t("businessHours")}</Label>
              <p className="text-sm text-muted-foreground mb-3">
                {t("businessHoursDesc")}
              </p>
              <div className="space-y-2">
                {DAY_KEYS.map((dayKey, dayIndex) => {
                  const hours = businessHours.find((h) => h.day_of_week === dayIndex) || {
                    day_of_week: dayIndex,
                    is_closed: true,
                    open_time: "09:00",
                    close_time: "17:00",
                  };

                  return (
                    <div key={dayIndex} className="flex items-center gap-4">
                      <div className="w-24 font-medium text-sm">{t(dayKey)}</div>
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
                          <span className="text-muted-foreground">{t("to")}</span>
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
                        <span className="text-sm text-muted-foreground">{t("closed")}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Languages */}
            <div>
              <Label className="text-base font-medium">{t("languages")}</Label>
              <div className="flex items-center gap-4 mt-2">
                <Badge variant="default">English</Badge>
                {spanishEnabled && <Badge variant="secondary">Español</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("languageSettingsNote")}
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
                {t("saveChanges")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Additional Knowledge Tab - Lines 743-746 */}
      {activeTab === "additional" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("additionalKnowledge")}</CardTitle>
            <CardDescription>
              {t("additionalKnowledgeDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Freeform notes */}
            <div>
              <Label>{t("additionalInformation")}</Label>
              <p className="text-sm text-muted-foreground mb-2">
                {t("additionalInfoDesc")}
              </p>
              <Textarea
                value={knowledge.content || ""}
                onChange={(e) => {
                  setKnowledge({ ...knowledge, content: e.target.value });
                  setKnowledgeModified(true);
                }}
                placeholder={t("additionalInfoPlaceholder")}
                rows={6}
              />
            </div>

            {/* Things not to say */}
            <div>
              <Label>{t("thingsNotToSay")}</Label>
              <p className="text-sm text-muted-foreground mb-2">
                {t("thingsNotToSayDesc")}
              </p>
              <Textarea
                value={knowledge.never_say || ""}
                onChange={(e) => {
                  setKnowledge({ ...knowledge, never_say: e.target.value });
                  setKnowledgeModified(true);
                }}
                placeholder={t("thingsNotToSayPlaceholder")}
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
                {t("saveChanges")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Offers Tab */}
      {activeTab === "offers" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              {t("offersAndUpsells")}
            </CardTitle>
            <CardDescription>
              {t("offersDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Sub-tabs */}
            <div className="flex flex-wrap gap-2 border-b pb-2">
              {[
                { id: "upsells" as const, label: t("serviceUpgrades") },
                { id: "bundles" as const, label: t("bundleDeals") },
                { id: "packages" as const, label: t("multiVisitPackages") },
                { id: "memberships" as const, label: t("memberships") },
                { id: "settings" as const, label: t("offerSettings") },
              ].map((subTab) => (
                <Button
                  key={subTab.id}
                  variant={offerSubTab === subTab.id ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setOfferSubTab(subTab.id)}
                >
                  {subTab.label}
                </Button>
              ))}
            </div>

            {/* Upsells Sub-Tab */}
            {offerSubTab === "upsells" && (
              <div className="space-y-6">
                {/* Loading state */}
                {upsellsLoading && (
                  <div className="text-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                    <p className="text-sm text-muted-foreground mt-2">{t("loadingUpsells")}</p>
                  </div>
                )}

                {/* No services warning */}
                {!upsellsLoading && services.length < 2 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {t("needTwoServices")}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Create new upsell form */}
                {!upsellsLoading && services.length >= 2 && (
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                    <h3 className="font-medium">{t("createNewUpsell")}</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t("whenBooking")}</Label>
                        <Select
                          value={newUpsell.source_service_id}
                          onValueChange={(value) => setNewUpsell({ ...newUpsell, source_service_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t("selectService")} />
                          </SelectTrigger>
                          <SelectContent>
                            {services.map((service) => (
                              <SelectItem key={service.id} value={service.id}>
                                {service.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>{t("suggestUpgradingTo")}</Label>
                        <Select
                          value={newUpsell.target_service_id}
                          onValueChange={(value) => setNewUpsell({ ...newUpsell, target_service_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t("selectUpgradeOption")} />
                          </SelectTrigger>
                          <SelectContent>
                            {services
                              .filter((s) => s.id !== newUpsell.source_service_id)
                              .map((service) => (
                                <SelectItem key={service.id} value={service.id}>
                                  {service.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t("discountPercentage")}</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={newUpsell.discount_percent || 0}
                            onChange={(e) =>
                              setNewUpsell({
                                ...newUpsell,
                                discount_percent: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)),
                              })
                            }
                            className="w-24"
                          />
                          <Percent className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">{t("offTheUpgrade")}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>{t("whenToSuggest")}</Label>
                        <Select
                          value={newUpsell.trigger_timing}
                          onValueChange={(value: "before_booking" | "after_booking") =>
                            setNewUpsell({ ...newUpsell, trigger_timing: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="before_booking">{t("beforeConfirmingBooking")}</SelectItem>
                            <SelectItem value="after_booking">{t("afterBookingConfirmed")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>{t("customPitchMessage")}</Label>
                      <Textarea
                        value={newUpsell.pitch_message || ""}
                        onChange={(e) => setNewUpsell({ ...newUpsell, pitch_message: e.target.value })}
                        placeholder={t("pitchMessagePlaceholder")}
                        rows={2}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="suggest-when-unavailable"
                        checked={newUpsell.suggest_when_unavailable || false}
                        onCheckedChange={(checked) =>
                          setNewUpsell({ ...newUpsell, suggest_when_unavailable: checked as boolean })
                        }
                      />
                      <Label htmlFor="suggest-when-unavailable" className="text-sm cursor-pointer">
                        {t("suggestWhenUnavailable")}
                      </Label>
                    </div>

                    <Button onClick={createUpsell} disabled={savingUpsell}>
                      {savingUpsell ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4 mr-2" />
                      )}
                      {t("createUpsell")}
                    </Button>
                  </div>
                )}

                {/* Existing upsells list */}
                {!upsellsLoading && upsells.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-medium">{t("activeUpsells")}</h3>
                    {upsells.map((upsell) => (
                      <div
                        key={upsell.id}
                        className={`p-4 border rounded-lg ${upsell.is_active ? "bg-background" : "bg-muted/50 opacity-60"}`}
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{upsell.source_service?.name || "Unknown"}</Badge>
                              <ArrowRight className="w-4 h-4 text-muted-foreground" />
                              <Badge variant="default">{upsell.target_service?.name || "Unknown"}</Badge>
                            </div>
                            {upsell.discount_percent > 0 && (
                              <Badge variant="secondary" className="bg-green-100 text-green-800">
                                {upsell.discount_percent}% off
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {upsell.trigger_timing === "before_booking" ? t("beforeBooking") : t("afterBooking")}
                            </Badge>
                            {upsell.suggest_when_unavailable && (
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                {t("availabilityAlternative")}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={upsell.is_active}
                              onCheckedChange={(checked) => updateUpsell({ ...upsell, is_active: checked })}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteUpsell(upsell.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        {upsell.pitch_message && (
                          <p className="text-sm text-muted-foreground mt-2 italic">
                            &quot;{upsell.pitch_message}&quot;
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty state */}
                {!upsellsLoading && upsells.length === 0 && services.length >= 2 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>{t("noUpsellsYet")}</p>
                    <p className="text-sm">{t("createFirstUpsell")}</p>
                  </div>
                )}
              </div>
            )}

            {/* Bundles Sub-Tab */}
            {offerSubTab === "bundles" && (
              <BundlesSection
                bundles={bundles}
                setBundles={setBundles}
                services={services}
                loading={bundlesLoading}
              />
            )}

            {/* Packages Sub-Tab */}
            {offerSubTab === "packages" && (
              <PackagesSection
                packages={packages}
                setPackages={setPackages}
                services={services}
                loading={packagesLoading}
              />
            )}

            {/* Memberships Sub-Tab */}
            {offerSubTab === "memberships" && (
              <MembershipsSection
                memberships={memberships}
                setMemberships={setMemberships}
                loading={membershipsLoading}
              />
            )}

            {/* Offer Settings Sub-Tab */}
            {offerSubTab === "settings" && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium">{t("offerSettingsTitle")}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t("offerSettingsDesc")}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label className="text-base">{t("serviceUpgrades")}</Label>
                        <p className="text-sm text-muted-foreground">{t("serviceUpgradesDesc")}</p>
                      </div>
                      <Switch
                        checked={offerSettings.upsellsEnabled}
                        onCheckedChange={(checked) => {
                          setOfferSettings({ ...offerSettings, upsellsEnabled: checked });
                          setOfferSettingsModified(true);
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label className="text-base">{t("bundleDeals")}</Label>
                        <p className="text-sm text-muted-foreground">{t("bundleDealsDesc")}</p>
                      </div>
                      <Switch
                        checked={offerSettings.bundlesEnabled}
                        onCheckedChange={(checked) => {
                          setOfferSettings({ ...offerSettings, bundlesEnabled: checked });
                          setOfferSettingsModified(true);
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label className="text-base">{t("multiVisitPackages")}</Label>
                        <p className="text-sm text-muted-foreground">{t("multiVisitPackagesDesc")}</p>
                      </div>
                      <Switch
                        checked={offerSettings.packagesEnabled}
                        onCheckedChange={(checked) => {
                          setOfferSettings({ ...offerSettings, packagesEnabled: checked });
                          setOfferSettingsModified(true);
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label className="text-base">{t("memberships")}</Label>
                        <p className="text-sm text-muted-foreground">{t("membershipsDesc")}</p>
                      </div>
                      <Switch
                        checked={offerSettings.membershipsEnabled}
                        onCheckedChange={(checked) => {
                          setOfferSettings({ ...offerSettings, membershipsEnabled: checked });
                          setOfferSettingsModified(true);
                        }}
                      />
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end pt-4">
                    <Button onClick={saveOfferSettings} disabled={savingOfferSettings || !offerSettingsModified}>
                      {savingOfferSettings ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      {t("saveSettings")}
                    </Button>
                  </div>
                </div>
              </div>
            )}
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
              {t("importContentFromWebsite")}
            </DialogTitle>
            <DialogDescription>
              {t("importWebsiteDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* URL Input */}
            <div className="space-y-2">
              <Label htmlFor="website-url">{t("websiteUrl")}</Label>
              <div className="flex gap-2">
                <Input
                  id="website-url"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder={t("websitePlaceholder")}
                  disabled={importing}
                />
                <Button onClick={scrapeWebsite} disabled={importing || !importUrl.trim()}>
                  {importing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    t("analyze")
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

      {/* FAQ Suggestion Dialog */}
      <Dialog open={suggestDialogOpen} onOpenChange={setSuggestDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-primary" />
              AI-Generated FAQ Suggestions
            </DialogTitle>
            <DialogDescription>
              Select the FAQs you want to add to your knowledge base.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {suggestedFaqs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No suggestions available. Add some services first!</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {selectedSuggestions.size} of {suggestedFaqs.length} selected
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (selectedSuggestions.size === suggestedFaqs.length) {
                        setSelectedSuggestions(new Set());
                      } else {
                        setSelectedSuggestions(new Set(suggestedFaqs.map((_, i) => i)));
                      }
                    }}
                  >
                    {selectedSuggestions.size === suggestedFaqs.length ? "Deselect All" : "Select All"}
                  </Button>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {suggestedFaqs.map((faq, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        selectedSuggestions.has(index)
                          ? "bg-primary/5 border-primary"
                          : "bg-muted/30 hover:bg-muted/50"
                      }`}
                      onClick={() => toggleSuggestionSelection(index)}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedSuggestions.has(index)}
                          onCheckedChange={() => toggleSuggestionSelection(index)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0 space-y-2">
                          <p className="font-medium text-sm">{faq.question}</p>
                          <p className="text-sm text-muted-foreground">
                            {faq.answer}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => setSuggestDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={applySuggestedFaqs}
                    disabled={selectedSuggestions.size === 0}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Add {selectedSuggestions.size} FAQs
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={importDialogOpenCsv} onOpenChange={setImportDialogOpenCsv}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Import {importType === "services" ? "Services" : "FAQs"} from CSV
            </DialogTitle>
            <DialogDescription>
              Upload a CSV file to bulk import {importType}.
              {importType === "services"
                ? " Expected columns: Name, Description, Duration (minutes), Price ($), Price Type, Bookable"
                : " Expected columns: Question, Answer"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
              <Label
                htmlFor="csv-upload"
                className="cursor-pointer text-primary hover:underline"
              >
                {importingCsv ? "Importing..." : "Click to select a CSV file"}
              </Label>
              <input
                id="csv-upload"
                type="file"
                accept=".csv"
                onChange={handleCsvImport}
                disabled={importingCsv}
                className="hidden"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Maximum 500 rows per import
              </p>
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button
                variant="link"
                size="sm"
                onClick={() => exportData(importType)}
                className="text-muted-foreground"
              >
                <Download className="w-4 h-4 mr-1" />
                Download template
              </Button>
              <Button variant="outline" onClick={() => setImportDialogOpenCsv(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================================================
// Bundles Section Component
// =============================================================================

interface BundlesSectionProps {
  bundles: Bundle[];
  setBundles: React.Dispatch<React.SetStateAction<Bundle[]>>;
  services: Service[];
  loading: boolean;
}

function BundlesSection({ bundles, setBundles, services, loading }: BundlesSectionProps) {
  const t = useTranslations("knowledge");
  const [saving, setSaving] = useState(false);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [newBundle, setNewBundle] = useState({
    name: "",
    description: "",
    discount_percent: 10,
    pitch_message: "",
  });

  const createBundle = async () => {
    if (!newBundle.name.trim()) {
      toast({ title: "Please enter a bundle name", variant: "warning" });
      return;
    }
    if (selectedServices.length < 2) {
      toast({ title: "A bundle must include at least 2 services", variant: "warning" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/knowledge/bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newBundle,
          service_ids: selectedServices,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create bundle");
      }

      const data = await res.json();
      setBundles([data.bundle, ...bundles]);
      setNewBundle({ name: "", description: "", discount_percent: 10, pitch_message: "" });
      setSelectedServices([]);
      toast({ title: "Bundle created", variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to create bundle", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteBundle = async (id: string) => {
    try {
      const res = await fetch(`/api/dashboard/knowledge/bundles?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete bundle");
      setBundles(bundles.filter((b) => b.id !== id));
      toast({ title: "Bundle deleted", variant: "success" });
    } catch (_err) {
      toast({ title: "Failed to delete bundle", variant: "destructive" });
    }
  };

  const toggleBundleActive = async (bundle: Bundle) => {
    try {
      const res = await fetch("/api/dashboard/knowledge/bundles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundle: { ...bundle, is_active: !bundle.is_active } }),
      });
      if (!res.ok) throw new Error("Failed to update bundle");
      setBundles(bundles.map((b) => (b.id === bundle.id ? { ...b, is_active: !b.is_active } : b)));
    } catch (_err) {
      toast({ title: "Failed to update bundle", variant: "destructive" });
    }
  };

  const toggleServiceInBundle = (serviceId: string) => {
    setSelectedServices((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    );
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
        <p className="text-sm text-muted-foreground mt-2">{t("loadingBundles")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {services.length < 2 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t("needTwoServices")}
          </AlertDescription>
        </Alert>
      )}

      {services.length >= 2 && (
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <h3 className="font-medium">{t("createNewBundle")}</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("bundleName")}</Label>
              <Input
                value={newBundle.name}
                onChange={(e) => setNewBundle({ ...newBundle, name: e.target.value })}
                placeholder={t("bundleNamePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("discount")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={newBundle.discount_percent}
                  onChange={(e) =>
                    setNewBundle({
                      ...newBundle,
                      discount_percent: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)),
                    })
                  }
                  className="w-24"
                />
                <Percent className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{t("offCombinedPrice")}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("selectServicesMin2")}</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2 border rounded-lg bg-background">
              {services.map((service) => (
                <div
                  key={service.id}
                  className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                    selectedServices.includes(service.id) ? "bg-primary/10" : "hover:bg-muted"
                  }`}
                  onClick={() => toggleServiceInBundle(service.id)}
                >
                  <Checkbox checked={selectedServices.includes(service.id)} />
                  <span className="text-sm truncate">{service.name}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedServices.length} {t("servicesSelected")}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t("pitchMessageOptional")}</Label>
            <Textarea
              value={newBundle.pitch_message}
              onChange={(e) => setNewBundle({ ...newBundle, pitch_message: e.target.value })}
              placeholder={t("bundlePitchPlaceholder")}
              rows={2}
            />
          </div>

          <Button onClick={createBundle} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            {t("createBundle")}
          </Button>
        </div>
      )}

      {bundles.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium">{t("activeBundles")}</h3>
          {bundles.map((bundle) => (
            <div
              key={bundle.id}
              className={`p-4 border rounded-lg ${bundle.is_active ? "bg-background" : "bg-muted/50 opacity-60"}`}
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{bundle.name}</span>
                    {bundle.discount_percent > 0 && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        {bundle.discount_percent}% off
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {bundle.services.map((s) => (
                      <Badge key={s.id} variant="outline" className="text-xs">
                        {s.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={bundle.is_active} onCheckedChange={() => toggleBundleActive(bundle)} />
                  <Button variant="ghost" size="icon" onClick={() => deleteBundle(bundle.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
              {bundle.pitch_message && (
                <p className="text-sm text-muted-foreground mt-2 italic">&quot;{bundle.pitch_message}&quot;</p>
              )}
            </div>
          ))}
        </div>
      )}

      {bundles.length === 0 && services.length >= 2 && (
        <div className="text-center py-8 text-muted-foreground">
          <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{t("noBundlesYet")}</p>
          <p className="text-sm">{t("createFirstBundle")}</p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Packages Section Component
// =============================================================================

interface PackagesSectionProps {
  packages: Package[];
  setPackages: React.Dispatch<React.SetStateAction<Package[]>>;
  services: Service[];
  loading: boolean;
}

function PackagesSection({ packages, setPackages, services, loading }: PackagesSectionProps) {
  const t = useTranslations("knowledge");
  const [saving, setSaving] = useState(false);
  const [newPackage, setNewPackage] = useState({
    name: "",
    service_id: "",
    session_count: 5,
    discount_percent: 20,
    validity_days: 365,
    pitch_message: "",
    min_visits_to_pitch: 3,
  });

  const createPackage = async () => {
    if (!newPackage.name.trim()) {
      toast({ title: "Please enter a package name", variant: "warning" });
      return;
    }
    if (newPackage.session_count < 2) {
      toast({ title: "A package must have at least 2 sessions", variant: "warning" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/knowledge/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newPackage,
          service_id: newPackage.service_id || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create package");
      }

      const data = await res.json();
      setPackages([data.package, ...packages]);
      setNewPackage({
        name: "",
        service_id: "",
        session_count: 5,
        discount_percent: 20,
        validity_days: 365,
        pitch_message: "",
        min_visits_to_pitch: 3,
      });
      toast({ title: "Package created", variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to create package", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deletePackage = async (id: string) => {
    try {
      const res = await fetch(`/api/dashboard/knowledge/packages?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete package");
      setPackages(packages.filter((p) => p.id !== id));
      toast({ title: "Package deleted", variant: "success" });
    } catch (_err) {
      toast({ title: "Failed to delete package", variant: "destructive" });
    }
  };

  const togglePackageActive = async (pkg: Package) => {
    try {
      const res = await fetch("/api/dashboard/knowledge/packages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ package: { ...pkg, is_active: !pkg.is_active } }),
      });
      if (!res.ok) throw new Error("Failed to update package");
      setPackages(packages.map((p) => (p.id === pkg.id ? { ...p, is_active: !p.is_active } : p)));
    } catch (_err) {
      toast({ title: "Failed to update package", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
        <p className="text-sm text-muted-foreground mt-2">{t("loadingPackages")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
        <h3 className="font-medium">{t("createNewPackage")}</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("packageName")}</Label>
            <Input
              value={newPackage.name}
              onChange={(e) => setNewPackage({ ...newPackage, name: e.target.value })}
              placeholder={t("packageNamePlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("applicableServiceOptional")}</Label>
            <Select
              value={newPackage.service_id || "__all__"}
              onValueChange={(value) => setNewPackage({ ...newPackage, service_id: value === "__all__" ? "" : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("allServices")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t("allServices")}</SelectItem>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>{t("numberOfSessions")}</Label>
            <Input
              type="number"
              min="2"
              max="100"
              value={newPackage.session_count}
              onChange={(e) =>
                setNewPackage({ ...newPackage, session_count: Math.max(2, parseInt(e.target.value) || 2) })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>{t("discount")}</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                max="100"
                value={newPackage.discount_percent}
                onChange={(e) =>
                  setNewPackage({
                    ...newPackage,
                    discount_percent: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)),
                  })
                }
                className="w-24"
              />
              <Percent className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("validForDays")}</Label>
            <Input
              type="number"
              min="30"
              max="730"
              value={newPackage.validity_days}
              onChange={(e) =>
                setNewPackage({ ...newPackage, validity_days: Math.max(30, parseInt(e.target.value) || 365) })
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("pitchAfterVisits")}</Label>
          <Input
            type="number"
            min="0"
            max="10"
            value={newPackage.min_visits_to_pitch}
            onChange={(e) =>
              setNewPackage({ ...newPackage, min_visits_to_pitch: Math.max(0, parseInt(e.target.value) || 0) })
            }
            className="w-24"
          />
          <p className="text-xs text-muted-foreground">{t("pitchAfterVisitsHint")}</p>
        </div>

        <div className="space-y-2">
          <Label>{t("packagePitchMessage")}</Label>
          <Textarea
            value={newPackage.pitch_message}
            onChange={(e) => setNewPackage({ ...newPackage, pitch_message: e.target.value })}
            placeholder={t("packagePitchPlaceholder")}
            rows={2}
          />
        </div>

        <Button onClick={createPackage} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
          {t("createPackage")}
        </Button>
      </div>

      {packages.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium">{t("activePackages")}</h3>
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`p-4 border rounded-lg ${pkg.is_active ? "bg-background" : "bg-muted/50 opacity-60"}`}
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{pkg.name}</span>
                    <Badge variant="outline">{pkg.session_count} {t("sessions")}</Badge>
                    {pkg.discount_percent > 0 && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        {pkg.discount_percent}% off
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {pkg.service?.name || t("allServices")} • {t("validFor")} {pkg.validity_days || 365} {t("days")}
                    {pkg.min_visits_to_pitch > 0 && ` • ${t("pitchAfter")} ${pkg.min_visits_to_pitch} ${t("visits")}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={pkg.is_active} onCheckedChange={() => togglePackageActive(pkg)} />
                  <Button variant="ghost" size="icon" onClick={() => deletePackage(pkg.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
              {pkg.pitch_message && (
                <p className="text-sm text-muted-foreground mt-2 italic">&quot;{pkg.pitch_message}&quot;</p>
              )}
            </div>
          ))}
        </div>
      )}

      {packages.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{t("noPackagesYet")}</p>
          <p className="text-sm">{t("createFirstPackage")}</p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Memberships Section Component
// =============================================================================

interface MembershipsSectionProps {
  memberships: Membership[];
  setMemberships: React.Dispatch<React.SetStateAction<Membership[]>>;
  loading: boolean;
}

function MembershipsSection({ memberships, setMemberships, loading }: MembershipsSectionProps) {
  const t = useTranslations("knowledge");
  const [saving, setSaving] = useState(false);
  const [newMembership, setNewMembership] = useState({
    name: "",
    price_cents: 9900,
    billing_period: "monthly" as "monthly" | "quarterly" | "annual",
    benefits: "",
    pitch_message: "",
    pitch_after_booking_amount_cents: 10000,
    pitch_after_visit_count: 3,
  });

  const createMembership = async () => {
    if (!newMembership.name.trim()) {
      toast({ title: "Please enter a membership name", variant: "warning" });
      return;
    }
    if (!newMembership.benefits.trim()) {
      toast({ title: "Please describe the membership benefits", variant: "warning" });
      return;
    }
    if (newMembership.price_cents <= 0) {
      toast({ title: "Please enter a valid price", variant: "warning" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/knowledge/memberships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMembership),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create membership");
      }

      const data = await res.json();
      setMemberships([data.membership, ...memberships]);
      setNewMembership({
        name: "",
        price_cents: 9900,
        billing_period: "monthly",
        benefits: "",
        pitch_message: "",
        pitch_after_booking_amount_cents: 10000,
        pitch_after_visit_count: 3,
      });
      toast({ title: "Membership created", variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to create membership", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteMembership = async (id: string) => {
    try {
      const res = await fetch(`/api/dashboard/knowledge/memberships?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete membership");
      setMemberships(memberships.filter((m) => m.id !== id));
      toast({ title: "Membership deleted", variant: "success" });
    } catch (_err) {
      toast({ title: "Failed to delete membership", variant: "destructive" });
    }
  };

  const toggleMembershipActive = async (membership: Membership) => {
    try {
      const res = await fetch("/api/dashboard/knowledge/memberships", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membership: { ...membership, is_active: !membership.is_active } }),
      });
      if (!res.ok) throw new Error("Failed to update membership");
      setMemberships(memberships.map((m) => (m.id === membership.id ? { ...m, is_active: !m.is_active } : m)));
    } catch (_err) {
      toast({ title: "Failed to update membership", variant: "destructive" });
    }
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
        <p className="text-sm text-muted-foreground mt-2">{t("loadingMemberships")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
        <h3 className="font-medium">{t("createNewMembership")}</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>{t("membershipName")}</Label>
            <Input
              value={newMembership.name}
              onChange={(e) => setNewMembership({ ...newMembership, name: e.target.value })}
              placeholder={t("membershipNamePlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("price")}</Label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">$</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={(newMembership.price_cents / 100).toFixed(2)}
                onChange={(e) =>
                  setNewMembership({
                    ...newMembership,
                    price_cents: Math.round(parseFloat(e.target.value || "0") * 100),
                  })
                }
                className="w-28"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("billingPeriod")}</Label>
            <Select
              value={newMembership.billing_period}
              onValueChange={(value: "monthly" | "quarterly" | "annual") =>
                setNewMembership({ ...newMembership, billing_period: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">{t("monthly")}</SelectItem>
                <SelectItem value="quarterly">{t("quarterly")}</SelectItem>
                <SelectItem value="annual">{t("annual")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("benefitsDescription")}</Label>
          <Textarea
            value={newMembership.benefits}
            onChange={(e) => setNewMembership({ ...newMembership, benefits: e.target.value })}
            placeholder={t("benefitsPlaceholder")}
            rows={2}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("pitchAfterBookingAmount")}</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={(newMembership.pitch_after_booking_amount_cents / 100).toFixed(2)}
              onChange={(e) =>
                setNewMembership({
                  ...newMembership,
                  pitch_after_booking_amount_cents: Math.round(parseFloat(e.target.value || "0") * 100),
                })
              }
              className="w-28"
            />
            <p className="text-xs text-muted-foreground">{t("pitchAfterBookingAmountHint")}</p>
          </div>
          <div className="space-y-2">
            <Label>{t("pitchAfterVisitCountLabel")}</Label>
            <Input
              type="number"
              min="0"
              max="20"
              value={newMembership.pitch_after_visit_count}
              onChange={(e) =>
                setNewMembership({ ...newMembership, pitch_after_visit_count: Math.max(0, parseInt(e.target.value) || 0) })
              }
              className="w-24"
            />
            <p className="text-xs text-muted-foreground">{t("pitchAfterVisitCountHint")}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("membershipPitchMessage")}</Label>
          <Textarea
            value={newMembership.pitch_message}
            onChange={(e) => setNewMembership({ ...newMembership, pitch_message: e.target.value })}
            placeholder={t("membershipPitchPlaceholder")}
            rows={2}
          />
        </div>

        <Button onClick={createMembership} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
          {t("createMembership")}
        </Button>
      </div>

      {memberships.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium">{t("activeMemberships")}</h3>
          {memberships.map((membership) => (
            <div
              key={membership.id}
              className={`p-4 border rounded-lg ${membership.is_active ? "bg-background" : "bg-muted/50 opacity-60"}`}
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{membership.name}</span>
                    <Badge variant="default">{formatPrice(membership.price_cents)}{membership.billing_period === "monthly" ? t("perMonth") : membership.billing_period === "quarterly" ? t("perQuarter") : t("perYear")}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{membership.benefits}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("pitchAfter")} {formatPrice(membership.pitch_after_booking_amount_cents || 0)} {t("bookingOr")} {membership.pitch_after_visit_count || 0} {t("visits")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={membership.is_active} onCheckedChange={() => toggleMembershipActive(membership)} />
                  <Button variant="ghost" size="icon" onClick={() => deleteMembership(membership.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
              {membership.pitch_message && (
                <p className="text-sm text-muted-foreground mt-2 italic">&quot;{membership.pitch_message}&quot;</p>
              )}
            </div>
          ))}
        </div>
      )}

      {memberships.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{t("noMembershipsYet")}</p>
          <p className="text-sm">{t("createFirstMembership")}</p>
        </div>
      )}
    </div>
  );
}
