"use client";

/**
 * Campaign Wizard Component
 * Step-by-step campaign creation workflow
 */

import { useState, useEffect } from "react";
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
  Settings,
  AlertCircle,
  Mail,
  Sparkles,
  ChevronDown,
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

interface CampaignData {
  name: string;
  description: string;
  type: "appointment_reminder" | "follow_up" | "marketing" | "custom" | "email";
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
  // Email-specific fields
  email_subject: string;
  email_body: string;
}

// AI personality traits that get added to the prompt
const AI_TRAITS = [
  {
    id: "persistent",
    name: "Persistent",
    description: "Keeps trying to close the sale, handles objections confidently",
    prompt: "Be persistent and confident. When the customer raises objections, acknowledge them but redirect to the value proposition. Don't give up easily - try at least 2-3 different approaches before accepting a 'no'. Use phrases like 'I understand, but consider this...' and 'Many customers felt the same way until they saw the benefits.'",
  },
  {
    id: "friendly",
    name: "Friendly",
    description: "Warm, casual, and builds rapport quickly",
    prompt: "Be warm and friendly. Use casual language and build rapport quickly. Smile through your voice. Use the customer's name naturally. Share brief relatable comments and show genuine interest in them as a person, not just a sale.",
  },
  {
    id: "professional",
    name: "Professional",
    description: "Business-like, formal, and to the point",
    prompt: "Maintain a professional and business-like tone throughout the call. Be concise and respect the customer's time. Stick to the facts and value proposition. Avoid overly casual language or jokes.",
  },
  {
    id: "empathetic",
    name: "Empathetic",
    description: "Understanding, patient, and listens actively",
    prompt: "Be highly empathetic and patient. Listen actively to customer concerns and acknowledge their feelings. Use phrases like 'I completely understand' and 'That makes sense.' Take your time and never rush the customer.",
  },
  {
    id: "urgent",
    name: "Creates Urgency",
    description: "Emphasizes limited time offers and scarcity",
    prompt: "Create a sense of urgency without being pushy. Mention limited-time offers, availability constraints, or upcoming price changes when relevant. Use phrases like 'This offer is only available until...' and 'Spots are filling up quickly.'",
  },
  {
    id: "consultative",
    name: "Consultative",
    description: "Asks questions and provides tailored solutions",
    prompt: "Take a consultative approach. Ask questions to understand the customer's specific needs and pain points before presenting solutions. Tailor your pitch based on what they share. Position yourself as a helpful advisor, not a salesperson.",
  },
];

const STEPS = [
  { id: 1, title: "Basics", icon: Settings, description: "Name and type" },
  { id: 2, title: "Audience", icon: Users, description: "Select contacts" },
  { id: 3, title: "Message", icon: MessageSquare, description: "Customize message" },
  { id: 4, title: "Schedule", icon: Calendar, description: "Set timing" },
  { id: 5, title: "Review", icon: Check, description: "Confirm and launch" },
];

const INITIAL_DATA: CampaignData = {
  name: "",
  description: "",
  type: "appointment_reminder",
  scheduled_start: "",
  scheduled_end: "",
  custom_message: "",
  ai_traits: [],
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
      const response = await fetch("/api/dashboard/contacts?limit=200");
      const result = await response.json();
      if (result.success) {
        setContacts(result.data.contacts || []);
      }
    } catch {
      // Silently fail - contacts list will remain empty
    } finally {
      setLoadingContacts(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

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

      // Populate the email subject and body fields
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
        return data.name.trim().length > 0;
      case 2:
        return data.contact_ids.length > 0;
      case 3:
        // Email campaigns require subject and body
        if (data.type === "email") {
          return data.email_subject.trim().length > 0 && data.email_body.trim().length > 0;
        }
        return true; // Call campaign message is optional
      case 4:
        return true; // Schedule is optional (can start immediately)
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
      // Build the full AI instructions from traits + custom message (for call campaigns)
      const traitInstructions = (data.ai_traits || [])
        .map((traitId) => AI_TRAITS.find((t) => t.id === traitId)?.prompt)
        .filter(Boolean)
        .join("\n\n");

      const fullInstructions = [traitInstructions, data.custom_message]
        .filter(Boolean)
        .join("\n\n---\n\n");

      // Build the request body with email data if it's an email campaign
      const requestBody: Record<string, unknown> = {
        name: data.name,
        description: data.description,
        type: data.type,
        scheduled_start: data.scheduled_start || null,
        scheduled_end: data.scheduled_end || null,
        contact_ids: data.contact_ids,
      };

      if (data.type === "email") {
        // Email campaign: include email-specific fields
        requestBody.settings = {
          email_subject: data.email_subject,
          email_body: data.email_body,
        };
      } else {
        // Call campaign: include AI traits and settings
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

      // If starting immediately, trigger the start action
      if (startImmediately && result.data?.id) {
        await fetch(`/api/dashboard/campaigns/${result.data.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start" }),
        });
      }

      toast({
        title: "Success",
        description: startImmediately
          ? "Campaign created and started!"
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
  // Filtered Contacts
  // =============================================================================

  const filteredContacts = contacts.filter((contact) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      contact.name?.toLowerCase().includes(query) ||
      contact.phone_number?.includes(query)
    );
  });

  // =============================================================================
  // Render Steps
  // =============================================================================

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name *</Label>
              <Input
                id="name"
                placeholder="e.g., January Appointment Reminders"
                value={data.name}
                onChange={(e) => updateData("name", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional description of this campaign..."
                value={data.description}
                onChange={(e) => updateData("description", e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-3">
              <Label>Campaign Type *</Label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => updateData("type", "email")}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 border rounded-lg cursor-pointer transition-colors",
                    data.type === "email"
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/50"
                  )}
                >
                  <Mail className="h-8 w-8 mb-2 text-primary" />
                  <span className="font-medium">Email</span>
                  <span className="text-xs text-muted-foreground text-center">
                    Mass email campaign
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => updateData("type", "appointment_reminder")}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 border rounded-lg cursor-pointer transition-colors",
                    data.type === "appointment_reminder"
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/50"
                  )}
                >
                  <Calendar className="h-8 w-8 mb-2 text-primary" />
                  <span className="font-medium">Reminder</span>
                  <span className="text-xs text-muted-foreground text-center">
                    Appointment reminders
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => updateData("type", "follow_up")}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 border rounded-lg cursor-pointer transition-colors",
                    data.type === "follow_up"
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/50"
                  )}
                >
                  <Phone className="h-8 w-8 mb-2 text-primary" />
                  <span className="font-medium">Follow-up</span>
                  <span className="text-xs text-muted-foreground text-center">
                    Post-visit follow-ups
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => updateData("type", "marketing")}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 border rounded-lg cursor-pointer transition-colors",
                    data.type === "marketing"
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/50"
                  )}
                >
                  <MessageSquare className="h-8 w-8 mb-2 text-primary" />
                  <span className="font-medium">Marketing</span>
                  <span className="text-xs text-muted-foreground text-center">
                    Promotional outreach
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => updateData("type", "custom")}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 border rounded-lg cursor-pointer transition-colors",
                    data.type === "custom"
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/50"
                  )}
                >
                  <Settings className="h-8 w-8 mb-2 text-primary" />
                  <span className="font-medium">Custom</span>
                  <span className="text-xs text-muted-foreground text-center">
                    Custom campaign
                  </span>
                </button>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Select Contacts</Label>
                <p className="text-sm text-muted-foreground">
                  {data.contact_ids.length} contact{data.contact_ids.length !== 1 ? "s" : ""} selected
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={selectAllContacts}>
                  Select All
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={deselectAllContacts}>
                  Deselect All
                </Button>
              </div>
            </div>

            <Input
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {loadingContacts ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredContacts.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No contacts found. Add contacts to your database first.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="max-h-[400px] overflow-y-auto border rounded-lg divide-y">
                {filteredContacts.map((contact) => (
                  <label
                    key={contact.id}
                    className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={data.contact_ids.includes(contact.id)}
                      onCheckedChange={() => toggleContact(contact.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{contact.name || "Unknown"}</p>
                      <p className="text-sm text-muted-foreground">{contact.phone_number}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        );

      case 3:
        // Show different content for email vs call campaigns
        if (data.type === "email") {
          return (
            <div className="space-y-6">
              {/* AI Generation Panel */}
              <div className="border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAiPanel(!showAiPanel)}
                  className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-500" />
                    <div className="text-left">
                      <span className="font-medium">Generate with AI</span>
                      <p className="text-xs text-muted-foreground">
                        Let AI help you write a professional email
                      </p>
                    </div>
                  </div>
                  <ChevronDown className={`w-5 h-5 transition-transform ${showAiPanel ? "rotate-180" : ""}`} />
                </button>

                {showAiPanel && (
                  <div className="p-4 border-t space-y-4 bg-muted/30">
                    <div>
                      <Label>Describe what you want to say</Label>
                      <Textarea
                        placeholder="e.g., Announce our new summer sale with 30% off all services. Include a sense of urgency and invite them to book..."
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        rows={3}
                        className="mt-1"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Tone</Label>
                        <Select
                          value={aiTone}
                          onValueChange={(v: string) => setAiTone(v as typeof aiTone)}
                        >
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
                        <Label>Purpose</Label>
                        <Select
                          value={aiPurpose}
                          onValueChange={(v: string) => setAiPurpose(v as typeof aiPurpose)}
                        >
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
                <Label htmlFor="email-subject">Email Subject *</Label>
                <Input
                  id="email-subject"
                  placeholder="Enter your email subject line..."
                  value={data.email_subject}
                  onChange={(e) => updateData("email_subject", e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Make it compelling to increase open rates
                </p>
              </div>

              {/* Email Body */}
              <div className="space-y-2">
                <Label htmlFor="email-body">Email Message *</Label>
                <Textarea
                  id="email-body"
                  placeholder="Write your email message here...

You can use line breaks for formatting."
                  value={data.email_body}
                  onChange={(e) => updateData("email_body", e.target.value)}
                  rows={10}
                  className="min-h-[250px]"
                />
                <p className="text-sm text-muted-foreground">
                  This message will be sent to all selected contacts. Each email is sent individually.
                </p>
              </div>

              <Alert>
                <Mail className="h-4 w-4" />
                <AlertDescription>
                  <strong>Note:</strong> Emails will be sent from your connected email account.
                  Make sure you have an email account connected in Connections.
                </AlertDescription>
              </Alert>
            </div>
          );
        }

        // Call campaign: show AI traits
        return (
          <div className="space-y-6">
            {/* AI Personality Traits */}
            <div className="space-y-3">
              <div>
                <Label className="text-base font-medium">AI Personality Traits</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Select traits to shape how the AI interacts with customers
                </p>
              </div>
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
                    <div className="flex-1">
                      <p className="font-medium text-sm">{trait.name}</p>
                      <p className="text-xs text-muted-foreground">{trait.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Custom Instructions */}
            <div className="space-y-2">
              <Label htmlFor="message">Additional Instructions</Label>
              <Textarea
                id="message"
                placeholder="Give specific instructions for your AI. For example: 'Mention our 20% discount for new customers' or 'Ask if they need help with scheduling a follow-up appointment'."
                value={data.custom_message}
                onChange={(e) => updateData("custom_message", e.target.value)}
                rows={5}
              />
              <p className="text-sm text-muted-foreground">
                Add specific talking points, offers to mention, or questions to ask. The AI will incorporate these into the conversation naturally.
              </p>
            </div>

            <Alert>
              <MessageSquare className="h-4 w-4" />
              <AlertDescription>
                <strong>Tip:</strong> For {data.type === "appointment_reminder" ? "reminder" : data.type === "follow_up" ? "follow-up" : data.type} campaigns, the AI already knows to {data.type === "appointment_reminder" ? "confirm appointment details and handle rescheduling" : data.type === "follow_up" ? "check on customer satisfaction and offer additional services" : data.type === "marketing" ? "present your offer and handle objections" : "follow your instructions"}. Add anything extra here.
              </AlertDescription>
            </Alert>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start">Start Date & Time</Label>
                <Input
                  id="start"
                  type="datetime-local"
                  value={data.scheduled_start}
                  onChange={(e) => updateData("scheduled_start", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to start immediately when activated
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">End Date & Time</Label>
                <Input
                  id="end"
                  type="datetime-local"
                  value={data.scheduled_end}
                  onChange={(e) => updateData("scheduled_end", e.target.value)}
                  min={data.scheduled_start}
                />
                <p className="text-xs text-muted-foreground">
                  Optional end date for the campaign
                </p>
              </div>
            </div>

            {/* Call campaign settings - not shown for email */}
            {data.type !== "email" && (
              <div className="space-y-4 pt-4 border-t">
                <Label className="text-base font-medium">Campaign Settings</Label>

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
                    Maximum calls to make per day (1-500)
                  </p>
                </div>

                <div className="flex items-start space-x-3 pt-2">
                  <Checkbox
                    id="retry"
                    checked={data.settings.retry_failed}
                    onCheckedChange={(checked) => updateSettings("retry_failed", checked === true)}
                  />
                  <div className="space-y-1">
                    <label htmlFor="retry" className="text-sm font-medium cursor-pointer">
                      Retry failed calls
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Automatically retry calls that fail due to no answer or busy signal
                    </p>
                  </div>
                </div>

                {data.settings.retry_failed && (
                  <div className="space-y-2 pl-6">
                    <Label htmlFor="max-retries">Maximum Retries</Label>
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

            {/* Email campaign info */}
            {data.type === "email" && (
              <Alert className="mt-4">
                <Mail className="h-4 w-4" />
                <AlertDescription>
                  Emails will be sent individually to each contact. This respects email provider
                  limits and ensures better deliverability.
                </AlertDescription>
              </Alert>
            )}
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription>
                Review your campaign settings below before creating.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Campaign Name</p>
                  <p className="font-medium">{data.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium">
                    {data.type === "email" ? "Email Campaign" :
                     data.type === "appointment_reminder" ? "Appointment Reminder" :
                     data.type === "follow_up" ? "Follow-up" :
                     data.type === "marketing" ? "Marketing" : "Custom"}
                  </p>
                </div>
              </div>

              {data.description && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p>{data.description}</p>
                </div>
              )}

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Target Audience</p>
                <p className="font-medium">
                  {data.contact_ids.length} contact{data.contact_ids.length !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Email campaign details */}
              {data.type === "email" && (
                <>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Email Subject</p>
                    <p className="font-medium">{data.email_subject}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Email Message</p>
                    <p className="text-sm bg-muted p-3 rounded whitespace-pre-wrap max-h-32 overflow-auto">
                      {data.email_body}
                    </p>
                  </div>
                </>
              )}

              {/* Call campaign: AI traits */}
              {data.type !== "email" && (data.ai_traits || []).length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">AI Personality</p>
                  <div className="flex flex-wrap gap-2">
                    {(data.ai_traits || []).map((traitId) => {
                      const trait = AI_TRAITS.find((t) => t.id === traitId);
                      return trait ? (
                        <span
                          key={traitId}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
                        >
                          {trait.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {data.type !== "email" && data.custom_message && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Additional Instructions</p>
                  <p className="text-sm bg-muted p-3 rounded">{data.custom_message}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Start</p>
                  <p className="font-medium">
                    {data.scheduled_start
                      ? new Date(data.scheduled_start).toLocaleString()
                      : "Immediately when activated"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">End</p>
                  <p className="font-medium">
                    {data.scheduled_end
                      ? new Date(data.scheduled_end).toLocaleString()
                      : "No end date"}
                  </p>
                </div>
              </div>

              {/* Call campaign settings */}
              {data.type !== "email" && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Settings</p>
                  <ul className="text-sm space-y-1">
                    <li>Daily limit: {data.settings.daily_limit} calls</li>
                    <li>
                      {data.settings.retry_failed
                        ? `Retry failed calls (up to ${data.settings.max_retries} times)`
                        : "No automatic retries"}
                    </li>
                  </ul>
                </div>
              )}
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
          Back to Outbound
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Create Campaign</h1>
        <p className="text-muted-foreground">
          Set up a new outbound calling campaign
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
                    {isCompleted ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
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
                      "h-0.5 w-16 mx-2",
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
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSave(false)}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Save as Draft
                </Button>
                <Button
                  type="button"
                  onClick={() => handleSave(true)}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Create & Start
                </Button>
              </>
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
