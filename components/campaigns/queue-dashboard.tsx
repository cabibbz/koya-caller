"use client";

/**
 * Queue Dashboard Component
 * Real-time view of outbound call queue
 */

import { useState, useEffect, useCallback } from "react";
import {
  Phone,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2,
  Calendar,
  RefreshCw,
  PlayCircle,
  PauseCircle,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Alert,
  AlertDescription,
} from "@/components/ui";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

// =============================================================================
// Types
// =============================================================================

interface QueuedCall {
  id: string;
  to_number: string;
  purpose: string;
  appointment_id: string | null;
  custom_message: string | null;
  scheduled_for: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  attempts: number;
  max_attempts: number;
  last_attempt_at: string | null;
  next_retry_at: string | null;
  error_message: string | null;
  created_at: string;
}

interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

const getStatusIcon = (status: QueuedCall["status"]) => {
  switch (status) {
    case "pending":
      return <Clock className="h-4 w-4 text-blue-500" />;
    case "processing":
      return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />;
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "cancelled":
      return <AlertCircle className="h-4 w-4 text-gray-500" />;
    default:
      return null;
  }
};

const getStatusColor = (status: QueuedCall["status"]) => {
  const colors = {
    pending: "bg-blue-500/10 text-blue-600",
    processing: "bg-yellow-500/10 text-yellow-600",
    completed: "bg-green-500/10 text-green-600",
    failed: "bg-red-500/10 text-red-600",
    cancelled: "bg-gray-500/10 text-gray-600",
  };
  return colors[status] || colors.pending;
};

const getPurposeLabel = (purpose: string) => {
  const labels: Record<string, string> = {
    reminder: "Appointment Reminder",
    followup: "Follow-up Call",
    custom: "Custom Call",
  };
  return labels[purpose] || purpose;
};

const formatPhoneNumber = (phone: string) => {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
};

// =============================================================================
// Component
// =============================================================================

interface QueueDashboardProps {
  /** Optional campaign ID to filter calls by */
  campaignId?: string;
  /** Whether to show the header section (default: true) */
  showHeader?: boolean;
  /** Whether to enable auto-refresh by default (default: true) */
  defaultAutoRefresh?: boolean;
}

export function QueueDashboard({
  campaignId,
  showHeader = true,
  defaultAutoRefresh = true,
}: QueueDashboardProps) {
  const [calls, setCalls] = useState<QueuedCall[]>([]);
  const [stats, setStats] = useState<QueueStats>({
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(defaultAutoRefresh);

  // =============================================================================
  // Data Fetching
  // =============================================================================

  const fetchQueue = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    else setRefreshing(true);

    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (campaignId) params.set("campaign_id", campaignId);
      params.set("limit", "100");

      const response = await fetch(`/api/outbound/queue?${params}`);
      const data = await response.json();

      if (data.success) {
        setCalls(data.data.calls || []);

        // Calculate stats from all calls (need separate fetch for accurate counts)
        const statsParams = new URLSearchParams();
        if (campaignId) statsParams.set("campaign_id", campaignId);
        statsParams.set("limit", "1000");
        const allResponse = await fetch(`/api/outbound/queue?${statsParams}`);
        const allData = await allResponse.json();
        if (allData.success) {
          const allCalls = allData.data.calls || [];
          setStats({
            pending: allCalls.filter((c: QueuedCall) => c.status === "pending").length,
            processing: allCalls.filter((c: QueuedCall) => c.status === "processing").length,
            completed: allCalls.filter((c: QueuedCall) => c.status === "completed").length,
            failed: allCalls.filter((c: QueuedCall) => c.status === "failed").length,
            total: allCalls.length,
          });
        }
      }
    } catch {
      // Silently fail - queue will remain empty
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, campaignId]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Auto-refresh every 10 seconds when enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => fetchQueue(false), 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchQueue]);

  // =============================================================================
  // Actions
  // =============================================================================

  const handleCancel = async (callId: string) => {
    setActionLoading(callId);
    try {
      const response = await fetch("/api/outbound/queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: callId, status: "cancelled" }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel call");
      }

      toast({
        title: "Cancelled",
        description: "Call removed from queue",
        variant: "success",
      });

      fetchQueue(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to cancel call",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  // =============================================================================
  // Render
  // =============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Call Queue</h2>
            <p className="text-muted-foreground">
              {campaignId
                ? "Calls queued for this campaign"
                : "Monitor and manage queued outbound calls"}
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
              {autoRefresh ? "Pause" : "Resume"} Auto-Refresh
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => fetchQueue(false)}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      )}
      {!showHeader && (
        <div className="flex items-center justify-end gap-2">
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
            {autoRefresh ? "Pause" : "Resume"}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => fetchQueue(false)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-blue-600">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Processing</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.processing}</p>
              </div>
              <Loader2 className="h-8 w-8 text-yellow-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Phone className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        {statusFilter !== "all" && (
          <Button variant="ghost" size="sm" onClick={() => setStatusFilter("all")}>
            Clear filter
          </Button>
        )}
      </div>

      {/* Queue Table */}
      {calls.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No calls in queue</h3>
              <p className="text-muted-foreground">
                Queued calls will appear here when campaigns are running.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Phone Number</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Error</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calls.map((call) => (
                <TableRow key={call.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(call.status)}
                      <Badge className={getStatusColor(call.status)}>
                        {call.status}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatPhoneNumber(call.to_number)}
                  </TableCell>
                  <TableCell>{getPurposeLabel(call.purpose)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatDistanceToNow(new Date(call.scheduled_for), { addSuffix: true })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {call.attempts} / {call.max_attempts}
                    </span>
                    {call.next_retry_at && call.status === "pending" && (
                      <p className="text-xs text-muted-foreground">
                        Retry {formatDistanceToNow(new Date(call.next_retry_at), { addSuffix: true })}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    {call.error_message && (
                      <span className="text-sm text-red-600 truncate max-w-[200px] block">
                        {call.error_message}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {(call.status === "pending" || call.status === "processing") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCancel(call.id)}
                        disabled={actionLoading === call.id}
                      >
                        {actionLoading === call.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-destructive" />
                        )}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Info Alert */}
      {autoRefresh && (
        <Alert>
          <RefreshCw className="h-4 w-4" />
          <AlertDescription>
            Queue data refreshes automatically every 10 seconds. Click pause to stop auto-refresh.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
