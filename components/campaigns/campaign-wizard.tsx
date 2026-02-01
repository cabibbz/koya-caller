"use client";

/**
 * Campaign Wizard Component
 * Step-by-step campaign creation workflow
 */

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Phone,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Check,
  Calendar,
  Users,
  MessageSquare,
  AlertCircle,
  Mail,
  Sparkles,
  ChevronDown,
  Megaphone,
  Clock,
  PhoneCall,
} from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Label,
  Textarea,
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
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

interface Contact {
  id: string;
  name: string;
  phone_number: string;
  email?: string;
}

interface PhoneNumber {
  id: string;
  number: string;
  is_active: boolean;
  setup_type?: string;
}

type CampaignChannel = "email" | "call";
type CallPurpose = "reminder" | "follow_up" | "marketing";

interface CampaignData {
  name: string;
  description: string;
  channel: CampaignChannel;
  call_purpose: CallPurpose;
  from_number: string;
  scheduled_start: string;
  scheduled_end: string;
  custom_message: string;
  ai_traits: string[];
  contact_ids: string[];
  settings: {
    daily_limit: number;
    retry_failed: boolean;
    max_retries: number;
  };
  email_subject: string;
  email_body: string;
}

// AI personality traits for call campaigns
const AI_TRAITS = [
  {
    id: "friendly",
    name: "Friendly",
    description: "Warm and builds rapport",
    prompt: "Be warm and friendly. Use casual language and build rapport quickly. Smile through your voice. Use the customer's name naturally.",
  },
  {
    id: "professional",
    name: "Professional",
    description: "Business-like and to the point",
    prompt: "Maintain a professional and business-like tone. Be concise and respect the customer's time. Stick to the facts.",
  },
  {
    id: "empathetic",
    name: "Empathetic",
    description: "Understanding and patient",
    prompt: "Be highly empathetic and patient. Listen actively to customer concerns and acknowledge their feelings.",
  },
  {
    id: "persuasive",
    name: "Persuasive",
    description: "Handles objections confidently",
    prompt: "Be confident when handling objections. Redirect to the value proposition. Use phrases like 'I understand, but consider this...'",
  },
];

const STEPS = [
  { id: 1, title: "Type", icon: Megaphone, description: "Choose campaign type" },
  { id: 2, title: "Audience", icon: Users, description: "Select recipients" },
  { id: 3, title: "Content", icon: MessageSquare, description: "Create your message" },
  { id: 4, title: "Schedule", icon: Calendar, description: "Set timing" },
  { id: 5, title: "Review", icon: Check, description: "Confirm and launch" },
];

const INITIAL_DATA: CampaignData = {
  name: "",
  description: "",
  channel: "email",
  call_purpose: "reminder",
  from_number: "",
  scheduled_start: "",
  scheduled_end: "",
  custom_message: "",
  ai_traits: ["friendly"],
  contact_ids: [],
  settings: {
    daily_limit: 100,
    retry_failed: true,
    max_retries: 2,
  },
  email_subject: "",
  email_body: "",
};

// =============================================================================
// Component
// =============================================================================

export function CampaignWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<CampaignData>(INITIAL_DATA);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Phone numbers state for call campaigns
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [loadingPhoneNumbers, setLoadingPhoneNumbers] = useState(false);

  // AI Generation state for email campaigns
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiTone, setAiTone] = useState<"professional" | "friendly" | "casual" | "urgent">("professional");
  const [aiPurpose, setAiPurpose] = useState<"marketing" | "follow_up" | "reminder" | "announcement" | "thank_you" | "general">("marketing");
  const [generatingAi, setGeneratingAi] = useState(false);

  // =============================================================================
  // Data Fetching
  // =============================================================================

  const fetchContacts = async () => {
    setLoadingContacts(true);
    try {
      const response = await fetch("/api/dashboard/contacts?limit=500");
      const result = await response.json();
      if (result.success) {
        setContacts(result.data.contacts || []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingContacts(false);
    }
  };

  const fetchPhoneNumbers = async () => {
    setLoadingPhoneNumbers(true);
    try {
      const response = await fetch("/api/dashboard/phone-numbers");
      const result = await response.json();
      if (result.success && result.data) {
        // The API returns all numbers, filter for active ones
        const activeNumbers = result.data.filter((p: PhoneNumber) => p.is_active);
        setPhoneNumbers(activeNumbers);
        // Auto-select first phone number if available
        if (activeNumbers.length > 0 && !data.from_number) {
          updateData("from_number", activeNumbers[0].number);
        }
      }
    } catch {
      // Silently fail - user will see "no phone numbers" message
    } finally {
      setLoadingPhoneNumbers(false);
    }
  };

  useEffect(() => {
    fetchContacts();
    fetchPhoneNumbers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter contacts based on campaign channel
  const availableContacts = useMemo(() => {
    return contacts.filter((contact) => {
      if (data.channel === "email") {
        return contact.email && contact.email.trim() !== "";
      } else {
        return contact.phone_number && contact.phone_number.trim() !== "";
      }
    });
  }, [contacts, data.channel]);

  const filteredContacts = useMemo(() => {
    if (!searchQuery) return availableContacts;
    const query = searchQuery.toLowerCase();
    return availableContacts.filter((contact) =>
      contact.name?.toLowerCase().includes(query) ||
      contact.phone_number?.includes(query) ||
      contact.email?.toLowerCase().includes(query)
    );
  }, [availableContacts, searchQuery]);

  // =============================================================================
  // Handlers
  // =============================================================================

  const updateData = <K extends keyof CampaignData>(key: K, value: CampaignData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const updateSettings = (key: keyof CampaignData["settings"], value: number | boolean) => {
    setData((prev) => ({
      ...prev,
      settings: { ...prev.settings, [key]: value },
    }));
  };

  const toggleContact = (contactId: string) => {
    setData((prev) => ({
      ...prev,
      contact_ids: prev.contact_ids.includes(contactId)
        ? prev.contact_ids.filter((id) => id !== contactId)
        : [...prev.contact_ids, contactId],
    }));
  };

  const selectAllContacts = () => {
    const filteredIds = filteredContacts.map((c) => c.id);
    setData((prev) => ({
      ...prev,
      contact_ids: Array.from(new Set([...prev.contact_ids, ...filteredIds])),
    }));
  };

  const deselectAllContacts = () => {
    const filteredIds = filteredContacts.map((c) => c.id);
    setData((prev) => ({
      ...prev,
      contact_ids: prev.contact_ids.filter((id) => !filteredIds.includes(id)),
    }));
  };

  // Clear contact selection when channel changes
  const handleChannelChange = (channel: CampaignChannel) => {
    updateData("channel", channel);
    updateData("contact_ids", []);
  };

  const handleGenerateAi = async () => {
    if (!aiPrompt.trim() || aiPrompt.trim().length < 10) {
      toast({
        title: "Description needed",
        description: "Please describe what you want the email to say (at least 10 characters)",
        variant: "destructive",
      });
      return;
    }

    setGeneratingAi(true);
    try {
      const response = await fetch("/api/dashboard/ai/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt,
          tone: aiTone,
          purpose: aiPurpose,
          includeCallToAction: true,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to generate email");
      }

      setData((prev) => ({
        ...prev,
        email_subject: result.subject,
        email_body: result.body,
      }));
      setShowAiPanel(false);
      setAiPrompt("");

      toast({
        title: "Email generated",
        description: "AI has created your email content. Feel free to edit it.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Could not generate email",
        variant: "destructive",
      });
    } finally {
      setGeneratingAi(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        // For call campaigns, require a phone number
        if (data.channel === "call") {
          return data.name.trim().length > 0 && data.from_number.trim().length > 0;
        }
        return data.name.trim().length > 0;
      case 2:
        return data.contact_ids.length > 0;
      case 3:
        if (data.channel === "email") {
          return data.email_subject.trim().length > 0 && data.email_body.trim().length > 0;
        }
        return true;
      case 4:
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSave = async (startImmediately: boolean = false) => {
    setSaving(true);
    try {
      // Build AI instructions from traits + custom message (for call campaigns)
      const traitInstructions = (data.ai_traits || [])
        .map((traitId) => AI_TRAITS.find((t) => t.id === traitId)?.prompt)
        .filter(Boolean)
        .join("\n\n");

      const fullInstructions = [traitInstructions, data.custom_message]
        .filter(Boolean)
        .join("\n\n---\n\n");

      // Map channel + purpose to API type
      let apiType: string;
      if (data.channel === "email") {
        apiType = "email";
      } else {
        apiType = data.call_purpose === "reminder" ? "appointment_reminder" : data.call_purpose;
      }

      const requestBody: Record<string, unknown> = {
        name: data.name,
        description: data.description,
        type: apiType,
        scheduled_start: data.scheduled_start || null,
        scheduled_end: data.scheduled_end || null,
        contact_ids: data.contact_ids,
      };

      if (data.channel === "email") {
        requestBody.settings = {
          email_subject: data.email_subject,
          email_body: data.email_body,
        };
      } else {
        // Include from_number for call campaigns
        requestBody.from_number = data.from_number || null;
        requestBody.custom_message = fullInstructions || null;
        requestBody.settings = {
          ...data.settings,
          ai_traits: data.ai_traits || [],
        };
      }

      const response = await fetch("/api/dashboard/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create campaign");
      }

      if (startImmediately && result.data?.id) {
        // Start the campaign
        await fetch(`/api/dashboard/campaigns/${result.data.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start" }),
        });

        // For call campaigns, auto-process the queue to begin making calls
        if (data.channel === "call") {
          // Small delay to ensure queue is populated
          await new Promise(resolve => setTimeout(resolve, 500));

          const processResponse = await fetch(`/api/dashboard/campaigns/${result.data.id}/process`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });

          if (!processResponse.ok) {
            const processResult = await processResponse.json();
            // Show warning but don't fail - campaign is still created
            const errorMessage = processResult.error?.message || processResult.error || "Campaign started but calls may need manual processing.";
            toast({
              title: "Campaign Started with Warning",
              description: errorMessage,
              variant: "destructive",
            });
            router.push("/campaigns");
            return;
          }
        }
      }

      toast({
        title: "Success",
        description: startImmediately
          ? data.channel === "call"
            ? "Campaign started! Calls are being processed."
            : "Campaign created and started!"
          : "Campaign created successfully",
        variant: "success",
      });

      router.push("/campaigns");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create campaign",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // =============================================================================
  // Render Steps
  // =============================================================================

  const renderStep = () => {
    switch (currentStep) {
      // =========================================================================
      // STEP 1: Campaign Type
      // =========================================================================
      case 1:
        return (
          <div className="space-y-6">
            {/* Campaign Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name *</Label>
              <Input
                id="name"
                placeholder="e.g., January Newsletter, Appointment Reminders"
                value={data.name}
                onChange={(e) => updateData("name", e.target.value)}
              />
            </div>

            {/* Channel Selection - Clear Two Options */}
            <div className="space-y-3">
              <Label>How do you want to reach your contacts? *</Label>
              <div className="grid grid-cols-2 gap-4">
                {/* Email Campaign */}
                <button
                  type="button"
                  onClick={() => handleChannelChange("email")}
                  className={cn(
                    "relative flex flex-col items-center p-6 border-2 rounded-xl transition-all",
                    data.channel === "email"
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "w-14 h-14 rounded-full flex items-center justify-center mb-3",
                    data.channel === "email" ? "bg-primary/10" : "bg-muted"
                  )}>
                    <Mail className={cn(
                      "h-7 w-7",
                      data.channel === "email" ? "text-primary" : "text-muted-foreground"
                    )} />
                  </div>
                  <span className="font-semibold text-lg">Email</span>
                  <span className="text-sm text-muted-foreground text-center mt-1">
                    Send emails to your contacts
                  </span>
                  {data.channel === "email" && (
                    <div className="absolute top-3 right-3">
                      <Check className="h-5 w-5 text-primary" />
                    </div>
                  )}
                </button>

                {/* Phone Call Campaign */}
                <button
                  type="button"
                  onClick={() => handleChannelChange("call")}
                  className={cn(
                    "relative flex flex-col items-center p-6 border-2 rounded-xl transition-all",
                    data.channel === "call"
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "w-14 h-14 rounded-full flex items-center justify-center mb-3",
                    data.channel === "call" ? "bg-primary/10" : "bg-muted"
                  )}>
                    <PhoneCall className={cn(
                      "h-7 w-7",
                      data.channel === "call" ? "text-primary" : "text-muted-foreground"
                    )} />
                  </div>
                  <span className="font-semibold text-lg">Phone Call</span>
                  <span className="text-sm text-muted-foreground text-center mt-1">
                    AI calls your contacts
                  </span>
                  {data.channel === "call" && (
                    <div className="absolute top-3 right-3">
                      <Check className="h-5 w-5 text-primary" />
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Call Purpose - Only shown for call campaigns */}
            {data.channel === "call" && (
              <div className="space-y-3 pt-2">
                <Label>What&apos;s the purpose of these calls?</Label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => updateData("call_purpose", "reminder")}
                    className={cn(
                      "flex flex-col items-center p-4 border rounded-lg transition-all",
                      data.call_purpose === "reminder"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <Clock className={cn(
                      "h-5 w-5 mb-2",
                      data.call_purpose === "reminder" ? "text-primary" : "text-muted-foreground"
                    )} />
                    <span className="font-medium text-sm">Reminders</span>
                    <span className="text-xs text-muted-foreground text-center">
                      Appointment reminders
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateData("call_purpose", "follow_up")}
                    className={cn(
                      "flex flex-col items-center p-4 border rounded-lg transition-all",
                      data.call_purpose === "follow_up"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <Phone className={cn(
                      "h-5 w-5 mb-2",
                      data.call_purpose === "follow_up" ? "text-primary" : "text-muted-foreground"
                    )} />
                    <span className="font-medium text-sm">Follow-ups</span>
                    <span className="text-xs text-muted-foreground text-center">
                      Check-in after visits
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateData("call_purpose", "marketing")}
                    className={cn(
                      "flex flex-col items-center p-4 border rounded-lg transition-all",
                      data.call_purpose === "marketing"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <Megaphone className={cn(
                      "h-5 w-5 mb-2",
                      data.call_purpose === "marketing" ? "text-primary" : "text-muted-foreground"
                    )} />
                    <span className="font-medium text-sm">Marketing</span>
                    <span className="text-xs text-muted-foreground text-center">
                      Promotions & offers
                    </span>
                  </button>
                </div>

                {/* Phone Number Selection */}
                <div className="space-y-2 pt-4 border-t mt-4">
                  <Label>Outbound Phone Number *</Label>
                  {loadingPhoneNumbers ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading phone numbers...
                    </div>
                  ) : phoneNumbers.length === 0 ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="flex items-center justify-between gap-4">
                        <span>No active phone numbers found. You need to add a phone number to make calls.</span>
                        <a
                          href="/settings?tab=phone-billing"
                          className="text-sm font-medium underline whitespace-nowrap hover:no-underline"
                        >
                          Go to Settings
                        </a>
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      <Select
                        value={data.from_number}
                        onValueChange={(v) => updateData("from_number", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a phone number" />
                        </SelectTrigger>
                        <SelectContent>
                          {phoneNumbers.map((phone) => (
                            <SelectItem key={phone.id} value={phone.number}>
                              {phone.number}
                              {phone.setup_type && (
                                <span className="text-muted-foreground ml-2">
                                  ({phone.setup_type})
                                </span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        This number will be used for all outbound calls in this campaign.
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Optional Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Add notes about this campaign..."
                value={data.description}
                onChange={(e) => updateData("description", e.target.value)}
                rows={2}
              />
            </div>
          </div>
        );

      // =========================================================================
      // STEP 2: Audience Selection
      // =========================================================================
      case 2:
        return (
          <div className="space-y-4">
            {/* Header with count */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Select Recipients</Label>
                <p className="text-sm text-muted-foreground">
                  {data.contact_ids.length} of {availableContacts.length} contacts selected
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={selectAllContacts}>
                  Select All
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={deselectAllContacts}>
                  Clear
                </Button>
              </div>
            </div>

            {/* Info about filtered contacts */}
            {data.channel === "email" && contacts.length > availableContacts.length && (
              <Alert>
                <Mail className="h-4 w-4" />
                <AlertDescription>
                  Showing {availableContacts.length} contacts with email addresses.
                  {contacts.length - availableContacts.length} contacts without email are hidden.
                </AlertDescription>
              </Alert>
            )}
            {data.channel === "call" && contacts.length > availableContacts.length && (
              <Alert>
                <Phone className="h-4 w-4" />
                <AlertDescription>
                  Showing {availableContacts.length} contacts with phone numbers.
                  {contacts.length - availableContacts.length} contacts without phone are hidden.
                </AlertDescription>
              </Alert>
            )}

            {/* Search */}
            <Input
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {/* Contact List */}
            {loadingContacts ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : availableContacts.length === 0 ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {data.channel === "email"
                    ? "No contacts with email addresses found. Add emails to your contacts first."
                    : "No contacts with phone numbers found. Add phone numbers to your contacts first."}
                </AlertDescription>
              </Alert>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No contacts match your search.
              </div>
            ) : (
              <div className="max-h-[350px] overflow-y-auto border rounded-lg divide-y">
                {filteredContacts.map((contact) => {
                  const isSelected = data.contact_ids.includes(contact.id);
                  return (
                    <label
                      key={contact.id}
                      className={cn(
                        "flex items-center gap-3 p-3 cursor-pointer transition-colors",
                        isSelected ? "bg-primary/5" : "hover:bg-muted/50"
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleContact(contact.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{contact.name || "Unknown"}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {data.channel === "email" ? contact.email : contact.phone_number}
                        </p>
                      </div>
                      {isSelected && (
                        <Badge variant="secondary" className="text-xs">Selected</Badge>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );

      // =========================================================================
      // STEP 3: Message Content
      // =========================================================================
      case 3:
        if (data.channel === "email") {
          return (
            <div className="space-y-6">
              {/* AI Generation Panel */}
              <div className="border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAiPanel(!showAiPanel)}
                  className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-purple-500" />
                    <div className="text-left">
                      <span className="font-medium">Generate with AI</span>
                      <p className="text-xs text-muted-foreground">
                        Let AI write your email
                      </p>
                    </div>
                  </div>
                  <ChevronDown className={cn("w-5 h-5 transition-transform", showAiPanel && "rotate-180")} />
                </button>

                {showAiPanel && (
                  <div className="p-4 border-t space-y-4 bg-muted/30">
                    <div>
                      <Label>What should the email say?</Label>
                      <Textarea
                        placeholder="e.g., Announce our summer sale with 20% off. Create urgency and invite them to book..."
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        rows={3}
                        className="mt-1"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm">Tone</Label>
                        <Select value={aiTone} onValueChange={(v: string) => setAiTone(v as typeof aiTone)}>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="professional">Professional</SelectItem>
                            <SelectItem value="friendly">Friendly</SelectItem>
                            <SelectItem value="casual">Casual</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm">Purpose</Label>
                        <Select value={aiPurpose} onValueChange={(v: string) => setAiPurpose(v as typeof aiPurpose)}>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="marketing">Marketing</SelectItem>
                            <SelectItem value="follow_up">Follow Up</SelectItem>
                            <SelectItem value="reminder">Reminder</SelectItem>
                            <SelectItem value="announcement">Announcement</SelectItem>
                            <SelectItem value="thank_you">Thank You</SelectItem>
                            <SelectItem value="general">General</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Button
                      type="button"
                      onClick={handleGenerateAi}
                      disabled={generatingAi || aiPrompt.trim().length < 10}
                      className="w-full"
                    >
                      {generatingAi ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate Email
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* Email Subject */}
              <div className="space-y-2">
                <Label htmlFor="email-subject">Subject Line *</Label>
                <Input
                  id="email-subject"
                  placeholder="Enter a compelling subject line..."
                  value={data.email_subject}
                  onChange={(e) => updateData("email_subject", e.target.value)}
                />
              </div>

              {/* Email Body */}
              <div className="space-y-2">
                <Label htmlFor="email-body">Email Body *</Label>
                <Textarea
                  id="email-body"
                  placeholder="Write your email message here..."
                  value={data.email_body}
                  onChange={(e) => updateData("email_body", e.target.value)}
                  rows={10}
                  className="min-h-[200px]"
                />
                <p className="text-xs text-muted-foreground">
                  Each email is sent individually to maintain deliverability.
                </p>
              </div>
            </div>
          );
        }

        // Call campaign content
        return (
          <div className="space-y-6">
            <Alert>
              <Phone className="h-4 w-4" />
              <AlertDescription>
                {data.call_purpose === "reminder" && "The AI will remind contacts of their upcoming appointments and offer to reschedule if needed."}
                {data.call_purpose === "follow_up" && "The AI will check on customer satisfaction and offer additional services."}
                {data.call_purpose === "marketing" && "The AI will present your offer and handle objections professionally."}
              </AlertDescription>
            </Alert>

            {/* AI Personality */}
            <div className="space-y-3">
              <Label className="text-base">AI Personality</Label>
              <p className="text-sm text-muted-foreground">How should the AI sound on calls?</p>
              <div className="grid grid-cols-2 gap-3">
                {AI_TRAITS.map((trait) => (
                  <label
                    key={trait.id}
                    className={cn(
                      "flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors",
                      (data.ai_traits || []).includes(trait.id)
                        ? "border-primary bg-primary/5"
                        : "hover:border-primary/50"
                    )}
                  >
                    <Checkbox
                      checked={(data.ai_traits || []).includes(trait.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          updateData("ai_traits", [...(data.ai_traits || []), trait.id]);
                        } else {
                          updateData("ai_traits", (data.ai_traits || []).filter((t) => t !== trait.id));
                        }
                      }}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="font-medium text-sm">{trait.name}</p>
                      <p className="text-xs text-muted-foreground">{trait.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Custom Instructions */}
            <div className="space-y-2">
              <Label htmlFor="message">Additional Instructions (optional)</Label>
              <Textarea
                id="message"
                placeholder="e.g., Mention our 20% discount for returning customers. Ask if they'd like to schedule a follow-up."
                value={data.custom_message}
                onChange={(e) => updateData("custom_message", e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Add specific talking points or offers for the AI to mention.
              </p>
            </div>
          </div>
        );

      // =========================================================================
      // STEP 4: Schedule
      // =========================================================================
      case 4:
        return (
          <div className="space-y-6">
            <Alert>
              <Calendar className="h-4 w-4" />
              <AlertDescription>
                Leave the start time empty to begin immediately when you launch the campaign.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start">Start Date & Time</Label>
                <Input
                  id="start"
                  type="datetime-local"
                  value={data.scheduled_start}
                  onChange={(e) => updateData("scheduled_start", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">End Date & Time (optional)</Label>
                <Input
                  id="end"
                  type="datetime-local"
                  value={data.scheduled_end}
                  onChange={(e) => updateData("scheduled_end", e.target.value)}
                  min={data.scheduled_start}
                />
              </div>
            </div>

            {/* Call campaign specific settings */}
            {data.channel === "call" && (
              <div className="space-y-4 pt-4 border-t">
                <Label className="text-base">Call Settings</Label>

                <div className="space-y-2">
                  <Label htmlFor="daily-limit">Daily Call Limit</Label>
                  <Input
                    id="daily-limit"
                    type="number"
                    min={1}
                    max={500}
                    value={data.settings.daily_limit}
                    onChange={(e) => updateSettings("daily_limit", parseInt(e.target.value) || 100)}
                    className="w-32"
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum calls per day (1-500)
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="retry"
                    checked={data.settings.retry_failed}
                    onCheckedChange={(checked) => updateSettings("retry_failed", checked === true)}
                  />
                  <div>
                    <label htmlFor="retry" className="text-sm font-medium cursor-pointer">
                      Retry failed calls
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Automatically retry if no answer or busy
                    </p>
                  </div>
                </div>

                {data.settings.retry_failed && (
                  <div className="pl-6 space-y-2">
                    <Label htmlFor="max-retries">Max Retries</Label>
                    <Select
                      value={String(data.settings.max_retries)}
                      onValueChange={(v: string) => updateSettings("max_retries", parseInt(v))}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 retry</SelectItem>
                        <SelectItem value="2">2 retries</SelectItem>
                        <SelectItem value="3">3 retries</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      // =========================================================================
      // STEP 5: Review
      // =========================================================================
      case 5:
        return (
          <div className="space-y-6">
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription>
                Review your campaign before launching.
              </AlertDescription>
            </Alert>

            <div className="space-y-4 divide-y">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4 pb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Campaign Name</p>
                  <p className="font-medium">{data.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium">
                    {data.channel === "email" ? (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-4 w-4" /> Email Campaign
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <PhoneCall className="h-4 w-4" />
                        {data.call_purpose === "reminder" && "Reminder Calls"}
                        {data.call_purpose === "follow_up" && "Follow-up Calls"}
                        {data.call_purpose === "marketing" && "Marketing Calls"}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Audience */}
              <div className="py-4">
                <p className="text-sm text-muted-foreground">Recipients</p>
                <p className="font-medium">
                  {data.contact_ids.length} contact{data.contact_ids.length !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Email Content */}
              {data.channel === "email" && (
                <div className="py-4 space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Subject</p>
                    <p className="font-medium">{data.email_subject}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Message Preview</p>
                    <div className="mt-1 p-3 bg-muted rounded-md text-sm max-h-32 overflow-auto whitespace-pre-wrap">
                      {data.email_body}
                    </div>
                  </div>
                </div>
              )}

              {/* Call Settings */}
              {data.channel === "call" && (
                <div className="py-4 space-y-3">
                  {data.from_number && (
                    <div>
                      <p className="text-sm text-muted-foreground">Outbound Number</p>
                      <p className="font-medium">{data.from_number}</p>
                    </div>
                  )}
                  {(data.ai_traits || []).length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground">AI Personality</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {(data.ai_traits || []).map((traitId) => {
                          const trait = AI_TRAITS.find((t) => t.id === traitId);
                          return trait ? (
                            <Badge key={traitId} variant="secondary">{trait.name}</Badge>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                  {data.custom_message && (
                    <div>
                      <p className="text-sm text-muted-foreground">Additional Instructions</p>
                      <p className="text-sm mt-1 p-3 bg-muted rounded-md">{data.custom_message}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Settings</p>
                    <ul className="text-sm mt-1 space-y-1">
                      <li>Daily limit: {data.settings.daily_limit} calls</li>
                      <li>
                        {data.settings.retry_failed
                          ? `Retry failed calls (up to ${data.settings.max_retries}x)`
                          : "No automatic retries"}
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Schedule */}
              <div className="pt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Start</p>
                  <p className="font-medium">
                    {data.scheduled_start
                      ? new Date(data.scheduled_start).toLocaleString()
                      : "Immediately when launched"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">End</p>
                  <p className="font-medium">
                    {data.scheduled_end
                      ? new Date(data.scheduled_end).toLocaleString()
                      : "No end date"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // =============================================================================
  // Main Render
  // =============================================================================

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Button type="button" variant="ghost" onClick={() => router.push("/campaigns")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Campaigns
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Create Campaign</h1>
        <p className="text-muted-foreground">
          Reach your contacts via email or phone
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;

            return (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : isCompleted
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted-foreground/30 text-muted-foreground"
                    )}
                  >
                    {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span
                    className={cn(
                      "text-xs mt-1 font-medium",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {step.title}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 w-12 sm:w-16 mx-2",
                      isCompleted ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{STEPS[currentStep - 1].title}</CardTitle>
          <CardDescription>{STEPS[currentStep - 1].description}</CardDescription>
        </CardHeader>
        <CardContent>{renderStep()}</CardContent>
        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex gap-2">
            {currentStep === STEPS.length ? (
              <Button
                type="button"
                onClick={() => handleSave(false)}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Create Campaign
              </Button>
            ) : (
              <Button type="button" onClick={handleNext} disabled={!canProceed()}>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
