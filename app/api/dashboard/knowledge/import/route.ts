/**
 * Knowledge Import API Route
 * Imports services or FAQs from CSV
 *
 * POST /api/dashboard/knowledge/import
 * Body: FormData with 'file' (CSV) and 'type' (services|faqs)
 * Returns: { success: boolean, imported: number, errors: string[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { inngest } from "@/lib/inngest/client";

interface ImportResponse {
  success: boolean;
  imported?: number;
  errors?: string[];
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<ImportResponse>> {
  try {
    // Rate limit check
    const ip = getClientIP(request.headers);
    const rateLimitResult = await checkRateLimit("dashboard", ip);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    const supabase = await createClient();

    // Verify auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Get business
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (businessError || !business) {
      return NextResponse.json({ success: false, error: "Business not found" }, { status: 404 });
    }

    const businessId = (business as { id: string }).id;

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const importType = formData.get("type") as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    // File size limit (5MB)
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: "File too large. Maximum size is 5MB" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      return NextResponse.json(
        { success: false, error: "Only CSV files are allowed" },
        { status: 400 }
      );
    }

    if (importType !== "services" && importType !== "faqs") {
      return NextResponse.json(
        { success: false, error: "Invalid import type. Use 'services' or 'faqs'" },
        { status: 400 }
      );
    }

    // Read and parse CSV
    const csvText = await file.text();
    const rows = parseCsv(csvText);

    // Row limit (500 rows max)
    const MAX_ROWS = 500;
    if (rows.length > MAX_ROWS + 1) {
      return NextResponse.json(
        { success: false, error: `Too many rows. Maximum is ${MAX_ROWS} (plus header)` },
        { status: 400 }
      );
    }

    if (rows.length < 2) {
      return NextResponse.json(
        { success: false, error: "CSV file is empty or has only headers" },
        { status: 400 }
      );
    }

    // Skip header row
    const dataRows = rows.slice(1);
    const errors: string[] = [];
    let imported = 0;

    if (importType === "services") {
      // Get current max sort_order
      const { data: existingServices } = await supabase
        .from("services")
        .select("sort_order")
        .eq("business_id", businessId)
        .order("sort_order", { ascending: false })
        .limit(1);

      let sortOrder = ((existingServices as Array<{ sort_order: number }> | null)?.[0]?.sort_order ?? -1) + 1;

      // Expected columns: Name, Description, Duration (minutes), Price ($), Price Type, Bookable
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const lineNum = i + 2; // +2 for 1-indexing and header

        if (row.length < 1 || !row[0]?.trim()) {
          errors.push(`Row ${lineNum}: Missing service name`);
          continue;
        }

        const name = row[0].trim();
        const description = row[1]?.trim() || null;
        const durationMinutes = parseInt(row[2]) || 60;
        const priceStr = row[3]?.trim();
        const priceCents = priceStr ? Math.round(parseFloat(priceStr) * 100) : null;
        const priceType = validatePriceType(row[4]?.trim());
        const isBookable = row[5]?.toLowerCase() !== "no";

        const { error: insertError } = await (supabase as any).from("services").insert({
          business_id: businessId,
          name,
          description,
          duration_minutes: durationMinutes,
          price_cents: priceCents,
          price_type: priceType,
          is_bookable: isBookable,
          sort_order: sortOrder++,
        });

        if (insertError) {
          errors.push(`Row ${lineNum}: Failed to import "${name}"`);
        } else {
          imported++;
        }
      }
    } else {
      // FAQs - Expected columns: Question, Answer
      const { data: existingFaqs } = await supabase
        .from("faqs")
        .select("sort_order")
        .eq("business_id", businessId)
        .order("sort_order", { ascending: false })
        .limit(1);

      let sortOrder = ((existingFaqs as Array<{ sort_order: number }> | null)?.[0]?.sort_order ?? -1) + 1;

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const lineNum = i + 2;

        if (row.length < 2 || !row[0]?.trim() || !row[1]?.trim()) {
          errors.push(`Row ${lineNum}: Missing question or answer`);
          continue;
        }

        const question = row[0].trim();
        const answer = row[1].trim();

        const { error: insertError } = await (supabase as any).from("faqs").insert({
          business_id: businessId,
          question,
          answer,
          sort_order: sortOrder++,
        });

        if (insertError) {
          errors.push(`Row ${lineNum}: Failed to import question`);
        } else {
          imported++;
        }
      }
    }

    // Trigger Retell AI sync if any items were imported
    if (imported > 0) {
      await inngest.send({
        name: "prompt/regeneration.requested",
        data: {
          businessId,
          triggeredBy: `${importType}_import`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      imported,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("[Knowledge Import] Error:", error);
    return NextResponse.json(
      { success: false, error: "Import failed" },
      { status: 500 }
    );
  }
}

/**
 * Parse CSV text into rows of columns
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i++;
        } else {
          // End of quoted field
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentField);
        currentField = "";
      } else if (char === "\n" || (char === "\r" && nextChar === "\n")) {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
        if (char === "\r") i++; // Skip \n after \r
      } else if (char !== "\r") {
        currentField += char;
      }
    }
  }

  // Don't forget the last field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Validate and normalize price type
 */
function validatePriceType(value: string | undefined): "fixed" | "quote" | "hidden" {
  const normalized = value?.toLowerCase();
  if (normalized === "fixed") return "fixed";
  if (normalized === "hidden") return "hidden";
  return "quote"; // Default
}
