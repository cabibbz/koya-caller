"use client";

/**
 * Campaign Edit Form Component
 * Form for editing existing campaigns
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Save,
  Calendar,
  Users,
  MessageSquare,
  Phone,
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

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "scheduled" | "active" | "paused" | "completed";
  type: "reminder" | "followup" | "custom";
  scheduled_start: string | null;
  scheduled_end: string | null;
  custom_message: string | null;
  target_contacts: number;
  settings: Record<string, unknown>;
}

interface Contact {
  id: string;
  name: string | null;
  phone: string;
}

interface CampaignEditFormProps {
  campaign: Campaign;
  contacts: Contact[];
  selectedContactIds: string[];
}

interface CampaignSettings {
  daily_limit: number;
  retry_failed: boolean;
  max_retries: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

const getStatusColor = (status: Campaign["status"]) => {
  const colors = {
    draft: "bg-gray-500/10 text-gray-600",
    scheduled: "bg-blue-500/10 text-blue-600",
    active: "bg-green-500/10 text-green-600",
    paused: "bg-yellow-500/10 text-yellow-600",
    completed: "bg-purple-500/10 text-purple-600",
  };
  return colors[status] || colors.draft;
};

// =============================================================================
// Component
// =============================================================================

export function CampaignEditForm({
  campaign,
  contacts,
  selectedContactIds: initialSelectedIds,
}: CampaignEditFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Form state
  const [name, setName] = useState(campaign.name);
  const [description, setDescription] = useState(campaign.description || "");
  const [type, setType] = useState<Campaign["type"]>(campaign.type);
  const [scheduledStart, setScheduledStart] = useState(
    campaign.scheduled_start
      ? new Date(campaign.scheduled_start).toISOString().slice(0, 16)
      : ""
  );
  const [scheduledEnd, setScheduledEnd] = useState(
    campaign.scheduled_end
      ? new Date(campaign.scheduled_end).toISOString().slice(0, 16)
      : ""
  );
  const [customMessage, setCustomMessage] = useState(campaign.custom_message || "");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>(initialSelectedIds);

  // Settings
  const campaignSettings = campaign.settings as Partial<CampaignSettings> | null;
  const [dailyLimit, setDailyLimit] = useState(campaignSettings?.daily_limit ?? 100);
  const [retryFailed, setRetryFailed] = useState(campaignSettings?.retry_failed ?? true);
  const [maxRetries, setMaxRetries] = useState(campaignSettings?.max_retries ?? 2);

  // =============================================================================
  // Handlers
  // =============================================================================

  const toggleContact = (contactId: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId]
    );
  };

  const filteredContacts = contacts.filter((contact) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      contact.name?.toLowerCase().includes(query) ||
      contact.phone?.includes(query)
    );
  });

  const selectAllFiltered = () => {
    const filteredIds = filteredContacts.map((c) => c.id);
    setSelectedContactIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
  };

  const deselectAllFiltered = () => {
    const filteredIds = filteredContacts.map((c) => c.id);
    setSelectedContactIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: "Validation Error",
        description: "Campaign name is required",
        variant: "destructive",
      });
      return;
    }

    if (selectedContactIds.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one contact",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/dashboard/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          type,
          scheduled_start: scheduledStart || null,
          scheduled_end: scheduledEnd || null,
          custom_message: customMessage.trim() || null,
          contact_ids: selectedContactIds,
          settings: {
            daily_limit: dailyLimit,
            retry_failed: retryFailed,
            max_retries: maxRetries,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update campaign");
      }

      toast({
        title: "Success",
        description: "Campaign updated successfully",
        variant: "success",
      });

      router.push(`/campaigns/${campaign.id}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update campaign",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => router.push(`/campaigns/${campaign.id}`)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Campaign
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Edit Campaign</h1>
          <Badge className={getStatusColor(campaign.status)}>{campaign.status}</Badge>
        </div>
        <p className="text-muted-foreground">Update campaign settings and contacts</p>
      </div>

      <div className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., January Appointment Reminders"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                rows={3}
              />
            </div>

            <div className="space-y-3">
              <Label>Campaign Type *</Label>
              <div className="grid grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => setType("reminder")}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 border rounded-lg transition-colors",
                    type === "reminder"
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/50"
                  )}
                >
                  <Calendar className="h-6 w-6 mb-2 text-primary" />
                  <span className="font-medium text-sm">Reminder</span>
                </button>

                <button
                  type="button"
                  onClick={() => setType("followup")}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 border rounded-lg transition-colors",
                    type === "followup"
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/50"
                  )}
                >
                  <Phone className="h-6 w-6 mb-2 text-primary" />
                  <span className="font-medium text-sm">Follow-up</span>
                </button>

                <button
                  type="button"
                  onClick={() => setType("custom")}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 border rounded-lg transition-colors",
                    type === "custom"
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/50"
                  )}
                >
                  <MessageSquare className="h-6 w-6 mb-2 text-primary" />
                  <span className="font-medium text-sm">Custom</span>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Audience */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Target Audience
            </CardTitle>
            <CardDescription>
              {selectedContactIds.length} contact{selectedContactIds.length !== 1 ? "s" : ""}{" "}
              selected
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={selectAllFiltered}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAllFiltered}>
                Deselect All
              </Button>
            </div>

            {contacts.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No contacts found. Add contacts to your database first.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="max-h-[300px] overflow-y-auto border rounded-lg divide-y">
                {filteredContacts.map((contact) => (
                  <label
                    key={contact.id}
                    className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedContactIds.includes(contact.id)}
                      onCheckedChange={() => toggleContact(contact.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{contact.name || "Unknown"}</p>
                      <p className="text-sm text-muted-foreground">{contact.phone}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Message */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Custom Message
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Enter a custom message for the AI to use during calls. Leave blank to use the default message."
              rows={4}
            />
            <p className="text-sm text-muted-foreground mt-2">
              This message will guide the AI&apos;s conversation. Include key points you want
              mentioned.
            </p>
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Schedule & Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start">Start Date & Time</Label>
                <Input
                  id="start"
                  type="datetime-local"
                  value={scheduledStart}
                  onChange={(e) => setScheduledStart(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to start immediately
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">End Date & Time</Label>
                <Input
                  id="end"
                  type="datetime-local"
                  value={scheduledEnd}
                  onChange={(e) => setScheduledEnd(e.target.value)}
                  min={scheduledStart}
                />
                <p className="text-xs text-muted-foreground">Optional end date</p>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="daily-limit">Daily Call Limit</Label>
                <Input
                  id="daily-limit"
                  type="number"
                  min={1}
                  max={500}
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(parseInt(e.target.value) || 100)}
                  className="w-32"
                />
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="retry"
                  checked={retryFailed}
                  onCheckedChange={(checked) => setRetryFailed(checked === true)}
                />
                <div className="space-y-1">
                  <label htmlFor="retry" className="text-sm font-medium cursor-pointer">
                    Retry failed calls
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Automatically retry calls that fail
                  </p>
                </div>
              </div>

              {retryFailed && (
                <div className="space-y-2 pl-6">
                  <Label htmlFor="max-retries">Maximum Retries</Label>
                  <Select
                    value={String(maxRetries)}
                    onValueChange={(v) => setMaxRetries(parseInt(v))}
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
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4">
          <Button variant="outline" onClick={() => router.push(`/campaigns/${campaign.id}`)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
