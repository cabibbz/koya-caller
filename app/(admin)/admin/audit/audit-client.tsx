"use client";

/**
 * Admin Audit Log Client Component
 * View history of all admin actions
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Shield,
  Search,
  RefreshCw,
  AlertCircle,
  Loader2,
  User,
  Pause,
  Play,
  XCircle,
  Plus,
  ArrowUpCircle,
  Bell,
  Download,
  Eye,
} from "lucide-react";
interface AuditLog {
  id: string;
  admin_user_id: string;
  admin_email: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

const actionIcons: Record<string, React.ReactNode> = {
  "subscription.pause": <Pause className="h-4 w-4" />,
  "subscription.resume": <Play className="h-4 w-4" />,
  "subscription.cancel": <XCircle className="h-4 w-4" />,
  "credit.apply": <Plus className="h-4 w-4" />,
  "plan.change": <ArrowUpCircle className="h-4 w-4" />,
  "announcement.create": <Bell className="h-4 w-4" />,
  "announcement.update": <Bell className="h-4 w-4" />,
  "announcement.delete": <Bell className="h-4 w-4" />,
  "export.download": <Download className="h-4 w-4" />,
  "customer.view": <Eye className="h-4 w-4" />,
};

const actionLabels: Record<string, string> = {
  "subscription.pause": "Paused subscription",
  "subscription.resume": "Resumed subscription",
  "subscription.cancel": "Cancelled subscription",
  "credit.apply": "Applied credit",
  "plan.change": "Changed plan",
  "announcement.create": "Created announcement",
  "announcement.update": "Updated announcement",
  "announcement.delete": "Deleted announcement",
  "export.download": "Downloaded export",
  "customer.view": "Viewed customer",
};

export function AuditClient() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/audit");
      if (!response.ok) throw new Error("Failed to fetch audit logs");

      const data = await response.json();
      setLogs(data.logs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.admin_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.target_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAction = actionFilter === "all" || log.action.startsWith(actionFilter);

    return matchesSearch && matchesAction;
  });

  const actionTypes = Array.from(new Set(logs.map((l) => l.action.split(".")[0])));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground">Track all admin actions for accountability</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by admin, target, or action..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="all">All Actions</option>
          {actionTypes.map((type) => (
            <option key={type} value={type}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Audit Logs Timeline */}
      <div className="space-y-4">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground border border-border rounded-lg">
            No audit logs found
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="flex gap-4 p-4 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                {actionIcons[log.action] || <Shield className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">
                    {actionLabels[log.action] || log.action}
                  </span>
                  {log.target_name && (
                    <>
                      <span className="text-muted-foreground">for</span>
                      <span className="font-medium">{log.target_name}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span>{log.admin_email}</span>
                  <span>•</span>
                  <span>{new Date(log.created_at).toLocaleString()}</span>
                  {log.ip_address && (
                    <>
                      <span>•</span>
                      <span className="font-mono text-xs">{log.ip_address}</span>
                    </>
                  )}
                </div>
                {log.details && Object.keys(log.details).length > 0 && (
                  <div className="mt-2 p-2 rounded bg-muted/50 text-xs font-mono">
                    {Object.entries(log.details).map(([key, value]) => (
                      <div key={key}>
                        <span className="text-muted-foreground">{key}:</span>{" "}
                        {String(value)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
