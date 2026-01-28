/**
 * Appointments API Route
 * Session 17: Dashboard - Appointments & Knowledge
 * Spec Reference: Part 7, Lines 700-717
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { logError } from "@/lib/logging";

async function handleGet(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const upcoming = searchParams.get("upcoming") === "true";
    const past = searchParams.get("past") === "true";
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const status = searchParams.get("status");
    const parsedLimit = parseInt(searchParams.get("limit") || "100", 10);
    // Validate limit parameter to prevent abuse
    const limit = Number.isNaN(parsedLimit) || parsedLimit < 1 ? 100 : Math.min(parsedLimit, 500);

    // Build query
    let query = supabase
      .from("appointments")
      .select("*")
      .eq("business_id", business.id)
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
      return errors.internalError("Failed to fetch appointments");
    }

    return success({ appointments: appointments || [] });
  } catch (error) {
    logError("Dashboard Appointments GET", error);
    return errors.internalError("Failed to fetch appointments");
  }
}

async function handlePost(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.scheduled_at || !body.duration_minutes) {
      return errors.badRequest("Scheduled time and duration are required");
    }

    // Validate field lengths to prevent abuse
    if (body.customer_name && (typeof body.customer_name !== "string" || body.customer_name.length > 200)) {
      return errors.badRequest("Customer name must be 200 characters or less");
    }
    if (body.customer_phone && (typeof body.customer_phone !== "string" || body.customer_phone.length > 30)) {
      return errors.badRequest("Customer phone must be 30 characters or less");
    }
    if (body.customer_email && (typeof body.customer_email !== "string" || body.customer_email.length > 254)) {
      return errors.badRequest("Customer email must be 254 characters or less");
    }
    if (body.service_name && (typeof body.service_name !== "string" || body.service_name.length > 200)) {
      return errors.badRequest("Service name must be 200 characters or less");
    }
    if (body.notes && (typeof body.notes !== "string" || body.notes.length > 2000)) {
      return errors.badRequest("Notes must be 2000 characters or less");
    }
    if (typeof body.duration_minutes !== "number" || body.duration_minutes < 1 || body.duration_minutes > 1440) {
      return errors.badRequest("Duration must be between 1 and 1440 minutes");
    }

    // Check for duplicate/overlapping appointments
    const scheduledStart = new Date(body.scheduled_at);
    const scheduledEnd = new Date(
      scheduledStart.getTime() + body.duration_minutes * 60 * 1000
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: existingAppointments, error: checkError } = await (
      supabase as any
    )
      .from("appointments")
      .select("id, scheduled_at, duration_minutes, customer_name")
      .eq("business_id", business.id)
      .eq("status", "confirmed")
      .gte(
        "scheduled_at",
        new Date(scheduledStart.getTime() - 24 * 60 * 60 * 1000).toISOString()
      )
      .lte(
        "scheduled_at",
        new Date(scheduledStart.getTime() + 24 * 60 * 60 * 1000).toISOString()
      );

    if (!checkError && existingAppointments) {
      for (const existing of existingAppointments) {
        const existingStart = new Date(existing.scheduled_at);
        const existingEnd = new Date(
          existingStart.getTime() + (existing.duration_minutes || 60) * 60 * 1000
        );

        // Check if new appointment overlaps with existing
        if (scheduledStart < existingEnd && scheduledEnd > existingStart) {
          return errors.conflict(
            `This time overlaps with an existing appointment for ${existing.customer_name || "another customer"}`
          );
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: appointment, error } = await (supabase as any)
      .from("appointments")
      .insert({
        business_id: business.id,
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
      return errors.internalError("Failed to create appointment");
    }

    return success({ appointment });
  } catch (error) {
    logError("Dashboard Appointments POST", error);
    return errors.internalError("Failed to create appointment");
  }
}

// Apply auth middleware with rate limiting
export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
