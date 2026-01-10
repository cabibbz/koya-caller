/**
 * Admin Global Search API Route
 * Search across businesses, calls, appointments
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.app_metadata?.is_admin !== true) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q")?.trim().toLowerCase();
    const type = searchParams.get("type");

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const results: any[] = [];

    // Search businesses
    if (!type || type === "business") {
      const { data: businesses } = await (supabase as any)
        .from("businesses")
        .select("id, name, subscription_status, users(email)")
        .or(`name.ilike.%${query}%`)
        .limit(10);

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
      const { data: byEmail } = await (supabase as any)
        .from("users")
        .select("id, email, businesses(id, name, subscription_status)")
        .ilike("email", `%${query}%`)
        .limit(10);

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
      const { data: calls } = await (supabase as any)
        .from("calls")
        .select("id, caller_phone, status, created_at, businesses(name)")
        .or(`caller_phone.ilike.%${query}%,id.eq.${query}`)
        .order("created_at", { ascending: false })
        .limit(10);

      (calls || []).forEach((c: any) => {
        results.push({
          id: c.id,
          type: "call",
          title: c.caller_phone || "Unknown caller",
          subtitle: c.businesses?.name || "Unknown business",
          metadata: {
            status: c.status,
            date: new Date(c.created_at).toLocaleDateString(),
          },
        });
      });
    }

    // Search appointments
    if (!type || type === "appointment") {
      const { data: appointments } = await (supabase as any)
        .from("appointments")
        .select("id, customer_name, customer_phone, customer_email, scheduled_at, businesses(name)")
        .or(`customer_name.ilike.%${query}%,customer_phone.ilike.%${query}%,customer_email.ilike.%${query}%`)
        .order("scheduled_at", { ascending: false })
        .limit(10);

      (appointments || []).forEach((a: any) => {
        results.push({
          id: a.id,
          type: "appointment",
          title: a.customer_name || "Unknown customer",
          subtitle: a.businesses?.name || "Unknown business",
          metadata: {
            phone: a.customer_phone,
            date: new Date(a.scheduled_at).toLocaleDateString(),
          },
        });
      });
    }

    return NextResponse.json({ results: results.slice(0, 30) });
  } catch (error) {
    console.error("[Admin Search API] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
