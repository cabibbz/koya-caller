"use client";

/**
 * Webhooks Settings Component
 * Manage webhook configurations for external integrations
 */

import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  Globe,
  Copy,
  Check,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  Eye,
} from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Input,
  Label,
  Switch,
  Badge,
  Alert,
  AlertDescription,
  Checkbox,
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

interface Webhook {
  id: string;
  business_id: string;
  url: string;
  events: string[];
  secret: string;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  response_code: number | null;
  response_body: string | null;
  attempts: number;
  max_attempts: number;
  last_attempt_at: string;
  next_retry_at: string | null;
  status: "pending" | "success" | "failed" | "retrying";
  error_message: string | null;
  created_at: string;
}

interface WebhookStats {
  total: number;
  success: number;
  failed: number;
  pending: number;
  successRate: number;
}

const EVENT_TYPES = [
  { value: "call.started", label: "Call Started", description: "When a call begins" },
  { value: "call.ended", label: "Call Ended", description: "When a call ends with outcome data" },
  { value: "appointment.created", label: "Appointment Created", description: "When a new appointment is booked" },
  { value: "appointment.updated", label: "Appointment Updated", description: "When an appointment is modified" },
  { value: "appointment.cancelled", label: "Appointment Cancelled", description: "When an appointment is cancelled" },
];

// ============================================
// Component
// ============================================

export function WebhooksSettings() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Create dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>([]);
  const [newWebhookDescription, setNewWebhookDescription] = useState("");

  // Details dialog state
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [stats, setStats] = useState<WebhookStats | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Secret reveal state
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [webhookToDelete, setWebhookToDelete] = useState<Webhook | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Retry state
  const [retryingDeliveryId, setRetryingDeliveryId] = useState<string | null>(null);

  // ============================================
  // Data Fetching
  // ============================================

  const fetchWebhooks = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/dashboard/settings/webhooks");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch webhooks");
      }

      setWebhooks(data.data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load webhooks",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchWebhookDetails = async (webhook: Webhook) => {
    setLoadingDetails(true);
    setSelectedWebhook(webhook);
    setDetailsDialogOpen(true);

    try {
      const response = await fetch(`/api/dashboard/settings/webhooks/${webhook.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch webhook details");
      }

      setDeliveries(data.data.deliveries || []);
      setStats(data.data.stats || null);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load details",
        variant: "destructive",
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    fetchWebhooks();
  }, []);

  // ============================================
  // Actions
  // ============================================

  const handleCreateWebhook = async () => {
    if (!newWebhookUrl) {
      toast({
        title: "URL Required",
        description: "Please enter a webhook URL",
        variant: "destructive",
      });
      return;
    }

    if (newWebhookEvents.length === 0) {
      toast({
        title: "Events Required",
        description: "Please select at least one event type",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/dashboard/settings/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: newWebhookUrl,
          events: newWebhookEvents,
          description: newWebhookDescription || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create webhook");
      }

      // Show the secret to the user
      setNewSecret(data.data.secret);
      setCreateDialogOpen(false);

      // Reset form
      setNewWebhookUrl("");
      setNewWebhookEvents([]);
      setNewWebhookDescription("");

      // Refresh list
      await fetchWebhooks();

      toast({
        title: "Webhook Created",
        description: "Save the secret below - it won't be shown again!",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create webhook",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (webhook: Webhook) => {
    try {
      const response = await fetch(`/api/dashboard/settings/webhooks/${webhook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !webhook.is_active }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update webhook");
      }

      // Update local state
      setWebhooks(prev =>
        prev.map(w => (w.id === webhook.id ? { ...w, is_active: !w.is_active } : w))
      );

      toast({
        title: webhook.is_active ? "Webhook Disabled" : "Webhook Enabled",
        description: webhook.is_active
          ? "Webhook will no longer receive events"
          : "Webhook will now receive events",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update webhook",
        variant: "destructive",
      });
    }
  };

  const handleDeleteWebhook = async () => {
    if (!webhookToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/dashboard/settings/webhooks/${webhookToDelete.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete webhook");
      }

      // Remove from local state
      setWebhooks(prev => prev.filter(w => w.id !== webhookToDelete.id));
      setDeleteDialogOpen(false);
      setWebhookToDelete(null);

      toast({
        title: "Webhook Deleted",
        description: "The webhook has been removed",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete webhook",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleRetryDelivery = async (deliveryId: string) => {
    if (!selectedWebhook) return;

    setRetryingDeliveryId(deliveryId);
    try {
      const response = await fetch(
        `/api/dashboard/settings/webhooks/${selectedWebhook.id}/deliveries/${deliveryId}/retry`,
        { method: "POST" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to retry delivery");
      }

      toast({
        title: "Retry Initiated",
        description: data.success
          ? "Webhook delivered successfully"
          : "Retry scheduled",
        variant: data.success ? "success" : "default",
      });

      // Refresh details to show updated status
      await fetchWebhookDetails(selectedWebhook);
    } catch (error) {
      toast({
        title: "Retry Failed",
        description: error instanceof Error ? error.message : "Failed to retry delivery",
        variant: "destructive",
      });
    } finally {
      setRetryingDeliveryId(null);
    }
  };

  const copySecret = async (secret: string) => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
      toast({
        title: "Copied",
        description: "Secret copied to clipboard",
      });
    } catch {
      toast({
        title: "Copy Failed",
        description: "Please copy the secret manually",
        variant: "destructive",
      });
    }
  };

  // ============================================
  // Helpers
  // ============================================

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: WebhookDelivery["status"]) => {
    switch (status) {
      case "success":
        return <Badge variant="default" className="bg-green-500">Success</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "retrying":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Retrying</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const getStatusIcon = (status: WebhookDelivery["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "retrying":
        return <RefreshCw className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
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
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Webhooks
              </CardTitle>
              <CardDescription>
                Send real-time notifications to your applications when events occur
              </CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Webhook
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Info Banner */}
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Webhooks send HTTP POST requests to your URL when events occur.
              Each request includes an HMAC signature for verification.
            </AlertDescription>
          </Alert>

          {/* Webhooks List */}
          {webhooks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No webhooks configured</p>
              <p className="text-sm">Create a webhook to start receiving event notifications</p>
            </div>
          ) : (
            <div className="space-y-4">
              {webhooks.map(webhook => (
                <div
                  key={webhook.id}
                  className="border rounded-lg p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm truncate">{webhook.url}</span>
                      {webhook.is_active ? (
                        <Badge variant="default" className="bg-green-500 shrink-0">Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="shrink-0">Inactive</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {webhook.events.map(event => (
                        <Badge key={event} variant="outline" className="text-xs">
                          {event}
                        </Badge>
                      ))}
                    </div>
                    {webhook.description && (
                      <p className="text-sm text-muted-foreground mt-2">{webhook.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchWebhookDetails(webhook)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Switch
                      checked={webhook.is_active}
                      onCheckedChange={() => handleToggleActive(webhook)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        setWebhookToDelete(webhook);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Webhook Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Webhook</DialogTitle>
            <DialogDescription>
              Configure a new webhook to receive event notifications
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-url">Endpoint URL</Label>
              <Input
                id="webhook-url"
                type="url"
                placeholder="https://your-app.com/webhooks/koya"
                value={newWebhookUrl}
                onChange={e => setNewWebhookUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Must be HTTPS in production environments
              </p>
            </div>

            <div className="space-y-2">
              <Label>Events to Send</Label>
              <div className="space-y-2 border rounded-lg p-3">
                {EVENT_TYPES.map(event => (
                  <div key={event.value} className="flex items-start gap-3">
                    <Checkbox
                      id={event.value}
                      checked={newWebhookEvents.includes(event.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setNewWebhookEvents(prev => [...prev, event.value]);
                        } else {
                          setNewWebhookEvents(prev => prev.filter(e => e !== event.value));
                        }
                      }}
                    />
                    <div className="flex-1">
                      <label htmlFor={event.value} className="text-sm font-medium cursor-pointer">
                        {event.label}
                      </label>
                      <p className="text-xs text-muted-foreground">{event.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook-description">Description (optional)</Label>
              <Input
                id="webhook-description"
                placeholder="e.g., CRM integration, Zapier, etc."
                value={newWebhookDescription}
                onChange={e => setNewWebhookDescription(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateWebhook} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Secret Dialog */}
      <Dialog open={!!newSecret} onOpenChange={() => setNewSecret(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Webhook Created Successfully
            </DialogTitle>
            <DialogDescription>
              Save this secret now - it won&apos;t be shown again!
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                Use this secret to verify webhook signatures. Store it securely.
              </AlertDescription>
            </Alert>

            <div className="mt-4 p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-between gap-2">
                <code className="text-sm font-mono break-all">{newSecret}</code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => newSecret && copySecret(newSecret)}
                >
                  {copiedSecret ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="mt-4 text-sm text-muted-foreground">
              <p className="font-medium mb-2">Signature Verification:</p>
              <code className="block p-2 bg-muted rounded text-xs">
                signature = HMAC-SHA256(secret, timestamp + &quot;.&quot; + payload)
              </code>
              <p className="mt-2">
                Compare the <code>X-Koya-Signature</code> header with your computed signature.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setNewSecret(null)}>
              I&apos;ve Saved the Secret
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Webhook Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Webhook Details</DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {selectedWebhook?.url}
            </DialogDescription>
          </DialogHeader>

          {loadingDetails ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6 py-4">
              {/* Stats */}
              {stats && (
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{stats.success}</p>
                    <p className="text-xs text-muted-foreground">Succeeded</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{stats.successRate}%</p>
                    <p className="text-xs text-muted-foreground">Success Rate</p>
                  </div>
                </div>
              )}

              {/* Recent Deliveries */}
              <div>
                <h4 className="font-medium mb-3">Recent Deliveries</h4>
                {deliveries.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No deliveries yet
                  </p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {deliveries.map(delivery => (
                      <div
                        key={delivery.id}
                        className="border rounded-lg p-3 flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3">
                          {getStatusIcon(delivery.status)}
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {delivery.event_type}
                              </Badge>
                              {getStatusBadge(delivery.status)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDate(delivery.created_at)}
                              {delivery.response_code && (
                                <span className="ml-2">HTTP {delivery.response_code}</span>
                              )}
                            </p>
                            {delivery.error_message && (
                              <p className="text-xs text-red-500 mt-1">{delivery.error_message}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            Attempt {delivery.attempts}/{delivery.max_attempts}
                          </span>
                          {(delivery.status === "failed" || delivery.status === "retrying") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => handleRetryDelivery(delivery.id)}
                              disabled={retryingDeliveryId === delivery.id}
                            >
                              {retryingDeliveryId === delivery.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3 w-3" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Delete Webhook
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this webhook? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {webhookToDelete && (
            <div className="py-4">
              <p className="font-mono text-sm truncate">{webhookToDelete.url}</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteWebhook}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
