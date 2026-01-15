/**
 * Knowledge Export API Route
 * Exports services or FAQs as CSV
 *
 * GET /api/dashboard/knowledge/export?type=services|faqs
 * Returns: CSV file
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { logError } from "@/lib/logging";

export async function GET(request: NextRequest) {
  try {
    // Rate limit check
    const ip = getClientIP(request.headers);
    const rateLimitResult = await checkRateLimit("dashboard", ip);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    const supabase = await createClient();

    // Verify auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get business
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (businessError || !business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const businessId = (business as { id: string }).id;

    // Get export type from query
    const { searchParams } = new URL(request.url);
    const exportType = searchParams.get("type");

    if (exportType !== "services" && exportType !== "faqs") {
      return NextResponse.json(
        { error: "Invalid export type. Use 'services' or 'faqs'" },
        { status: 400 }
      );
    }

    let csvContent: string;
    let filename: string;

    if (exportType === "services") {
      const { data: services } = await supabase
        .from("services")
        .select("name, description, duration_minutes, price_cents, price_type, is_bookable")
        .eq("business_id", businessId)
        .order("sort_order");

      const serviceData = (services || []) as Array<{
        name: string;
        description: string | null;
        duration_minutes: number;
        price_cents: number | null;
        price_type: string;
        is_bookable: boolean;
      }>;

      // Create CSV header
      const header = "Name,Description,Duration (minutes),Price ($),Price Type,Bookable";
      const rows = serviceData.map(s => {
        const price = s.price_cents ? (s.price_cents / 100).toFixed(2) : "";
        return [
          escapeCsvField(s.name),
          escapeCsvField(s.description || ""),
          s.duration_minutes.toString(),
          price,
          s.price_type,
          s.is_bookable ? "Yes" : "No",
        ].join(",");
      });

      csvContent = [header, ...rows].join("\n");
      filename = "services.csv";
    } else {
      const { data: faqs } = await supabase
        .from("faqs")
        .select("question, answer")
        .eq("business_id", businessId)
        .order("sort_order");

      const faqData = (faqs || []) as Array<{ question: string; answer: string }>;

      // Create CSV header
      const header = "Question,Answer";
      const rows = faqData.map(f => [
        escapeCsvField(f.question),
        escapeCsvField(f.answer),
      ].join(","));

      csvContent = [header, ...rows].join("\n");
      filename = "faqs.csv";
    }

    // Return as CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    logError("Knowledge Export", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}

/**
 * Escape a field for CSV format
 */
function escapeCsvField(value: string): string {
  // If the field contains comma, newline, or quotes, wrap in quotes
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    // Double any quotes
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
