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
}

interface CampaignData {
  name: string;
  description: string;
  type: "appointment_reminder" | "follow_up" | "marketing" | "custom";
  scheduled_start: string;
  scheduled_end: string;
  custom_message: string;
  contact_ids: string[];
  settings: {
    daily_limit: number;
    retry_failed: boolean;
    max_retries: number;
  };
}

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
  contact_ids: [],
  settings: {
    daily_limit: 100,
    retry_failed: true,
    max_retries: 2,
  },
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

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return data.name.trim().length > 0;
      case 2:
        return data.contact_ids.length > 0;
      case 3:
        return true; // Message is optional
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
      const response = await fetch("/api/dashboard/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          type: data.type,
          scheduled_start: data.scheduled_start || null,
          scheduled_end: data.scheduled_end || null,
          custom_message: data.custom_message || null,
          settings: data.settings,
          contact_ids: data.contact_ids,
        }),
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
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="message">Custom Message</Label>
              <Textarea
                id="message"
                placeholder="Enter a custom message for the AI to use during calls. Leave blank to use the default message for your campaign type."
                value={data.custom_message}
                onChange={(e) => updateData("custom_message", e.target.value)}
                rows={6}
              />
              <p className="text-sm text-muted-foreground">
                This message will guide the AI&apos;s conversation. Include key points you want mentioned.
              </p>
            </div>

            <Alert>
              <MessageSquare className="h-4 w-4" />
              <AlertDescription>
                <strong>Tip:</strong> For {data.type} campaigns, the AI will automatically
                include relevant details like appointment times or service information.
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
                    {data.type === "appointment_reminder" ? "Appointment Reminder" :
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

              {data.custom_message && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Custom Message</p>
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
