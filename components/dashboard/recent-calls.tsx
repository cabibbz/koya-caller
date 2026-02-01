"use client";

/**
 * Recent Calls List
 * Session 16: Dashboard - Home & Calls
 * Spec Reference: Part 7, Line 675
 *
 * Shows: Last 5-10 calls with key info
 *
 * Enhanced with Supabase Realtime subscriptions for live updates
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  Phone,
  ArrowRight,
  CalendarCheck,
  PhoneForwarded,
  Info,
  MessageSquare,
  PhoneMissed,
  Clock,
  Wifi,
  WifiOff,
  Loader2
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback } from "react";
import { useRealtimeCalls } from "@/hooks/use-realtime-calls";
import { toast } from "@/hooks/use-toast";
import type { Call } from "@/types";

interface RecentCallsListProps {
  calls: Call[];
}

interface RealtimeRecentCallsListProps {
  /** Initial calls data from server-side fetch */
  initialCalls: Call[];
  /** Business ID for realtime subscription */
  businessId: string;
  /** Maximum number of calls to display */
  maxCalls?: number;
  /** Show connection status indicator */
  showConnectionStatus?: boolean;
  /** Show toast notifications for new calls */
  showNotifications?: boolean;
}

const outcomeConfig = {
  booked: {
    labelKey: "outcomeBooked",
    icon: CalendarCheck,
    variant: "default" as const,
    className: "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20",
  },
  transferred: {
    labelKey: "outcomeTransferred",
    icon: PhoneForwarded,
    variant: "secondary" as const,
    className: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20",
  },
  info: {
    labelKey: "outcomeInfo",
    icon: Info,
    variant: "secondary" as const,
    className: "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20",
  },
  message: {
    labelKey: "outcomeMessage",
    icon: MessageSquare,
    variant: "secondary" as const,
    className: "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20",
  },
  missed: {
    labelKey: "outcomeMissed",
    icon: PhoneMissed,
    variant: "destructive" as const,
    className: "bg-red-500/10 text-red-500 hover:bg-red-500/20",
  },
  minutes_exhausted: {
    labelKey: "outcomeOverLimit",
    icon: Clock,
    variant: "outline" as const,
    className: "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20",
  },
};

function formatPhoneNumber(phone: string | null, unknownText: string): string {
  if (!phone) return unknownText;
  // Format as (XXX) XXX-XXXX for US numbers
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    const match = cleaned.slice(1).match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
  }
  if (cleaned.length === 10) {
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
  }
  return phone;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function RecentCallsList({ calls }: RecentCallsListProps) {
  const t = useTranslations("dashboard");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t("recentCalls")}
        </CardTitle>
        <Link href="/calls">
          <Button variant="ghost" size="sm" className="gap-1 h-8">
            {t("viewAll")}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {calls.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Phone className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm">{t("noCallsYet")}</p>
            <p className="text-xs mt-1">{t("recentCallsWillAppear")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {calls.map((call) => {
              const outcome = call.outcome || "info";
              const config = outcomeConfig[outcome as keyof typeof outcomeConfig] || outcomeConfig.info;
              const Icon = config.icon;

              return (
                <Link
                  key={call.id}
                  href={`/calls?id=${call.id}`}
                  className="flex items-center gap-4 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                >
                  {/* Icon */}
                  <div className={cn("rounded-lg p-2", config.className.split(" ")[0])}>
                    <Icon className={cn("h-4 w-4", config.className.split(" ")[1])} />
                  </div>

                  {/* Call info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {formatPhoneNumber(call.from_number, t("unknown"))}
                      </span>
                      {call.language === "es" && (
                        <Badge variant="outline" className="text-xs">
                          🇪🇸 ES
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatDuration(call.duration_seconds)}</span>
                      <span>•</span>
                      <span suppressHydrationWarning>
                        {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>

                  {/* Outcome badge */}
                  <Badge variant="secondary" className={cn("shrink-0", config.className)}>
                    {t(config.labelKey)}
                  </Badge>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// REALTIME-ENABLED RECENT CALLS LIST
// =============================================================================

/**
 * Realtime-enabled Recent Calls List
 * Uses Supabase Realtime subscriptions for live updates
 *
 * Features:
 * - Live updates when new calls come in
 * - Visual animation for new calls
 * - Connection status indicator
 * - Toast notifications for new calls
 */
export function RealtimeRecentCallsList({
  initialCalls,
  businessId,
  maxCalls = 10,
  showConnectionStatus = true,
  showNotifications = true,
}: RealtimeRecentCallsListProps) {
  const t = useTranslations("dashboard");
  const [highlightedCallId, setHighlightedCallId] = useState<string | null>(null);

  // Handle new call notification
  const handleNewCall = useCallback(
    (call: Call) => {
      // Highlight the new call temporarily
      setHighlightedCallId(call.id);
      setTimeout(() => setHighlightedCallId(null), 3000);

      // Show toast notification
      if (showNotifications) {
        const outcome = call.outcome || "info";
        const config = outcomeConfig[outcome as keyof typeof outcomeConfig] || outcomeConfig.info;

        toast({
          title: t("newCallReceived"),
          description: `${formatPhoneNumber(call.from_number, t("unknown"))} - ${t(config.labelKey)}`,
          variant: outcome === "booked" ? "success" : "default",
        });
      }
    },
    [showNotifications, t]
  );

  // Handle call update notification
  const handleCallUpdate = useCallback(
    (call: Call) => {
      // Highlight the updated call temporarily
      setHighlightedCallId(call.id);
      setTimeout(() => setHighlightedCallId(null), 2000);
    },
    []
  );

  // Use realtime subscription
  const {
    calls,
    isConnecting,
    isConnected,
    error,
    reconnect,
  } = useRealtimeCalls({
    businessId,
    initialCalls,
    maxCalls,
    onNewCall: handleNewCall,
    onCallUpdate: handleCallUpdate,
  });

  // Connection status component
  const ConnectionStatus = () => {
    if (!showConnectionStatus) return null;

    if (isConnecting) {
      return (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>{t("connecting") || "Connecting..."}</span>
        </div>
      );
    }

    if (error) {
      return (
        <button
          onClick={reconnect}
          className="flex items-center gap-1 text-xs text-red-500 hover:text-red-400 transition-colors"
          title={t("clickToReconnect") || "Click to reconnect"}
        >
          <WifiOff className="h-3 w-3" />
          <span>{t("disconnected") || "Disconnected"}</span>
        </button>
      );
    }

    if (isConnected) {
      return (
        <div className="flex items-center gap-1 text-xs text-emerald-500">
          <Wifi className="h-3 w-3" />
          <span>{t("live") || "Live"}</span>
        </div>
      );
    }

    return null;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("recentCalls")}
          </CardTitle>
          <ConnectionStatus />
        </div>
        <Link href="/calls">
          <Button variant="ghost" size="sm" className="gap-1 h-8">
            {t("viewAll")}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {calls.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Phone className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm">{t("noCallsYet")}</p>
            <p className="text-xs mt-1">{t("recentCallsWillAppear")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {calls.map((call) => {
              const outcome = call.outcome || "info";
              const config = outcomeConfig[outcome as keyof typeof outcomeConfig] || outcomeConfig.info;
              const Icon = config.icon;
              const isHighlighted = highlightedCallId === call.id;

              return (
                <Link
                  key={call.id}
                  href={`/calls?id=${call.id}`}
                  className={cn(
                    "flex items-center gap-4 rounded-lg border border-border p-3 transition-all duration-300 hover:bg-muted/50",
                    isHighlighted && "ring-2 ring-emerald-500/50 bg-emerald-500/5 border-emerald-500/30"
                  )}
                >
                  {/* Icon */}
                  <div className={cn("rounded-lg p-2", config.className.split(" ")[0])}>
                    <Icon className={cn("h-4 w-4", config.className.split(" ")[1])} />
                  </div>

                  {/* Call info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {formatPhoneNumber(call.from_number, t("unknown"))}
                      </span>
                      {call.language === "es" && (
                        <Badge variant="outline" className="text-xs">
                          ES
                        </Badge>
                      )}
                      {isHighlighted && (
                        <Badge variant="secondary" className="text-xs bg-emerald-500/20 text-emerald-500">
                          {t("new") || "New"}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatDuration(call.duration_seconds)}</span>
                      <span>*</span>
                      <span suppressHydrationWarning>
                        {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>

                  {/* Outcome badge */}
                  <Badge variant="secondary" className={cn("shrink-0", config.className)}>
                    {t(config.labelKey)}
                  </Badge>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// CONNECTION STATUS INDICATOR (standalone)
// =============================================================================

interface RealtimeStatusIndicatorProps {
  businessId: string;
}

/**
 * Standalone realtime connection status indicator
 * Can be used anywhere in the dashboard to show connection state
 */
export function RealtimeStatusIndicator({ businessId }: RealtimeStatusIndicatorProps) {
  const t = useTranslations("dashboard");
  const { isConnecting, isConnected, error, reconnect } = useRealtimeCalls({
    businessId,
    initialCalls: [],
    maxCalls: 0,
  });

  if (isConnecting) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-2 py-1 rounded-full bg-muted/50">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>{t("connecting") || "Connecting..."}</span>
      </div>
    );
  }

  if (error) {
    return (
      <button
        onClick={reconnect}
        className="flex items-center gap-1.5 text-xs text-red-500 px-2 py-1 rounded-full bg-red-500/10 hover:bg-red-500/20 transition-colors"
      >
        <WifiOff className="h-3 w-3" />
        <span>{t("reconnect") || "Reconnect"}</span>
      </button>
    );
  }

  if (isConnected) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-500 px-2 py-1 rounded-full bg-emerald-500/10">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span>{t("liveUpdates") || "Live Updates"}</span>
      </div>
    );
  }

  return null;
}
