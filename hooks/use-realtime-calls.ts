"use client";

/**
 * useRealtimeCalls Hook
 * Supabase Realtime subscription for live call updates on the dashboard
 *
 * Features:
 * - Subscribes to INSERT events for new calls
 * - Subscribes to UPDATE events for call status changes
 * - Provides loading/error states
 * - Cleans up subscription on unmount
 * - Integrates with React Query for cache invalidation
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/use-api";
import type { Call } from "@/types";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

// =============================================================================
// TYPES
// =============================================================================

export interface RealtimeCallEvent {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  call: Call;
  timestamp: Date;
}

export interface UseRealtimeCallsOptions {
  /** Business ID to subscribe to */
  businessId: string;
  /** Initial calls data (from server-side fetch) */
  initialCalls?: Call[];
  /** Maximum number of calls to keep in state */
  maxCalls?: number;
  /** Callback when a new call is received */
  onNewCall?: (call: Call) => void;
  /** Callback when a call is updated */
  onCallUpdate?: (call: Call) => void;
  /** Whether to automatically invalidate React Query cache */
  invalidateCache?: boolean;
  /** Enable debug logging */
  debug?: boolean;
}

export interface UseRealtimeCallsReturn {
  /** Current calls with realtime updates applied */
  calls: Call[];
  /** Whether the subscription is being established */
  isConnecting: boolean;
  /** Whether the subscription is active */
  isConnected: boolean;
  /** Error if subscription failed */
  error: Error | null;
  /** Recent realtime events (for debugging/UI feedback) */
  recentEvents: RealtimeCallEvent[];
  /** Manually reconnect the subscription */
  reconnect: () => void;
  /** Manually disconnect the subscription */
  disconnect: () => void;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useRealtimeCalls({
  businessId,
  initialCalls = [],
  maxCalls = 50,
  onNewCall,
  onCallUpdate,
  invalidateCache = true,
  debug = false,
}: UseRealtimeCallsOptions): UseRealtimeCallsReturn {
  // State
  const [calls, setCalls] = useState<Call[]>(initialCalls);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [recentEvents, setRecentEvents] = useState<RealtimeCallEvent[]>([]);

  // Refs
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabaseRef = useRef(createClient());
  const queryClient = useQueryClient();

  // Debug logger
  const log = useCallback(
    (...args: unknown[]) => {
      if (debug) {
        console.log("[useRealtimeCalls]", ...args);
      }
    },
    [debug]
  );

  // Handle INSERT event (new call)
  const handleInsert = useCallback(
    (payload: RealtimePostgresChangesPayload<Call>) => {
      const newCall = payload.new as Call;
      log("New call received:", newCall.id);

      // Add event to recent events
      const event: RealtimeCallEvent = {
        eventType: "INSERT",
        call: newCall,
        timestamp: new Date(),
      };
      setRecentEvents((prev) => [event, ...prev].slice(0, 10));

      // Update local state - add to beginning
      setCalls((prev) => {
        // Check if call already exists (prevent duplicates)
        if (prev.some((c) => c.id === newCall.id)) {
          return prev;
        }
        return [newCall, ...prev].slice(0, maxCalls);
      });

      // Call the callback
      onNewCall?.(newCall);

      // Invalidate React Query cache for dashboard stats
      if (invalidateCache) {
        queryClient.invalidateQueries({ queryKey: queryKeys.stats });
        queryClient.invalidateQueries({ queryKey: queryKeys.recentCalls });
        queryClient.invalidateQueries({ queryKey: ["calls"] });
      }
    },
    [log, maxCalls, onNewCall, invalidateCache, queryClient]
  );

  // Handle UPDATE event (call status change)
  const handleUpdate = useCallback(
    (payload: RealtimePostgresChangesPayload<Call>) => {
      const updatedCall = payload.new as Call;
      log("Call updated:", updatedCall.id, "outcome:", updatedCall.outcome);

      // Add event to recent events
      const event: RealtimeCallEvent = {
        eventType: "UPDATE",
        call: updatedCall,
        timestamp: new Date(),
      };
      setRecentEvents((prev) => [event, ...prev].slice(0, 10));

      // Update local state
      setCalls((prev) =>
        prev.map((call) => (call.id === updatedCall.id ? updatedCall : call))
      );

      // Call the callback
      onCallUpdate?.(updatedCall);

      // Invalidate React Query cache
      if (invalidateCache) {
        queryClient.invalidateQueries({ queryKey: queryKeys.stats });
        queryClient.invalidateQueries({ queryKey: queryKeys.call(updatedCall.id) });
        queryClient.invalidateQueries({ queryKey: ["calls"] });
      }
    },
    [log, onCallUpdate, invalidateCache, queryClient]
  );

  // Handle DELETE event
  const handleDelete = useCallback(
    (payload: RealtimePostgresChangesPayload<Call>) => {
      const deletedCall = payload.old as Call;
      log("Call deleted:", deletedCall.id);

      // Add event to recent events
      const event: RealtimeCallEvent = {
        eventType: "DELETE",
        call: deletedCall,
        timestamp: new Date(),
      };
      setRecentEvents((prev) => [event, ...prev].slice(0, 10));

      // Update local state
      setCalls((prev) => prev.filter((call) => call.id !== deletedCall.id));

      // Invalidate React Query cache
      if (invalidateCache) {
        queryClient.invalidateQueries({ queryKey: queryKeys.stats });
        queryClient.invalidateQueries({ queryKey: ["calls"] });
      }
    },
    [log, invalidateCache, queryClient]
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
    const channelName = `calls-${businessId}-${Date.now()}`;

    // Create channel with postgres_changes listener
    const channel = supabase
      .channel(channelName)
      .on<Call>(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "calls",
          filter: `business_id=eq.${businessId}`,
        },
        handleInsert
      )
      .on<Call>(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "calls",
          filter: `business_id=eq.${businessId}`,
        },
        handleUpdate
      )
      .on<Call>(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "calls",
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

  // Update calls when initialCalls changes (server data refresh)
  useEffect(() => {
    if (initialCalls.length > 0) {
      setCalls(initialCalls);
    }
  }, [initialCalls]);

  // Setup and cleanup subscription on mount/unmount
  useEffect(() => {
    setupSubscription();

    return () => {
      cleanup();
    };
  }, [setupSubscription, cleanup]);

  return {
    calls,
    isConnecting,
    isConnected,
    error,
    recentEvents,
    reconnect,
    disconnect,
  };
}

// =============================================================================
// UTILITY HOOK FOR CONNECTION STATUS
// =============================================================================

/**
 * Hook to get just the connection status without managing calls
 * Useful for displaying a connection indicator
 */
export function useRealtimeConnectionStatus(businessId: string) {
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("connecting");
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabaseRef = useRef(createClient());

  useEffect(() => {
    if (!businessId) {
      setStatus("disconnected");
      return;
    }

    const supabase = supabaseRef.current;
    const channelName = `status-${businessId}-${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setStatus("connected");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setStatus("error");
        } else if (status === "CLOSED") {
          setStatus("disconnected");
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [businessId]);

  return status;
}
