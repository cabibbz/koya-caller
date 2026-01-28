"use client";

/**
 * Admin Retell Agents Client Component
 * View and monitor Retell agent configurations
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bot,
  Search,
  RefreshCw,
  AlertCircle,
  Loader2,
  CheckCircle,
  XCircle,
  Phone,
  Clock,
  MessageSquare,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RetellAgent {
  id: string;
  agent_id: string;
  business_id: string;
  business_name: string;
  voice_id: string;
  voice_name: string;
  language: string;
  status: "active" | "inactive" | "error";
  total_calls: number;
  last_call_at: string | null;
  prompt_preview: string;
  created_at: string;
  updated_at: string;
}

interface AgentStats {
  total_agents: number;
  active_agents: number;
  inactive_agents: number;
  error_agents: number;
}

export function AgentsClient() {
  const [agents, setAgents] = useState<RetellAgent[]>([]);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/agents");
      if (!response.ok) throw new Error("Failed to fetch agents");

      const data = await response.json();
      setAgents(data.agents || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const filteredAgents = agents.filter((a) => {
    const matchesSearch =
      a.business_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.agent_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.voice_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || a.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; icon: React.ReactNode }> = {
      active: { bg: "bg-emerald-500/10 text-emerald-500", icon: <CheckCircle className="h-3 w-3" /> },
      inactive: { bg: "bg-zinc-500/10 text-zinc-500", icon: <XCircle className="h-3 w-3" /> },
      error: { bg: "bg-red-500/10 text-red-500", icon: <AlertCircle className="h-3 w-3" /> },
    };
    const style = styles[status] || styles.inactive;
    return (
      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", style.bg)}>
        {style.icon}
        {status}
      </span>
    );
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
          <h1 className="text-2xl font-bold tracking-tight">Retell Agents</h1>
          <p className="text-muted-foreground">Monitor AI agent configurations</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Bot className="h-4 w-4" />
              <span className="text-sm">Total Agents</span>
            </div>
            <p className="text-2xl font-bold">{stats.total_agents}</p>
          </div>
          <div className="p-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
            <div className="flex items-center gap-2 text-emerald-500 mb-2">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">Active</span>
            </div>
            <p className="text-2xl font-bold text-emerald-500">{stats.active_agents}</p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <XCircle className="h-4 w-4" />
              <span className="text-sm">Inactive</span>
            </div>
            <p className="text-2xl font-bold">{stats.inactive_agents}</p>
          </div>
          <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5">
            <div className="flex items-center gap-2 text-red-500 mb-2">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Errors</span>
            </div>
            <p className="text-2xl font-bold text-red-500">{stats.error_agents}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by business or agent ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {["all", "active", "inactive", "error"].map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(status)}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Agents List */}
      <div className="space-y-4">
        {filteredAgents.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground border border-border rounded-lg">
            No agents found
          </div>
        ) : (
          filteredAgents.map((agent) => (
            <div
              key={agent.id}
              className="rounded-lg border border-border bg-card overflow-hidden"
            >
              <div
                className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{agent.business_name}</span>
                        {getStatusBadge(agent.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Volume2 className="h-3 w-3" />
                          {agent.voice_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {agent.total_calls} calls
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {agent.language}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p className="font-mono text-xs">{agent.agent_id.slice(0, 12)}...</p>
                    {agent.last_call_at && (
                      <p className="flex items-center gap-1 mt-1 justify-end">
                        <Clock className="h-3 w-3" />
                        {new Date(agent.last_call_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {expandedAgent === agent.id && (
                <div className="p-4 border-t border-border bg-muted/30">
                  <h4 className="text-sm font-medium mb-2">Prompt Preview</h4>
                  <pre className="text-xs bg-background p-3 rounded overflow-x-auto whitespace-pre-wrap max-h-40">
                    {agent.prompt_preview || "No prompt configured"}
                  </pre>
                  <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                    <span>Created: {new Date(agent.created_at).toLocaleDateString()}</span>
                    <span>Updated: {new Date(agent.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
