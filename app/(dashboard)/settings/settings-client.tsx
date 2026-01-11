"use client";

/**
 * Settings Client Component
 * Session 18: Dashboard - Settings
 * Session 20: Calendar OAuth Integration
 * Spec Reference: Part 7, Lines 748-810
 *
 * Tabs:
 * 1. Call Handling (Lines 750-760)
 * 2. Voice & Personality (Lines 762-770)
 * 3. Language (Lines 772-778)
 * 4. Calendar (Lines 780-790)
 * 5. Notifications (Lines 792-798)
 * 6. Phone & Billing (Lines 800-810)
 */

import { useState, useRef, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Save,
  Loader2,
  CheckCircle,
  Phone,
  Mic,
  Globe,
  Calendar,
  Bell,
  CreditCard,
  Play,
  Pause,
  ExternalLink,
  AlertCircle,
  Unlink,
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
  Checkbox,
} from "@/components/ui";
import type {
  CallSettings,
  AIConfig,
  CalendarIntegration,
  NotificationSettings,
  PhoneNumber,
  Personality,
  LanguageMode,
  TransferHoursType,
  ReminderSetting,
} from "@/types";
import {
  VOICE_SAMPLES,
  STYLE_DESCRIPTIONS,
} from "@/lib/onboarding/voice-samples";
import type { VoiceSample } from "@/types/onboarding";

interface SettingsClientProps {
  businessId: string;
  businessInfo: {
    name: string;
    planName: string;
    subscriptionStatus: string;
    minutesUsed: number;
    minutesIncluded: number;
    cycleStart: string | null;
    cycleEnd: string | null;
    stripeCustomerId: string | null;
    userEmail: string;
  };
  initialCallSettings: CallSettings | null;
  initialAiConfig: AIConfig | null;
  initialCalendarIntegration: CalendarIntegration | null;
  initialNotificationSettings: NotificationSettings | null;
  initialPhoneNumbers: PhoneNumber[];
}

type Tab = "call-handling" | "voice" | "language" | "calendar" | "notifications" | "phone-billing";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "call-handling", label: "Call Handling", icon: Phone },
  { id: "voice", label: "Voice & Personality", icon: Mic },
  { id: "language", label: "Language", icon: Globe },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "phone-billing", label: "Phone & Billing", icon: CreditCard },
];

const PERSONALITY_OPTIONS: { value: Personality; label: string; description: string }[] = [
  { value: "professional", label: "Professional", description: "Clear and businesslike" },
  { value: "friendly", label: "Friendly", description: "Warm and approachable" },
  { value: "casual", label: "Casual", description: "Relaxed and conversational" },
];

const LANGUAGE_MODE_OPTIONS: { value: LanguageMode; label: string; description: string }[] = [
  { value: "auto", label: "Auto-detect", description: "Koya detects the caller's language automatically" },
  { value: "ask", label: "Ask first", description: "Koya asks which language the caller prefers" },
  { value: "spanish_default", label: "Spanish default", description: "Start in Spanish, switch if needed" },
];

const TRANSFER_HOURS_OPTIONS: { value: TransferHoursType; label: string }[] = [
  { value: "always", label: "Always available" },
  { value: "business_hours", label: "Business hours only" },
  { value: "custom", label: "Custom schedule (coming soon)" },
];

const REMINDER_OPTIONS: { value: ReminderSetting; label: string }[] = [
  { value: "off", label: "No reminder" },
  { value: "1hr", label: "1 hour before" },
  { value: "24hr", label: "24 hours before" },
];

export function SettingsClient({
  businessId,
  businessInfo,
  initialCallSettings,
  initialAiConfig,
  initialCalendarIntegration,
  initialNotificationSettings,
  initialPhoneNumbers,
}: SettingsClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("call-handling");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audio playback state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);

  // Call handling state
  const [callSettings, setCallSettings] = useState({
    transferNumber: initialCallSettings?.transfer_number || "",
    backupTransferNumber: initialCallSettings?.backup_transfer_number || "",
    transferOnRequest: initialCallSettings?.transfer_on_request ?? true,
    transferOnEmergency: initialCallSettings?.transfer_on_emergency ?? true,
    transferOnUpset: initialCallSettings?.transfer_on_upset ?? false,
    transferKeywords: initialCallSettings?.transfer_keywords?.join(", ") || "",
    transferHoursType: (initialCallSettings?.transfer_hours_type || "always") as TransferHoursType,
    afterHoursEnabled: initialCallSettings?.after_hours_enabled ?? true,
    afterHoursCanBook: initialCallSettings?.after_hours_can_book ?? true,
    afterHoursMessageOnly: initialCallSettings?.after_hours_message_only ?? false,
    maxCallDurationSeconds: initialCallSettings?.max_call_duration_seconds || 600,
    recordingEnabled: initialCallSettings?.recording_enabled ?? true,
  });
  const [callSettingsModified, setCallSettingsModified] = useState(false);

  // Voice & personality state
  const [voiceSettings, setVoiceSettings] = useState({
    voiceId: initialAiConfig?.voice_id || "",
    voiceIdSpanish: initialAiConfig?.voice_id_spanish || "",
    aiName: initialAiConfig?.ai_name || "Koya",
    personality: (initialAiConfig?.personality || "professional") as Personality,
    greeting: initialAiConfig?.greeting || "",
    greetingSpanish: initialAiConfig?.greeting_spanish || "",
    afterHoursGreeting: initialAiConfig?.after_hours_greeting || "",
    afterHoursGreetingSpanish: initialAiConfig?.after_hours_greeting_spanish || "",
  });
  const [voiceSettingsModified, setVoiceSettingsModified] = useState(false);
  const [selectedGender, setSelectedGender] = useState<"female" | "male">("female");

  // Language state
  const [languageSettings, setLanguageSettings] = useState({
    spanishEnabled: initialAiConfig?.spanish_enabled ?? false,
    languageMode: (initialAiConfig?.language_mode || "auto") as LanguageMode,
  });
  const [languageSettingsModified, setLanguageSettingsModified] = useState(false);

  // Calendar state
  const [calendarSettings, setCalendarSettings] = useState({
    provider: initialCalendarIntegration?.provider || "built_in",
    defaultDurationMinutes: initialCalendarIntegration?.default_duration_minutes || 60,
    bufferMinutes: initialCalendarIntegration?.buffer_minutes || 0,
    advanceBookingDays: initialCalendarIntegration?.advance_booking_days || 14,
    requireEmail: initialCalendarIntegration?.require_email ?? false,
  });
  const [calendarSettingsModified, setCalendarSettingsModified] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(
    initialCalendarIntegration?.provider !== "built_in" && 
    !!initialCalendarIntegration?.access_token
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Notifications state
  const [notificationSettings, setNotificationSettings] = useState({
    smsAllCalls: initialNotificationSettings?.sms_all_calls ?? false,
    smsBookings: initialNotificationSettings?.sms_bookings ?? true,
    smsMissed: initialNotificationSettings?.sms_missed ?? true,
    smsMessages: initialNotificationSettings?.sms_messages ?? true,
    smsUsageAlerts: initialNotificationSettings?.sms_usage_alerts ?? true,
    emailDaily: initialNotificationSettings?.email_daily ?? false,
    emailWeekly: initialNotificationSettings?.email_weekly ?? true,
    smsCustomerConfirmation: initialNotificationSettings?.sms_customer_confirmation ?? true,
    smsCustomerReminder: (initialNotificationSettings?.sms_customer_reminder || "24hr") as ReminderSetting,
  });
  const [notificationSettingsModified, setNotificationSettingsModified] = useState(false);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Handle OAuth callback params (calendar tab)
  useEffect(() => {
    const success = searchParams.get("success");
    const urlError = searchParams.get("error");
    const tab = searchParams.get("tab");

    // Auto-switch to calendar tab if coming from OAuth callback
    if (tab === "calendar") {
      setActiveTab("calendar");
    }

    if (success) {
      setSuccessMessage(success);
      setCalendarConnected(true);
      // Clear URL params after reading
      router.replace("/settings?tab=calendar", { scroll: false });
      // Clear success after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    }

    if (urlError) {
      setError(urlError);
      router.replace("/settings?tab=calendar", { scroll: false });
    }
  }, [searchParams, router]);

  // Connect to a calendar provider
  const handleConnectCalendar = async (provider: "google" | "outlook") => {
    setIsConnecting(true);
    setError(null);

    try {
      // Check if OAuth is available for this provider
      const response = await fetch("/api/dashboard/settings/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          returnUrl: "/settings?tab=calendar",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to initiate connection");
      }

      if (!data.success && data.message) {
        throw new Error(data.message);
      }

      if (data.initiateUrl) {
        // Call the OAuth initiation endpoint
        const authResponse = await fetch(data.initiateUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ returnUrl: data.returnUrl }),
        });

        const authData = await authResponse.json();

        if (!authResponse.ok) {
          throw new Error(authData.error || "Failed to start OAuth");
        }

        if (authData.authUrl) {
          // Redirect to OAuth provider
          window.location.href = authData.authUrl;
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to connect calendar"
      );
      setIsConnecting(false);
    }
  };

  // Disconnect calendar
  const handleDisconnectCalendar = async () => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/dashboard/settings/calendar", {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to disconnect");
      }

      setCalendarSettings((prev) => ({ ...prev, provider: "built_in" }));
      setCalendarConnected(false);
      setSuccessMessage("Calendar disconnected");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to disconnect calendar"
      );
    } finally {
      setSaving(false);
    }
  };

  // Voice playback handler
  const handlePlayVoice = async (voice: VoiceSample) => {
    if (playingVoiceId === voice.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingVoiceId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setLoadingVoiceId(voice.id);
    setPlayingVoiceId(null);

    try {
      const audio = new Audio(voice.previewUrl);
      audioRef.current = audio;

      audio.oncanplaythrough = () => {
        setLoadingVoiceId(null);
        setPlayingVoiceId(voice.id);
        audio.play().catch(() => {});
      };

      audio.onended = () => {
        setPlayingVoiceId(null);
        audioRef.current = null;
      };

      audio.onerror = () => {
        setLoadingVoiceId(null);
        setPlayingVoiceId(null);
        audioRef.current = null;
      };

      audio.load();
    } catch (err) {
      setLoadingVoiceId(null);
      setPlayingVoiceId(null);
    }
  };

  // Filter voices by gender and bilingual support
  const filteredVoices = VOICE_SAMPLES.filter((voice) => {
    if (voice.gender !== selectedGender) return false;
    if (languageSettings.spanishEnabled && !voice.supportsBilingual) return false;
    return true;
  });

  // Save handlers
  const saveCallSettings = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/settings/call-handling", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(callSettings),
      });

      if (!res.ok) throw new Error("Failed to save call settings");

      setCallSettingsModified(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const saveVoiceSettings = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/settings/voice", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(voiceSettings),
      });

      if (!res.ok) throw new Error("Failed to save voice settings");

      setVoiceSettingsModified(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const saveLanguageSettings = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/settings/language", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(languageSettings),
      });

      if (!res.ok) throw new Error("Failed to save language settings");

      setLanguageSettingsModified(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const saveCalendarSettings = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/settings/calendar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(calendarSettings),
      });

      if (!res.ok) throw new Error("Failed to save calendar settings");

      setCalendarSettingsModified(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const saveNotificationSettings = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notificationSettings),
      });

      if (!res.ok) throw new Error("Failed to save notification settings");

      setNotificationSettingsModified(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Usage percentage
  const usagePercent = businessInfo.minutesIncluded > 0
    ? Math.round((businessInfo.minutesUsed / businessInfo.minutesIncluded) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Configure Koya&apos;s behavior and your preferences
          </p>
        </div>
        {saveSuccess && (
          <div className="flex items-center gap-2 text-emerald-500">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Saved</span>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Call Handling Tab */}
      {activeTab === "call-handling" && (
        <Card>
          <CardHeader>
            <CardTitle>Call Handling</CardTitle>
            <CardDescription>
              Configure how Koya handles transfers and after-hours calls
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Transfer Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Transfer Settings</h3>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="transferNumber">Primary transfer number</Label>
                  <Input
                    id="transferNumber"
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={callSettings.transferNumber}
                    onChange={(e) => {
                      setCallSettings({ ...callSettings, transferNumber: e.target.value });
                      setCallSettingsModified(true);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="backupNumber">Backup number (optional)</Label>
                  <Input
                    id="backupNumber"
                    type="tel"
                    placeholder="(555) 987-6543"
                    value={callSettings.backupTransferNumber}
                    onChange={(e) => {
                      setCallSettings({ ...callSettings, backupTransferNumber: e.target.value });
                      setCallSettingsModified(true);
                    }}
                  />
                </div>
              </div>

              {/* Transfer Triggers */}
              <div className="space-y-3">
                <Label>When should Koya transfer?</Label>
                
                <div className="space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={callSettings.transferOnRequest}
                      onCheckedChange={(checked) => {
                        setCallSettings({ ...callSettings, transferOnRequest: checked === true });
                        setCallSettingsModified(true);
                      }}
                    />
                    <div>
                      <span className="font-medium">When caller asks for a human</span>
                      <p className="text-sm text-muted-foreground">
                        &quot;Can I speak to someone?&quot;, &quot;Transfer me please&quot;
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={callSettings.transferOnEmergency}
                      onCheckedChange={(checked) => {
                        setCallSettings({ ...callSettings, transferOnEmergency: checked === true });
                        setCallSettingsModified(true);
                      }}
                    />
                    <div>
                      <span className="font-medium">For emergencies</span>
                      <p className="text-sm text-muted-foreground">
                        When caller mentions urgent issues
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={callSettings.transferOnUpset}
                      onCheckedChange={(checked) => {
                        setCallSettings({ ...callSettings, transferOnUpset: checked === true });
                        setCallSettingsModified(true);
                      }}
                    />
                    <div>
                      <span className="font-medium">When caller seems upset</span>
                      <p className="text-sm text-muted-foreground">
                        Koya detects frustration in the caller&apos;s tone
                      </p>
                    </div>
                  </label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="keywords">Custom transfer keywords</Label>
                  <Input
                    id="keywords"
                    placeholder="manager, supervisor, complaint"
                    value={callSettings.transferKeywords}
                    onChange={(e) => {
                      setCallSettings({ ...callSettings, transferKeywords: e.target.value });
                      setCallSettingsModified(true);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated words that trigger a transfer
                  </p>
                </div>
              </div>

              {/* Transfer Hours */}
              <div className="space-y-2">
                <Label>Transfer availability</Label>
                <Select
                  value={callSettings.transferHoursType}
                  onValueChange={(value: TransferHoursType) => {
                    setCallSettings({ ...callSettings, transferHoursType: value });
                    setCallSettingsModified(true);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSFER_HOURS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* After Hours */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-medium">After Hours Behavior</h3>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Koya answers after hours</Label>
                  <p className="text-sm text-muted-foreground">
                    Koya will still pick up calls outside business hours
                  </p>
                </div>
                <Switch
                  checked={callSettings.afterHoursEnabled}
                  onCheckedChange={(checked) => {
                    setCallSettings({ ...callSettings, afterHoursEnabled: checked });
                    setCallSettingsModified(true);
                  }}
                />
              </div>

              {callSettings.afterHoursEnabled && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Can book appointments after hours</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow callers to schedule appointments
                      </p>
                    </div>
                    <Switch
                      checked={callSettings.afterHoursCanBook}
                      onCheckedChange={(checked) => {
                        setCallSettings({ ...callSettings, afterHoursCanBook: checked });
                        setCallSettingsModified(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Message only mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Only take messages, no other services
                      </p>
                    </div>
                    <Switch
                      checked={callSettings.afterHoursMessageOnly}
                      onCheckedChange={(checked) => {
                        setCallSettings({ ...callSettings, afterHoursMessageOnly: checked });
                        setCallSettingsModified(true);
                      }}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Call Duration */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-medium">Call Duration</h3>
              <div className="space-y-2">
                <Label htmlFor="maxDuration">Maximum call duration (seconds)</Label>
                <Input
                  id="maxDuration"
                  type="number"
                  min={60}
                  max={3600}
                  value={callSettings.maxCallDurationSeconds}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 600;
                    setCallSettings({
                      ...callSettings,
                      maxCallDurationSeconds: Math.max(60, Math.min(3600, value)),
                    });
                    setCallSettingsModified(true);
                  }}
                  className="max-w-[200px]"
                />
                <p className="text-sm text-muted-foreground">
                  Calls will automatically end after this duration (60-3600 seconds). Default is 10 minutes (600s).
                </p>
              </div>
            </div>

            {/* Recording */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-medium">Recording</h3>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable call recording</Label>
                  <p className="text-sm text-muted-foreground">
                    Record calls for quality and training purposes
                  </p>
                </div>
                <Switch
                  checked={callSettings.recordingEnabled}
                  onCheckedChange={(checked) => {
                    setCallSettings({ ...callSettings, recordingEnabled: checked });
                    setCallSettingsModified(true);
                  }}
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={saveCallSettings} disabled={saving || !callSettingsModified}>
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

      {/* Voice & Personality Tab */}
      {activeTab === "voice" && (
        <Card>
          <CardHeader>
            <CardTitle>Voice & Personality</CardTitle>
            <CardDescription>
              Customize how Koya sounds and interacts with callers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Voice Selection */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Voice</h3>
              
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={selectedGender === "female" ? "default" : "outline"}
                  onClick={() => setSelectedGender("female")}
                  className="flex-1"
                >
                  Female Voices
                </Button>
                <Button
                  type="button"
                  variant={selectedGender === "male" ? "default" : "outline"}
                  onClick={() => setSelectedGender("male")}
                  className="flex-1"
                >
                  Male Voices
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredVoices.map((voice) => (
                  <div
                    key={voice.id}
                    className={`relative rounded-lg border p-4 cursor-pointer transition-all ${
                      voiceSettings.voiceId === voice.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-muted hover:border-muted-foreground/50"
                    }`}
                    onClick={() => {
                      setVoiceSettings({
                        ...voiceSettings,
                        voiceId: voice.id,
                        voiceIdSpanish: voice.supportsBilingual ? voice.id : voiceSettings.voiceIdSpanish,
                      });
                      setVoiceSettingsModified(true);
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">{voice.name}</h4>
                        <p className="text-sm text-muted-foreground capitalize">
                          {STYLE_DESCRIPTIONS[voice.style]}
                        </p>
                        {voice.supportsBilingual && (
                          <Badge variant="secondary" className="mt-1 text-xs">
                            Bilingual
                          </Badge>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-10 w-10 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayVoice(voice);
                        }}
                        disabled={loadingVoiceId === voice.id}
                      >
                        {loadingVoiceId === voice.id ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : playingVoiceId === voice.id ? (
                          <Pause className="h-5 w-5" />
                        ) : (
                          <Play className="h-5 w-5" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Name */}
            <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="aiName">AI Assistant Name</Label>
              <Input
                id="aiName"
                value={voiceSettings.aiName}
                onChange={(e) => {
                  setVoiceSettings({ ...voiceSettings, aiName: e.target.value });
                  setVoiceSettingsModified(true);
                }}
                placeholder="Koya"
              />
            </div>

            {/* Personality */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Personality</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                {PERSONALITY_OPTIONS.map((option) => (
                  <div
                    key={option.value}
                    className={`rounded-lg border p-4 cursor-pointer transition-all ${
                      voiceSettings.personality === option.value
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-muted hover:border-muted-foreground/50"
                    }`}
                    onClick={() => {
                      setVoiceSettings({ ...voiceSettings, personality: option.value });
                      setVoiceSettingsModified(true);
                    }}
                  >
                    <h4 className="font-medium">{option.label}</h4>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Greetings */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-medium">Greetings</h3>
              
              <div className="space-y-2">
                <Label htmlFor="greeting">English greeting</Label>
                <Textarea
                  id="greeting"
                  value={voiceSettings.greeting}
                  onChange={(e) => {
                    setVoiceSettings({ ...voiceSettings, greeting: e.target.value });
                    setVoiceSettingsModified(true);
                  }}
                  placeholder={`Thanks for calling ${businessInfo.name}, this is ${voiceSettings.aiName}. How can I help you today?`}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="afterHoursGreeting">After-hours greeting</Label>
                <Textarea
                  id="afterHoursGreeting"
                  value={voiceSettings.afterHoursGreeting}
                  onChange={(e) => {
                    setVoiceSettings({ ...voiceSettings, afterHoursGreeting: e.target.value });
                    setVoiceSettingsModified(true);
                  }}
                  placeholder="Thanks for calling. We're currently closed, but I'd be happy to help you schedule an appointment..."
                  rows={2}
                />
              </div>

              {languageSettings.spanishEnabled && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="greetingSpanish">Spanish greeting</Label>
                    <Textarea
                      id="greetingSpanish"
                      value={voiceSettings.greetingSpanish}
                      onChange={(e) => {
                        setVoiceSettings({ ...voiceSettings, greetingSpanish: e.target.value });
                        setVoiceSettingsModified(true);
                      }}
                      placeholder={`Gracias por llamar a ${businessInfo.name}, soy ${voiceSettings.aiName}. ¿En qué puedo ayudarle?`}
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="afterHoursGreetingSpanish">Spanish after-hours greeting</Label>
                    <Textarea
                      id="afterHoursGreetingSpanish"
                      value={voiceSettings.afterHoursGreetingSpanish}
                      onChange={(e) => {
                        setVoiceSettings({ ...voiceSettings, afterHoursGreetingSpanish: e.target.value });
                        setVoiceSettingsModified(true);
                      }}
                      placeholder="Gracias por llamar. Actualmente estamos cerrados..."
                      rows={2}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={saveVoiceSettings} disabled={saving || !voiceSettingsModified}>
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

      {/* Language Tab */}
      {activeTab === "language" && (
        <Card>
          <CardHeader>
            <CardTitle>Language Settings</CardTitle>
            <CardDescription>
              Configure which languages Koya should support
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Language Options */}
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🇺🇸</span>
                  <div>
                    <p className="font-medium">English</p>
                    <p className="text-sm text-muted-foreground">Always enabled</p>
                  </div>
                </div>
                <Switch checked disabled />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🇪🇸</span>
                  <div>
                    <p className="font-medium">Spanish / Español</p>
                    <p className="text-sm text-muted-foreground">
                      Enable bilingual support
                    </p>
                  </div>
                </div>
                <Switch
                  checked={languageSettings.spanishEnabled}
                  onCheckedChange={(checked) => {
                    setLanguageSettings({ ...languageSettings, spanishEnabled: checked });
                    setLanguageSettingsModified(true);
                  }}
                />
              </div>
            </div>

            {/* Language Mode */}
            {languageSettings.spanishEnabled && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Language Detection Mode</h3>
                <div className="space-y-2">
                  {LANGUAGE_MODE_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-4 transition-all ${
                        languageSettings.languageMode === option.value
                          ? "border-primary bg-primary/5"
                          : "border-muted hover:border-muted-foreground/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="languageMode"
                          value={option.value}
                          checked={languageSettings.languageMode === option.value}
                          onChange={() => {
                            setLanguageSettings({ ...languageSettings, languageMode: option.value });
                            setLanguageSettingsModified(true);
                          }}
                          className="h-4 w-4 text-primary"
                        />
                        <span className="font-medium">{option.label}</span>
                      </div>
                      <p className="ml-7 text-sm text-muted-foreground">
                        {option.description}
                      </p>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {!languageSettings.spanishEnabled && (
              <div className="rounded-lg border border-muted bg-muted/30 p-6 text-center">
                <Globe className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">
                  Enable Spanish support above to configure bilingual settings.
                </p>
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={saveLanguageSettings} disabled={saving || !languageSettingsModified}>
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

      {/* Calendar Tab */}
      {activeTab === "calendar" && (
        <Card>
          <CardHeader>
            <CardTitle>Calendar Integration</CardTitle>
            <CardDescription>
              Connect your calendar for automatic availability sync
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Success Message */}
            {successMessage && (
              <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4 text-green-400 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                {successMessage}
              </div>
            )}

            {/* Calendar Provider */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Calendar Provider</h3>

              {/* Connected State */}
              {calendarConnected && calendarSettings.provider !== "built_in" && (
                <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-6 w-6 text-green-500" />
                      <div>
                        <h4 className="font-medium text-green-400">
                          Connected to {calendarSettings.provider === "google" ? "Google Calendar" : "Outlook Calendar"}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Your appointments will sync automatically
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDisconnectCalendar}
                      disabled={saving}
                      className="text-red-400 border-red-400/30 hover:bg-red-500/10"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Unlink className="w-4 h-4 mr-2" />
                      )}
                      Disconnect
                    </Button>
                  </div>
                </div>
              )}

              {/* Provider Selection */}
              {!calendarConnected && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div
                    className={`rounded-lg border p-4 cursor-pointer transition-all ${
                      calendarSettings.provider === "built_in"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-muted hover:border-muted-foreground/50"
                    }`}
                    onClick={() => {
                      setCalendarSettings({ ...calendarSettings, provider: "built_in" });
                      setCalendarSettingsModified(true);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="w-8 h-8 text-primary" />
                      <div>
                        <h4 className="font-medium">Built-in Calendar</h4>
                        <p className="text-sm text-muted-foreground">Use Koya&apos;s calendar</p>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`rounded-lg border p-4 cursor-pointer transition-all ${
                      calendarSettings.provider === "google" && !calendarConnected
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/50"
                    }`}
                    onClick={() => handleConnectCalendar("google")}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-white flex items-center justify-center">
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-medium">Google Calendar</h4>
                        <p className="text-sm text-muted-foreground">
                          {isConnecting ? "Connecting..." : "Click to connect"}
                        </p>
                      </div>
                    </div>
                    {isConnecting && (
                      <Loader2 className="w-4 h-4 animate-spin mt-2 ml-11" />
                    )}
                  </div>

                  <div
                    className={`rounded-lg border p-4 cursor-pointer transition-all ${
                      calendarSettings.provider === "outlook" && !calendarConnected
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/50"
                    }`}
                    onClick={() => handleConnectCalendar("outlook")}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded flex items-center justify-center">
                        <svg className="w-6 h-6" viewBox="0 0 24 24">
                          <path d="M11.4 24H0V12.6h11.4V24z" fill="#00A4EF"/>
                          <path d="M24 24H12.6V12.6H24V24z" fill="#FFB900"/>
                          <path d="M11.4 11.4H0V0h11.4v11.4z" fill="#F25022"/>
                          <path d="M24 11.4H12.6V0H24v11.4z" fill="#7FBA00"/>
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-medium">Outlook Calendar</h4>
                        <p className="text-sm text-muted-foreground">
                          {isConnecting ? "Connecting..." : "Click to connect"}
                        </p>
                      </div>
                    </div>
                    {isConnecting && (
                      <Loader2 className="w-4 h-4 animate-spin mt-2 ml-11" />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Booking Settings */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-medium">Booking Settings</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="duration">Default appointment duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min={15}
                    max={480}
                    value={calendarSettings.defaultDurationMinutes}
                    onChange={(e) => {
                      setCalendarSettings({
                        ...calendarSettings,
                        defaultDurationMinutes: parseInt(e.target.value) || 60,
                      });
                      setCalendarSettingsModified(true);
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="buffer">Buffer between appointments (minutes)</Label>
                  <Input
                    id="buffer"
                    type="number"
                    min={0}
                    max={120}
                    value={calendarSettings.bufferMinutes}
                    onChange={(e) => {
                      setCalendarSettings({
                        ...calendarSettings,
                        bufferMinutes: parseInt(e.target.value) || 0,
                      });
                      setCalendarSettingsModified(true);
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="advance">How far in advance can customers book (days)</Label>
                  <Input
                    id="advance"
                    type="number"
                    min={1}
                    max={90}
                    value={calendarSettings.advanceBookingDays}
                    onChange={(e) => {
                      setCalendarSettings({
                        ...calendarSettings,
                        advanceBookingDays: parseInt(e.target.value) || 14,
                      });
                      setCalendarSettingsModified(true);
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Require email for bookings</Label>
                  <p className="text-sm text-muted-foreground">
                    Ask callers for their email address when booking
                  </p>
                </div>
                <Switch
                  checked={calendarSettings.requireEmail}
                  onCheckedChange={(checked) => {
                    setCalendarSettings({ ...calendarSettings, requireEmail: checked });
                    setCalendarSettingsModified(true);
                  }}
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={saveCalendarSettings} disabled={saving || !calendarSettingsModified}>
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

      {/* Notifications Tab */}
      {activeTab === "notifications" && (
        <Card>
          <CardHeader>
            <CardTitle>Notification Preferences</CardTitle>
            <CardDescription>
              Choose how you want to be notified about calls and bookings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Owner SMS Notifications */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">SMS Notifications (to you)</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>All calls</Label>
                    <p className="text-sm text-muted-foreground">Get notified for every call</p>
                  </div>
                  <Switch
                    checked={notificationSettings.smsAllCalls}
                    onCheckedChange={(checked) => {
                      setNotificationSettings({ ...notificationSettings, smsAllCalls: checked });
                      setNotificationSettingsModified(true);
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>New bookings</Label>
                    <p className="text-sm text-muted-foreground">When someone books an appointment</p>
                  </div>
                  <Switch
                    checked={notificationSettings.smsBookings}
                    onCheckedChange={(checked) => {
                      setNotificationSettings({ ...notificationSettings, smsBookings: checked });
                      setNotificationSettingsModified(true);
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Missed calls</Label>
                    <p className="text-sm text-muted-foreground">When a call goes unanswered</p>
                  </div>
                  <Switch
                    checked={notificationSettings.smsMissed}
                    onCheckedChange={(checked) => {
                      setNotificationSettings({ ...notificationSettings, smsMissed: checked });
                      setNotificationSettingsModified(true);
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Messages taken</Label>
                    <p className="text-sm text-muted-foreground">When Koya takes a message</p>
                  </div>
                  <Switch
                    checked={notificationSettings.smsMessages}
                    onCheckedChange={(checked) => {
                      setNotificationSettings({ ...notificationSettings, smsMessages: checked });
                      setNotificationSettingsModified(true);
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Usage alerts</Label>
                    <p className="text-sm text-muted-foreground">When you&apos;re running low on minutes</p>
                  </div>
                  <Switch
                    checked={notificationSettings.smsUsageAlerts}
                    onCheckedChange={(checked) => {
                      setNotificationSettings({ ...notificationSettings, smsUsageAlerts: checked });
                      setNotificationSettingsModified(true);
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Owner Email Notifications */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-medium">Email Notifications (to you)</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Daily summary</Label>
                    <p className="text-sm text-muted-foreground">
                      Daily recap of calls and bookings
                    </p>
                  </div>
                  <Switch
                    checked={notificationSettings.emailDaily}
                    onCheckedChange={(checked) => {
                      setNotificationSettings({ ...notificationSettings, emailDaily: checked });
                      setNotificationSettingsModified(true);
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Weekly summary</Label>
                    <p className="text-sm text-muted-foreground">
                      Weekly recap with stats and insights
                    </p>
                  </div>
                  <Switch
                    checked={notificationSettings.emailWeekly}
                    onCheckedChange={(checked) => {
                      setNotificationSettings({ ...notificationSettings, emailWeekly: checked });
                      setNotificationSettingsModified(true);
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Customer Notifications */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-medium">Customer Notifications</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Booking confirmation</Label>
                    <p className="text-sm text-muted-foreground">
                      Send SMS confirmation when customers book
                    </p>
                  </div>
                  <Switch
                    checked={notificationSettings.smsCustomerConfirmation}
                    onCheckedChange={(checked) => {
                      setNotificationSettings({ ...notificationSettings, smsCustomerConfirmation: checked });
                      setNotificationSettingsModified(true);
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Appointment reminders</Label>
                  <Select
                    value={notificationSettings.smsCustomerReminder}
                    onValueChange={(value: ReminderSetting) => {
                      setNotificationSettings({ ...notificationSettings, smsCustomerReminder: value });
                      setNotificationSettingsModified(true);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REMINDER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={saveNotificationSettings} disabled={saving || !notificationSettingsModified}>
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

      {/* Phone & Billing Tab */}
      {activeTab === "phone-billing" && (
        <div className="space-y-6">
          {/* Phone Number Card */}
          <Card>
            <CardHeader>
              <CardTitle>Phone Number</CardTitle>
              <CardDescription>
                Your Koya phone number that customers call
              </CardDescription>
            </CardHeader>
            <CardContent>
              {initialPhoneNumbers.length > 0 ? (
                <div className="space-y-4">
                  {initialPhoneNumbers.map((phone) => (
                    <div key={phone.id} className="flex items-center justify-between rounded-lg border p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <Phone className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium font-mono">{phone.number}</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {phone.setup_type === "forwarded" ? `Forwarded from ${phone.forwarded_from}` : "Direct"}
                          </p>
                        </div>
                      </div>
                      <Badge variant={phone.is_active ? "default" : "secondary"}>
                        {phone.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <Phone className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">
                    No phone number assigned yet
                  </p>
                  <Button className="mt-4" variant="outline">
                    Set Up Phone Number
                  </Button>
                </div>
              )}

              {/* Forwarding Help */}
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Need help setting up call forwarding?</p>
                    <p className="text-sm text-muted-foreground">
                      Forward your existing business number to Koya so callers reach your AI receptionist.
                    </p>
                    <a
                      href="https://support.koya.ai/call-forwarding-setup"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                    >
                      View forwarding setup guide
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Usage Card */}
          <Card>
            <CardHeader>
              <CardTitle>Usage This Cycle</CardTitle>
              <CardDescription>
                {businessInfo.cycleStart && businessInfo.cycleEnd && (
                  <>
                    {new Date(businessInfo.cycleStart).toLocaleDateString()} -{" "}
                    {new Date(businessInfo.cycleEnd).toLocaleDateString()}
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {businessInfo.minutesUsed} / {businessInfo.minutesIncluded} min
                </span>
                <Badge
                  variant={usagePercent >= 80 ? "destructive" : usagePercent >= 50 ? "secondary" : "default"}
                >
                  {usagePercent}% used
                </Badge>
              </div>

              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    usagePercent >= 80
                      ? "bg-red-500"
                      : usagePercent >= 50
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                />
              </div>

              {/* Days until reset */}
              {businessInfo.cycleEnd && (
                <p className="text-sm text-muted-foreground">
                  {(() => {
                    const daysUntilReset = Math.max(
                      0,
                      Math.ceil(
                        (new Date(businessInfo.cycleEnd).getTime() - Date.now()) /
                          (1000 * 60 * 60 * 24)
                      )
                    );
                    return daysUntilReset === 0
                      ? "Resets today"
                      : daysUntilReset === 1
                      ? "Resets tomorrow"
                      : `Resets in ${daysUntilReset} days`;
                  })()}
                </p>
              )}

              {usagePercent >= 80 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    You&apos;re running low on minutes. Consider upgrading your plan to avoid interruption.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Plan & Billing Card */}
          <Card>
            <CardHeader>
              <CardTitle>Plan & Billing</CardTitle>
              <CardDescription>
                Manage your subscription and payment methods
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">{businessInfo.planName} Plan</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    Status: {businessInfo.subscriptionStatus}
                  </p>
                </div>
                <Button variant="outline" asChild>
                  <a
                    href={businessInfo.stripeCustomerId ? "/api/stripe/portal" : "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Manage Billing
                  </a>
                </Button>
              </div>

              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">
                  Account email: <span className="font-medium text-foreground">{businessInfo.userEmail}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
