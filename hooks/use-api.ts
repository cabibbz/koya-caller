"use client";

/**
 * API Hooks
 * React Query hooks for data fetching with caching and synchronization
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// =============================================================================
// TYPES
// =============================================================================

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface _PaginatedResponse<T> {
  success: boolean;
  data: {
    items: T[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// =============================================================================
// FETCH HELPERS
// =============================================================================

async function fetchApi<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// =============================================================================
// QUERY KEYS
// =============================================================================

export const queryKeys = {
  // Dashboard
  stats: ["dashboard", "stats"] as const,

  // Calls
  calls: (filters?: unknown) => ["calls", filters] as const,
  call: (id: string) => ["calls", id] as const,
  recentCalls: ["calls", "recent"] as const,

  // Appointments
  appointments: (filters?: unknown) => ["appointments", filters] as const,
  appointment: (id: string) => ["appointments", id] as const,

  // Settings
  settings: ["settings"] as const,
  businessSettings: ["settings", "business"] as const,
  voiceSettings: ["settings", "voice"] as const,
  notificationSettings: ["settings", "notifications"] as const,

  // Knowledge Base
  services: ["knowledge", "services"] as const,
  faqs: ["knowledge", "faqs"] as const,
  businessInfo: ["knowledge", "business"] as const,
};

// =============================================================================
// DASHBOARD HOOKS
// =============================================================================

export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: () => fetchApi<ApiResponse<{
      totalCalls: number;
      totalAppointments: number;
      minutesUsed: number;
      minutesIncluded: number;
      callsByOutcome: Record<string, number>;
    }>>("/api/dashboard/stats"),
  });
}

// =============================================================================
// CALLS HOOKS
// =============================================================================

interface CallFilters {
  startDate?: string;
  endDate?: string;
  outcome?: string;
  language?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export function useCalls(filters?: CallFilters) {
  return useQuery({
    queryKey: queryKeys.calls(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters?.startDate) params.set("startDate", filters.startDate);
      if (filters?.endDate) params.set("endDate", filters.endDate);
      if (filters?.outcome) params.set("outcome", filters.outcome);
      if (filters?.language) params.set("language", filters.language);
      if (filters?.search) params.set("search", filters.search);
      if (filters?.limit) params.set("limit", String(filters.limit));
      if (filters?.offset) params.set("offset", String(filters.offset));

      return fetchApi<ApiResponse<{
        calls: unknown[];
        total: number;
        hasMore: boolean;
      }>>(`/api/dashboard/calls?${params}`);
    },
  });
}

export function useRecentCalls(count = 10) {
  return useQuery({
    queryKey: queryKeys.recentCalls,
    queryFn: () => fetchApi<ApiResponse<{
      calls: unknown[];
      total: number;
    }>>(`/api/dashboard/calls?recent=true&limit=${count}`),
  });
}

export function useCall(id: string) {
  return useQuery({
    queryKey: queryKeys.call(id),
    queryFn: () => fetchApi<ApiResponse<unknown>>(`/api/dashboard/calls/${id}`),
    enabled: !!id,
  });
}

export function useUpdateCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...updates }: { id: string; flagged?: boolean; notes?: string }) =>
      fetchApi<ApiResponse<unknown>>(`/api/dashboard/calls`, {
        method: "PATCH",
        body: JSON.stringify({ id, ...updates }),
      }),
    onSuccess: (_, variables) => {
      // Invalidate call list and specific call
      queryClient.invalidateQueries({ queryKey: ["calls"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.call(variables.id) });
    },
  });
}

// =============================================================================
// APPOINTMENTS HOOKS
// =============================================================================

interface AppointmentFilters {
  status?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export function useAppointments(filters?: AppointmentFilters) {
  return useQuery({
    queryKey: queryKeys.appointments(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters?.status) params.set("status", filters.status);
      if (filters?.startDate) params.set("startDate", filters.startDate);
      if (filters?.endDate) params.set("endDate", filters.endDate);
      if (filters?.limit) params.set("limit", String(filters.limit));
      if (filters?.offset) params.set("offset", String(filters.offset));

      return fetchApi<ApiResponse<{
        appointments: unknown[];
        total: number;
        hasMore: boolean;
      }>>(`/api/dashboard/appointments?${params}`);
    },
  });
}

export function useAppointment(id: string) {
  return useQuery({
    queryKey: queryKeys.appointment(id),
    queryFn: () => fetchApi<ApiResponse<unknown>>(`/api/dashboard/appointments/${id}`),
    enabled: !!id,
  });
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...updates }: { id: string; status?: string; notes?: string }) =>
      fetchApi<ApiResponse<unknown>>(`/api/dashboard/appointments/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.appointment(variables.id) });
    },
  });
}

// =============================================================================
// SETTINGS HOOKS
// =============================================================================

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => fetchApi<ApiResponse<unknown>>("/api/dashboard/settings"),
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: Record<string, unknown>) =>
      fetchApi<ApiResponse<unknown>>("/api/dashboard/settings", {
        method: "POST",
        body: JSON.stringify(settings),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    },
  });
}

export function useVoiceSettings() {
  return useQuery({
    queryKey: queryKeys.voiceSettings,
    queryFn: () => fetchApi<ApiResponse<unknown>>("/api/dashboard/settings/voice"),
  });
}

export function useUpdateVoiceSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: { voiceId?: string; speed?: number; stability?: number }) =>
      fetchApi<ApiResponse<unknown>>("/api/dashboard/settings/voice", {
        method: "POST",
        body: JSON.stringify(settings),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.voiceSettings });
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    },
  });
}

// =============================================================================
// KNOWLEDGE BASE HOOKS
// =============================================================================

export function useServices() {
  return useQuery({
    queryKey: queryKeys.services,
    queryFn: () => fetchApi<ApiResponse<unknown[]>>("/api/dashboard/knowledge/services"),
  });
}

export function useUpdateServices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (services: unknown[]) =>
      fetchApi<ApiResponse<unknown>>("/api/dashboard/knowledge/services", {
        method: "POST",
        body: JSON.stringify({ services }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services });
    },
  });
}

export function useFaqs() {
  return useQuery({
    queryKey: queryKeys.faqs,
    queryFn: () => fetchApi<ApiResponse<unknown[]>>("/api/dashboard/knowledge/faqs"),
  });
}

export function useUpdateFaqs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (faqs: unknown[]) =>
      fetchApi<ApiResponse<unknown>>("/api/dashboard/knowledge/faqs", {
        method: "POST",
        body: JSON.stringify({ faqs }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.faqs });
    },
  });
}

export function useBusinessInfo() {
  return useQuery({
    queryKey: queryKeys.businessInfo,
    queryFn: () => fetchApi<ApiResponse<unknown>>("/api/dashboard/knowledge/business"),
  });
}

export function useUpdateBusinessInfo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (info: Record<string, unknown>) =>
      fetchApi<ApiResponse<unknown>>("/api/dashboard/knowledge/business", {
        method: "POST",
        body: JSON.stringify(info),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.businessInfo });
    },
  });
}
