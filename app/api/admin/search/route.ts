/**
 * Admin Global Search API Route
 * Search across businesses, calls, appointments
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

/**
 * Sanitize search query for safe use in ILIKE patterns and PostgREST .or() clauses
 * Escapes special PostgreSQL pattern characters and PostgREST filter syntax
 */
function sanitizeSearchQuery(query: string): string {
  // First, strip any characters that could interfere with PostgREST filter syntax
  // Only allow alphanumeric, spaces, common punctuation marks that are safe
  const safeChars = query.replace(/[^a-zA-Z0-9\s\-@.+]/g, "");

  // Then escape PostgreSQL ILIKE special characters
  return safeChars
    .replace(/\\/g, "\\\\") // Escape backslashes first
    .replace(/%/g, "\\%")   // Escape percent signs
    .replace(/_/g, "\\_");  // Escape underscores
}

/**
 * Validate if a string is a valid UUID format
 */
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.app_metadata?.is_admin !== true) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const rawQuery = searchParams.get("q")?.trim().toLowerCase();
    const type = searchParams.get("type");

    if (!rawQuery || rawQuery.length < 2) {
      return NextResponse.json({ results: [] });
    }

    // Limit query length to prevent abuse
    if (rawQuery.length > 100) {
      return NextResponse.json({ error: "Query too long" }, { status: 400 });
    }

    // Sanitize the query for safe use in ILIKE patterns
    const query = sanitizeSearchQuery(rawQuery);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic search result structure
    const results: any[] = [];

    // Search businesses
    if (!type || type === "business") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
      const { data: businesses } = await (supabase as any)
        .from("businesses")
        .select("id, name, subscription_status, users(email)")
        .ilike("name", `%${query}%`)
        .limit(10);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response iteration
      (businesses || []).forEach((b: any) => {
        results.push({
          id: b.id,
          type: "business",
          title: b.name,
          subtitle: b.users?.email || "No email",
          metadata: { status: b.subscription_status },
        });
      });

      // Also search by email
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
      const { data: byEmail } = await (supabase as any)
        .from("users")
        .select("id, email, businesses(id, name, subscription_status)")
        .ilike("email", `%${query}%`)
        .limit(10);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response iteration
      (byEmail || []).forEach((u: any) => {
        if (u.businesses) {
          const existing = results.find((r) => r.id === u.businesses.id);
          if (!existing) {
            results.push({
              id: u.businesses.id,
              type: "business",
              title: u.businesses.name,
              subtitle: u.email,
              metadata: { status: u.businesses.subscription_status },
            });
          }
        }
      });
    }

    // Search calls
    if (!type || type === "call") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
      let calls: any[] = [];

      if (isValidUUID(rawQuery)) {
        // If it's a valid UUID, search by ID first, then by phone
        // Using separate queries avoids string interpolation in .or() filters
        const { data: callById } = await (supabase as any)
          .from("calls")
          .select("id, caller_phone, status, created_at, businesses(name)")
          .eq("id", rawQuery)
          .limit(1);

        const { data: callsByPhone } = await (supabase as any)
          .from("calls")
          .select("id, caller_phone, status, created_at, businesses(name)")
          .ilike("caller_phone", `%${query}%`)
          .order("created_at", { ascending: false })
          .limit(10);

        // Combine results, avoiding duplicates
        const seenIds = new Set<string>();
        calls = [];
        for (const c of [...(callById || []), ...(callsByPhone || [])]) {
          if (!seenIds.has(c.id)) {
            seenIds.add(c.id);
            calls.push(c);
          }
        }
      } else {
        // Otherwise only search by phone
        const { data: callsByPhone } = await (supabase as any)
          .from("calls")
          .select("id, caller_phone, status, created_at, businesses(name)")
          .ilike("caller_phone", `%${query}%`)
          .order("created_at", { ascending: false })
          .limit(10);
        calls = callsByPhone || [];
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response iteration
      calls.forEach((c: any) => {
        results.push({
          id: c.id,
          type: "call",
          title: c.caller_phone || "Unknown caller",
          subtitle: c.businesses?.name || "Unknown business",
          metadata: {
            status: c.status,
            date: c.created_at ? new Date(c.created_at).toLocaleDateString() : "Unknown",
          },
        });
      });
    }

    // Search appointments
    if (!type || type === "appointment") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
      const { data: appointments } = await (supabase as any)
        .from("appointments")
        .select("id, customer_name, customer_phone, customer_email, scheduled_at, businesses(name)")
        .or(`customer_name.ilike.%${query}%,customer_phone.ilike.%${query}%,customer_email.ilike.%${query}%`)
        .order("scheduled_at", { ascending: false })
        .limit(10);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response iteration
      (appointments || []).forEach((a: any) => {
        results.push({
          id: a.id,
          type: "appointment",
          title: a.customer_name || "Unknown customer",
          subtitle: a.businesses?.name || "Unknown business",
          metadata: {
            phone: a.customer_phone,
            date: a.scheduled_at ? new Date(a.scheduled_at).toLocaleDateString() : "Unknown",
          },
        });
      });
    }

    return NextResponse.json({ results: results.slice(0, 30) });
  } catch (error) {
    logError("Admin Search GET", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
