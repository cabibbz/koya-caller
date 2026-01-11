/**
 * Appointments API Route
 * Session 17: Dashboard - Appointments & Knowledge
 * Spec Reference: Part 7, Lines 700-717
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    // Rate limit check - use IP or user identifier
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const rateLimitResult = await checkRateLimit("dashboard", ip);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
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

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const upcoming = searchParams.get("upcoming") === "true";
    const past = searchParams.get("past") === "true";
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    // Build query
    let query = supabase
      .from("appointments")
      .select("*")
      .eq("business_id", businessId)
      .order("scheduled_at", { ascending: true });

    const now = new Date().toISOString();

    // Date range filtering (for calendar view)
    if (from) {
      query = query.gte("scheduled_at", from);
    }
    if (to) {
      query = query.lte("scheduled_at", to);
    }
    
    // List view filters (if no from/to specified)
    if (!from && !to) {
      if (upcoming) {
        query = query.gte("scheduled_at", now);
      }
      if (past) {
        query = query.lt("scheduled_at", now);
      }
    }
    
    if (status) {
      query = query.eq("status", status);
    }

    query = query.limit(limit);

    const { data: appointments, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Failed to fetch appointments" }, { status: 500 });
    }

    return NextResponse.json({ appointments: appointments || [] });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit check - use IP or user identifier
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const rateLimitResult = await checkRateLimit("dashboard", ip);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
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
    const body = await request.json();

    // Validate required fields
    if (!body.scheduled_at || !body.duration_minutes) {
      return NextResponse.json(
        { error: "Scheduled time and duration are required" },
        { status: 400 }
      );
    }

    // Check for duplicate/overlapping appointments
    const scheduledStart = new Date(body.scheduled_at);
    const scheduledEnd = new Date(scheduledStart.getTime() + (body.duration_minutes * 60 * 1000));

    const { data: existingAppointments, error: checkError } = await (supabase as any)
      .from("appointments")
      .select("id, scheduled_at, duration_minutes, customer_name")
      .eq("business_id", businessId)
      .eq("status", "confirmed")
      .gte("scheduled_at", new Date(scheduledStart.getTime() - 24 * 60 * 60 * 1000).toISOString()) // Within 24hrs
      .lte("scheduled_at", new Date(scheduledStart.getTime() + 24 * 60 * 60 * 1000).toISOString());

    if (!checkError && existingAppointments) {
      for (const existing of existingAppointments) {
        const existingStart = new Date(existing.scheduled_at);
        const existingEnd = new Date(existingStart.getTime() + ((existing.duration_minutes || 60) * 60 * 1000));

        // Check if new appointment overlaps with existing
        if (scheduledStart < existingEnd && scheduledEnd > existingStart) {
          return NextResponse.json(
            {
              error: "Time slot conflict",
              message: `This time overlaps with an existing appointment for ${existing.customer_name || "another customer"}`
            },
            { status: 409 }
          );
        }
      }
    }

    const { data: appointment, error } = await (supabase as any)
      .from("appointments")
      .insert({
        business_id: businessId,
        customer_name: body.customer_name,
        customer_phone: body.customer_phone,
        customer_email: body.customer_email,
        service_id: body.service_id,
        service_name: body.service_name,
        scheduled_at: body.scheduled_at,
        duration_minutes: body.duration_minutes,
        notes: body.notes,
        status: "confirmed",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 });
    }

    return NextResponse.json({ appointment });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
