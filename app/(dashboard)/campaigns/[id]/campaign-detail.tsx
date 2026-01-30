"use client";

/**
 * Campaign Detail Client Component
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  Pause,
  StopCircle,
  Trash2,
  Phone,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Loader2,
  MoreVertical,
  Edit,
} from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Progress,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui";
import { QueueDashboard } from "@/components/campaigns/queue-dashboard";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

// =============================================================================
// Types
// =============================================================================

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "scheduled" | "active" | "paused" | "completed";
  type: "reminder" | "followup" | "custom";
  scheduled_start: string | null;
  scheduled_end: string | null;
  target_contacts: number;
  calls_completed: number;
  calls_successful: number;
  calls_failed: number;
  custom_message: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface CampaignDetailProps {
  campaign: Campaign;
}

// =============================================================================
// Helper Functions
// =============================================================================

const getStatusColor = (status: Campaign["status"]) => {
  const colors = {
    draft: "bg-gray-500/10 text-gray-600",
    scheduled: "bg-blue-500/10 text-blue-600",
    active: "bg-green-500/10 text-green-600",
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

// =============================================================================
// Component
// =============================================================================

export function CampaignDetail({ campaign: initialCampaign }: CampaignDetailProps) {
  const router = useRouter();
  const [campaign, setCampaign] = useState(initialCampaign);
  const [actionLoading, setActionLoading] = useState(false);

  // Calculate progress
  const progressPercent =
    campaign.target_contacts > 0
      ? Math.round((campaign.calls_completed / campaign.target_contacts) * 100)
      : 0;

  const successRate =
    campaign.calls_completed > 0
      ? Math.round((campaign.calls_successful / campaign.calls_completed) * 100)
      : 0;

  // =============================================================================
  // Actions
  // =============================================================================

  const handleAction = async (action: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/dashboard/campaigns/${campaign.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action} campaign`);
      }

      setCampaign(data.data);

      toast({
        title: "Success",
        description: data.message || `Campaign ${action}ed successfully`,
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : `Failed to ${action} campaign`,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this campaign? This cannot be undone.")) {
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/dashboard/campaigns/${campaign.id}`, {
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

      router.push("/campaigns");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete campaign",
        variant: "destructive",
      });
      setActionLoading(false);
    }
  };

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Button variant="ghost" onClick={() => router.push("/campaigns")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Campaigns
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{campaign.name}</h1>
            <Badge className={getStatusColor(campaign.status)}>{campaign.status}</Badge>
            <Badge variant="outline">{getTypeLabel(campaign.type)}</Badge>
          </div>
          {campaign.description && (
            <p className="text-muted-foreground mt-1">{campaign.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Quick actions based on status */}
          {campaign.status === "draft" && (
            <Button onClick={() => handleAction("start")} disabled={actionLoading}>
              {actionLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Start Campaign
            </Button>
          )}
          {campaign.status === "active" && (
            <Button variant="secondary" onClick={() => handleAction("pause")} disabled={actionLoading}>
              {actionLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Pause className="h-4 w-4 mr-2" />
              )}
              Pause
            </Button>
          )}
          {campaign.status === "paused" && (
            <Button onClick={() => handleAction("resume")} disabled={actionLoading}>
              {actionLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Resume
            </Button>
          )}

          {/* More actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {campaign.status !== "active" && campaign.status !== "completed" && (
                <DropdownMenuItem asChild>
                  <Link href={`/campaigns/${campaign.id}/edit`}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Campaign
                  </Link>
                </DropdownMenuItem>
              )}
              {(campaign.status === "active" || campaign.status === "paused") && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => handleAction("cancel")}
                  >
                    <StopCircle className="h-4 w-4 mr-2" />
                    Cancel Campaign
                  </DropdownMenuItem>
                </>
              )}
              {campaign.status !== "active" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={handleDelete}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Campaign
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Target Contacts</p>
                <p className="text-2xl font-bold">{campaign.target_contacts}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Calls Completed</p>
                <p className="text-2xl font-bold">{campaign.calls_completed}</p>
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
                <p className="text-2xl font-bold text-green-600">{campaign.calls_successful}</p>
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
                <p className="text-2xl font-bold text-red-600">{campaign.calls_failed}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Progress</CardTitle>
          <CardDescription>
            {progressPercent}% complete ({campaign.calls_completed} of {campaign.target_contacts} contacts)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Progress</span>
              <span>{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} />
          </div>
          {campaign.calls_completed > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Success Rate</span>
                <span>{successRate}%</span>
              </div>
              <Progress value={successRate} className="bg-red-100 [&>div]:bg-green-500" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Campaign Details */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-muted-foreground">Created</dt>
              <dd className="font-medium">
                {new Date(campaign.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Last Updated</dt>
              <dd className="font-medium">
                {formatDistanceToNow(new Date(campaign.updated_at), { addSuffix: true })}
              </dd>
            </div>
            {campaign.scheduled_start && (
              <div>
                <dt className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Scheduled Start
                </dt>
                <dd className="font-medium">
                  {new Date(campaign.scheduled_start).toLocaleString()}
                </dd>
              </div>
            )}
            {campaign.scheduled_end && (
              <div>
                <dt className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Scheduled End
                </dt>
                <dd className="font-medium">
                  {new Date(campaign.scheduled_end).toLocaleString()}
                </dd>
              </div>
            )}
          </dl>
          {campaign.custom_message && (
            <div className="mt-4 pt-4 border-t">
              <dt className="text-sm text-muted-foreground mb-2">Custom Message</dt>
              <dd className="bg-muted p-3 rounded text-sm">{campaign.custom_message}</dd>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Call Queue - Show for all non-draft campaigns */}
      {campaign.status !== "draft" && (
        <Card>
          <CardHeader>
            <CardTitle>Call Queue</CardTitle>
            <CardDescription>
              {campaign.status === "completed"
                ? "Historical view of calls made during this campaign"
                : "Real-time view of queued calls for this campaign"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QueueDashboard
              campaignId={campaign.id}
              showHeader={false}
              defaultAutoRefresh={campaign.status === "active"}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
