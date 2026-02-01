"use client";

/**
 * Outbound Settings Component
 * Configure outbound calling for appointment reminders
 * Phase 3: Outbound Calling Feature
 */

import { useState, useEffect } from "react";
import {
  Phone,
  Loader2,
  Save,
  Clock,
  Bell,
  Calendar,
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
  Switch,
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

// ============================================
// Types
// ============================================

interface OutboundSettings {
  reminder_calls_enabled: boolean;
  reminder_24hr_enabled: boolean;
  reminder_2hr_enabled: boolean;
  reminder_agent_id: string | null;
  reminder_from_number: string | null;
  daily_call_limit: number;
  outbound_hours_start: string;
  outbound_hours_end: string;
  timezone: string;
}

interface Agent {
  id: string;
  name: string;
}

interface PhoneNumber {
  id: string;
  number: string;
  is_active: boolean;
}

const DEFAULT_SETTINGS: OutboundSettings = {
  reminder_calls_enabled: false,
  reminder_24hr_enabled: true,
  reminder_2hr_enabled: true,
  reminder_agent_id: null,
  reminder_from_number: null,
  daily_call_limit: 100,
  outbound_hours_start: "09:00",
  outbound_hours_end: "18:00",
  timezone: "America/Los_Angeles",
};

// Generate time options in 30-minute increments
const generateTimeOptions = () => {
  const options: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const h = hour.toString().padStart(2, "0");
      const m = minute.toString().padStart(2, "0");
      options.push(`${h}:${m}`);
    }
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Phoenix", label: "Arizona (MST)" },
  { value: "America/Anchorage", label: "Alaska (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii (HST)" },
];

// ============================================
// Helper Functions
// ============================================

const formatTime = (time: string) => {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

// ============================================
// Component
// ============================================

export function OutboundSettings() {
  const [settings, setSettings] = useState<OutboundSettings>(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<OutboundSettings>(DEFAULT_SETTINGS);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // ============================================
  // Data Fetching
  // ============================================

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch settings, agents, and phone numbers in parallel
      const [settingsRes, agentsRes, phonesRes] = await Promise.all([
        fetch("/api/dashboard/settings/outbound"),
        fetch("/api/dashboard/agents"),
        fetch("/api/dashboard/phone-numbers"),
      ]);

      // Process settings
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        if (settingsData.data) {
          // Merge with defaults to ensure all properties exist
          const merged: OutboundSettings = {
            ...DEFAULT_SETTINGS,
            ...settingsData.data,
          };
          setSettings(merged);
          setOriginalSettings(merged);
        }
      }

      // Process agents
      if (agentsRes.ok) {
        const agentsData = await agentsRes.json();
        setAgents(agentsData.data || []);
      }

      // Process phone numbers
      if (phonesRes.ok) {
        const phonesData = await phonesRes.json();
        setPhoneNumbers(phonesData.data?.filter((p: PhoneNumber) => p.is_active) || []);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Track changes
  useEffect(() => {
    const changed = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    setHasChanges(changed);
  }, [settings, originalSettings]);

  // ============================================
  // Actions
  // ============================================

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/dashboard/settings/outbound", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save settings");
      }

      setOriginalSettings(settings);
      setHasChanges(false);

      toast({
        title: "Saved",
        description: "Outbound calling settings updated successfully",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof OutboundSettings>(
    key: K,
    value: OutboundSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  // ============================================
  // Render
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Outbound Calling
              </CardTitle>
              <CardDescription>
                Configure automated reminder calls for appointments
              </CardDescription>
            </div>
            <Button onClick={handleSave} disabled={saving || !hasChanges}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable Reminder Calls */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div>
                <Label className="font-medium">Enable Reminder Calls</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically call customers to remind them of upcoming appointments
                </p>
              </div>
            </div>
            <Switch
              checked={settings.reminder_calls_enabled}
              onCheckedChange={(checked) =>
                updateSetting("reminder_calls_enabled", checked)
              }
            />
          </div>

          {settings.reminder_calls_enabled && (
            <>
              {/* Reminder Timing Options */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Reminder Timing</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start space-x-3 p-4 border rounded-lg">
                    <Checkbox
                      id="reminder-24hr"
                      checked={settings.reminder_24hr_enabled}
                      onCheckedChange={(checked) =>
                        updateSetting("reminder_24hr_enabled", checked === true)
                      }
                    />
                    <div className="space-y-1">
                      <label
                        htmlFor="reminder-24hr"
                        className="text-sm font-medium cursor-pointer"
                      >
                        24-Hour Reminder
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Call customers 24 hours before their appointment
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-4 border rounded-lg">
                    <Checkbox
                      id="reminder-2hr"
                      checked={settings.reminder_2hr_enabled}
                      onCheckedChange={(checked) =>
                        updateSetting("reminder_2hr_enabled", checked === true)
                      }
                    />
                    <div className="space-y-1">
                      <label
                        htmlFor="reminder-2hr"
                        className="text-sm font-medium cursor-pointer"
                      >
                        2-Hour Reminder
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Call customers 2 hours before their appointment
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Agent Selection */}
              <div className="space-y-2">
                <Label htmlFor="reminder-agent">AI Agent for Reminders</Label>
                <Select
                  value={settings.reminder_agent_id || ""}
                  onValueChange={(value) =>
                    updateSetting("reminder_agent_id", value || null)
                  }
                >
                  <SelectTrigger id="reminder-agent" className="w-full">
                    <SelectValue placeholder="Select an agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.length === 0 ? (
                      <SelectItem value="" disabled>
                        No agents available
                      </SelectItem>
                    ) : (
                      agents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The AI agent that will make reminder calls
                </p>
              </div>

              {/* From Number Selection */}
              <div className="space-y-2">
                <Label htmlFor="from-number">From Number</Label>
                <Select
                  value={settings.reminder_from_number || ""}
                  onValueChange={(value) =>
                    updateSetting("reminder_from_number", value || null)
                  }
                >
                  <SelectTrigger id="from-number" className="w-full">
                    <SelectValue placeholder="Select a phone number" />
                  </SelectTrigger>
                  <SelectContent>
                    {phoneNumbers.length === 0 ? (
                      <SelectItem value="" disabled>
                        No phone numbers available
                      </SelectItem>
                    ) : (
                      phoneNumbers.map((phone) => (
                        <SelectItem key={phone.id} value={phone.number}>
                          {phone.number}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The caller ID shown when making reminder calls
                </p>
              </div>

              {/* Daily Call Limit */}
              <div className="space-y-2">
                <Label htmlFor="daily-limit">Daily Call Limit</Label>
                <Input
                  id="daily-limit"
                  type="number"
                  min={1}
                  max={500}
                  value={settings.daily_call_limit}
                  onChange={(e) =>
                    updateSetting("daily_call_limit", Math.min(parseInt(e.target.value, 10) || 100, 500))
                  }
                  className="w-32"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of outbound calls per day (1-500)
                </p>
              </div>

              {/* Outbound Hours */}
              <div className="space-y-4">
                <Label className="text-base font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Outbound Calling Hours
                </Label>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Reminder calls will only be made during these hours to respect
                    customer preferences and comply with regulations.
                  </AlertDescription>
                </Alert>
                <div className="flex items-center gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hours-start">Start Time</Label>
                    <Select
                      value={settings.outbound_hours_start}
                      onValueChange={(value) =>
                        updateSetting("outbound_hours_start", value)
                      }
                    >
                      <SelectTrigger id="hours-start" className="w-32">
                        <SelectValue placeholder="Start" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((time) => (
                          <SelectItem key={time} value={time}>
                            {formatTime(time)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <span className="text-muted-foreground pt-6">to</span>
                  <div className="space-y-2">
                    <Label htmlFor="hours-end">End Time</Label>
                    <Select
                      value={settings.outbound_hours_end}
                      onValueChange={(value) =>
                        updateSetting("outbound_hours_end", value)
                      }
                    >
                      <SelectTrigger id="hours-end" className="w-32">
                        <SelectValue placeholder="End" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.filter(
                          (time) => time > settings.outbound_hours_start
                        ).map((time) => (
                          <SelectItem key={time} value={time}>
                            {formatTime(time)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Timezone */}
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  value={settings.timezone}
                  onValueChange={(value) => updateSetting("timezone", value)}
                >
                  <SelectTrigger id="timezone" className="w-64">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Calling hours will be enforced based on this timezone
                </p>
              </div>
            </>
          )}

          {!settings.reminder_calls_enabled && (
            <Alert>
              <Calendar className="h-4 w-4" />
              <AlertDescription>
                Enable reminder calls to automatically contact customers before their
                appointments. This can help reduce no-shows and improve customer
                satisfaction.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
