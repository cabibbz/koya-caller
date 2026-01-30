/**
 * Global Search Database Helpers
 * Provides unified search across calls, appointments, contacts, and FAQs
 */

import { createClient } from "@/lib/supabase/server";
import { sanitizeSqlPattern } from "@/lib/security";
import { logError } from "@/lib/logging";
import type { Call, Appointment, CallerProfile, FAQ } from "@/types";

// =============================================================================
// Types
// =============================================================================

export type SearchResultType = "call" | "appointment" | "contact" | "faq" | "page";

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  href: string;
  icon: string;
  timestamp?: string;
}

export interface GroupedSearchResults {
  calls: SearchResult[];
  appointments: SearchResult[];
  contacts: SearchResult[];
  faqs: SearchResult[];
  pages: SearchResult[];
}

// =============================================================================
// Navigation Pages for Quick Access
// =============================================================================

const NAVIGATION_PAGES: SearchResult[] = [
  { id: "nav-home", type: "page", title: "Dashboard Home", subtitle: "Overview and statistics", href: "/dashboard", icon: "home" },
  { id: "nav-calls", type: "page", title: "Calls", subtitle: "View all call history", href: "/dashboard/calls", icon: "phone" },
  { id: "nav-appointments", type: "page", title: "Appointments", subtitle: "Manage appointments", href: "/dashboard/appointments", icon: "calendar" },
  { id: "nav-knowledge", type: "page", title: "Knowledge", subtitle: "Services, FAQs, and business info", href: "/dashboard/knowledge", icon: "book" },
  { id: "nav-settings", type: "page", title: "Settings", subtitle: "Configure your AI assistant", href: "/dashboard/settings", icon: "settings" },
  { id: "nav-stats", type: "page", title: "Statistics", subtitle: "Analytics and performance", href: "/dashboard/stats", icon: "chart" },
  { id: "nav-billing", type: "page", title: "Billing", subtitle: "Manage subscription and payments", href: "/dashboard/billing", icon: "credit-card" },
];

// =============================================================================
// Search Functions
// =============================================================================

/**
 * Search across calls
 */
async function searchCalls(
  businessId: string,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const supabase = await createClient();
  const sanitizedQuery = sanitizeSqlPattern(query);

  const { data, error } = await supabase
    .from("calls")
    .select("id, from_number, summary, started_at, outcome")
    .eq("business_id", businessId)
    .or(
      `from_number.ilike.%${sanitizedQuery}%,summary.ilike.%${sanitizedQuery}%,message_taken.ilike.%${sanitizedQuery}%`
    )
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((call: Pick<Call, "id" | "from_number" | "summary" | "started_at" | "outcome">) => ({
    id: call.id,
    type: "call" as const,
    title: call.from_number ? `Call from ${formatPhoneForDisplay(call.from_number)}` : "Unknown Caller",
    subtitle: call.summary?.slice(0, 60) || call.outcome || "No summary",
    href: `/dashboard/calls/${call.id}`,
    icon: "phone-incoming",
    timestamp: call.started_at || undefined,
  }));
}

/**
 * Search across appointments
 */
async function searchAppointments(
  businessId: string,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const supabase = await createClient();
  const sanitizedQuery = sanitizeSqlPattern(query);

  const { data, error } = await supabase
    .from("appointments")
    .select("id, customer_name, customer_phone, service_name, scheduled_at, status")
    .eq("business_id", businessId)
    .or(
      `customer_name.ilike.%${sanitizedQuery}%,customer_phone.ilike.%${sanitizedQuery}%,service_name.ilike.%${sanitizedQuery}%,customer_email.ilike.%${sanitizedQuery}%`
    )
    .order("scheduled_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((apt: Pick<Appointment, "id" | "customer_name" | "customer_phone" | "service_name" | "scheduled_at" | "status">) => ({
    id: apt.id,
    type: "appointment" as const,
    title: apt.service_name
      ? `${apt.service_name} - ${apt.customer_name || "Unknown"}`
      : apt.customer_name || "Appointment",
    subtitle: apt.scheduled_at
      ? formatDateForDisplay(apt.scheduled_at)
      : apt.status || "No date",
    href: `/dashboard/appointments?id=${apt.id}`,
    icon: "calendar",
    timestamp: apt.scheduled_at || undefined,
  }));
}

/**
 * Search across caller profiles (contacts)
 */
async function searchContacts(
  businessId: string,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const supabase = await createClient();
  const sanitizedQuery = sanitizeSqlPattern(query);

  const { data, error } = await supabase
    .from("caller_profiles")
    .select("id, phone_number, name, email, call_count, last_call_at")
    .eq("business_id", businessId)
    .or(
      `name.ilike.%${sanitizedQuery}%,phone_number.ilike.%${sanitizedQuery}%,email.ilike.%${sanitizedQuery}%`
    )
    .order("last_call_at", { ascending: false })
    .limit(limit);

  if (error) {
    // Table might not exist yet, return empty array
    if (error.code === "42P01") {
      return [];
    }
    throw error;
  }

  return (data ?? []).map((contact: Pick<CallerProfile, "id" | "phone_number" | "name" | "email" | "call_count" | "last_call_at">) => ({
    id: contact.id,
    type: "contact" as const,
    title: contact.name || formatPhoneForDisplay(contact.phone_number),
    subtitle: contact.email || `${contact.call_count} call${contact.call_count === 1 ? "" : "s"}`,
    href: `/dashboard/calls?contact=${contact.phone_number}`,
    icon: "user",
    timestamp: contact.last_call_at,
  }));
}

/**
 * Search across FAQs
 */
async function searchFAQs(
  businessId: string,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const supabase = await createClient();
  const sanitizedQuery = sanitizeSqlPattern(query);

  const { data, error } = await supabase
    .from("faqs")
    .select("id, question, answer")
    .eq("business_id", businessId)
    .or(`question.ilike.%${sanitizedQuery}%,answer.ilike.%${sanitizedQuery}%`)
    .order("sort_order", { ascending: true })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((faq: Pick<FAQ, "id" | "question" | "answer">) => ({
    id: faq.id,
    type: "faq" as const,
    title: faq.question,
    subtitle: faq.answer.slice(0, 60) + (faq.answer.length > 60 ? "..." : ""),
    href: `/dashboard/knowledge?tab=faqs&id=${faq.id}`,
    icon: "help-circle",
  }));
}

/**
 * Search navigation pages
 */
function searchPages(query: string, limit: number): SearchResult[] {
  const lowerQuery = query.toLowerCase();
  return NAVIGATION_PAGES.filter(
    (page) =>
      page.title.toLowerCase().includes(lowerQuery) ||
      page.subtitle.toLowerCase().includes(lowerQuery)
  ).slice(0, limit);
}

/**
 * Global search across all entities
 * Returns grouped results by type
 */
export async function globalSearch(
  businessId: string,
  query: string,
  limitPerCategory: number = 5
): Promise<GroupedSearchResults> {
  // If query is empty, return just pages
  if (!query || query.trim().length === 0) {
    return {
      calls: [],
      appointments: [],
      contacts: [],
      faqs: [],
      pages: NAVIGATION_PAGES.slice(0, limitPerCategory),
    };
  }

  const trimmedQuery = query.trim();

  // Run all searches in parallel for performance
  // Errors are logged but don't fail the overall search - partial results are better than no results
  const [calls, appointments, contacts, faqs] = await Promise.all([
    searchCalls(businessId, trimmedQuery, limitPerCategory).catch((err) => { logError("Search calls", err); return []; }),
    searchAppointments(businessId, trimmedQuery, limitPerCategory).catch((err) => { logError("Search appointments", err); return []; }),
    searchContacts(businessId, trimmedQuery, limitPerCategory).catch((err) => { logError("Search contacts", err); return []; }),
    searchFAQs(businessId, trimmedQuery, limitPerCategory).catch((err) => { logError("Search FAQs", err); return []; }),
  ]);

  const pages = searchPages(trimmedQuery, limitPerCategory);

  return {
    calls,
    appointments,
    contacts,
    faqs,
    pages,
  };
}

/**
 * Get recent items for empty search state
 */
export async function getRecentItems(
  businessId: string,
  limit: number = 5
): Promise<SearchResult[]> {
  const supabase = await createClient();

  // Get recent calls
  const { data: recentCalls } = await supabase
    .from("calls")
    .select("id, from_number, summary, started_at, outcome")
    .eq("business_id", businessId)
    .order("started_at", { ascending: false })
    .limit(limit);

  return (recentCalls ?? []).map((call: Pick<Call, "id" | "from_number" | "summary" | "started_at" | "outcome">) => ({
    id: call.id,
    type: "call" as const,
    title: call.from_number ? `Call from ${formatPhoneForDisplay(call.from_number)}` : "Unknown Caller",
    subtitle: call.summary?.slice(0, 60) || call.outcome || "No summary",
    href: `/dashboard/calls/${call.id}`,
    icon: "phone-incoming",
    timestamp: call.started_at || undefined,
  }));
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Format phone number for display
 */
function formatPhoneForDisplay(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  // Try with country code
  const matchWithCountry = cleaned.match(/^1?(\d{3})(\d{3})(\d{4})$/);
  if (matchWithCountry) {
    return `(${matchWithCountry[1]}) ${matchWithCountry[2]}-${matchWithCountry[3]}`;
  }
  return phone;
}

/**
 * Format date for display
 */
function formatDateForDisplay(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isTomorrow = date.toDateString() === new Date(now.getTime() + 86400000).toDateString();

    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    if (isToday) {
      return `Today at ${timeStr}`;
    }
    if (isTomorrow) {
      return `Tomorrow at ${timeStr}`;
    }

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}
