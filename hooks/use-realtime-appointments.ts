"use client";

/**
 * useRealtimeAppointments Hook
 * Supabase Realtime subscription for live appointment updates on the dashboard
 *
 * Features:
 * - Subscribes to INSERT events for new appointments
 * - Subscribes to UPDATE events for appointment status changes
 * - Subscribes to DELETE events for appointment cancellations
 * - Provides loading/error states
 * - Cleans up subscription on unmount
 * - Integrates with React Query for cache invalidation
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/use-api";
import type { Appointment } from "@/types";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

// =============================================================================
// TYPES
// =============================================================================

export interface RealtimeAppointmentEvent {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  appointment: Appointment;
  timestamp: Date;
}

export interface UseRealtimeAppointmentsOptions {
  /** Business ID to subscribe to */
  businessId: string;
  /** Initial appointments data (from server-side fetch) */
  initialAppointments?: Appointment[];
  /** Maximum number of appointments to keep in state */
  maxAppointments?: number;
  /** Filter to only show upcoming appointments */
  upcomingOnly?: boolean;
  /** Callback when a new appointment is created */
  onNewAppointment?: (appointment: Appointment) => void;
  /** Callback when an appointment is updated */
  onAppointmentUpdate?: (appointment: Appointment) => void;
  /** Callback when an appointment is cancelled/deleted */
  onAppointmentDelete?: (appointment: Appointment) => void;
  /** Whether to automatically invalidate React Query cache */
  invalidateCache?: boolean;
  /** Enable debug logging */
  debug?: boolean;
}

export interface UseRealtimeAppointmentsReturn {
  /** Current appointments with realtime updates applied */
  appointments: Appointment[];
  /** Whether the subscription is being established */
  isConnecting: boolean;
  /** Whether the subscription is active */
  isConnected: boolean;
  /** Error if subscription failed */
  error: Error | null;
  /** Recent realtime events (for debugging/UI feedback) */
  recentEvents: RealtimeAppointmentEvent[];
  /** Manually reconnect the subscription */
  reconnect: () => void;
  /** Manually disconnect the subscription */
  disconnect: () => void;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if an appointment is upcoming (scheduled for the future)
 */
function isUpcoming(appointment: Appointment): boolean {
  if (!appointment.scheduled_at) return false;
  return new Date(appointment.scheduled_at) > new Date();
}

/**
 * Sort appointments by scheduled date (ascending)
 */
function sortByScheduledAt(appointments: Appointment[]): Appointment[] {
  return [...appointments].sort((a, b) => {
    const dateA = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
    const dateB = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
    return dateA - dateB;
  });
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useRealtimeAppointments({
  businessId,
  initialAppointments = [],
  maxAppointments = 50,
  upcomingOnly = false,
  onNewAppointment,
  onAppointmentUpdate,
  onAppointmentDelete,
  invalidateCache = true,
  debug = false,
}: UseRealtimeAppointmentsOptions): UseRealtimeAppointmentsReturn {
  // State
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [recentEvents, setRecentEvents] = useState<RealtimeAppointmentEvent[]>([]);

  // Refs
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabaseRef = useRef(createClient());
  const queryClient = useQueryClient();

  // Debug logger
  const log = useCallback(
    (...args: unknown[]) => {
      if (debug) {
        console.log("[useRealtimeAppointments]", ...args);
      }
    },
    [debug]
  );

  // Handle INSERT event (new appointment)
  const handleInsert = useCallback(
    (payload: RealtimePostgresChangesPayload<Appointment>) => {
      const newAppointment = payload.new as Appointment;
      log("New appointment received:", newAppointment.id);

      // Add event to recent events
      const event: RealtimeAppointmentEvent = {
        eventType: "INSERT",
        appointment: newAppointment,
        timestamp: new Date(),
      };
      setRecentEvents((prev) => [event, ...prev].slice(0, 10));

      // Update local state
      setAppointments((prev) => {
        // Check if appointment already exists (prevent duplicates)
        if (prev.some((a) => a.id === newAppointment.id)) {
          return prev;
        }

        // Filter by upcoming if needed
        if (upcomingOnly && !isUpcoming(newAppointment)) {
          return prev;
        }

        // Add and sort
        const updated = [...prev, newAppointment];
        return sortByScheduledAt(updated).slice(0, maxAppointments);
      });

      // Call the callback
      onNewAppointment?.(newAppointment);

      // Invalidate React Query cache
      if (invalidateCache) {
        queryClient.invalidateQueries({ queryKey: queryKeys.stats });
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
      }
    },
    [log, maxAppointments, upcomingOnly, onNewAppointment, invalidateCache, queryClient]
  );

  // Handle UPDATE event (appointment status change)
  const handleUpdate = useCallback(
    (payload: RealtimePostgresChangesPayload<Appointment>) => {
      const updatedAppointment = payload.new as Appointment;
      log("Appointment updated:", updatedAppointment.id, "status:", updatedAppointment.status);

      // Add event to recent events
      const event: RealtimeAppointmentEvent = {
        eventType: "UPDATE",
        appointment: updatedAppointment,
        timestamp: new Date(),
      };
      setRecentEvents((prev) => [event, ...prev].slice(0, 10));

      // Update local state
      setAppointments((prev) => {
        // If filtering by upcoming and appointment is no longer upcoming, remove it
        if (upcomingOnly && !isUpcoming(updatedAppointment)) {
          return prev.filter((a) => a.id !== updatedAppointment.id);
        }

        // Update the appointment in the list
        const updated = prev.map((appointment) =>
          appointment.id === updatedAppointment.id ? updatedAppointment : appointment
        );
        return sortByScheduledAt(updated);
      });

      // Call the callback
      onAppointmentUpdate?.(updatedAppointment);

      // Invalidate React Query cache
      if (invalidateCache) {
        queryClient.invalidateQueries({ queryKey: queryKeys.stats });
        queryClient.invalidateQueries({
          queryKey: queryKeys.appointment(updatedAppointment.id),
        });
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
      }
    },
    [log, upcomingOnly, onAppointmentUpdate, invalidateCache, queryClient]
  );

  // Handle DELETE event
  const handleDelete = useCallback(
    (payload: RealtimePostgresChangesPayload<Appointment>) => {
      const deletedAppointment = payload.old as Appointment;
      log("Appointment deleted:", deletedAppointment.id);

      // Add event to recent events
      const event: RealtimeAppointmentEvent = {
        eventType: "DELETE",
        appointment: deletedAppointment,
        timestamp: new Date(),
      };
      setRecentEvents((prev) => [event, ...prev].slice(0, 10));

      // Update local state
      setAppointments((prev) =>
        prev.filter((appointment) => appointment.id !== deletedAppointment.id)
      );

      // Call the callback
      onAppointmentDelete?.(deletedAppointment);

      // Invalidate React Query cache
      if (invalidateCache) {
        queryClient.invalidateQueries({ queryKey: queryKeys.stats });
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
      }
    },
    [log, onAppointmentDelete, invalidateCache, queryClient]
  );

  // Setup subscription
  const setupSubscription = useCallback(() => {
    if (!businessId) {
      log("No businessId provided, skipping subscription");
      setIsConnecting(false);
      return;
    }

    log("Setting up realtime subscription for business:", businessId);
    setIsConnecting(true);
    setError(null);

    const supabase = supabaseRef.current;
    const channelName = `appointments-${businessId}-${Date.now()}`;

    // Create channel with postgres_changes listener
    const channel = supabase
      .channel(channelName)
      .on<Appointment>(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "appointments",
          filter: `business_id=eq.${businessId}`,
        },
        handleInsert
      )
      .on<Appointment>(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "appointments",
          filter: `business_id=eq.${businessId}`,
        },
        handleUpdate
      )
      .on<Appointment>(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "appointments",
          filter: `business_id=eq.${businessId}`,
        },
        handleDelete
      )
      .subscribe((status, err) => {
        log("Subscription status:", status, err);

        if (status === "SUBSCRIBED") {
          setIsConnecting(false);
          setIsConnected(true);
          setError(null);
        } else if (status === "CHANNEL_ERROR") {
          setIsConnecting(false);
          setIsConnected(false);
          setError(err || new Error("Channel subscription failed"));
        } else if (status === "TIMED_OUT") {
          setIsConnecting(false);
          setIsConnected(false);
          setError(new Error("Subscription timed out"));
        } else if (status === "CLOSED") {
          setIsConnected(false);
        }
      });

    channelRef.current = channel;
  }, [businessId, handleInsert, handleUpdate, handleDelete, log]);

  // Cleanup subscription
  const cleanup = useCallback(() => {
    if (channelRef.current) {
      log("Cleaning up subscription");
      supabaseRef.current.removeChannel(channelRef.current);
      channelRef.current = null;
      setIsConnected(false);
    }
  }, [log]);

  // Reconnect function
  const reconnect = useCallback(() => {
    cleanup();
    setupSubscription();
  }, [cleanup, setupSubscription]);

  // Disconnect function
  const disconnect = useCallback(() => {
    cleanup();
  }, [cleanup]);

  // Update appointments when initialAppointments changes (server data refresh)
  useEffect(() => {
    if (initialAppointments.length > 0) {
      const filtered = upcomingOnly
        ? initialAppointments.filter(isUpcoming)
        : initialAppointments;
      setAppointments(sortByScheduledAt(filtered));
    }
  }, [initialAppointments, upcomingOnly]);

  // Setup and cleanup subscription on mount/unmount
  useEffect(() => {
    setupSubscription();

    return () => {
      cleanup();
    };
  }, [setupSubscription, cleanup]);

  return {
    appointments,
    isConnecting,
    isConnected,
    error,
    recentEvents,
    reconnect,
    disconnect,
  };
}

// =============================================================================
// SPECIALIZED HOOK FOR UPCOMING APPOINTMENTS
// =============================================================================

/**
 * Hook specifically for upcoming appointments in dashboard widgets
 * Pre-configured with upcomingOnly=true and automatic filtering
 */
export function useRealtimeUpcomingAppointments(
  businessId: string,
  initialAppointments?: Appointment[],
  limit = 5
) {
  return useRealtimeAppointments({
    businessId,
    initialAppointments,
    maxAppointments: limit,
    upcomingOnly: true,
  });
}
