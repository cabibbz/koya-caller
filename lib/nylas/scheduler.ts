/**
 * Nylas Scheduler API wrapper
 * Manage scheduler configurations (booking pages)
 */

import { getNylasClient } from "./client";

export interface SchedulerConfig {
  id: string;
  name: string;
  slug: string;
  participantIds: string[];
  availability: Record<string, unknown>;
  eventBooking: Record<string, unknown>;
  isActive: boolean;
}

/**
 * List scheduler configurations for a grant
 */
export async function listSchedulerConfigs(
  grantId: string
): Promise<SchedulerConfig[]> {
  const nylas = getNylasClient();

  const response = await (nylas as any).schedulers?.configurations?.list({
    identifier: grantId,
  });

  if (!response?.data) return [];

  return (response.data as any[]).map((c: any) => ({
    id: c.id,
    name: c.name || "Untitled",
    slug: c.slug || "",
    participantIds: c.participants?.map((p: any) => p.email) || [],
    availability: c.availability || {},
    eventBooking: c.eventBooking || {},
    isActive: c.active ?? true,
  }));
}

/**
 * Create a scheduler configuration
 */
export async function createSchedulerConfig(
  grantId: string,
  params: {
    name: string;
    slug?: string;
    durationMinutes: number;
    participantEmail: string;
    availability?: {
      daysOfWeek?: number[];
      startHour?: number;
      endHour?: number;
    };
  }
): Promise<SchedulerConfig> {
  const nylas = getNylasClient();

  const requestBody: any = {
    name: params.name,
    slug: params.slug,
    participants: [
      {
        email: params.participantEmail,
        isOrganizer: true,
        availability: {
          calendarIds: ["primary"],
        },
      },
    ],
    availability: {
      durationMinutes: params.durationMinutes,
    },
    eventBooking: {
      title: params.name,
    },
  };

  const response = await (nylas as any).schedulers?.configurations?.create({
    identifier: grantId,
    requestBody,
  });

  const c = response.data as any;
  return {
    id: c.id,
    name: c.name || params.name,
    slug: c.slug || "",
    participantIds: [params.participantEmail],
    availability: c.availability || {},
    eventBooking: c.eventBooking || {},
    isActive: true,
  };
}

/**
 * Delete a scheduler configuration
 */
export async function deleteSchedulerConfig(
  grantId: string,
  configId: string
): Promise<void> {
  const nylas = getNylasClient();

  await (nylas as any).schedulers?.configurations?.destroy({
    identifier: grantId,
    configurationId: configId,
  });
}
