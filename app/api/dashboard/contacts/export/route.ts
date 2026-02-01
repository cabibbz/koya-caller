/**
 * Contacts Export API Route
 * GET /api/dashboard/contacts/export
 *
 * Customer/Contact Management feature
 * PRODUCT_ROADMAP.md Section 2.3
 *
 * Query params:
 * - format: "csv" (required)
 * - vipOnly: boolean (optional)
 * - tier: CallerTier (optional)
 *
 * Returns: CSV file download
 */

import { NextRequest, NextResponse } from "next/server";
import {
  withAuth,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { getContactsForExport } from "@/lib/db/contacts";
import { logError } from "@/lib/logging";
import { format } from "date-fns";
import { arrayToCsv, formatPhoneForExport, formatExportDate } from "@/lib/utils/export";
import type { CallerTier } from "@/types";
import type { ContactWithStats } from "@/lib/db/contacts";

export const dynamic = "force-dynamic";

/**
 * Column definitions for contacts export
 */
const contactsExportColumns: {
  key: keyof ContactWithStats | string;
  header: string;
  transform?: (value: unknown, row: ContactWithStats) => string;
  width: number;
}[] = [
  {
    key: "name",
    header: "Name",
    transform: (v) => (v as string) || "Unknown",
    width: 120,
  },
  {
    key: "phone_number",
    header: "Phone",
    transform: (v) => formatPhoneForExport(v as string),
    width: 120,
  },
  {
    key: "email",
    header: "Email",
    transform: (v) => (v as string) || "",
    width: 150,
  },
  {
    key: "vip_status",
    header: "VIP",
    transform: (v) => (v ? "Yes" : "No"),
    width: 60,
  },
  {
    key: "total_calls",
    header: "Total Calls",
    transform: (v) => String(v || 0),
    width: 80,
  },
  {
    key: "last_call_at",
    header: "Last Contact",
    transform: (v) => formatExportDate(v as string),
    width: 150,
  },
  {
    key: "last_outcome",
    header: "Last Outcome",
    transform: (v) => {
      const outcomes: Record<string, string> = {
        booked: "Booked",
        transferred: "Transferred",
        info: "Info Only",
        message: "Message",
        missed: "Missed",
        minutes_exhausted: "Over Limit",
      };
      return outcomes[v as string] || String(v || "");
    },
    width: 100,
  },
  {
    key: "notes",
    header: "Notes",
    transform: (v) => (v as string) || "",
    width: 200,
  },
  {
    key: "created_at",
    header: "First Contact",
    transform: (v) => formatExportDate(v as string),
    width: 150,
  },
];

async function handleGet(
  request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const formatType = searchParams.get("format") as "csv" | null;
    const vipOnly = searchParams.get("vipOnly") === "true";
    const tier = searchParams.get("tier") as CallerTier | undefined;

    // Validate format
    if (!formatType || formatType !== "csv") {
      return errors.badRequest("Invalid format. Must be 'csv'");
    }

    // Fetch contacts
    const contacts = await getContactsForExport(business.id, {
      vipOnly,
      tier,
    });

    // Generate filename
    const today = format(new Date(), "yyyy-MM-dd");
    let filename = `koya-contacts-${today}`;
    if (vipOnly) filename += "-vip";
    if (tier) filename += `-${tier}`;
    filename += ".csv";

    // Generate CSV
    const csv = arrayToCsv(contacts, contactsExportColumns);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    logError("Contacts Export Error", error);
    return errors.internalError("Failed to generate export");
  }
}

export const GET = withAuth(handleGet);
