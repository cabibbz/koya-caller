"use server";

/**
 * Koya Caller - Onboarding Server Actions
 * Database operations for onboarding flow
 * Spec Reference: Part 5, Lines 206-280
 */

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type {
  BusinessTemplate,
  BusinessTypeOption,
  ServiceFormData,
  FAQFormData,
  BusinessHoursFormData,
  PricingApproach,
  Step4FormData,
  Step5FormData,
  Step6FormData,
  Step8FormData,
  CalendarProvider,
  TransferHoursType,
  LanguageMode,
} from "@/types/onboarding";

/**
 * Helper to get a loosely-typed Supabase client for write operations
 * This works around Supabase type inference issues in strict mode
 */
async function getWriteClient(): Promise<any> {
  return createClient();
}

// ============================================
// Get Business Templates
// ============================================

export async function getBusinessTemplates(): Promise<BusinessTypeOption[]> {
  const supabase = await getWriteClient();
  
  const { data, error } = await supabase
    .from("business_templates")
    .select("type_slug, type_name, sort_order")
    .order("sort_order", { ascending: true });
  
  if (error) {
    throw new Error("Failed to load business types");
  }
  
  return data || [];
}

export async function getBusinessTemplate(
  typeSlug: string
): Promise<BusinessTemplate | null> {
  const supabase = await getWriteClient();
  
  const { data, error } = await supabase
    .from("business_templates")
    .select("*")
    .eq("type_slug", typeSlug)
    .single();
  
  if (error) {
    if (error.code === "PGRST116") {
      return null; // Not found
    }
    throw new Error("Failed to load template");
  }
  
  return data;
}

// ============================================
// Get Current Business State
// ============================================

export async function getCurrentBusiness() {
  const supabase = await getWriteClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("Not authenticated");
  }
  
  const tenantId = user.app_metadata?.tenant_id;
  if (!tenantId) {
    throw new Error("No business associated with user");
  }
  
  const { data: business, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", tenantId)
    .single();
  
  if (error) {
    throw new Error("Failed to load business");
  }
  
  return business;
}

// ============================================
// Step 1: Save Business Type
// Spec Lines 216-220
// ============================================

export async function saveBusinessType(typeSlug: string, _typeName: string) {
  const supabase = await getWriteClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("Not authenticated");
  }
  
  const tenantId = user.app_metadata?.tenant_id;
  if (!tenantId) {
    throw new Error("No business associated with user");
  }
  
  // Update business type
  const { error: businessError } = await supabase
    .from("businesses")
    .update({
      business_type: typeSlug,
      onboarding_step: 2,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId);
  
  if (businessError) {
    throw new Error("Failed to save business type");
  }
  
  revalidatePath("/onboarding");
  return { success: true };
}

// ============================================
// Step 2: Save Services & Business Details
// Spec Lines 222-260
// ============================================

export async function saveStep2Data(data: {
  services: ServiceFormData[];
  pricingApproach: PricingApproach;
  serviceArea: string;
  differentiator: string;
  businessHours: BusinessHoursFormData[];
}) {
  const supabase = await getWriteClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("Not authenticated");
  }
  
  const tenantId = user.app_metadata?.tenant_id;
  if (!tenantId) {
    throw new Error("No business associated with user");
  }
  
  // Filter to only selected services
  const selectedServices = data.services.filter((s) => s.isSelected);
  
  if (selectedServices.length === 0) {
    throw new Error("At least one service must be selected");
  }
  
  // Update business details
  const { error: businessError } = await supabase
    .from("businesses")
    .update({
      service_area: data.serviceArea,
      differentiator: data.differentiator || null,
      onboarding_step: 3,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId);
  
  if (businessError) {
    throw new Error("Failed to save business details");
  }
  
  // Delete existing services and insert new ones
  const { error: deleteServicesError } = await supabase
    .from("services")
    .delete()
    .eq("business_id", tenantId);
  
  if (deleteServicesError) {
    throw new Error("Failed to update services");
  }
  
  // Insert services
  const servicesToInsert = selectedServices.map((service, index) => ({
    business_id: tenantId,
    name: service.name,
    description: service.description || null,
    duration_minutes: service.duration_minutes,
    price_cents: service.price_cents,
    price_type: data.pricingApproach === "hidden" ? "hidden" : service.price_type,
    is_bookable: service.is_bookable,
    sort_order: index,
  }));
  
  const { error: insertServicesError } = await supabase
    .from("services")
    .insert(servicesToInsert);
  
  if (insertServicesError) {
    throw new Error("Failed to save services");
  }
  
  // Delete existing business hours and insert new ones
  const { error: deleteHoursError } = await supabase
    .from("business_hours")
    .delete()
    .eq("business_id", tenantId);
  
  if (deleteHoursError) {
    throw new Error("Failed to update business hours");
  }
  
  // Insert business hours
  const hoursToInsert = data.businessHours.map((hours) => ({
    business_id: tenantId,
    day_of_week: hours.day_of_week,
    open_time: hours.is_closed ? null : hours.open_time,
    close_time: hours.is_closed ? null : hours.close_time,
    is_closed: hours.is_closed,
  }));
  
  const { error: insertHoursError } = await supabase
    .from("business_hours")
    .insert(hoursToInsert);
  
  if (insertHoursError) {
    throw new Error("Failed to save business hours");
  }
  
  revalidatePath("/onboarding");
  return { success: true };
}

// ============================================
// Step 3: Save FAQs & Knowledge
// Spec Lines 262-280
// ============================================

export async function saveStep3Data(data: {
  faqs: FAQFormData[];
  additionalKnowledge: string;
  neverSay: string;
}) {
  const supabase = await getWriteClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("Not authenticated");
  }
  
  const tenantId = user.app_metadata?.tenant_id;
  if (!tenantId) {
    throw new Error("No business associated with user");
  }
  
  // Filter to only selected FAQs
  const selectedFAQs = data.faqs.filter((f) => f.isSelected);
  
  // Delete existing FAQs and insert new ones
  const { error: deleteFAQsError } = await supabase
    .from("faqs")
    .delete()
    .eq("business_id", tenantId);
  
  if (deleteFAQsError) {
    throw new Error("Failed to update FAQs");
  }
  
  // Insert FAQs if any selected
  if (selectedFAQs.length > 0) {
    const faqsToInsert = selectedFAQs.map((faq, index) => ({
      business_id: tenantId,
      question: faq.question,
      answer: faq.answer,
      sort_order: index,
    }));
    
    const { error: insertFAQsError } = await supabase
      .from("faqs")
      .insert(faqsToInsert);
    
    if (insertFAQsError) {
      throw new Error("Failed to save FAQs");
    }
  }
  
  // Upsert knowledge record
  const { error: knowledgeError } = await supabase
    .from("knowledge")
    .upsert(
      {
        business_id: tenantId,
        content: data.additionalKnowledge || null,
        never_say: data.neverSay || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id" }
    );
  
  if (knowledgeError) {
    throw new Error("Failed to save knowledge");
  }
  
  // Update onboarding step
  const { error: businessError } = await supabase
    .from("businesses")
    .update({
      onboarding_step: 4,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId);
  
  if (businessError) {
    throw new Error("Failed to update progress");
  }
  
  revalidatePath("/onboarding");
  return { success: true };
}

// ============================================
// Load Existing Data
// ============================================

export async function loadExistingServices(): Promise<ServiceFormData[]> {
  const supabase = await getWriteClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("Not authenticated");
  }
  
  const tenantId = user.app_metadata?.tenant_id;
  if (!tenantId) {
    return [];
  }
  
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("business_id", tenantId)
    .order("sort_order", { ascending: true });
  
  if (error) {
    return [];
  }
  
  return (data || []).map((service: Record<string, unknown>, index: number) => ({
    id: service.id as string,
    name: service.name as string,
    description: (service.description as string) || "",
    duration_minutes: service.duration_minutes as number,
    price_cents: service.price_cents as number | null,
    price_type: service.price_type as string,
    is_bookable: service.is_bookable as boolean,
    isSelected: true,
    isCustom: false,
    sort_order: index,
  }));
}

export async function loadExistingFAQs(): Promise<FAQFormData[]> {
  const supabase = await getWriteClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("Not authenticated");
  }
  
  const tenantId = user.app_metadata?.tenant_id;
  if (!tenantId) {
    return [];
  }
  
  const { data, error } = await supabase
    .from("faqs")
    .select("*")
    .eq("business_id", tenantId)
    .order("sort_order", { ascending: true });
  
  if (error) {
    return [];
  }
  
  return (data || []).map((faq: Record<string, unknown>, index: number) => ({
    id: faq.id as string,
    question: faq.question as string,
    answer: faq.answer as string,
    isSelected: true,
    isCustom: false,
    needsAttention: false,
    sort_order: index,
  }));
}

export async function loadExistingKnowledge() {
  const supabase = await getWriteClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("Not authenticated");
  }
  
  const tenantId = user.app_metadata?.tenant_id;
  if (!tenantId) {
    return { content: "", never_say: "" };
  }
  
  const { data, error } = await supabase
    .from("knowledge")
    .select("*")
    .eq("business_id", tenantId)
    .single();
  
  if (error && error.code !== "PGRST116") {
    // Error handled silently
  }
  
  return {
    content: data?.content || "",
    never_say: data?.never_say || "",
  };
}

export async function loadExistingBusinessHours(): Promise<
  BusinessHoursFormData[]
> {
  const supabase = await getWriteClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("Not authenticated");
  }
  
  const tenantId = user.app_metadata?.tenant_id;
  if (!tenantId) {
    return [];
  }
  
  const { data, error } = await supabase
    .from("business_hours")
    .select("*")
    .eq("business_id", tenantId)
    .order("day_of_week", { ascending: true });
  
  if (error) {
    return [];
  }
  
  return (data || []).map((hours: Record<string, unknown>) => ({
    day_of_week: hours.day_of_week as number,
    open_time: (hours.open_time as string) || "",
    close_time: (hours.close_time as string) || "",
    is_closed: hours.is_closed as boolean,
  }));
}

// ============================================
// Step 4: Save Calendar Settings
// Spec Lines 283-320
// ============================================

export async function saveStep4Data(data: Step4FormData) {
  const supabase = await getWriteClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("Not authenticated");
  }
  
  const tenantId = user.app_metadata?.tenant_id;
  if (!tenantId) {
    throw new Error("No business associated with user");
  }
  
  // Calculate actual duration
  const durationMinutes = data.defaultDurationMinutes === 0 && data.customDurationMinutes
    ? data.customDurationMinutes
    : data.defaultDurationMinutes;
  
  // Upsert calendar integration record
  const { error: calendarError } = await supabase
    .from("calendar_integrations")
    .upsert(
      {
        business_id: tenantId,
        provider: data.provider,
        calendar_id: data.calendarId,
        default_duration_minutes: durationMinutes,
        buffer_minutes: data.bufferMinutes,
        advance_booking_days: data.advanceBookingDays,
        require_email: data.requireEmail,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id" }
    );
  
  if (calendarError) {
    throw new Error("Failed to save calendar settings");
  }
  
  // Update onboarding step
  const { error: businessError } = await supabase
    .from("businesses")
    .update({
      onboarding_step: 5,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId);
  
  if (businessError) {
    throw new Error("Failed to update progress");
  }
  
  revalidatePath("/onboarding");
  return { success: true };
}

export async function loadExistingCalendarSettings(): Promise<Step4FormData | null> {
  const supabase = await getWriteClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("Not authenticated");
  }
  
  const tenantId = user.app_metadata?.tenant_id;
  if (!tenantId) {
    return null;
  }
  
  const { data, error } = await supabase
    .from("calendar_integrations")
    .select("*")
    .eq("business_id", tenantId)
    .single();
  
  if (error && error.code !== "PGRST116") {
    return null;
  }
  
  if (!data) {
    return null;
  }
  
  // Determine if using custom duration
  const standardDurations = [30, 60, 90];
  const isCustomDuration = !standardDurations.includes(data.default_duration_minutes);
  
  return {
    provider: data.provider as CalendarProvider,
    isConnected: !!data.access_token,
    calendarId: data.calendar_id,
    defaultDurationMinutes: isCustomDuration ? 0 : data.default_duration_minutes,
    customDurationMinutes: isCustomDuration ? data.default_duration_minutes : null,
    bufferMinutes: data.buffer_minutes,
    advanceBookingDays: data.advance_booking_days,
    requireEmail: data.require_email,
  };
}

// ============================================
// Step 5: Save Call Handling Settings
// Spec Lines 322-370
// ============================================

export async function saveStep5Data(data: Step5FormData) {
  const supabase = await getWriteClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("Not authenticated");
  }
  
  const tenantId = user.app_metadata?.tenant_id;
  if (!tenantId) {
    throw new Error("No business associated with user");
  }
  
  // Parse keywords
  const keywords = data.transferKeywords
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
  
  // Upsert call settings record
  const { error: callSettingsError } = await supabase
    .from("call_settings")
    .upsert(
      {
        business_id: tenantId,
        transfer_number: data.transferNumber || null,
        backup_transfer_number: data.backupTransferNumber || null,
        transfer_on_request: data.transferOnRequest,
        transfer_on_emergency: data.transferOnEmergency,
        transfer_on_upset: data.transferOnUpset,
        transfer_keywords: keywords,
        transfer_hours_type: data.transferHoursType,
        transfer_hours_custom: data.transferHoursCustom,
        after_hours_enabled: data.afterHoursEnabled,
        after_hours_can_book: data.afterHoursCanBook,
        after_hours_message_only: data.afterHoursMessageOnly,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id" }
    );
  
  if (callSettingsError) {
    throw new Error("Failed to save call settings");
  }
  
  // If there's an after-hours greeting, save it to ai_config
  if (data.afterHoursGreeting) {
    const { error: aiConfigError } = await supabase
      .from("ai_config")
      .upsert(
        {
          business_id: tenantId,
          after_hours_greeting: data.afterHoursGreeting,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id" }
      );
    
    if (aiConfigError) {
      // Non-fatal error, continue
    }
  }
  
  // Update onboarding step
  const { error: businessError } = await supabase
    .from("businesses")
    .update({
      onboarding_step: 6,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId);
  
  if (businessError) {
    throw new Error("Failed to update progress");
  }
  
  revalidatePath("/onboarding");
  return { success: true };
}

export async function loadExistingCallSettings(): Promise<Step5FormData | null> {
  const supabase = await getWriteClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("Not authenticated");
  }
  
  const tenantId = user.app_metadata?.tenant_id;
  if (!tenantId) {
    return null;
  }
  
  // Load call settings
  const { data: callSettings, error: callError } = await supabase
    .from("call_settings")
    .select("*")
    .eq("business_id", tenantId)
    .single();
  
  if (callError && callError.code !== "PGRST116") {
    return null;
  }
  
  // Load after-hours greeting from ai_config
  const { data: aiConfig } = await supabase
    .from("ai_config")
    .select("after_hours_greeting")
    .eq("business_id", tenantId)
    .single();
  
  if (!callSettings) {
    return null;
  }
  
  return {
    transferNumber: callSettings.transfer_number || "",
    backupTransferNumber: callSettings.backup_transfer_number || "",
    transferOnRequest: callSettings.transfer_on_request,
    transferOnEmergency: callSettings.transfer_on_emergency,
    transferOnUpset: callSettings.transfer_on_upset,
    transferKeywords: (callSettings.transfer_keywords || []).join(", "),
    transferHoursType: callSettings.transfer_hours_type as TransferHoursType,
    transferHoursCustom: callSettings.transfer_hours_custom,
    afterHoursEnabled: callSettings.after_hours_enabled,
    afterHoursCanBook: callSettings.after_hours_can_book,
    afterHoursMessageOnly: callSettings.after_hours_message_only,
    afterHoursGreeting: aiConfig?.after_hours_greeting || "",
  };
}

// ============================================
// Step 6: Save Language Settings
// Spec Lines 372-420
// ============================================

export async function saveStep6Data(data: Step6FormData) {
  const supabase = await getWriteClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("Not authenticated");
  }
  
  const tenantId = user.app_metadata?.tenant_id;
  if (!tenantId) {
    throw new Error("No business associated with user");
  }
  
  // Upsert ai_config record with language settings
  const { error: aiConfigError } = await supabase
    .from("ai_config")
    .upsert(
      {
        business_id: tenantId,
        spanish_enabled: data.spanishEnabled,
        language_mode: data.languageMode,
        greeting_spanish: data.greetingSpanish || null,
        after_hours_greeting_spanish: data.afterHoursGreetingSpanish || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id" }
    );
  
  if (aiConfigError) {
    throw new Error("Failed to save language settings");
  }
  
  // Update onboarding step
  const { error: businessError } = await supabase
    .from("businesses")
    .update({
      onboarding_step: 7,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId);
  
  if (businessError) {
    throw new Error("Failed to update progress");
  }
  
  revalidatePath("/onboarding");
  return { success: true };
}

// ============================================
// Step 7: Save Voice Settings
// ============================================

export async function saveStep7Data(data: {
  voiceId: string;
  voiceIdSpanish: string | null;
  personality: "professional" | "friendly" | "casual";
  aiName: string;
  customGreeting: string;
}) {
  const supabase = await getWriteClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const tenantId = user.app_metadata?.tenant_id;
  if (!tenantId) {
    throw new Error("No business associated with user");
  }

  // Upsert ai_config record with voice settings
  const { error: aiConfigError } = await supabase
    .from("ai_config")
    .upsert(
      {
        business_id: tenantId,
        voice_id: data.voiceId,
        voice_id_spanish: data.voiceIdSpanish,
        personality: data.personality,
        ai_name: data.aiName,
        greeting: data.customGreeting || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id" }
    );

  if (aiConfigError) {
    throw new Error("Failed to save voice settings");
  }

  // Update onboarding step
  const { error: businessError } = await supabase
    .from("businesses")
    .update({
      onboarding_step: 8,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId);

  if (businessError) {
    throw new Error("Failed to update progress");
  }

  revalidatePath("/onboarding");
  return { success: true };
}

export async function loadExistingVoiceSettings() {
  const supabase = await getWriteClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const tenantId = user.app_metadata?.tenant_id;
  if (!tenantId) {
    return null;
  }

  const { data, error } = await supabase
    .from("ai_config")
    .select("voice_id, voice_id_spanish, personality, ai_name, greeting")
    .eq("business_id", tenantId)
    .single();

  if (error && error.code !== "PGRST116") {
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    voiceId: data.voice_id || "",
    voiceIdSpanish: data.voice_id_spanish || null,
    personality: data.personality || "professional",
    aiName: data.ai_name || "Koya",
    customGreeting: data.greeting || "",
  };
}

export async function loadExistingLanguageSettings(): Promise<Step6FormData | null> {
  const supabase = await getWriteClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("Not authenticated");
  }
  
  const tenantId = user.app_metadata?.tenant_id;
  if (!tenantId) {
    return null;
  }
  
  const { data, error } = await supabase
    .from("ai_config")
    .select("spanish_enabled, language_mode, greeting_spanish, after_hours_greeting_spanish")
    .eq("business_id", tenantId)
    .single();
  
  if (error && error.code !== "PGRST116") {
    return null;
  }
  
  if (!data) {
    return null;
  }
  
  return {
    spanishEnabled: data.spanish_enabled || false,
    languageMode: (data.language_mode as LanguageMode) || "auto",
    greetingSpanish: data.greeting_spanish || "",
    afterHoursGreetingSpanish: data.after_hours_greeting_spanish || "",
  };
}

// ============================================
// Step 8: Save Phone Setup
// Provisions phone number and assigns to business
// ============================================

export async function saveStep8Data(data: Step8FormData) {
  const supabase = await getWriteClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const tenantId = user.app_metadata?.tenant_id;
  if (!tenantId) {
    throw new Error("No business associated with user");
  }

  // Validate that a phone number was selected or forwarding was confirmed
  if (!data.selectedNumber && !data.forwardingConfirmed) {
    throw new Error("Please select a phone number or confirm forwarding setup");
  }

  // If user selected a number and it hasn't been provisioned yet, provision it
  if (data.selectedNumber && !data.isProvisioned) {
    // Call the provision API
    const provisionResponse = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/twilio/provision`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: data.selectedNumber,
          businessId: tenantId,
          setupType: data.setupType || "direct",
          forwardedFrom: data.forwardedFrom,
          carrier: data.carrier,
        }),
      }
    );

    if (!provisionResponse.ok) {
      const errorData = await provisionResponse.json().catch(() => ({}));
      throw new Error(errorData.message || "Failed to provision phone number");
    }
  }

  // For forwarding setup, just record the forwarding info without provisioning
  // Map onboarding type "forward" to database type "forwarded"
  if (data.setupType === "forward" && data.forwardedFrom && data.forwardingConfirmed) {
    // Store the forwarding configuration
    const { error: phoneError } = await supabase
      .from("phone_numbers")
      .upsert(
        {
          business_id: tenantId,
          number: data.forwardedFrom,
          setup_type: "forwarded",
          forwarded_from: data.forwardedFrom,
          carrier: data.carrier,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id,number" }
      );

    if (phoneError) {
      throw new Error("Failed to save forwarding configuration");
    }
  }

  // Update onboarding step to 9 (test call)
  const { error: businessError } = await supabase
    .from("businesses")
    .update({
      onboarding_step: 9,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId);

  if (businessError) {
    throw new Error("Failed to update progress");
  }

  revalidatePath("/onboarding");
  return { success: true };
}

export async function loadExistingPhoneSettings(): Promise<Step8FormData | null> {
  const supabase = await getWriteClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const tenantId = user.app_metadata?.tenant_id;
  if (!tenantId) {
    return null;
  }

  // Load existing phone number for the business
  const { data: phoneNumber, error } = await supabase
    .from("phone_numbers")
    .select("*")
    .eq("business_id", tenantId)
    .eq("is_active", true)
    .single();

  if (error && error.code !== "PGRST116") {
    return null;
  }

  if (!phoneNumber) {
    return null;
  }

  // Map database types to onboarding types
  // Database: "direct" | "forwarded" -> Onboarding: "new" | "forward"
  const setupType = phoneNumber.setup_type === "forwarded" ? "forward" : "new";

  return {
    setupType: setupType as "new" | "forward",
    areaCode: phoneNumber.number?.substring(2, 5) || "",
    availableNumbers: [],
    selectedNumber: phoneNumber.number,
    twilioSid: phoneNumber.twilio_sid,
    isProvisioned: !!phoneNumber.twilio_sid,
    forwardedFrom: phoneNumber.forwarded_from,
    carrier: phoneNumber.carrier,
    forwardingConfirmed: phoneNumber.setup_type === "forwarded",
  };
}
