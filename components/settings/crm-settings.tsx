"use client";

/**
 * CRM Settings Component
 * HubSpot and other CRM integrations management
 * PRODUCT_ROADMAP.md Section 2.8
 */

import { useState, useEffect } from "react";
import {
  Loader2,
  ExternalLink,
  Check,
  AlertCircle,
  Unlink,
  RefreshCw,
  Settings2,
  Activity,
  Users,
  Phone as PhoneIcon,
  Calendar,
  TrendingUp,
} from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Label,
  Switch,
  Badge,
  Alert,
  AlertDescription,
} from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

// ============================================
// Types
// ============================================

interface CRMIntegration {
  id: string;
  provider: "hubspot" | "salesforce" | "zoho";
  hub_id: string | null;
  is_active: boolean;
  settings: CRMSettings;
  created_at: string;
  updated_at: string;
}

interface CRMSettings {
  auto_sync_contacts: boolean;
  log_calls: boolean;
  create_deals: boolean;
  deal_pipeline_id?: string | null;
  deal_stage_id?: string | null;
  deal_owner_id?: string | null;
}

interface SyncStats {
  total: number;
  success: number;
  failed: number;
  pending: number;
  successRate: number;
}

interface SyncLog {
  id: string;
  entity_type: string;
  sync_direction: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

// ============================================
// HubSpot Logo Component
// ============================================

function HubSpotLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.984v-.066A2.2 2.2 0 0017.231.834h-.066a2.2 2.2 0 00-2.2 2.2v.066c0 .873.51 1.627 1.249 1.98v2.861a5.399 5.399 0 00-2.566 1.058L6.164 3.055a2.627 2.627 0 00.077-.623 2.628 2.628 0 10-2.628 2.628c.397 0 .773-.09 1.109-.248l7.378 5.903a5.4 5.4 0 00-.816 2.846 5.4 5.4 0 00.85 2.9l-2.284 2.283a2.167 2.167 0 00-.65-.107 2.19 2.19 0 102.19 2.19c0-.227-.038-.446-.099-.653l2.268-2.268a5.4 5.4 0 103.605-9.975zm-.999 7.579a2.546 2.546 0 110-5.092 2.546 2.546 0 010 5.092z"/>
    </svg>
  );
}

// ============================================
// Component
// ============================================

export function CRMSettings() {
  const [loading, setLoading] = useState(true);
  const [integration, setIntegration] = useState<CRMIntegration | null>(null);
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<SyncLog[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Settings dialog state
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState<CRMSettings>({
    auto_sync_contacts: true,
    log_calls: true,
    create_deals: true,
  });

  // Disconnect confirmation
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);

  // ============================================
  // Data Fetching
  // ============================================

  const fetchIntegration = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/dashboard/settings/crm");
      const data = await response.json();

      if (!response.ok) {
        if (response.status !== 404) {
          throw new Error(data.error || "Failed to fetch CRM integration");
        }
        setIntegration(null);
      } else if (data.data) {
        setIntegration(data.data.integration);
        setStats(data.data.stats || null);
        setRecentLogs(data.data.recentLogs || []);
        if (data.data.integration?.settings) {
          setLocalSettings(data.data.integration.settings);
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load CRM settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegration();
  }, []);

  // Check for OAuth callback result
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const crmConnected = urlParams.get("crm_connected");
    const crmError = urlParams.get("crm_error");

    if (crmConnected === "true") {
      toast({
        title: "HubSpot Connected",
        description: "Your HubSpot account has been successfully connected",
        variant: "success",
      });
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
      fetchIntegration();
    } else if (crmError) {
      toast({
        title: "Connection Failed",
        description: decodeURIComponent(crmError),
        variant: "destructive",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // ============================================
  // Actions
  // ============================================

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const response = await fetch("/api/integrations/hubspot/auth");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start OAuth flow");
      }

      // Redirect to HubSpot OAuth
      window.location.href = data.authUrl;
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect to HubSpot",
        variant: "destructive",
      });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const response = await fetch("/api/dashboard/settings/crm", {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to disconnect");
      }

      setIntegration(null);
      setStats(null);
      setRecentLogs([]);
      setDisconnectDialogOpen(false);

      toast({
        title: "Disconnected",
        description: "HubSpot has been disconnected from your account",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to disconnect",
        variant: "destructive",
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!integration) return;

    setSaving(true);
    try {
      const response = await fetch("/api/dashboard/settings/crm", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: localSettings }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save settings");
      }

      setIntegration(data.data);
      setSettingsDialogOpen(false);

      toast({
        title: "Settings Saved",
        description: "Your CRM integration settings have been updated",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!integration) return;

    try {
      const response = await fetch("/api/dashboard/settings/crm", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !integration.is_active }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update status");
      }

      setIntegration(data.data);

      toast({
        title: integration.is_active ? "Integration Paused" : "Integration Activated",
        description: integration.is_active
          ? "Sync operations are now paused"
          : "Sync operations have resumed",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const handleManualSync = async () => {
    if (!integration) return;

    setSyncing(true);
    try {
      const response = await fetch("/api/dashboard/settings/crm/sync", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Sync failed");
      }

      toast({
        title: "Sync Started",
        description: `Syncing ${data.data.contactsQueued} contacts to HubSpot`,
        variant: "success",
      });

      // Refresh stats after a delay
      setTimeout(() => fetchIntegration(), 3000);
    } catch (error) {
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : "Failed to start sync",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  // ============================================
  // Helpers
  // ============================================

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-500">Success</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // ============================================
  // Render
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#ff7a59]/10 rounded-lg">
                <HubSpotLogo className="h-6 w-6 text-[#ff7a59]" />
              </div>
              <div>
                <CardTitle>HubSpot CRM</CardTitle>
                <CardDescription>
                  Sync contacts, log calls, and create deals automatically
                </CardDescription>
              </div>
            </div>
            {integration ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSettingsDialogOpen(true)}
                >
                  <Settings2 className="h-4 w-4 mr-2" />
                  Settings
                </Button>
                <Switch
                  checked={integration.is_active}
                  onCheckedChange={handleToggleActive}
                />
              </div>
            ) : (
              <Button onClick={handleConnect} disabled={connecting}>
                {connecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                Connect HubSpot
              </Button>
            )}
          </div>
        </CardHeader>

        {integration && (
          <CardContent>
            {/* Connection Status */}
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-full">
                  <Check className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <p className="font-medium">Connected to HubSpot</p>
                  <p className="text-sm text-muted-foreground">
                    Portal ID: {integration.hub_id || "Unknown"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualSync}
                  disabled={syncing || !integration.is_active}
                >
                  {syncing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Sync Now
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDisconnectDialogOpen(true)}
                >
                  <Unlink className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
              </div>
            </div>

            {/* Stats Grid */}
            {stats && (
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="p-4 border rounded-lg text-center">
                  <Activity className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Syncs</p>
                </div>
                <div className="p-4 border rounded-lg text-center">
                  <Check className="h-5 w-5 mx-auto mb-2 text-green-500" />
                  <p className="text-2xl font-bold text-green-600">{stats.success}</p>
                  <p className="text-xs text-muted-foreground">Successful</p>
                </div>
                <div className="p-4 border rounded-lg text-center">
                  <AlertCircle className="h-5 w-5 mx-auto mb-2 text-red-500" />
                  <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
                <div className="p-4 border rounded-lg text-center">
                  <TrendingUp className="h-5 w-5 mx-auto mb-2 text-primary" />
                  <p className="text-2xl font-bold">{stats.successRate}%</p>
                  <p className="text-xs text-muted-foreground">Success Rate</p>
                </div>
              </div>
            )}

            {/* Sync Features */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className={`p-4 border rounded-lg ${integration.settings.auto_sync_contacts ? "border-green-500/50 bg-green-50 dark:bg-green-950" : ""}`}>
                <Users className="h-5 w-5 mb-2 text-muted-foreground" />
                <p className="font-medium">Contact Sync</p>
                <p className="text-xs text-muted-foreground">
                  {integration.settings.auto_sync_contacts ? "Enabled" : "Disabled"}
                </p>
              </div>
              <div className={`p-4 border rounded-lg ${integration.settings.log_calls ? "border-green-500/50 bg-green-50 dark:bg-green-950" : ""}`}>
                <PhoneIcon className="h-5 w-5 mb-2 text-muted-foreground" />
                <p className="font-medium">Call Logging</p>
                <p className="text-xs text-muted-foreground">
                  {integration.settings.log_calls ? "Enabled" : "Disabled"}
                </p>
              </div>
              <div className={`p-4 border rounded-lg ${integration.settings.create_deals ? "border-green-500/50 bg-green-50 dark:bg-green-950" : ""}`}>
                <Calendar className="h-5 w-5 mb-2 text-muted-foreground" />
                <p className="font-medium">Deal Creation</p>
                <p className="text-xs text-muted-foreground">
                  {integration.settings.create_deals ? "Enabled" : "Disabled"}
                </p>
              </div>
            </div>

            {/* Recent Sync Log */}
            {recentLogs.length > 0 && (
              <div>
                <h4 className="font-medium mb-3">Recent Activity</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {recentLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {getStatusBadge(log.status)}
                        <div>
                          <p className="text-sm font-medium capitalize">
                            {log.entity_type} {log.sync_direction}
                          </p>
                          {log.error_message && (
                            <p className="text-xs text-red-500">{log.error_message}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(log.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        )}

        {!integration && (
          <CardContent>
            <Alert>
              <HubSpotLogo className="h-4 w-4" />
              <AlertDescription>
                Connect your HubSpot account to automatically sync contacts, log calls to the
                timeline, and create deals when appointments are booked.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="p-4 border rounded-lg">
                <Users className="h-5 w-5 mb-2 text-muted-foreground" />
                <p className="font-medium">Contact Sync</p>
                <p className="text-xs text-muted-foreground">
                  Automatically sync callers as HubSpot contacts
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <PhoneIcon className="h-5 w-5 mb-2 text-muted-foreground" />
                <p className="font-medium">Call Logging</p>
                <p className="text-xs text-muted-foreground">
                  Log calls with transcripts to contact timeline
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <Calendar className="h-5 w-5 mb-2 text-muted-foreground" />
                <p className="font-medium">Deal Creation</p>
                <p className="text-xs text-muted-foreground">
                  Create deals when appointments are booked
                </p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Settings Dialog */}
      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>HubSpot Settings</DialogTitle>
            <DialogDescription>
              Configure what data syncs between Koya and HubSpot
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Contact Sync */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-medium">Auto-sync Contacts</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically create/update HubSpot contacts for callers
                </p>
              </div>
              <Switch
                checked={localSettings.auto_sync_contacts}
                onCheckedChange={(checked) =>
                  setLocalSettings((prev) => ({ ...prev, auto_sync_contacts: checked }))
                }
              />
            </div>

            {/* Call Logging */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-medium">Log Calls to Timeline</Label>
                <p className="text-sm text-muted-foreground">
                  Add call activities with transcripts to contact timeline
                </p>
              </div>
              <Switch
                checked={localSettings.log_calls}
                onCheckedChange={(checked) =>
                  setLocalSettings((prev) => ({ ...prev, log_calls: checked }))
                }
              />
            </div>

            {/* Deal Creation */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-medium">Create Deals on Booking</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically create deals when appointments are booked
                </p>
              </div>
              <Switch
                checked={localSettings.create_deals}
                onCheckedChange={(checked) =>
                  setLocalSettings((prev) => ({ ...prev, create_deals: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSettings} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect Confirmation */}
      <Dialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Disconnect HubSpot
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to disconnect HubSpot? This will stop all sync operations
              but won&apos;t delete any data from HubSpot.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Unlink className="h-4 w-4 mr-2" />
              )}
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
