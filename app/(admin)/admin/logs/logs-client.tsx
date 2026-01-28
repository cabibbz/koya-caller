"use client";

/**
 * Admin System Logs Client Component
 * View system errors, webhook failures, API issues
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Search,
  RefreshCw,
  Loader2,
  Filter,
  ChevronDown,
  ChevronUp,
  Clock,
  Server,
  Webhook,
  Phone,
  CreditCard,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SystemLog {
  id: string;
  level: "error" | "warning" | "info";
  category: string;
  message: string;
  details: Record<string, unknown> | null;
  business_id: string | null;
  business_name?: string;
  call_id: string | null;
  created_at: string;
}

interface LogStats {
  errors_today: number;
  warnings_today: number;
  errors_this_week: number;
  top_categories: { category: string; count: number }[];
}

const categoryIcons: Record<string, React.ReactNode> = {
  webhook: <Webhook className="h-4 w-4" />,
  api: <Server className="h-4 w-4" />,
  retell: <Phone className="h-4 w-4" />,
  twilio: <Phone className="h-4 w-4" />,
  stripe: <CreditCard className="h-4 w-4" />,
  calendar: <Calendar className="h-4 w-4" />,
};

export function LogsClient() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/logs");
      if (!response.ok) throw new Error("Failed to fetch logs");

      const data = await response.json();
      setLogs(data.logs || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.business_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesLevel = levelFilter === "all" || log.level === levelFilter;
    const matchesCategory = categoryFilter === "all" || log.category === categoryFilter;

    return matchesSearch && matchesLevel && matchesCategory;
  });

  const categories = Array.from(new Set(logs.map((l) => l.category)));

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getLevelStyles = (level: string) => {
    switch (level) {
      case "error":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "warning":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      default:
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    }
  };

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
          <h1 className="text-2xl font-bold tracking-tight">System Logs</h1>
          <p className="text-muted-foreground">Monitor errors and system events</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5">
            <div className="flex items-center gap-2 text-red-500 mb-2">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Errors Today</span>
            </div>
            <p className="text-2xl font-bold text-red-500">{stats.errors_today}</p>
          </div>
          <div className="p-4 rounded-lg border border-amber-500/20 bg-amber-500/5">
            <div className="flex items-center gap-2 text-amber-500 mb-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">Warnings Today</span>
            </div>
            <p className="text-2xl font-bold text-amber-500">{stats.warnings_today}</p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Errors This Week</span>
            </div>
            <p className="text-2xl font-bold">{stats.errors_this_week}</p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Filter className="h-4 w-4" />
              <span className="text-sm">Top Category</span>
            </div>
            <p className="text-lg font-bold">
              {stats.top_categories?.[0]?.category || "-"}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="h-9 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="all">All Levels</option>
            <option value="error">Errors</option>
            <option value="warning">Warnings</option>
            <option value="info">Info</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs List */}
      <div className="space-y-2">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground border border-border rounded-lg">
            No logs found
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className={cn(
                "rounded-lg border p-4 transition-colors",
                getLevelStyles(log.level)
              )}
            >
              <div
                className="flex items-start justify-between cursor-pointer"
                onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
              >
                <div className="flex items-start gap-3 flex-1">
                  {getLevelIcon(log.level)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-xs bg-background/50 flex items-center gap-1">
                        {categoryIcons[log.category] || <Server className="h-3 w-3" />}
                        {log.category}
                      </span>
                      {log.business_name && (
                        <span className="text-xs text-muted-foreground">
                          {log.business_name}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium">{log.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                {log.details && (
                  <Button variant="ghost" size="icon" className="shrink-0">
                    {expandedLog === log.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
              {expandedLog === log.id && log.details && (
                <div className="mt-3 pt-3 border-t border-current/10">
                  <pre className="text-xs bg-background/50 p-3 rounded overflow-x-auto">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
