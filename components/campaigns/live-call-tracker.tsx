"use client";

/**
 * Live Call Tracker Component
 * Real-time view of campaign calls with status, progress, and details
 */

import { useState, useEffect, useCallback } from "react";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  PhoneIncoming,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  User,
  RefreshCw,
  PlayCircle,
  PauseCircle,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  Card,
  CardContent,
  Badge,
  Progress,
  Button,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

// =============================================================================
// Types
// =============================================================================

interface CallItem {
  id: string;
  contact_name: string;
  contact_phone: string;
  status: "pending" | "calling" | "completed" | "failed" | "declined" | "dnc_blocked" | "no_answer";
  outcome: string | null;
  duration_seconds: number;
  attempt_count: number;
  max_attempts: number;
  last_error: string | null;
  call_id: string | null;
  retell_call_id: string | null;
  created_at: string;
  updated_at: string;
  last_attempt_at: string | null;
}

interface QueueStats {
  total: number;
  pending: number;
  calling: number;
  completed: number;
  failed: number;
  declined: number;
  dnc_blocked: number;
  no_answer: number;
}

interface LiveCallTrackerProps {
  campaignId: string;
  campaignStatus: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

const formatPhoneNumber = (phone: string) => {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
};

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const getStatusConfig = (status: string, outcome: string | null) => {
  // Check outcome first for more specific status
  if (outcome === "booked" || outcome === "transferred" || outcome === "message_taken" || outcome === "completed" || outcome === "info") {
    return {
      icon: CheckCircle2,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      borderColor: "border-green-500/30",
      label: outcome === "booked" ? "Booked" : outcome === "transferred" ? "Transferred" : outcome === "message_taken" ? "Message Taken" : "Answered",
      pulse: false,
    };
  }

  if (outcome === "declined" || outcome === "rejected") {
    return {
      icon: PhoneOff,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      borderColor: "border-yellow-500/30",
      label: "Declined",
      pulse: false,
    };
  }

  if (outcome === "voicemail") {
    return {
      icon: Volume2,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/30",
      label: "Voicemail",
      pulse: false,
    };
  }

  if (outcome === "no_answer" || status === "no_answer") {
    return {
      icon: VolumeX,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      borderColor: "border-orange-500/30",
      label: "No Answer",
      pulse: false,
    };
  }

  switch (status) {
    case "pending":
      return {
        icon: Clock,
        color: "text-slate-400",
        bgColor: "bg-slate-500/10",
        borderColor: "border-slate-500/20",
        label: "Waiting",
        pulse: false,
      };
    case "calling":
      return {
        icon: PhoneCall,
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
        borderColor: "border-blue-500/30",
        label: "Calling...",
        pulse: true,
      };
    case "completed":
      return {
        icon: CheckCircle2,
        color: "text-green-500",
        bgColor: "bg-green-500/10",
        borderColor: "border-green-500/30",
        label: "Completed",
        pulse: false,
      };
    case "failed":
      return {
        icon: XCircle,
        color: "text-red-500",
        bgColor: "bg-red-500/10",
        borderColor: "border-red-500/30",
        label: "Failed",
        pulse: false,
      };
    case "declined":
      return {
        icon: PhoneOff,
        color: "text-yellow-500",
        bgColor: "bg-yellow-500/10",
        borderColor: "border-yellow-500/30",
        label: "Declined",
        pulse: false,
      };
    case "dnc_blocked":
      return {
        icon: AlertCircle,
        color: "text-orange-500",
        bgColor: "bg-orange-500/10",
        borderColor: "border-orange-500/30",
        label: "DNC Blocked",
        pulse: false,
      };
    default:
      return {
        icon: Phone,
        color: "text-gray-500",
        bgColor: "bg-gray-500/10",
        borderColor: "border-gray-500/20",
        label: status,
        pulse: false,
      };
  }
};

// =============================================================================
// Call Card Component
// =============================================================================

function CallCard({ call, index }: { call: CallItem; index: number }) {
  const config = getStatusConfig(call.status, call.outcome);
  const Icon = config.icon;

  // Calculate a pseudo-progress for calling status
  const [callingProgress, setCallingProgress] = useState(0);

  useEffect(() => {
    if (call.status === "calling") {
      const interval = setInterval(() => {
        setCallingProgress((prev) => (prev >= 95 ? 95 : prev + Math.random() * 5));
      }, 500);
      return () => clearInterval(interval);
    } else if (call.status === "completed" || call.status === "failed" || call.status === "declined") {
      setCallingProgress(100);
    } else {
      setCallingProgress(0);
    }
  }, [call.status]);

  return (
    <div
      className={cn(
        "relative p-4 rounded-lg border-2 transition-all duration-300",
        config.bgColor,
        config.borderColor,
        config.pulse && "animate-pulse"
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Status indicator dot */}
      {call.status === "calling" && (
        <span className="absolute top-2 right-2 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
        </span>
      )}

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn(
          "shrink-0 p-2 rounded-full",
          config.bgColor
        )}>
          <Icon className={cn("h-5 w-5", config.color)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium truncate">
              {call.contact_name}
            </span>
            <Badge variant="outline" className={cn("text-xs", config.color)}>
              {config.label}
            </Badge>
          </div>

          <p className="text-sm text-muted-foreground font-mono">
            {formatPhoneNumber(call.contact_phone)}
          </p>

          {/* Progress bar for active/completed calls */}
          {(call.status === "calling" || call.status === "completed" || call.status === "failed" || call.status === "declined") && (
            <div className="mt-2">
              <Progress
                value={callingProgress}
                className={cn(
                  "h-1.5",
                  call.status === "completed" && "[&>div]:bg-green-500",
                  call.status === "failed" && "[&>div]:bg-red-500",
                  call.status === "declined" && "[&>div]:bg-yellow-500",
                  call.status === "calling" && "[&>div]:bg-blue-500"
                )}
              />
            </div>
          )}

          {/* Duration or error */}
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            {call.duration_seconds > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(call.duration_seconds)}
              </span>
            )}
            {call.attempt_count > 1 && (
              <span>Attempt {call.attempt_count}/{call.max_attempts}</span>
            )}
            {call.last_error && (
              <span className="text-red-500 truncate max-w-[150px]" title={call.last_error}>
                {call.last_error}
              </span>
            )}
            {call.outcome && call.outcome !== "initiated" && (
              <span className="capitalize">{call.outcome.replace(/_/g, " ")}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function LiveCallTracker({ campaignId, campaignStatus }: LiveCallTrackerProps) {
  const [calls, setCalls] = useState<CallItem[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(
    campaignStatus === "running" || campaignStatus === "active"
  );

  const fetchQueue = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    else setRefreshing(true);

    try {
      const response = await fetch(`/api/dashboard/campaigns/${campaignId}/queue`);
      const data = await response.json();

      if (data.success) {
        setCalls(data.data.calls || []);
        setStats(data.data.stats || null);
      }
    } catch (error) {
      console.error("Failed to fetch queue:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Auto-refresh every 3 seconds when enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => fetchQueue(false), 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchQueue]);

  // Calculate overall progress
  const overallProgress = stats ?
    Math.round(((stats.completed + stats.failed + stats.declined + stats.no_answer) / Math.max(stats.total, 1)) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Live Call Status</h3>
          <p className="text-sm text-muted-foreground">
            {stats?.calling || 0} active call{(stats?.calling || 0) !== 1 ? "s" : ""} in progress
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? (
              <PauseCircle className="h-4 w-4 mr-2" />
            ) : (
              <PlayCircle className="h-4 w-4 mr-2" />
            )}
            {autoRefresh ? "Pause" : "Live"}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => fetchQueue(false)}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Overall Progress */}
      {stats && stats.total > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Campaign Progress</span>
              <span className="text-sm text-muted-foreground">
                {stats.completed + stats.failed + stats.declined + stats.no_answer} / {stats.total} completed
              </span>
            </div>
            <Progress value={overallProgress} className="h-3" />
            <div className="flex items-center justify-between mt-3 text-xs">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                  Pending: {stats.pending}
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
                  Calling: {stats.calling}
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-green-500"></span>
                  Completed: {stats.completed}
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-yellow-500"></span>
                  Declined: {stats.declined}
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-red-500"></span>
                  Failed: {stats.failed}
                </span>
              </div>
              <span className="font-medium">{overallProgress}%</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Call Grid */}
      {calls.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Phone className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No calls queued</h3>
            <p className="text-muted-foreground">
              Start the campaign to begin making calls
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Show calling first, then pending, then completed/failed */}
          {[...calls]
            .sort((a, b) => {
              const order = { calling: 0, pending: 1, completed: 2, declined: 3, failed: 4, no_answer: 5, dnc_blocked: 6 };
              const aOrder = order[a.status as keyof typeof order] ?? 99;
              const bOrder = order[b.status as keyof typeof order] ?? 99;
              return aOrder - bOrder;
            })
            .map((call, index) => (
              <CallCard key={call.id} call={call} index={index} />
            ))}
        </div>
      )}

      {/* Auto-refresh indicator */}
      {autoRefresh && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          Live updating every 3 seconds
        </div>
      )}
    </div>
  );
}
