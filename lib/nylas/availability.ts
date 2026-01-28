/**
 * Nylas Availability
 * Combines business hours + calendar busy times via Nylas Availability API
 */

import { getNylasClient } from "./client";
import { getNylasGrant } from "./calendar";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/logging";
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

interface AvailabilityOptions {
  startTime: number; // Unix seconds
  endTime: number;
  durationMinutes: number;
  intervalMinutes?: number;
  bufferMinutes?: number;
}

interface TimeSlot {
  startTime: number;
  endTime: number;
  emails: string[];
}

/**
 * Map day-of-week from DB format (0=Sunday) to Nylas format (0=Sunday)
 */
function mapDayOfWeek(dbDay: number): number {
  return dbDay;
}

/**
 * Fetch business hours and convert to Nylas open_hours format
 */
async function getOpenHours(
  businessId: string,
  timezone: string,
  supabase?: AnySupabaseClient
) {
  const client = (supabase || createAdminClient()) as AnySupabaseClient;

  const { data: hours } = await client
    .from("business_hours")
    .select("day_of_week, is_closed, open_time, close_time")
    .eq("business_id", businessId)
    .order("day_of_week");

  if (!hours || hours.length === 0) {
    // Default: Mon-Fri 9am-5pm
    return [
      {
        days: [1, 2, 3, 4, 5],
        timezone,
        start: "09:00",
        end: "17:00",
        exdates: [] as string[],
      },
    ];
  }

  // Group consecutive days with same hours
  const openDays = hours.filter((h) => !h.is_closed);
  const grouped: Record<string, number[]> = {};

  for (const day of openDays) {
    const key = `${day.open_time}-${day.close_time}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(mapDayOfWeek(day.day_of_week));
  }

  return Object.entries(grouped).map(([timeRange, days]) => {
    const [start, end] = timeRange.split("-");
    return {
      days,
      timezone,
      start: start.substring(0, 5),
      end: end.substring(0, 5),
      exdates: [] as string[],
    };
  });
}

/**
 * Get available time slots for a business using Nylas Availability API
 * Combines business hours + external calendar busy times in one call
 */
export async function getNylasAvailability(
  businessId: string,
  options: AvailabilityOptions
): Promise<{ timeSlots: TimeSlot[] }> {
  try {
    const grant = await getNylasGrant(businessId);
    if (!grant) {
      return { timeSlots: [] };
    }

    // Get business timezone
    const supabase = createAdminClient() as AnySupabaseClient;
    const { data: business } = await supabase
      .from("businesses")
      .select("timezone")
      .eq("id", businessId)
      .single();

    const timezone = business?.timezone || "America/New_York";

    // Get business hours as Nylas open_hours
    const openHours = await getOpenHours(businessId, timezone, supabase);

    const nylas = getNylasClient();
    const response = await nylas.calendars.getAvailability({
      requestBody: {
        startTime: options.startTime,
        endTime: options.endTime,
        durationMinutes: options.durationMinutes,
        intervalMinutes: options.intervalMinutes || 30,
        participants: [
          {
            email: grant.grantEmail,
            calendarIds: [grant.calendarId],
            openHours,
          },
        ],
        availabilityRules: {
          buffer: {
            before: options.bufferMinutes || 0,
            after: options.bufferMinutes || 0,
          },
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const slots = (response.data as any).timeSlots || [];
    return {
      timeSlots: slots.map((slot: { startTime: number; endTime: number; emails?: string[] }) => ({
        startTime: Number(slot.startTime),
        endTime: Number(slot.endTime),
        emails: slot.emails || [],
      })),
    };
  } catch (error) {
    logError("Nylas Availability", error);
    return { timeSlots: [] };
  }
}
