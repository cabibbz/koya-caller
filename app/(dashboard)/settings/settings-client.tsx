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
import { useTranslations } from "next-intl";
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
  RotateCcw,
  MessageSquare,
  Shield,
  Clock,
  Link2,
  ChevronDown,
  Brain,
  Volume2,
  Headphones,
  Zap,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { PrivacySettings } from "@/components/settings/privacy-settings";
import { AvailabilitySettings } from "@/components/settings/availability-settings";
import { HolidayBlocker } from "@/components/settings/holiday-blocker";
import { ServiceAvailability } from "@/components/settings/service-availability";
import { CRMSettings } from "@/components/settings/crm-settings";
import { WebhooksSettings } from "@/components/settings/webhooks-settings";
import { ApiKeysSettings } from "@/components/settings/api-keys-settings";
import { OutboundSettings } from "@/components/settings/outbound-settings";
import { DNCSettings } from "@/components/settings/dnc-settings";
import { ComplianceSettings } from "@/components/settings/compliance-settings";
import { PaymentSettings } from "@/components/settings/payment-settings";

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

// Default values for reset functionality
const DEFAULT_CALL_SETTINGS = {
  transferNumber: "",
  backupTransferNumber: "",
  transferOnRequest: true,
  transferOnEmergency: true,
  transferOnUpset: false,
  transferKeywords: "",
  transferHoursType: "always" as TransferHoursType,
  afterHoursEnabled: true,
  afterHoursCanBook: true,
  afterHoursMessageOnly: false,
  maxCallDurationSeconds: 600,
  recordingEnabled: true,
};

const DEFAULT_CALL_FEATURES = {
  voicemailDetectionEnabled: false,
  voicemailMessage: "",
  voicemailDetectionTimeoutMs: 30000,
  reminderTriggerMs: 10000,
  reminderMaxCount: 2,
  endCallAfterSilenceMs: 30000,
  dtmfEnabled: false,
  dtmfDigitLimit: 10,
  dtmfTerminationKey: "#",
  dtmfTimeoutMs: 5000,
  denoisingMode: "noise-cancellation",
  interruptionSensitivity: 0.9,
  responsiveness: 0.9,
};

const DEFAULT_VOICE_SETTINGS = {
  voiceId: "",
  voiceIdSpanish: "",
  aiName: "Koya",
  personality: "professional" as Personality,
  greeting: "",
  greetingSpanish: "",
  afterHoursGreeting: "",
  afterHoursGreetingSpanish: "",
  fallbackVoiceIds: [] as string[],
  voiceTemperature: 1.0,
  voiceSpeed: 1.0,
  voiceVolume: 1.0,
  beginMessageDelayMs: 0,
};

const DEFAULT_CALENDAR_SETTINGS = {
  provider: "built_in" as const,
  defaultDurationMinutes: 60,
  bufferMinutes: 0,
  advanceBookingDays: 14,
  requireEmail: false,
};

const DEFAULT_NOTIFICATION_SETTINGS = {
  smsAllCalls: false,
  smsBookings: true,
  smsMissed: true,
  smsMessages: true,
  smsUsageAlerts: true,
  emailDaily: false,
  emailWeekly: true,
  emailMissed: true,
  smsCustomerConfirmation: true,
  smsCustomerReminder: "24hr" as ReminderSetting,
};

const DEFAULT_ADVANCED_RETELL = {
  boostedKeywords: "",
  analysisSummaryPrompt: "",
  analysisModel: "gpt-4.1-mini",
  piiRedactionEnabled: false,
  piiCategories: ["ssn", "credit_card"],
  fallbackVoiceIds: [] as string[],
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
    slug?: string | null;
  };
  initialCallSettings: CallSettings | null;
  initialAiConfig: AIConfig | null;
  initialCalendarIntegration: CalendarIntegration | null;
  initialNotificationSettings: NotificationSettings | null;
  initialPhoneNumbers: PhoneNumber[];
  initialPromptConfig?: InitialPromptConfig | null;
}

type Tab = "call-handling" | "ai-settings" | "outbound" | "voice" | "language" | "availability" | "calendar" | "notifications" | "sms-templates" | "phone-billing" | "payments" | "integrations" | "compliance" | "privacy";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "call-handling", label: "Call Handling", icon: Phone },
  { id: "ai-settings", label: "AI & Call Settings", icon: Sparkles },
  { id: "outbound", label: "Outbound Calls", icon: Phone },
  { id: "voice", label: "Voice & Personality", icon: Mic },
  { id: "language", label: "Language", icon: Globe },
  { id: "availability", label: "Availability", icon: Clock },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "sms-templates", label: "SMS Templates", icon: MessageSquare },
  { id: "phone-billing", label: "Phone & Billing", icon: CreditCard },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "integrations", label: "Integrations", icon: Link2 },
  { id: "compliance", label: "HIPAA Compliance", icon: Shield },
  { id: "privacy", label: "Privacy", icon: Shield },
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
  { value: "custom", label: "Custom schedule" },
];

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

interface TransferScheduleDay {
  day_of_week: number;
  start_time: string;
  end_time: string;
  enabled: boolean;
}

const REMINDER_OPTIONS: { value: ReminderSetting; label: string }[] = [
  { value: "off", label: "No reminder" },
  { value: "1hr", label: "1 hour before" },
  { value: "24hr", label: "24 hours before" },
  { value: "both", label: "Both (1hr & 24hr)" },
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
  const t = useTranslations("settings");
  const _tCommon = useTranslations("common");
  const [activeTab, setActiveTab] = useState<Tab>("call-handling");
  const [saving, setSaving] = useState(false);

  // Reset confirmation dialog state
  type ResetDialogType = "call-handling" | "ai-settings" | "voice" | "calendar" | "notifications" | "sms-templates" | null;
  const [resetDialogOpen, setResetDialogOpen] = useState<ResetDialogType>(null);

  // AI Settings expanded sections state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["intelligence", "listening"]));
  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Audio playback state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);

  // Default custom transfer schedule (M-F 9-5)
  const defaultTransferSchedule: TransferScheduleDay[] = DAYS_OF_WEEK.map(day => ({
    day_of_week: day.value,
    start_time: "09:00",
    end_time: "17:00",
    enabled: day.value >= 1 && day.value <= 5, // Mon-Fri enabled by default
  }));

  // Call handling state
  const [callSettings, setCallSettings] = useState({
    transferNumber: initialCallSettings?.transfer_number || "",
    backupTransferNumber: initialCallSettings?.backup_transfer_number || "",
    transferOnRequest: initialCallSettings?.transfer_on_request ?? true,
    transferOnEmergency: initialCallSettings?.transfer_on_emergency ?? true,
    transferOnUpset: initialCallSettings?.transfer_on_upset ?? false,
    transferKeywords: initialCallSettings?.transfer_keywords?.join(", ") || "",
    transferHoursType: (initialCallSettings?.transfer_hours_type || "always") as TransferHoursType,
    transferHoursCustom: (initialCallSettings?.transfer_hours_custom as TransferScheduleDay[] | null) || defaultTransferSchedule,
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
    (initialCalendarIntegration?.provider !== "built_in" &&
    !!initialCalendarIntegration?.access_token) ||
    !!initialCalendarIntegration?.grant_id
  );
  const [calendarEmail, setCalendarEmail] = useState<string | null>(
    initialCalendarIntegration?.grant_email || null
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
    emailMissed: initialNotificationSettings?.email_missed ?? true,
    smsCustomerConfirmation: initialNotificationSettings?.sms_customer_confirmation ?? true,
    smsCustomerReminder: (initialNotificationSettings?.sms_customer_reminder || "24hr") as ReminderSetting,
  });
  const [notificationSettingsModified, setNotificationSettingsModified] = useState(false);

  // SMS Templates state
  const [smsTemplates, setSmsTemplates] = useState<{
    bookingConfirmation: string | null;
    reminder24hr: string | null;
    reminder1hr: string | null;
    missedCallAlert: string | null;
    messageAlert: string | null;
    transferAlert: string | null;
  }>({
    bookingConfirmation: null,
    reminder24hr: null,
    reminder1hr: null,
    missedCallAlert: null,
    messageAlert: null,
    transferAlert: null,
  });
  const [smsTemplatesDefaults, setSmsTemplatesDefaults] = useState<Record<string, string>>({});
  const [smsTemplatesModified, setSmsTemplatesModified] = useState(false);
  const [smsTemplatesLoaded, setSmsTemplatesLoaded] = useState(false);
  const [previewingTemplate, setPreviewingTemplate] = useState<string | null>(null);
  const [templatePreview, setTemplatePreview] = useState<string>("");

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
    "api.us.nylas.com",
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

  // Connect calendar via Nylas hosted OAuth
  const handleConnectCalendar = async () => {
    setIsConnecting(true);

    try {
      const response = await fetch("/api/calendar/nylas/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnUrl: "/settings?tab=calendar",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to initiate connection");
      }

      if (data.authUrl) {
        window.location.href = data.authUrl;
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
      setCalendarEmail(null);
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

  const _saveCallFeaturesSettings = async () => {
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

  const _saveAdvancedAiSettings = async () => {
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

  // Combined AI Settings save handler
  const saveAiSettings = async () => {
    setSaving(true);
    try {
      // Save call features and advanced AI settings in parallel
      const [callFeaturesRes, advancedAiRes] = await Promise.all([
        fetch("/api/dashboard/settings/call-features", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(callFeaturesSettings),
        }),
        fetch("/api/dashboard/settings/advanced-ai", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...advancedAiSettings,
            boostedKeywords: advancedRetellSettings.boostedKeywords,
            analysisSummaryPrompt: advancedRetellSettings.analysisSummaryPrompt,
            analysisModel: advancedRetellSettings.analysisModel,
            piiRedactionEnabled: advancedRetellSettings.piiRedactionEnabled,
            piiCategories: advancedRetellSettings.piiCategories,
          }),
        }),
      ]);

      const errors: string[] = [];
      if (!callFeaturesRes.ok) errors.push("call features");
      if (!advancedAiRes.ok) errors.push("AI intelligence");

      if (errors.length > 0) {
        throw new Error(`Failed to save ${errors.join(" and ")}`);
      }

      setCallFeaturesModified(false);
      setAdvancedAiSettingsModified(false);
      setAdvancedRetellModified(false);
      toast({ title: "AI & Call settings saved", variant: "success" });
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

  // Reset handlers - these reset to defaults and mark as modified so user can save
  const handleResetCallSettings = () => {
    setCallSettings({
      ...DEFAULT_CALL_SETTINGS,
      transferHoursCustom: defaultTransferSchedule,
    });
    setCallSettingsModified(true);
    setResetDialogOpen(null);
    toast({ title: "Call handling reset to defaults", description: "Click Save to apply changes", variant: "success" });
  };

  const _handleResetCallFeatures = () => {
    setCallFeaturesSettings(DEFAULT_CALL_FEATURES);
    setCallFeaturesModified(true);
    setResetDialogOpen(null);
    toast({ title: "Call features reset to defaults", description: "Click Save to apply changes", variant: "success" });
  };

  const handleResetVoiceSettings = () => {
    setVoiceSettings(DEFAULT_VOICE_SETTINGS);
    setVoiceSettingsModified(true);
    setResetDialogOpen(null);
    toast({ title: "Voice settings reset to defaults", description: "Click Save to apply changes", variant: "success" });
  };

  const handleResetCalendarSettings = () => {
    setCalendarSettings(DEFAULT_CALENDAR_SETTINGS);
    setCalendarSettingsModified(true);
    setResetDialogOpen(null);
    toast({ title: "Calendar settings reset to defaults", description: "Click Save to apply changes", variant: "success" });
  };

  const handleResetNotificationSettings = () => {
    setNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS);
    setNotificationSettingsModified(true);
    setResetDialogOpen(null);
    toast({ title: "Notification settings reset to defaults", description: "Click Save to apply changes", variant: "success" });
  };

  const handleResetSmsTemplates = () => {
    setSmsTemplates({
      bookingConfirmation: null,
      reminder24hr: null,
      reminder1hr: null,
      missedCallAlert: null,
      messageAlert: null,
      transferAlert: null,
    });
    setSmsTemplatesModified(true);
    setResetDialogOpen(null);
    toast({ title: "SMS templates reset to defaults", description: "Click Save to apply changes", variant: "success" });
  };

  // Load SMS templates when tab is opened
  useEffect(() => {
    if (activeTab === "sms-templates" && !smsTemplatesLoaded) {
      const loadTemplates = async () => {
        try {
          const res = await fetch("/api/dashboard/settings/sms-templates");
          if (res.ok) {
            const data = await res.json();
            setSmsTemplates({
              bookingConfirmation: data.templates?.booking_confirmation ?? null,
              reminder24hr: data.templates?.reminder_24hr ?? null,
              reminder1hr: data.templates?.reminder_1hr ?? null,
              missedCallAlert: data.templates?.missed_call_alert ?? null,
              messageAlert: data.templates?.message_alert ?? null,
              transferAlert: data.templates?.transfer_alert ?? null,
            });
            setSmsTemplatesDefaults(data.defaults || {});
            setSmsTemplatesLoaded(true);
          } else {
            toast({ title: "Failed to load SMS templates", variant: "destructive" });
            setSmsTemplatesLoaded(true); // Set to true to stop loading spinner
          }
        } catch {
          toast({ title: "Failed to load SMS templates", variant: "destructive" });
          setSmsTemplatesLoaded(true); // Set to true to stop loading spinner
        }
      };
      loadTemplates();
    }
  }, [activeTab, smsTemplatesLoaded]);

  const saveSmsTemplates = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/settings/sms-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(smsTemplates),
      });

      if (!res.ok) throw new Error("Failed to save SMS templates");

      setSmsTemplatesModified(false);
      toast({ title: "SMS templates saved", variant: "success" });
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

  const previewTemplate = async (templateKey: string, template: string | null) => {
    if (!template) return;
    setPreviewingTemplate(templateKey);
    try {
      const res = await fetch("/api/dashboard/settings/sms-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template, type: templateKey }),
      });
      const data = await res.json();
      setTemplatePreview(data.preview || "");
    } catch {
      setTemplatePreview("Preview failed");
    }
  };

  const _handleResetAdvancedAi = () => {
    setAdvancedAiSettings(DEFAULT_PROMPT_CONFIG);
    setAdvancedRetellSettings(DEFAULT_ADVANCED_RETELL);
    setAdvancedAiSettingsModified(true);
    setAdvancedRetellModified(true);
    setResetDialogOpen(null);
    toast({ title: "Advanced AI reset to defaults", description: "Click Save to apply changes", variant: "success" });
  };

  // Combined AI Settings reset handler
  const handleResetAiSettings = () => {
    // Reset call features
    setCallFeaturesSettings(DEFAULT_CALL_FEATURES);
    setCallFeaturesModified(true);
    // Reset advanced AI
    setAdvancedAiSettings(DEFAULT_PROMPT_CONFIG);
    setAdvancedRetellSettings(DEFAULT_ADVANCED_RETELL);
    setAdvancedAiSettingsModified(true);
    setAdvancedRetellModified(true);
    setResetDialogOpen(null);
    toast({ title: "AI & Call settings reset to defaults", description: "Click Save to apply changes", variant: "success" });
  };

  // Get reset dialog info based on type
  const getResetDialogInfo = (type: ResetDialogType) => {
    switch (type) {
      case "call-handling":
        return { title: "Reset Call Handling Settings", description: "This will reset all transfer settings, after-hours settings, and call duration to their default values. You will need to click Save to apply the changes.", onConfirm: handleResetCallSettings };
      case "ai-settings":
        return { title: "Reset AI & Call Settings", description: "This will reset all AI intelligence, listening & responding, call features, and advanced settings to their default values. You will need to click Save to apply the changes.", onConfirm: handleResetAiSettings };
      case "voice":
        return { title: "Reset Voice & Personality", description: "This will reset AI name to 'Koya', personality to 'Professional', clear all custom greetings, and reset voice parameters. You will need to click Save to apply the changes.", onConfirm: handleResetVoiceSettings };
      case "calendar":
        return { title: "Reset Calendar Settings", description: "This will reset appointment duration, buffer time, and advance booking days to their default values. You will need to click Save to apply the changes.", onConfirm: handleResetCalendarSettings };
      case "notifications":
        return { title: "Reset Notification Settings", description: "This will reset all SMS and email notification preferences to their default values. You will need to click Save to apply the changes.", onConfirm: handleResetNotificationSettings };
      case "sms-templates":
        return { title: "Reset SMS Templates", description: "This will reset all SMS templates to their default text. You will need to click Save to apply the changes.", onConfirm: handleResetSmsTemplates };
      default:
        return { title: "", description: "", onConfirm: () => {} };
    }
  };

  // Usage percentage
  const usagePercent = businessInfo.minutesIncluded > 0
    ? Math.round((businessInfo.minutesUsed / businessInfo.minutesIncluded) * 100)
    : 0;

  const resetDialogInfo = getResetDialogInfo(resetDialogOpen);

  return (
    <div className="space-y-6">
      {/* Reset Confirmation Dialog */}
      <Dialog open={resetDialogOpen !== null} onOpenChange={(open) => !open && setResetDialogOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{resetDialogInfo.title}</DialogTitle>
            <DialogDescription>{resetDialogInfo.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setResetDialogOpen(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={resetDialogInfo.onConfirm}>
              <RotateCcw className="w-4 h-4 mr-2" />
              {t("resetToDefaults")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">
            {t("subtitle")}
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
            <CardTitle>{t("callHandling.title")}</CardTitle>
            <CardDescription>
              {t("callHandling.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Transfer Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">{t("callHandling.transferSettings")}</h3>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="transferNumber">{t("callHandling.primaryTransferNumber")}</Label>
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
                  <Label htmlFor="backupNumber">{t("callHandling.backupNumber")}</Label>
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
                <Label>{t("callHandling.whenShouldTransfer")}</Label>
                
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
                      <span className="font-medium">{t("callHandling.transferOnRequest")}</span>
                      <p className="text-sm text-muted-foreground">
                        {t("callHandling.transferOnRequestDesc")}
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
                      <span className="font-medium">{t("callHandling.transferOnEmergency")}</span>
                      <p className="text-sm text-muted-foreground">
                        {t("callHandling.transferOnEmergencyDesc")}
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
                      <span className="font-medium">{t("callHandling.transferOnUpset")}</span>
                      <p className="text-sm text-muted-foreground">
                        {t("callHandling.transferOnUpsetDesc")}
                      </p>
                    </div>
                  </label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="keywords">{t("callHandling.customKeywords")}</Label>
                  <Input
                    id="keywords"
                    placeholder={t("callHandling.customKeywordsPlaceholder")}
                    value={callSettings.transferKeywords}
                    onChange={(e) => {
                      setCallSettings({ ...callSettings, transferKeywords: e.target.value });
                      setCallSettingsModified(true);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("callHandling.customKeywordsHint")}
                  </p>
                </div>
              </div>

              {/* Transfer Hours */}
              <div className="space-y-2">
                <Label>{t("callHandling.transferAvailability")}</Label>
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

              {/* Custom Transfer Schedule */}
              {callSettings.transferHoursType === "custom" && (
                <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                  <Label className="text-sm font-medium">{t("callHandling.customTransferSchedule")}</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    {t("callHandling.customScheduleDesc")}
                  </p>
                  <div className="space-y-2">
                    {callSettings.transferHoursCustom.map((day, index) => (
                      <div key={day.day_of_week} className="flex items-center gap-3">
                        <div className="w-24">
                          <Label className="text-sm">{DAYS_OF_WEEK[day.day_of_week].label}</Label>
                        </div>
                        <Switch
                          checked={day.enabled}
                          onCheckedChange={(checked) => {
                            const updated = [...callSettings.transferHoursCustom];
                            updated[index] = { ...day, enabled: checked };
                            setCallSettings({ ...callSettings, transferHoursCustom: updated });
                            setCallSettingsModified(true);
                          }}
                        />
                        {day.enabled && (
                          <>
                            <Input
                              type="time"
                              value={day.start_time}
                              onChange={(e) => {
                                const updated = [...callSettings.transferHoursCustom];
                                updated[index] = { ...day, start_time: e.target.value };
                                setCallSettings({ ...callSettings, transferHoursCustom: updated });
                                setCallSettingsModified(true);
                              }}
                              className="w-28"
                            />
                            <span className="text-sm text-muted-foreground">{t("callHandling.to")}</span>
                            <Input
                              type="time"
                              value={day.end_time}
                              onChange={(e) => {
                                const updated = [...callSettings.transferHoursCustom];
                                updated[index] = { ...day, end_time: e.target.value };
                                setCallSettings({ ...callSettings, transferHoursCustom: updated });
                                setCallSettingsModified(true);
                              }}
                              className="w-28"
                            />
                          </>
                        )}
                        {!day.enabled && (
                          <span className="text-sm text-muted-foreground">{t("callHandling.closed")}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* After Hours */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-medium">{t("callHandling.afterHoursBehavior")}</h3>

              <div className="flex items-center justify-between">
                <div>
                  <Label>{t("callHandling.answersAfterHours")}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t("callHandling.answersAfterHoursDesc")}
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
                      <Label>{t("callHandling.canBookAfterHours")}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t("callHandling.canBookAfterHoursDesc")}
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
                      <Label>{t("callHandling.messageOnlyMode")}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t("callHandling.messageOnlyDesc")}
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
              <h3 className="text-lg font-medium">{t("callHandling.callDuration")}</h3>
              <div className="space-y-2">
                <Label htmlFor="maxDuration">{t("callHandling.maxCallDuration")}</Label>
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
                  {t("callHandling.maxCallDurationDesc")}
                </p>
              </div>
            </div>

            {/* Recording */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-medium">{t("callHandling.recording")}</h3>
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t("callHandling.enableRecording")}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t("callHandling.recordingDesc")}
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

            {/* Save/Reset Buttons */}
            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setResetDialogOpen("call-handling")} disabled={saving}>
                <RotateCcw className="w-4 h-4 mr-2" />
                {t("resetToDefaults")}
              </Button>
              <Button onClick={saveCallSettings} disabled={saving || !callSettingsModified}>
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

      {/* AI & Call Settings Tab */}
      {activeTab === "ai-settings" && (
        <div className="space-y-4">
          {/* Header Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI & Call Settings
              </CardTitle>
              <CardDescription>
                Configure how Koya thinks, listens, and responds to callers. These settings work together to create a natural conversation experience.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* AI Intelligence Section */}
          <Card>
            <button
              onClick={() => toggleSection("intelligence")}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors rounded-t-lg"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Brain className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold">AI Intelligence</h3>
                  <p className="text-sm text-muted-foreground">How Koya understands and responds to callers</p>
                </div>
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${expandedSections.has("intelligence") ? "rotate-180" : ""}`} />
            </button>
            {expandedSections.has("intelligence") && (
              <CardContent className="pt-0 space-y-6">
                {/* Smart Features Grid */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                    <div className="space-y-1">
                      <Label className="font-medium">Industry-specific prompts</Label>
                      <p className="text-sm text-muted-foreground">
                        Uses terminology and scenarios for your business type
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

                  <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                    <div className="space-y-1">
                      <Label className="font-medium">Conversation examples</Label>
                      <p className="text-sm text-muted-foreground">
                        Learns from curated ideal conversation patterns
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

                  <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                    <div className="space-y-1">
                      <Label className="font-medium">Remember repeat callers</Label>
                      <p className="text-sm text-muted-foreground">
                        Personalizes interactions with returning callers
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

                  <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                    <div className="space-y-1">
                      <Label className="font-medium">Personality-aware errors</Label>
                      <p className="text-sm text-muted-foreground">
                        Error messages match your chosen style
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

                {/* Sentiment Detection */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">Sentiment Detection</Label>
                  <p className="text-sm text-muted-foreground">How Koya detects and responds to caller emotions</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {SENTIMENT_LEVEL_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-4 transition-all ${
                          advancedAiSettings.sentimentDetectionLevel === option.value
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-muted hover:border-muted-foreground/50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="sentimentLevel"
                            value={option.value}
                            checked={advancedAiSettings.sentimentDetectionLevel === option.value}
                            onChange={() => {
                              setAdvancedAiSettings({ ...advancedAiSettings, sentimentDetectionLevel: option.value });
                              setAdvancedAiSettingsModified(true);
                            }}
                            className="sr-only"
                          />
                          <span className="font-medium">{option.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{option.description}</p>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Tone Intensity */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">Tone Intensity</Label>
                  <p className="text-sm text-muted-foreground">How strongly Koya expresses the selected personality</p>
                  <div className="px-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                      <span>Subtle</span>
                      <span>Balanced</span>
                      <span>Expressive</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <button
                          key={level}
                          onClick={() => {
                            setAdvancedAiSettings({ ...advancedAiSettings, toneIntensity: level as ToneIntensity });
                            setAdvancedAiSettingsModified(true);
                          }}
                          className={`flex-1 h-10 rounded-lg text-sm font-medium transition-all ${
                            advancedAiSettings.toneIntensity === level
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "bg-muted hover:bg-muted-foreground/20"
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Listening & Responding Section */}
          <Card>
            <button
              onClick={() => toggleSection("listening")}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors rounded-t-lg"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Headphones className="h-5 w-5 text-blue-500" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold">Listening & Responding</h3>
                  <p className="text-sm text-muted-foreground">How quickly Koya reacts during conversations</p>
                </div>
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${expandedSections.has("listening") ? "rotate-180" : ""}`} />
            </button>
            {expandedSections.has("listening") && (
              <CardContent className="pt-0 space-y-6">
                {/* Interruption Sensitivity */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-base font-medium">Interruption Sensitivity</Label>
                    <p className="text-sm text-muted-foreground">How quickly Koya stops talking when the caller speaks</p>
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
                </div>

                {/* Response Speed */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-base font-medium">Response Speed</Label>
                    <p className="text-sm text-muted-foreground">How quickly Koya responds after the caller stops talking</p>
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
                </div>

                {/* Quick Presets */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={callFeaturesSettings.interruptionSensitivity === 0.9 && callFeaturesSettings.responsiveness === 0.9 ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setCallFeaturesSettings({ ...callFeaturesSettings, interruptionSensitivity: 0.9, responsiveness: 0.9 });
                      setCallFeaturesModified(true);
                    }}
                  >
                    <Zap className="w-4 h-4 mr-1" />
                    Maximum
                  </Button>
                  <Button
                    type="button"
                    variant={callFeaturesSettings.interruptionSensitivity === 0.5 && callFeaturesSettings.responsiveness === 0.5 ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setCallFeaturesSettings({ ...callFeaturesSettings, interruptionSensitivity: 0.5, responsiveness: 0.5 });
                      setCallFeaturesModified(true);
                    }}
                  >
                    Balanced
                  </Button>
                </div>

                {/* Audio Quality */}
                <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-base font-medium">Audio Quality</Label>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label
                      className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-4 transition-all ${
                        callFeaturesSettings.denoisingMode === "noise-cancellation"
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-muted hover:border-muted-foreground/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="denoising"
                        checked={callFeaturesSettings.denoisingMode === "noise-cancellation"}
                        onChange={() => {
                          setCallFeaturesSettings({ ...callFeaturesSettings, denoisingMode: "noise-cancellation" });
                          setCallFeaturesModified(true);
                        }}
                        className="sr-only"
                      />
                      <span className="font-medium">Standard</span>
                      <p className="text-xs text-muted-foreground">Removes background noise while preserving voice clarity</p>
                    </label>
                    <label
                      className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-4 transition-all ${
                        callFeaturesSettings.denoisingMode === "noise-and-background-speech-cancellation"
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-muted hover:border-muted-foreground/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="denoising"
                        checked={callFeaturesSettings.denoisingMode === "noise-and-background-speech-cancellation"}
                        onChange={() => {
                          setCallFeaturesSettings({ ...callFeaturesSettings, denoisingMode: "noise-and-background-speech-cancellation" });
                          setCallFeaturesModified(true);
                        }}
                        className="sr-only"
                      />
                      <span className="font-medium">Aggressive</span>
                      <p className="text-xs text-muted-foreground">Also filters out background conversations</p>
                    </label>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Call Features Section */}
          <Card>
            <button
              onClick={() => toggleSection("callFeatures")}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors rounded-t-lg"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Phone className="h-5 w-5 text-green-500" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold">Call Features</h3>
                  <p className="text-sm text-muted-foreground">Voicemail, silence handling, and keypad input</p>
                </div>
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${expandedSections.has("callFeatures") ? "rotate-180" : ""}`} />
            </button>
            {expandedSections.has("callFeatures") && (
              <CardContent className="pt-0 space-y-6">
                {/* Voicemail Detection */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-medium">Voicemail Detection</Label>
                      <p className="text-sm text-muted-foreground">Leave a message when reaching voicemail</p>
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
                    <div className="space-y-4 pl-4 border-l-2 border-muted">
                      <div className="space-y-2">
                        <Label htmlFor="voicemailMessage">Voicemail message</Label>
                        <Textarea
                          id="voicemailMessage"
                          placeholder="Hi, this is Koya calling on behalf of..."
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
                          className="max-w-[120px]"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Silence Handling */}
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <Label className="text-base font-medium">Silence Handling</Label>
                    <p className="text-sm text-muted-foreground">What happens when the caller goes quiet</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="reminderTrigger">Prompt after (sec)</Label>
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
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endCallSilence">End call after (sec)</Label>
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
                    </div>
                  </div>
                </div>

                {/* DTMF Input */}
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-medium">Keypad Input (DTMF)</Label>
                      <p className="text-sm text-muted-foreground">Allow callers to enter numbers using their phone keypad</p>
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
                    <div className="grid gap-4 sm:grid-cols-3 pl-4 border-l-2 border-muted">
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
                        <Label htmlFor="dtmfTimeout">Timeout (sec)</Label>
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
              </CardContent>
            )}
          </Card>

          {/* Save/Reset Footer */}
          <Card>
            <CardContent className="py-4">
              <div className="flex justify-between items-center">
                <Button variant="outline" onClick={() => setResetDialogOpen("ai-settings")} disabled={saving}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset All
                </Button>
                <div className="flex items-center gap-3">
                  {(callFeaturesModified || advancedAiSettingsModified || advancedRetellModified) && (
                    <span className="text-sm text-muted-foreground">Unsaved changes</span>
                  )}
                  <Button
                    onClick={saveAiSettings}
                    disabled={saving || (!callFeaturesModified && !advancedAiSettingsModified && !advancedRetellModified)}
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Voice & Personality Tab */}
      {activeTab === "voice" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("voice.title")}</CardTitle>
            <CardDescription>
              {t("voice.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Voice Selection */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">{t("voice.selectVoice")}</h3>
              
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={selectedGender === "female" ? "default" : "outline"}
                  onClick={() => setSelectedGender("female")}
                  className="flex-1"
                >
                  {t("voice.femaleVoices")}
                </Button>
                <Button
                  type="button"
                  variant={selectedGender === "male" ? "default" : "outline"}
                  onClick={() => setSelectedGender("male")}
                  className="flex-1"
                >
                  {t("voice.maleVoices")}
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredVoices.map((voice) => (
                  <div
                    key={voice.id}
                    className={`relative rounded-lg border p-4 cursor-pointer transition-all ${
                      voiceSettings.voiceId === voice.retellVoiceId
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-muted hover:border-muted-foreground/50"
                    }`}
                    onClick={() => {
                      setVoiceSettings({
                        ...voiceSettings,
                        voiceId: voice.retellVoiceId,
                        voiceIdSpanish: voice.supportsBilingual ? voice.retellVoiceId : voiceSettings.voiceIdSpanish,
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
              <Label htmlFor="aiName">{t("voice.aiName")}</Label>
              <Input
                id="aiName"
                value={voiceSettings.aiName}
                onChange={(e) => {
                  setVoiceSettings({ ...voiceSettings, aiName: e.target.value });
                  setVoiceSettingsModified(true);
                }}
                placeholder={t("voice.aiNamePlaceholder")}
              />
            </div>

            {/* Personality */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">{t("voice.personality")}</h3>
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
              <h3 className="text-lg font-medium">{t("voice.greetings")}</h3>

              <div className="space-y-2">
                <Label htmlFor="greeting">{t("voice.englishGreeting")}</Label>
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
                <Label htmlFor="afterHoursGreeting">{t("voice.afterHoursGreeting")}</Label>
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
                    <Label htmlFor="greetingSpanish">{t("voice.spanishGreeting")}</Label>
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
                    <Label htmlFor="afterHoursGreetingSpanish">{t("voice.spanishAfterHoursGreeting")}</Label>
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
              <h3 className="text-lg font-medium">{t("voice.voiceSettings")}</h3>
              <p className="text-sm text-muted-foreground">
                Fine-tune how Koya&apos;s voice sounds. These settings affect speech rate, expressiveness, and timing.
              </p>

              {/* Voice Speed */}
              <div className="space-y-3">
                <Label htmlFor="voiceSpeed">{t("voice.speechSpeed")}</Label>
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
                <Label htmlFor="voiceTemperature">{t("voice.voiceExpressiveness")}</Label>
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
                <Label htmlFor="voiceVolume">{t("voice.volume")}</Label>
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
                            .filter(v => v.retellVoiceId !== voiceSettings.voiceId && !voiceSettings.fallbackVoiceIds.includes(v.retellVoiceId))
                            .concat(currentVoiceId ? VOICE_SAMPLES.filter(v => v.retellVoiceId === currentVoiceId) : [])
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((voice) => (
                              <SelectItem key={voice.retellVoiceId} value={voice.retellVoiceId}>
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

            {/* Save/Reset Buttons */}
            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setResetDialogOpen("voice")} disabled={saving}>
                <RotateCcw className="w-4 h-4 mr-2" />
                {t("resetToDefaults")}
              </Button>
              <Button onClick={saveVoiceSettings} disabled={saving || !voiceSettingsModified}>
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

      {/* Language Tab */}
      {activeTab === "language" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("language.title")}</CardTitle>
            <CardDescription>
              {t("language.description")}
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
                <h3 className="text-lg font-medium">{t("language.languageMode")}</h3>
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
                {t("saveChanges")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calendar Tab */}
      {activeTab === "calendar" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("calendar.title")}</CardTitle>
            <CardDescription>
              {t("calendar.description")}
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
              <h3 className="text-lg font-medium">{t("calendar.provider")}</h3>

              {/* Connected State */}
              {calendarConnected && calendarSettings.provider !== "built_in" && (
                <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-6 w-6 text-green-500" />
                      <div>
                        <h4 className="font-medium text-green-400">
                          Calendar Connected
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {calendarEmail ? `Syncing with ${calendarEmail}` : "Your appointments will sync automatically"}
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

              {/* Connect Calendar */}
              {!calendarConnected && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Connect your Google or Outlook calendar to sync appointments automatically.
                  </p>
                  <Button
                    onClick={handleConnectCalendar}
                    disabled={isConnecting}
                    className="w-full sm:w-auto"
                  >
                    {isConnecting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Calendar className="w-4 h-4 mr-2" />
                    )}
                    {isConnecting ? "Connecting..." : "Connect Calendar"}
                  </Button>
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

            {/* Online Booking Link */}
            {businessInfo.slug && (
              <div className="space-y-3 pt-4 border-t">
                <h3 className="text-lg font-medium">Online Booking Page</h3>
                <p className="text-sm text-muted-foreground">
                  Share this link with your customers so they can book online.
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/book/${businessInfo.slug}`}
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/book/${businessInfo.slug}`);
                      toast({ title: "Link copied!" });
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            )}

            {/* Save/Reset Buttons */}
            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setResetDialogOpen("calendar")} disabled={saving}>
                <RotateCcw className="w-4 h-4 mr-2" />
                {t("resetToDefaults")}
              </Button>
              <Button onClick={saveCalendarSettings} disabled={saving || !calendarSettingsModified}>
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

      {/* Notifications Tab */}
      {activeTab === "notifications" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("notifications.title")}</CardTitle>
            <CardDescription>
              {t("notifications.subtitle")}
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

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Missed call alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Email when a call goes unanswered
                    </p>
                  </div>
                  <Switch
                    checked={notificationSettings.emailMissed}
                    onCheckedChange={(checked) => {
                      setNotificationSettings({ ...notificationSettings, emailMissed: checked });
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

            {/* Save/Reset Buttons */}
            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setResetDialogOpen("notifications")} disabled={saving}>
                <RotateCcw className="w-4 h-4 mr-2" />
                {t("resetToDefaults")}
              </Button>
              <Button onClick={saveNotificationSettings} disabled={saving || !notificationSettingsModified}>
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

      {/* SMS Templates Tab */}
      {activeTab === "sms-templates" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("smsTemplates.title")}</CardTitle>
            <CardDescription>
              {t("smsTemplates.subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!smsTemplatesLoaded ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Customer-facing templates */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Customer Notifications</h3>
                  <p className="text-sm text-muted-foreground">
                    Available variables: {"{{business_name}}"}, {"{{service_name}}"}, {"{{date_time}}"}, {"{{customer_name}}"}
                  </p>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Booking Confirmation</Label>
                      <Textarea
                        placeholder={smsTemplatesDefaults.booking_confirmation || "Default template"}
                        value={smsTemplates.bookingConfirmation || ""}
                        onChange={(e) => {
                          setSmsTemplates({ ...smsTemplates, bookingConfirmation: e.target.value || null });
                          setSmsTemplatesModified(true);
                        }}
                        rows={4}
                      />
                      {smsTemplates.bookingConfirmation && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => previewTemplate("booking_confirmation", smsTemplates.bookingConfirmation)}
                          >
                            Preview
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSmsTemplates({ ...smsTemplates, bookingConfirmation: null });
                              setSmsTemplatesModified(true);
                            }}
                          >
                            Use Default
                          </Button>
                        </div>
                      )}
                      {previewingTemplate === "booking_confirmation" && templatePreview && (
                        <Alert>
                          <AlertDescription className="whitespace-pre-wrap font-mono text-sm">
                            {templatePreview}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>24-Hour Reminder</Label>
                      <Textarea
                        placeholder={smsTemplatesDefaults.reminder_24hr || "Default template"}
                        value={smsTemplates.reminder24hr || ""}
                        onChange={(e) => {
                          setSmsTemplates({ ...smsTemplates, reminder24hr: e.target.value || null });
                          setSmsTemplatesModified(true);
                        }}
                        rows={4}
                      />
                      {smsTemplates.reminder24hr && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => previewTemplate("reminder_24hr", smsTemplates.reminder24hr)}
                          >
                            Preview
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSmsTemplates({ ...smsTemplates, reminder24hr: null });
                              setSmsTemplatesModified(true);
                            }}
                          >
                            Use Default
                          </Button>
                        </div>
                      )}
                      {previewingTemplate === "reminder_24hr" && templatePreview && (
                        <Alert>
                          <AlertDescription className="whitespace-pre-wrap font-mono text-sm">
                            {templatePreview}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>1-Hour Reminder</Label>
                      <Textarea
                        placeholder={smsTemplatesDefaults.reminder_1hr || "Default template"}
                        value={smsTemplates.reminder1hr || ""}
                        onChange={(e) => {
                          setSmsTemplates({ ...smsTemplates, reminder1hr: e.target.value || null });
                          setSmsTemplatesModified(true);
                        }}
                        rows={4}
                      />
                      {smsTemplates.reminder1hr && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => previewTemplate("reminder_1hr", smsTemplates.reminder1hr)}
                          >
                            Preview
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSmsTemplates({ ...smsTemplates, reminder1hr: null });
                              setSmsTemplatesModified(true);
                            }}
                          >
                            Use Default
                          </Button>
                        </div>
                      )}
                      {previewingTemplate === "reminder_1hr" && templatePreview && (
                        <Alert>
                          <AlertDescription className="whitespace-pre-wrap font-mono text-sm">
                            {templatePreview}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </div>
                </div>

                {/* Owner-facing templates */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-lg font-medium">Owner Alerts (sent to you)</h3>
                  <p className="text-sm text-muted-foreground">
                    Available variables: {"{{caller_name}}"}, {"{{caller_phone}}"}, {"{{call_time}}"}, {"{{message}}"}, {"{{reason}}"}
                  </p>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Missed Call Alert</Label>
                      <Textarea
                        placeholder={smsTemplatesDefaults.missed_call_alert || "Default template"}
                        value={smsTemplates.missedCallAlert || ""}
                        onChange={(e) => {
                          setSmsTemplates({ ...smsTemplates, missedCallAlert: e.target.value || null });
                          setSmsTemplatesModified(true);
                        }}
                        rows={4}
                      />
                      {smsTemplates.missedCallAlert && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => previewTemplate("missed_call_alert", smsTemplates.missedCallAlert)}
                          >
                            Preview
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSmsTemplates({ ...smsTemplates, missedCallAlert: null });
                              setSmsTemplatesModified(true);
                            }}
                          >
                            Use Default
                          </Button>
                        </div>
                      )}
                      {previewingTemplate === "missed_call_alert" && templatePreview && (
                        <Alert>
                          <AlertDescription className="whitespace-pre-wrap font-mono text-sm">
                            {templatePreview}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Message Alert</Label>
                      <Textarea
                        placeholder={smsTemplatesDefaults.message_alert || "Default template"}
                        value={smsTemplates.messageAlert || ""}
                        onChange={(e) => {
                          setSmsTemplates({ ...smsTemplates, messageAlert: e.target.value || null });
                          setSmsTemplatesModified(true);
                        }}
                        rows={4}
                      />
                      {smsTemplates.messageAlert && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => previewTemplate("message_alert", smsTemplates.messageAlert)}
                          >
                            Preview
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSmsTemplates({ ...smsTemplates, messageAlert: null });
                              setSmsTemplatesModified(true);
                            }}
                          >
                            Use Default
                          </Button>
                        </div>
                      )}
                      {previewingTemplate === "message_alert" && templatePreview && (
                        <Alert>
                          <AlertDescription className="whitespace-pre-wrap font-mono text-sm">
                            {templatePreview}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Transfer Alert</Label>
                      <Textarea
                        placeholder={smsTemplatesDefaults.transfer_alert || "Default template"}
                        value={smsTemplates.transferAlert || ""}
                        onChange={(e) => {
                          setSmsTemplates({ ...smsTemplates, transferAlert: e.target.value || null });
                          setSmsTemplatesModified(true);
                        }}
                        rows={4}
                      />
                      {smsTemplates.transferAlert && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => previewTemplate("transfer_alert", smsTemplates.transferAlert)}
                          >
                            Preview
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSmsTemplates({ ...smsTemplates, transferAlert: null });
                              setSmsTemplatesModified(true);
                            }}
                          >
                            Use Default
                          </Button>
                        </div>
                      )}
                      {previewingTemplate === "transfer_alert" && templatePreview && (
                        <Alert>
                          <AlertDescription className="whitespace-pre-wrap font-mono text-sm">
                            {templatePreview}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </div>
                </div>

                {/* Save/Reset Buttons */}
                <div className="flex justify-between pt-4 border-t">
                  <Button variant="outline" onClick={() => setResetDialogOpen("sms-templates")} disabled={saving}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    {t("resetToDefaults")}
                  </Button>
                  <Button onClick={saveSmsTemplates} disabled={saving || !smsTemplatesModified}>
                    {saving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {t("saveChanges")}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Phone & Billing Tab */}
      {activeTab === "phone-billing" && (
        <div className="space-y-6">
          {/* Phone Number Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t("billing.phoneNumber")}</CardTitle>
              <CardDescription>
                {t("billing.phoneNumberDesc")}
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
                  <Button
                    className="mt-4"
                    variant="outline"
                    onClick={() => window.location.href = "/onboarding?step=8"}
                  >
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

      {/* Privacy Tab */}
      {activeTab === "privacy" && (
        <PrivacySettings businessName={businessInfo.name} />
      )}

      {/* Availability Tab */}
      {activeTab === "availability" && (
        <div className="space-y-6">
          <AvailabilitySettings />
          <HolidayBlocker />
          <ServiceAvailability />
        </div>
      )}

      {/* Integrations Tab */}
      {activeTab === "integrations" && (
        <div className="space-y-6">
          <CRMSettings />
          <WebhooksSettings />
          <ApiKeysSettings />
        </div>
      )}

      {/* Outbound Calls Tab */}
      {activeTab === "outbound" && (
        <div className="space-y-6">
          <OutboundSettings />
          <DNCSettings />
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === "payments" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div>
              <h3 className="font-medium">Payment Management Dashboard</h3>
              <p className="text-sm text-muted-foreground">
                Access the full payment dashboard with Stripe Connect, revenue overview, and payment history.
              </p>
            </div>
            <Button onClick={() => router.push("/settings/payments")}>
              <CreditCard className="h-4 w-4 mr-2" />
              Open Payment Dashboard
            </Button>
          </div>
          <PaymentSettings />
        </div>
      )}

      {/* HIPAA Compliance Tab */}
      {activeTab === "compliance" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div>
              <h3 className="font-medium">HIPAA Compliance Dashboard</h3>
              <p className="text-sm text-muted-foreground">
                Access the full HIPAA compliance dashboard with audit logs, encryption status, and consent management.
              </p>
            </div>
            <Button onClick={() => router.push("/settings/hipaa")}>
              <Shield className="h-4 w-4 mr-2" />
              Open Dashboard
            </Button>
          </div>
          <ComplianceSettings />
        </div>
      )}
    </div>
  );
}
