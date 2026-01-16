/**
 * Public Site Settings API
 * Returns public settings for landing page (stats, pricing)
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIP, rateLimitExceededResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Rate limit public API (30 requests per minute per IP)
    const clientIP = getClientIP(request.headers);
    const rateLimit = await checkRateLimit("public", clientIP);
    if (!rateLimit.success) {
      return rateLimitExceededResponse(rateLimit);
    }
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const supabase = createAdminClient();
    let query = (supabase.from("site_settings") as any).select("key, value, category");

    if (category) {
      query = query.eq("category", category);
    }

    const { data: settings, error } = await query;

    if (error) {
      // Return default values on error
      return NextResponse.json({
        settings: getDefaultSettings(category)
      });
    }

    // Transform to key-value map
    const settingsMap: Record<string, unknown> = {};
    settings?.forEach((s: { key: string; value: unknown }) => {
      settingsMap[s.key] = s.value;
    });

    return NextResponse.json({
      settings: settingsMap,
      raw: settings
    });
  } catch (_error) {
    return NextResponse.json({
      settings: getDefaultSettings(null)
    });
  }
}

// Default fallback settings
function getDefaultSettings(category: string | null) {
  const defaults: Record<string, unknown> = {
    // Stats
    stats_calls_today: { value: 2847, label: "Calls Handled Today" },
    stats_total_calls: { value: 2147892, suffix: "+", label: "Total Calls Answered" },
    stats_businesses: { value: 10847, suffix: "+", label: "Businesses Trust Us" },
    stats_uptime: { value: 99.9, suffix: "%", label: "Uptime Guaranteed" },
    // Pricing
    pricing_starter: {
      name: "Starter",
      price: 49,
      period: "month",
      description: "Perfect for small businesses",
      minutes: 100,
      features: ["100 minutes/month", "1 phone number", "Basic call handling", "Email support"],
      highlighted: false,
      cta: "Start Free Trial"
    },
    pricing_professional: {
      name: "Professional",
      price: 149,
      period: "month",
      description: "For growing businesses",
      minutes: 500,
      features: ["500 minutes/month", "2 phone numbers", "Advanced routing", "Priority support", "Calendar integration"],
      highlighted: true,
      badge: "Most Popular",
      cta: "Start Free Trial"
    },
    pricing_enterprise: {
      name: "Enterprise",
      price: 399,
      period: "month",
      description: "For high call volumes",
      minutes: 2000,
      features: ["2000 minutes/month", "5 phone numbers", "Multi-location", "Dedicated manager", "API access"],
      highlighted: false,
      cta: "Contact Sales"
    }
  };

  if (category === "stats") {
    return Object.fromEntries(
      Object.entries(defaults).filter(([k]) => k.startsWith("stats_"))
    );
  }
  if (category === "pricing") {
    return Object.fromEntries(
      Object.entries(defaults).filter(([k]) => k.startsWith("pricing_"))
    );
  }
  return defaults;
}
