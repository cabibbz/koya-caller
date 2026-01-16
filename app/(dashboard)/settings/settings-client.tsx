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
  Sparkles,
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
import { Slider } from "@/components/ui/slider";
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
import { toast } from "@/hooks/use-toast";

interface PromptConfig {
  industryEnhancements: boolean;
  fewShotExamplesEnabled: boolean;
  sentimentDetectionLevel: SentimentDetectionLevel;
  callerContextEnabled: boolean;
  toneIntensity: ToneIntensity;
  personalityAwareErrors: boolean;
  maxFewShotExamples: number;
}

const DEFAULT_PROMPT_CONFIG: PromptConfig = {
  industryEnhancements: true,
  fewShotExamplesEnabled: true,
  sentimentDetectionLevel: "basic",
  callerContextEnabled: true,
  toneIntensity: 3,
  personalityAwareErrors: true,
  maxFewShotExamples: 3,
};

interface InitialPromptConfig {
  industryEnhancements?: boolean;
  fewShotExamplesEnabled?: boolean;
  sentimentDetectionLevel?: SentimentDetectionLevel;
  callerContextEnabled?: boolean;
  toneIntensity?: ToneIntensity;
  personalityAwareErrors?: boolean;
  maxFewShotExamples?: number;
}

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
  initialPromptConfig?: InitialPromptConfig | null;
}

type Tab = "call-handling" | "call-features" | "voice" | "language" | "calendar" | "notifications" | "phone-billing" | "advanced-ai";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "call-handling", label: "Call Handling", icon: Phone },
  { id: "call-features", label: "Call Features", icon: Sparkles },
  { id: "voice", label: "Voice & Personality", icon: Mic },
  { id: "language", label: "Language", icon: Globe },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "phone-billing", label: "Phone & Billing", icon: CreditCard },
  { id: "advanced-ai", label: "Advanced AI", icon: Sparkles },
];

type SentimentDetectionLevel = "none" | "basic" | "advanced";
type ToneIntensity = 1 | 2 | 3 | 4 | 5;

const SENTIMENT_LEVEL_OPTIONS: { value: SentimentDetectionLevel; label: string; description: string }[] = [
  { value: "none", label: "Off", description: "No sentiment detection" },
  { value: "basic", label: "Basic", description: "Detect frustrated and upset callers" },
  { value: "advanced", label: "Advanced", description: "Full emotion detection with de-escalation" },
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
  businessId: _businessId,
  businessInfo,
  initialCallSettings,
  initialAiConfig,
  initialCalendarIntegration,
  initialNotificationSettings,
  initialPhoneNumbers,
  initialPromptConfig,
}: SettingsClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("call-handling");
  const [saving, setSaving] = useState(false);

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
    fallbackVoiceIds: (initialAiConfig as unknown as Record<string, unknown>)?.fallback_voice_ids as string[] || [],
    // Voice control settings
    voiceTemperature: (initialAiConfig as unknown as Record<string, unknown>)?.voice_temperature as number ?? 1.0,
    voiceSpeed: (initialAiConfig as unknown as Record<string, unknown>)?.voice_speed as number ?? 1.0,
    voiceVolume: (initialAiConfig as unknown as Record<string, unknown>)?.voice_volume as number ?? 1.0,
    beginMessageDelayMs: (initialAiConfig as unknown as Record<string, unknown>)?.begin_message_delay_ms as number ?? 0,
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

  // Advanced AI state
  const [advancedAiSettings, setAdvancedAiSettings] = useState<PromptConfig>({
    industryEnhancements: initialPromptConfig?.industryEnhancements ?? DEFAULT_PROMPT_CONFIG.industryEnhancements,
    fewShotExamplesEnabled: initialPromptConfig?.fewShotExamplesEnabled ?? DEFAULT_PROMPT_CONFIG.fewShotExamplesEnabled,
    sentimentDetectionLevel: initialPromptConfig?.sentimentDetectionLevel ?? DEFAULT_PROMPT_CONFIG.sentimentDetectionLevel,
    callerContextEnabled: initialPromptConfig?.callerContextEnabled ?? DEFAULT_PROMPT_CONFIG.callerContextEnabled,
    toneIntensity: initialPromptConfig?.toneIntensity ?? DEFAULT_PROMPT_CONFIG.toneIntensity,
    personalityAwareErrors: initialPromptConfig?.personalityAwareErrors ?? DEFAULT_PROMPT_CONFIG.personalityAwareErrors,
    maxFewShotExamples: initialPromptConfig?.maxFewShotExamples ?? DEFAULT_PROMPT_CONFIG.maxFewShotExamples,
  });
  const [advancedAiSettingsModified, setAdvancedAiSettingsModified] = useState(false);

  // Call Features state (Retell advanced features)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const callSettingsData = initialCallSettings as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aiConfigData = initialAiConfig as any;
  const [callFeaturesSettings, setCallFeaturesSettings] = useState({
    // Voicemail Detection
    voicemailDetectionEnabled: callSettingsData?.voicemail_detection_enabled ?? false,
    voicemailMessage: callSettingsData?.voicemail_message || "",
    voicemailDetectionTimeoutMs: callSettingsData?.voicemail_detection_timeout_ms || 30000,
    // Silence Handling
    reminderTriggerMs: callSettingsData?.reminder_trigger_ms || 10000,
    reminderMaxCount: callSettingsData?.reminder_max_count ?? 2,
    endCallAfterSilenceMs: callSettingsData?.end_call_after_silence_ms || 30000,
    // DTMF Input
    dtmfEnabled: callSettingsData?.dtmf_enabled ?? false,
    dtmfDigitLimit: callSettingsData?.dtmf_digit_limit || 10,
    dtmfTerminationKey: callSettingsData?.dtmf_termination_key || "#",
    dtmfTimeoutMs: callSettingsData?.dtmf_timeout_ms || 5000,
    // Denoising
    denoisingMode: callSettingsData?.denoising_mode || "noise-cancellation",
    // Responsiveness (how quickly Koya responds and stops when caller talks)
    interruptionSensitivity: callSettingsData?.interruption_sensitivity ?? 0.9,
    responsiveness: callSettingsData?.responsiveness ?? 0.9,
  });
  const [callFeaturesModified, setCallFeaturesModified] = useState(false);

  // Advanced AI Retell features state
  const [advancedRetellSettings, setAdvancedRetellSettings] = useState({
    boostedKeywords: (aiConfigData?.boosted_keywords || []).join(", "),
    analysisSummaryPrompt: aiConfigData?.analysis_summary_prompt || "",
    analysisModel: aiConfigData?.analysis_model || "gpt-4.1-mini",
    piiRedactionEnabled: callSettingsData?.pii_redaction_enabled ?? false,
    piiCategories: callSettingsData?.pii_categories || ["ssn", "credit_card"],
    fallbackVoiceIds: aiConfigData?.fallback_voice_ids || [],
  });
  const [advancedRetellModified, setAdvancedRetellModified] = useState(false);

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
      toast({ title: "Calendar connection failed", description: urlError, variant: "destructive" });
      router.replace("/settings?tab=calendar", { scroll: false });
    }
  }, [searchParams, router]);

  // Allowed OAuth redirect domains
  const ALLOWED_OAUTH_DOMAINS = [
    "accounts.google.com",
    "login.microsoftonline.com",
    "login.live.com",
  ];

  // Validate OAuth URL is from a trusted provider
  const isValidOAuthUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return ALLOWED_OAUTH_DOMAINS.some(
        (domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
      );
    } catch {
      return false;
    }
  };

  // Connect to a calendar provider
  const handleConnectCalendar = async (provider: "google" | "outlook") => {
    setIsConnecting(true);

    try {
      // Check if OAuth is available for this provider
      const response = await fetch("/api/dashboard/settings/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          // Use relative path only - server validates and constructs full URL
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
        // Validate initiateUrl is a relative path (starts with /)
        if (!data.initiateUrl.startsWith("/")) {
          throw new Error("Invalid OAuth initiation URL");
        }

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
          // Validate the auth URL is from a trusted OAuth provider
          if (!isValidOAuthUrl(authData.authUrl)) {
            throw new Error("Untrusted OAuth provider URL");
          }
          // Redirect to OAuth provider
          window.location.href = authData.authUrl;
        }
      }
    } catch (err) {
      toast({
        title: "Failed to connect calendar",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive"
      });
      setIsConnecting(false);
    }
  };

  // Disconnect calendar
  const handleDisconnectCalendar = async () => {
    setSaving(true);

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
      toast({ title: "Calendar disconnected", variant: "success" });
    } catch (err) {
      toast({
        title: "Failed to disconnect calendar",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive"
      });
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
    } catch (_err) {
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
    try {
      const res = await fetch("/api/dashboard/settings/call-handling", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(callSettings),
      });

      if (!res.ok) throw new Error("Failed to save call settings");

      setCallSettingsModified(false);
      toast({ title: "Call settings saved", variant: "success" });
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

  const saveCallFeaturesSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/settings/call-features", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(callFeaturesSettings),
      });

      if (!res.ok) throw new Error("Failed to save call features settings");

      setCallFeaturesModified(false);
      toast({ title: "Call features saved", variant: "success" });
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

  const saveVoiceSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/settings/voice", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(voiceSettings),
      });

      if (!res.ok) throw new Error("Failed to save voice settings");

      setVoiceSettingsModified(false);
      toast({ title: "Voice settings saved", variant: "success" });
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

  const saveLanguageSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/settings/language", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(languageSettings),
      });

      if (!res.ok) throw new Error("Failed to save language settings");

      setLanguageSettingsModified(false);
      toast({ title: "Language settings saved", variant: "success" });
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

  const saveCalendarSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/settings/calendar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(calendarSettings),
      });

      if (!res.ok) throw new Error("Failed to save calendar settings");

      setCalendarSettingsModified(false);
      toast({ title: "Calendar settings saved", variant: "success" });
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

  const saveNotificationSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notificationSettings),
      });

      if (!res.ok) throw new Error("Failed to save notification settings");

      setNotificationSettingsModified(false);
      toast({ title: "Notification settings saved", variant: "success" });
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

  const saveAdvancedAiSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/settings/advanced-ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...advancedAiSettings,
          // Include Retell advanced settings
          boostedKeywords: advancedRetellSettings.boostedKeywords,
          analysisSummaryPrompt: advancedRetellSettings.analysisSummaryPrompt,
          analysisModel: advancedRetellSettings.analysisModel,
          piiRedactionEnabled: advancedRetellSettings.piiRedactionEnabled,
          piiCategories: advancedRetellSettings.piiCategories,
        }),
      });

      if (!res.ok) throw new Error("Failed to save advanced AI settings");

      setAdvancedAiSettingsModified(false);
      setAdvancedRetellModified(false);
      toast({ title: "Advanced AI settings saved", variant: "success" });
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
      </div>

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

      {/* Call Features Tab */}
      {activeTab === "call-features" && (
        <Card>
          <CardHeader>
            <CardTitle>Call Features</CardTitle>
            <CardDescription>
              Configure advanced call handling features powered by Retell AI
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Voicemail Detection */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Voicemail Detection</h3>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable voicemail detection</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically detect and leave a message on voicemail
                  </p>
                </div>
                <Switch
                  checked={callFeaturesSettings.voicemailDetectionEnabled}
                  onCheckedChange={(checked) => {
                    setCallFeaturesSettings({ ...callFeaturesSettings, voicemailDetectionEnabled: checked });
                    setCallFeaturesModified(true);
                  }}
                />
              </div>

              {callFeaturesSettings.voicemailDetectionEnabled && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="voicemailMessage">Voicemail message</Label>
                    <Textarea
                      id="voicemailMessage"
                      placeholder="Hi, this is Koya from [business]. We'll call you back shortly."
                      value={callFeaturesSettings.voicemailMessage}
                      onChange={(e) => {
                        setCallFeaturesSettings({ ...callFeaturesSettings, voicemailMessage: e.target.value });
                        setCallFeaturesModified(true);
                      }}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="voicemailTimeout">Detection timeout (seconds)</Label>
                    <Input
                      id="voicemailTimeout"
                      type="number"
                      min={5}
                      max={180}
                      value={callFeaturesSettings.voicemailDetectionTimeoutMs / 1000}
                      onChange={(e) => {
                        const seconds = Math.max(5, Math.min(180, parseInt(e.target.value) || 30));
                        setCallFeaturesSettings({ ...callFeaturesSettings, voicemailDetectionTimeoutMs: seconds * 1000 });
                        setCallFeaturesModified(true);
                      }}
                      className="max-w-[150px]"
                    />
                    <p className="text-xs text-muted-foreground">Time to wait for voicemail detection (5-180 seconds)</p>
                  </div>
                </>
              )}
            </div>

            {/* Silence Handling */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-medium">Silence Handling</h3>
              <p className="text-sm text-muted-foreground">
                Configure how Koya handles silent callers
              </p>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="reminderTrigger">Prompt after (seconds)</Label>
                  <Input
                    id="reminderTrigger"
                    type="number"
                    min={5}
                    max={60}
                    value={callFeaturesSettings.reminderTriggerMs / 1000}
                    onChange={(e) => {
                      const seconds = Math.max(5, Math.min(60, parseInt(e.target.value) || 10));
                      setCallFeaturesSettings({ ...callFeaturesSettings, reminderTriggerMs: seconds * 1000 });
                      setCallFeaturesModified(true);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">Silence before prompting</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reminderCount">Max reminders</Label>
                  <Input
                    id="reminderCount"
                    type="number"
                    min={0}
                    max={10}
                    value={callFeaturesSettings.reminderMaxCount}
                    onChange={(e) => {
                      const count = Math.max(0, Math.min(10, parseInt(e.target.value) || 2));
                      setCallFeaturesSettings({ ...callFeaturesSettings, reminderMaxCount: count });
                      setCallFeaturesModified(true);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">Prompts before ending</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endCallSilence">End call after (seconds)</Label>
                  <Input
                    id="endCallSilence"
                    type="number"
                    min={10}
                    max={120}
                    value={callFeaturesSettings.endCallAfterSilenceMs / 1000}
                    onChange={(e) => {
                      const seconds = Math.max(10, Math.min(120, parseInt(e.target.value) || 30));
                      setCallFeaturesSettings({ ...callFeaturesSettings, endCallAfterSilenceMs: seconds * 1000 });
                      setCallFeaturesModified(true);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">Total silence to end call</p>
                </div>
              </div>
            </div>

            {/* DTMF Input */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-medium">Touch-Tone Input (DTMF)</h3>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Allow callers to enter digits</Label>
                  <p className="text-sm text-muted-foreground">
                    Callers can use their keypad for account numbers, extensions, etc.
                  </p>
                </div>
                <Switch
                  checked={callFeaturesSettings.dtmfEnabled}
                  onCheckedChange={(checked) => {
                    setCallFeaturesSettings({ ...callFeaturesSettings, dtmfEnabled: checked });
                    setCallFeaturesModified(true);
                  }}
                />
              </div>

              {callFeaturesSettings.dtmfEnabled && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="dtmfLimit">Max digits</Label>
                    <Input
                      id="dtmfLimit"
                      type="number"
                      min={1}
                      max={50}
                      value={callFeaturesSettings.dtmfDigitLimit}
                      onChange={(e) => {
                        const limit = Math.max(1, Math.min(50, parseInt(e.target.value) || 10));
                        setCallFeaturesSettings({ ...callFeaturesSettings, dtmfDigitLimit: limit });
                        setCallFeaturesModified(true);
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dtmfKey">End key</Label>
                    <Select
                      value={callFeaturesSettings.dtmfTerminationKey}
                      onValueChange={(value) => {
                        setCallFeaturesSettings({ ...callFeaturesSettings, dtmfTerminationKey: value });
                        setCallFeaturesModified(true);
                      }}
                    >
                      <SelectTrigger id="dtmfKey">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="#"># (pound)</SelectItem>
                        <SelectItem value="*">* (star)</SelectItem>
                        <SelectItem value="none">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dtmfTimeout">Input timeout (seconds)</Label>
                    <Input
                      id="dtmfTimeout"
                      type="number"
                      min={1}
                      max={15}
                      value={callFeaturesSettings.dtmfTimeoutMs / 1000}
                      onChange={(e) => {
                        const seconds = Math.max(1, Math.min(15, parseInt(e.target.value) || 5));
                        setCallFeaturesSettings({ ...callFeaturesSettings, dtmfTimeoutMs: seconds * 1000 });
                        setCallFeaturesModified(true);
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Audio Quality */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-medium">Audio Quality</h3>
              <div className="space-y-2">
                <Label>Background noise reduction</Label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="denoising"
                      checked={callFeaturesSettings.denoisingMode === "noise-cancellation"}
                      onChange={() => {
                        setCallFeaturesSettings({ ...callFeaturesSettings, denoisingMode: "noise-cancellation" });
                        setCallFeaturesModified(true);
                      }}
                      className="w-4 h-4"
                    />
                    <div>
                      <span className="font-medium">Standard</span>
                      <p className="text-sm text-muted-foreground">Basic noise cancellation</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="denoising"
                      checked={callFeaturesSettings.denoisingMode === "noise-and-background-speech-cancellation"}
                      onChange={() => {
                        setCallFeaturesSettings({ ...callFeaturesSettings, denoisingMode: "noise-and-background-speech-cancellation" });
                        setCallFeaturesModified(true);
                      }}
                      className="w-4 h-4"
                    />
                    <div>
                      <span className="font-medium">Aggressive</span>
                      <p className="text-sm text-muted-foreground">Removes noise and background speech</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Responsiveness Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Responsiveness</h3>
              <p className="text-sm text-muted-foreground">
                Control how quickly Koya responds and reacts when callers speak
              </p>

              {/* Interruption Sensitivity */}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="interruptionSensitivity">Interruption Sensitivity</Label>
                  <p className="text-sm text-muted-foreground">
                    How quickly Koya stops talking when the caller starts speaking
                  </p>
                </div>
                <Slider
                  id="interruptionSensitivity"
                  value={callFeaturesSettings.interruptionSensitivity}
                  onChange={(value) => {
                    setCallFeaturesSettings({ ...callFeaturesSettings, interruptionSensitivity: value });
                    setCallFeaturesModified(true);
                  }}
                  min={0}
                  max={1}
                  step={0.1}
                  valueLabel={(v) => {
                    if (v >= 0.8) return "Very High";
                    if (v >= 0.6) return "High";
                    if (v >= 0.4) return "Medium";
                    if (v >= 0.2) return "Low";
                    return "Very Low";
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Higher = Koya stops immediately when caller speaks (recommended: Very High)
                </p>
              </div>

              {/* Response Speed */}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="responsiveness">Response Speed</Label>
                  <p className="text-sm text-muted-foreground">
                    How fast Koya responds after the caller finishes speaking
                  </p>
                </div>
                <Slider
                  id="responsiveness"
                  value={callFeaturesSettings.responsiveness}
                  onChange={(value) => {
                    setCallFeaturesSettings({ ...callFeaturesSettings, responsiveness: value });
                    setCallFeaturesModified(true);
                  }}
                  min={0}
                  max={1}
                  step={0.1}
                  valueLabel={(v) => {
                    if (v >= 0.8) return "Very Fast";
                    if (v >= 0.6) return "Fast";
                    if (v >= 0.4) return "Normal";
                    if (v >= 0.2) return "Slow";
                    return "Very Slow";
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Higher = Koya responds faster after caller stops talking (recommended: Very Fast)
                </p>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCallFeaturesSettings({
                      ...callFeaturesSettings,
                      interruptionSensitivity: 0.9,
                      responsiveness: 0.9,
                    });
                    setCallFeaturesModified(true);
                  }}
                >
                  Maximum Responsiveness
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCallFeaturesSettings({
                      ...callFeaturesSettings,
                      interruptionSensitivity: 0.5,
                      responsiveness: 0.5,
                    });
                    setCallFeaturesModified(true);
                  }}
                >
                  Balanced
                </Button>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={saveCallFeaturesSettings} disabled={saving || !callFeaturesModified}>
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

            {/* Voice Controls */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-medium">Voice Controls</h3>
              <p className="text-sm text-muted-foreground">
                Fine-tune how Koya&apos;s voice sounds. These settings affect speech rate, expressiveness, and timing.
              </p>

              {/* Voice Speed */}
              <div className="space-y-3">
                <Label htmlFor="voiceSpeed">Speech Speed</Label>
                <Slider
                  id="voiceSpeed"
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={voiceSettings.voiceSpeed}
                  onChange={(value) => {
                    setVoiceSettings({ ...voiceSettings, voiceSpeed: value });
                    setVoiceSettingsModified(true);
                  }}
                  showValue={false}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Slower (0.5x)</span>
                  <span className="font-medium">{voiceSettings.voiceSpeed.toFixed(1)}x</span>
                  <span>Faster (2.0x)</span>
                </div>
              </div>

              {/* Voice Temperature */}
              <div className="space-y-3">
                <Label htmlFor="voiceTemperature">Voice Expressiveness</Label>
                <Slider
                  id="voiceTemperature"
                  min={0}
                  max={2}
                  step={0.1}
                  value={voiceSettings.voiceTemperature}
                  onChange={(value) => {
                    setVoiceSettings({ ...voiceSettings, voiceTemperature: value });
                    setVoiceSettingsModified(true);
                  }}
                  showValue={false}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Stable</span>
                  <span className="font-medium">{voiceSettings.voiceTemperature.toFixed(1)}</span>
                  <span>Expressive</span>
                </div>
              </div>

              {/* Voice Volume */}
              <div className="space-y-3">
                <Label htmlFor="voiceVolume">Volume</Label>
                <Slider
                  id="voiceVolume"
                  min={0}
                  max={2}
                  step={0.1}
                  value={voiceSettings.voiceVolume}
                  onChange={(value) => {
                    setVoiceSettings({ ...voiceSettings, voiceVolume: value });
                    setVoiceSettingsModified(true);
                  }}
                  showValue={false}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Quieter</span>
                  <span className="font-medium">{voiceSettings.voiceVolume.toFixed(1)}</span>
                  <span>Louder</span>
                </div>
              </div>

              {/* Begin Message Delay */}
              <div className="space-y-3">
                <Label htmlFor="beginMessageDelay">Start Delay</Label>
                <Slider
                  id="beginMessageDelay"
                  min={0}
                  max={5000}
                  step={250}
                  value={voiceSettings.beginMessageDelayMs}
                  onChange={(value) => {
                    setVoiceSettings({ ...voiceSettings, beginMessageDelayMs: value });
                    setVoiceSettingsModified(true);
                  }}
                  showValue={false}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Immediate</span>
                  <span className="font-medium">
                    {voiceSettings.beginMessageDelayMs === 0 ? "None" : `${(voiceSettings.beginMessageDelayMs / 1000).toFixed(1)}s`}
                  </span>
                  <span>5 seconds</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Delay before Koya speaks after the call connects. Useful for a more natural call start.
                </p>
              </div>
            </div>

            {/* Backup Voices */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-medium">Backup Voices</h3>
              <p className="text-sm text-muted-foreground">
                Select backup voices to use if your primary voice provider experiences an outage.
                Calls will continue uninterrupted using the fallback voice.
              </p>

              <div className="space-y-3">
                {[0, 1].map((index) => {
                  const currentVoiceId = voiceSettings.fallbackVoiceIds[index] || "";
                  return (
                    <div key={index} className="space-y-2">
                      <Label>Fallback voice {index + 1}</Label>
                      <Select
                        value={currentVoiceId}
                        onValueChange={(value) => {
                          const newFallbackIds = [...voiceSettings.fallbackVoiceIds];
                          if (value === "none") {
                            // Remove this slot and all after it
                            newFallbackIds.splice(index);
                          } else {
                            newFallbackIds[index] = value;
                          }
                          // Clean up empty trailing slots
                          while (newFallbackIds.length > 0 && !newFallbackIds[newFallbackIds.length - 1]) {
                            newFallbackIds.pop();
                          }
                          setVoiceSettings({
                            ...voiceSettings,
                            fallbackVoiceIds: newFallbackIds,
                          });
                          setVoiceSettingsModified(true);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={`Select fallback voice ${index + 1}`} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No fallback</SelectItem>
                          {VOICE_SAMPLES
                            .filter(v => v.id !== voiceSettings.voiceId && !voiceSettings.fallbackVoiceIds.includes(v.id))
                            .concat(currentVoiceId ? VOICE_SAMPLES.filter(v => v.id === currentVoiceId) : [])
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((voice) => (
                              <SelectItem key={voice.id} value={voice.id}>
                                {voice.name} ({voice.gender === "female" ? "F" : "M"}, {voice.style})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground">
                  Backup voices are used in order. If your primary voice is unavailable,
                  the first fallback will be used. If that&apos;s also unavailable, the second fallback will be tried.
                </p>
              </div>
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

      {/* Advanced AI Tab */}
      {activeTab === "advanced-ai" && (
        <Card>
          <CardHeader>
            <CardTitle>Advanced AI Settings</CardTitle>
            <CardDescription>
              Fine-tune how Koya&apos;s AI responds to callers with industry-specific enhancements, sentiment detection, and personalization features
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Industry Enhancements */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Intelligence Features</h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Industry-specific prompts</Label>
                    <p className="text-sm text-muted-foreground">
                      Uses terminology, scenarios, and guardrails specific to your business type
                    </p>
                  </div>
                  <Switch
                    checked={advancedAiSettings.industryEnhancements}
                    onCheckedChange={(checked) => {
                      setAdvancedAiSettings({ ...advancedAiSettings, industryEnhancements: checked });
                      setAdvancedAiSettingsModified(true);
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Conversation examples</Label>
                    <p className="text-sm text-muted-foreground">
                      Teaches Koya with curated examples of ideal conversations
                    </p>
                  </div>
                  <Switch
                    checked={advancedAiSettings.fewShotExamplesEnabled}
                    onCheckedChange={(checked) => {
                      setAdvancedAiSettings({ ...advancedAiSettings, fewShotExamplesEnabled: checked });
                      setAdvancedAiSettingsModified(true);
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Personality-aware error messages</Label>
                    <p className="text-sm text-muted-foreground">
                      Error messages match your chosen personality style
                    </p>
                  </div>
                  <Switch
                    checked={advancedAiSettings.personalityAwareErrors}
                    onCheckedChange={(checked) => {
                      setAdvancedAiSettings({ ...advancedAiSettings, personalityAwareErrors: checked });
                      setAdvancedAiSettingsModified(true);
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Sentiment Detection */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-medium">Sentiment Detection</h3>
              <p className="text-sm text-muted-foreground">
                How Koya detects and responds to caller emotions
              </p>

              <div className="space-y-2">
                {SENTIMENT_LEVEL_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-4 transition-all ${
                      advancedAiSettings.sentimentDetectionLevel === option.value
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="sentimentLevel"
                        value={option.value}
                        checked={advancedAiSettings.sentimentDetectionLevel === option.value}
                        onChange={() => {
                          setAdvancedAiSettings({ ...advancedAiSettings, sentimentDetectionLevel: option.value });
                          setAdvancedAiSettingsModified(true);
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

            {/* Caller Recognition */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-medium">Caller Recognition</h3>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Remember repeat callers</Label>
                  <p className="text-sm text-muted-foreground">
                    Personalize interactions for returning callers with their name and history
                  </p>
                </div>
                <Switch
                  checked={advancedAiSettings.callerContextEnabled}
                  onCheckedChange={(checked) => {
                    setAdvancedAiSettings({ ...advancedAiSettings, callerContextEnabled: checked });
                    setAdvancedAiSettingsModified(true);
                  }}
                />
              </div>
            </div>

            {/* Tone Intensity */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-medium">Tone Intensity</h3>
              <p className="text-sm text-muted-foreground">
                How strongly Koya expresses the selected personality style
              </p>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Subtle</span>
                  <span>Balanced</span>
                  <span>Expressive</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={advancedAiSettings.toneIntensity}
                  onChange={(e) => {
                    setAdvancedAiSettings({
                      ...advancedAiSettings,
                      toneIntensity: parseInt(e.target.value) as ToneIntensity,
                    });
                    setAdvancedAiSettingsModified(true);
                  }}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      onClick={() => {
                        setAdvancedAiSettings({
                          ...advancedAiSettings,
                          toneIntensity: level as ToneIntensity,
                        });
                        setAdvancedAiSettingsModified(true);
                      }}
                      className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                        advancedAiSettings.toneIntensity === level
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted-foreground/20"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Conversation Examples Count */}
            {advancedAiSettings.fewShotExamplesEnabled && (
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-lg font-medium">Example Count</h3>
                <div className="space-y-2">
                  <Label htmlFor="maxExamples">Max conversation examples per prompt</Label>
                  <Input
                    id="maxExamples"
                    type="number"
                    min={1}
                    max={5}
                    value={advancedAiSettings.maxFewShotExamples}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 3;
                      setAdvancedAiSettings({
                        ...advancedAiSettings,
                        maxFewShotExamples: Math.max(1, Math.min(5, value)),
                      });
                      setAdvancedAiSettingsModified(true);
                    }}
                    className="max-w-[100px]"
                  />
                  <p className="text-sm text-muted-foreground">
                    More examples improve accuracy but use more tokens (1-5)
                  </p>
                </div>
              </div>
            )}

            {/* Boosted Keywords */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-medium">Boosted Keywords</h3>
              <p className="text-sm text-muted-foreground">
                Words and phrases to prioritize in speech recognition for more accurate transcription
              </p>
              <div className="space-y-2">
                <Label htmlFor="boostedKeywords">Keywords (comma-separated)</Label>
                <Input
                  id="boostedKeywords"
                  placeholder="appointment, schedule, cancel, reschedule, emergency"
                  value={advancedRetellSettings.boostedKeywords}
                  onChange={(e) => {
                    setAdvancedRetellSettings({
                      ...advancedRetellSettings,
                      boostedKeywords: e.target.value,
                    });
                    setAdvancedRetellModified(true);
                  }}
                />
                <p className="text-sm text-muted-foreground">
                  Enter industry-specific terms, your business name, service names, or commonly misheard words
                </p>
              </div>
            </div>

            {/* Custom Summary Prompt */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-medium">Call Summary</h3>
              <p className="text-sm text-muted-foreground">
                Customize how Koya summarizes calls after they end
              </p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="analysisSummaryPrompt">Custom summary prompt (optional)</Label>
                  <Textarea
                    id="analysisSummaryPrompt"
                    placeholder="Summarize this call focusing on: service requested, appointment details, follow-up actions needed, and any special requests..."
                    value={advancedRetellSettings.analysisSummaryPrompt}
                    onChange={(e) => {
                      setAdvancedRetellSettings({
                        ...advancedRetellSettings,
                        analysisSummaryPrompt: e.target.value,
                      });
                      setAdvancedRetellModified(true);
                    }}
                    rows={3}
                  />
                  <p className="text-sm text-muted-foreground">
                    Leave empty to use the default summary format
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="analysisModel">Analysis model</Label>
                  <Select
                    value={advancedRetellSettings.analysisModel}
                    onValueChange={(value) => {
                      setAdvancedRetellSettings({
                        ...advancedRetellSettings,
                        analysisModel: value,
                      });
                      setAdvancedRetellModified(true);
                    }}
                  >
                    <SelectTrigger className="max-w-[250px]">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini (Fast)</SelectItem>
                      <SelectItem value="claude-4.5-sonnet">Claude Sonnet (Balanced)</SelectItem>
                      <SelectItem value="gemini-2.5-flash">Gemini Flash (Fast)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Model used for generating call summaries and analysis
                  </p>
                </div>
              </div>
            </div>

            {/* PII Redaction */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-medium">Privacy & Compliance</h3>
              <p className="text-sm text-muted-foreground">
                Automatically redact sensitive information from call transcripts
              </p>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable PII redaction</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically detect and mask sensitive data in transcripts
                  </p>
                </div>
                <Switch
                  checked={advancedRetellSettings.piiRedactionEnabled}
                  onCheckedChange={(checked) => {
                    setAdvancedRetellSettings({
                      ...advancedRetellSettings,
                      piiRedactionEnabled: checked,
                    });
                    setAdvancedRetellModified(true);
                  }}
                />
              </div>

              {advancedRetellSettings.piiRedactionEnabled && (
                <div className="space-y-3 pl-4 border-l-2 border-muted ml-2">
                  <Label>Data types to redact</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: "ssn", label: "Social Security Numbers" },
                      { id: "credit_card", label: "Credit Card Numbers" },
                      { id: "phone_number", label: "Phone Numbers" },
                      { id: "email", label: "Email Addresses" },
                      { id: "date_of_birth", label: "Dates of Birth" },
                      { id: "address", label: "Physical Addresses" },
                    ].map((category) => (
                      <label
                        key={category.id}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Checkbox
                          checked={advancedRetellSettings.piiCategories.includes(category.id)}
                          onCheckedChange={(checked) => {
                            const newCategories = checked
                              ? [...advancedRetellSettings.piiCategories, category.id]
                              : advancedRetellSettings.piiCategories.filter((c: string) => c !== category.id);
                            setAdvancedRetellSettings({
                              ...advancedRetellSettings,
                              piiCategories: newCategories,
                            });
                            setAdvancedRetellModified(true);
                          }}
                        />
                        <span className="text-sm">{category.label}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Selected data types will be replaced with [REDACTED] in transcripts
                  </p>
                </div>
              )}
            </div>

            {/* Info Box */}
            <div className="rounded-lg bg-muted/50 p-4 mt-4">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Enhanced AI Features</p>
                  <p className="text-sm text-muted-foreground">
                    These settings work together to make Koya smarter and more personalized. Changes take effect immediately on new calls.
                  </p>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={saveAdvancedAiSettings} disabled={saving || (!advancedAiSettingsModified && !advancedRetellModified)}>
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
    </div>
  );
}
