"use client";

/**
 * Admin Real-time Dashboard Client Component
 * Live activity feed showing calls in progress, recent events
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Phone,
  PhoneCall,
  PhoneOff,
  Calendar,
  RefreshCw,
  AlertCircle,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  Zap,
  Users,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveStats {
  active_calls: number;
  calls_today: number;
  appointments_today: number;
  new_customers_today: number;
  system_health: "healthy" | "degraded" | "down";
}

interface ActivityEvent {
  id: string;
  type: "call_started" | "call_ended" | "appointment_booked" | "customer_signup" | "error";
  message: string;
  business_name?: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

const eventIcons: Record<string, React.ReactNode> = {
  call_started: <PhoneCall className="h-4 w-4 text-emerald-500" />,
  call_ended: <PhoneOff className="h-4 w-4 text-muted-foreground" />,
  appointment_booked: <Calendar className="h-4 w-4 text-blue-500" />,
  customer_signup: <Users className="h-4 w-4 text-purple-500" />,
  error: <AlertCircle className="h-4 w-4 text-red-500" />,
};

export function LiveClient() {
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/live");
      if (!response.ok) throw new Error("Failed to fetch live data");

      const data = await response.json();
      setStats(data.stats || null);
      setEvents(data.events || []);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  const getHealthStatus = (health: string) => {
    switch (health) {
      case "healthy":
        return { icon: <CheckCircle className="h-5 w-5" />, color: "text-emerald-500", bg: "bg-emerald-500/10" };
      case "degraded":
        return { icon: <AlertCircle className="h-5 w-5" />, color: "text-amber-500", bg: "bg-amber-500/10" };
      case "down":
        return { icon: <XCircle className="h-5 w-5" />, color: "text-red-500", bg: "bg-red-500/10" };
      default:
        return { icon: <Activity className="h-5 w-5" />, color: "text-muted-foreground", bg: "bg-muted" };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const healthStatus = stats ? getHealthStatus(stats.system_health) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="h-6 w-6 text-amber-500" />
            Live Dashboard
          </h1>
          <p className="text-muted-foreground">
            Real-time system activity • Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? (
              <>
                <Activity className="h-4 w-4 mr-2 animate-pulse" />
                Live
              </>
            ) : (
              <>
                <Activity className="h-4 w-4 mr-2" />
                Paused
              </>
            )}
          </Button>
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div
            className={cn(
              "p-4 rounded-lg border",
              stats.active_calls > 0
                ? "border-emerald-500/50 bg-emerald-500/5"
                : "border-border bg-card"
            )}
          >
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <PhoneCall className={cn("h-4 w-4", stats.active_calls > 0 && "text-emerald-500 animate-pulse")} />
              <span className="text-sm">Active Calls</span>
            </div>
            <p className={cn("text-3xl font-bold", stats.active_calls > 0 && "text-emerald-500")}>
              {stats.active_calls}
            </p>
          </div>

          <div className="p-4 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Phone className="h-4 w-4" />
              <span className="text-sm">Calls Today</span>
            </div>
            <p className="text-3xl font-bold">{stats.calls_today}</p>
          </div>

          <div className="p-4 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">Appts Today</span>
            </div>
            <p className="text-3xl font-bold">{stats.appointments_today}</p>
          </div>

          <div className="p-4 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">New Customers</span>
            </div>
            <p className="text-3xl font-bold">{stats.new_customers_today}</p>
          </div>

          <div className={cn("p-4 rounded-lg border", healthStatus?.bg)}>
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Activity className="h-4 w-4" />
              <span className="text-sm">System Health</span>
            </div>
            <div className={cn("flex items-center gap-2", healthStatus?.color)}>
              {healthStatus?.icon}
              <span className="text-xl font-bold capitalize">{stats.system_health}</span>
            </div>
          </div>
        </div>
      )}

      {/* Activity Feed */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Activity Feed
          </h2>
          <span className="text-xs text-muted-foreground">
            {events.length} recent events
          </span>
        </div>
        <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
          {events.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No recent activity
            </div>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className="p-4 hover:bg-muted/30 transition-colors flex items-start gap-3"
              >
                <div className="mt-0.5">{eventIcons[event.type]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{event.message}</p>
                  {event.business_name && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {event.business_name}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  <Clock className="h-3 w-3" />
                  {new Date(event.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
