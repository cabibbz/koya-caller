"use client";

/**
 * Campaign List Component
 * Displays all campaigns with filtering and actions
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Phone,
  Loader2,
  Plus,
  Play,
  Pause,
  StopCircle,
  Trash2,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Filter,
  TrendingUp,
  Activity,
  Zap,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Badge,
  Progress,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

// =============================================================================
// Types
// =============================================================================

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "scheduled" | "active" | "running" | "paused" | "completed";
  type: "reminder" | "followup" | "custom";
  scheduled_start: string | null;
  scheduled_end: string | null;
  target_contacts: number;
  calls_completed: number;
  calls_successful: number;
  calls_failed: number;
  created_at: string;
  updated_at: string;
}

interface CampaignListProps {
  initialCampaigns?: Campaign[];
  initialTotal?: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

const getStatusColor = (status: Campaign["status"]) => {
  const colors = {
    draft: "bg-gray-500/10 text-gray-600",
    scheduled: "bg-blue-500/10 text-blue-600",
    active: "bg-green-500/10 text-green-600",
    running: "bg-green-500/10 text-green-600",
    paused: "bg-yellow-500/10 text-yellow-600",
    completed: "bg-purple-500/10 text-purple-600",
  };
  return colors[status] || colors.draft;
};

const getTypeLabel = (type: Campaign["type"]) => {
  const labels = {
    reminder: "Appointment Reminder",
    followup: "Follow-up",
    custom: "Custom Campaign",
  };
  return labels[type] || type;
};

const formatDate = (date: string | null) => {
  if (!date) return "Not scheduled";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

// =============================================================================
// Component
// =============================================================================

export function CampaignList({ initialCampaigns = [], initialTotal = 0 }: CampaignListProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(initialCampaigns.length === 0);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // =============================================================================
  // Data Fetching
  // =============================================================================

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);

      const response = await fetch(`/api/dashboard/campaigns?${params}`);
      const data = await response.json();

      if (data.success) {
        setCampaigns(data.data.campaigns);
        setTotal(data.data.total);
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to fetch campaigns",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // =============================================================================
  // Actions
  // =============================================================================

  const handleAction = async (campaignId: string, action: string) => {
    setActionLoading(campaignId);
    try {
      const response = await fetch(`/api/dashboard/campaigns/${campaignId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action} campaign`);
      }

      toast({
        title: "Success",
        description: data.message || `Campaign ${action}ed successfully`,
        variant: "success",
      });

      fetchCampaigns();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : `Failed to ${action} campaign`,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (campaignId: string) => {
    if (!confirm("Are you sure you want to delete this campaign? This cannot be undone.")) {
      return;
    }

    setActionLoading(campaignId);
    try {
      const response = await fetch(`/api/dashboard/campaigns/${campaignId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete campaign");
      }

      toast({
        title: "Deleted",
        description: "Campaign deleted successfully",
        variant: "success",
      });

      fetchCampaigns();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete campaign",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleProcessCalls = async (campaignId: string) => {
    setActionLoading(`process-${campaignId}`);
    try {
      const response = await fetch(`/api/dashboard/campaigns/${campaignId}/process`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || data.error || "Failed to process calls");
      }

      if (data.data?.processed === 0) {
        toast({
          title: "No Pending Calls",
          description: "There are no pending calls to process in this campaign.",
        });
      } else {
        toast({
          title: "Calls Processed",
          description: `Processed ${data.data?.processed || 0} calls. ${data.data?.succeeded || 0} succeeded, ${data.data?.failed || 0} failed.`,
          variant: data.data?.failed > 0 ? "destructive" : "success",
        });
      }

      fetchCampaigns();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process calls",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  // =============================================================================
  // Computed Stats
  // =============================================================================

  const aggregateStats = campaigns.reduce(
    (acc, campaign) => {
      acc.totalContacts += campaign.target_contacts ?? 0;
      acc.totalCalls += campaign.calls_completed ?? 0;
      acc.successfulCalls += campaign.calls_successful ?? 0;
      acc.failedCalls += campaign.calls_failed ?? 0;
      if (campaign.status === "active") acc.activeCampaigns += 1;
      return acc;
    },
    {
      totalContacts: 0,
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      activeCampaigns: 0,
    }
  );

  const overallSuccessRate =
    aggregateStats.totalCalls > 0
      ? Math.round((aggregateStats.successfulCalls / aggregateStats.totalCalls) * 100)
      : 0;

  // =============================================================================
  // Render
  // =============================================================================

  if (loading && campaigns.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground">
            Manage outbound calling campaigns
          </p>
        </div>
        <Link href="/campaigns/create">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </Link>
      </div>

      {/* Summary Stats */}
      {campaigns.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Campaigns</p>
                  <p className="text-2xl font-bold">{total}</p>
                </div>
                <Phone className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold text-green-600">
                    {aggregateStats.activeCampaigns}
                  </p>
                </div>
                <Activity className="h-8 w-8 text-green-500/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Calls</p>
                  <p className="text-2xl font-bold">{aggregateStats.totalCalls}</p>
                </div>
                <Phone className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Successful</p>
                  <p className="text-2xl font-bold text-green-600">
                    {aggregateStats.successfulCalls}
                  </p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold">{overallSuccessRate}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filters:</span>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="reminder">Appointment Reminder</SelectItem>
            <SelectItem value="followup">Follow-up</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
        {(statusFilter !== "all" || typeFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter("all");
              setTypeFilter("all");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Campaign List */}
      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No campaigns yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first outbound calling campaign to reach your customers.
              </p>
              <Link href="/campaigns/create">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Campaign
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Link
                        href={`/campaigns/${campaign.id}`}
                        className="text-lg font-semibold hover:text-primary"
                      >
                        {campaign.name}
                      </Link>
                      <Badge className={getStatusColor(campaign.status)}>
                        {campaign.status}
                      </Badge>
                      <Badge variant="outline">{getTypeLabel(campaign.type)}</Badge>
                    </div>
                    {campaign.description && (
                      <p className="text-sm text-muted-foreground mb-4">
                        {campaign.description}
                      </p>
                    )}

                    {/* Progress Bar */}
                    {(campaign.target_contacts ?? 0) > 0 && (
                      <div className="mb-4">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">
                            {Math.round(((campaign.calls_completed ?? 0) / (campaign.target_contacts ?? 1)) * 100)}%
                          </span>
                        </div>
                        <Progress
                          value={((campaign.calls_completed ?? 0) / (campaign.target_contacts ?? 1)) * 100}
                          className="h-2"
                        />
                      </div>
                    )}

                    {/* Stats */}
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{campaign.target_contacts ?? 0} contacts</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span>{campaign.calls_completed ?? 0} calls made</span>
                      </div>
                      {(campaign.calls_completed ?? 0) > 0 && (
                        <>
                          <div className="flex items-center gap-1.5 text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>{campaign.calls_successful ?? 0} successful</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-red-600">
                            <XCircle className="h-4 w-4" />
                            <span>{campaign.calls_failed ?? 0} failed</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground border-l pl-4">
                            <span>
                              {Math.round(((campaign.calls_successful ?? 0) / (campaign.calls_completed ?? 1)) * 100)}% success rate
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Schedule */}
                    {campaign.scheduled_start && (
                      <div className="flex items-center gap-1.5 mt-3 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>
                          Scheduled: {formatDate(campaign.scheduled_start)}
                          {campaign.scheduled_end && ` - ${formatDate(campaign.scheduled_end)}`}
                        </span>
                      </div>
                    )}

                    {/* Created time */}
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Created {formatDistanceToNow(new Date(campaign.created_at))} ago</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {/* Quick actions based on status */}
                    {campaign.status === "draft" && (
                      <Button
                        size="sm"
                        onClick={() => handleAction(campaign.id, "start")}
                        disabled={actionLoading === campaign.id}
                      >
                        {actionLoading === campaign.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-1" />
                            Start
                          </>
                        )}
                      </Button>
                    )}
                    {(campaign.status === "active" || campaign.status === "running") && (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleProcessCalls(campaign.id)}
                          disabled={actionLoading === `process-${campaign.id}`}
                        >
                          {actionLoading === `process-${campaign.id}` ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Zap className="h-4 w-4 mr-1" />
                              Process Calls
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleAction(campaign.id, "pause")}
                          disabled={actionLoading === campaign.id}
                        >
                          {actionLoading === campaign.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Pause className="h-4 w-4 mr-1" />
                              Pause
                            </>
                          )}
                        </Button>
                      </>
                    )}
                    {campaign.status === "paused" && (
                      <Button
                        size="sm"
                        onClick={() => handleAction(campaign.id, "resume")}
                        disabled={actionLoading === campaign.id}
                      >
                        {actionLoading === campaign.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-1" />
                            Resume
                          </>
                        )}
                      </Button>
                    )}

                    {/* More actions dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/campaigns/${campaign.id}`}>
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        {campaign.status !== "active" && campaign.status !== "completed" && (
                          <DropdownMenuItem asChild>
                            <Link href={`/campaigns/${campaign.id}/edit`}>
                              Edit Campaign
                            </Link>
                          </DropdownMenuItem>
                        )}
                        {(campaign.status === "active" || campaign.status === "running" || campaign.status === "paused") && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleAction(campaign.id, "cancel")}
                            >
                              <StopCircle className="h-4 w-4 mr-2" />
                              Cancel Campaign
                            </DropdownMenuItem>
                          </>
                        )}
                        {campaign.status !== "active" && campaign.status !== "running" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(campaign.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Results summary */}
      {total > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          Showing {campaigns.length} of {total} campaign{total !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
