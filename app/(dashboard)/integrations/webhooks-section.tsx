"use client";

/**
 * Webhooks Section Component
 * Manages webhook configurations for post-event notifications
 * Works alongside direct integrations (Shopify, Square, etc.)
 */

import { useState, useEffect } from "react";
import {
  Webhook,
  Plus,
  Trash2,
  Send,
  Check,
  Loader2,
  Copy,
  Eye,
  EyeOff,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";

// =============================================================================
// Types
// =============================================================================

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret?: string;
  is_active: boolean;
  created_at: string;
}

// Available webhook events
const WEBHOOK_EVENTS = [
  {
    id: "call.completed",
    label: "Call Completed",
    description: "When a call ends",
  },
  {
    id: "appointment.booked",
    label: "Appointment Booked",
    description: "When an appointment is scheduled",
  },
  {
    id: "appointment.cancelled",
    label: "Appointment Cancelled",
    description: "When an appointment is cancelled",
  },
  {
    id: "message.taken",
    label: "Message Taken",
    description: "When a voicemail/message is recorded",
  },
  {
    id: "lead.captured",
    label: "Lead Captured",
    description: "When a new lead is collected",
  },
  {
    id: "payment.collected",
    label: "Payment Collected",
    description: "When a payment is processed",
  },
];

// =============================================================================
// Component
// =============================================================================

export function WebhooksSection() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSecretModal, setShowSecretModal] = useState<string | null>(null);
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);
  const [deletingWebhook, setDeletingWebhook] = useState<string | null>(null);

  // Form state
  const [newWebhook, setNewWebhook] = useState({
    name: "",
    url: "",
    events: [] as string[],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  // Fetch webhooks on mount
  useEffect(() => {
    fetchWebhooks();
  }, []);

  const fetchWebhooks = async () => {
    try {
      const response = await fetch("/api/webhooks");
      if (response.ok) {
        const data = await response.json();
        setWebhooks(data.webhooks || []);
      }
    } catch {
      // Silently fail - webhooks list will remain empty
    } finally {
      setLoading(false);
    }
  };

  const handleAddWebhook = async () => {
    if (!newWebhook.name.trim()) {
      toast({ title: "Please enter a webhook name", variant: "destructive" });
      return;
    }
    if (!newWebhook.url.trim()) {
      toast({ title: "Please enter a webhook URL", variant: "destructive" });
      return;
    }
    if (newWebhook.events.length === 0) {
      toast({ title: "Please select at least one event", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newWebhook),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create webhook");
      }

      // Show the secret to the user
      setWebhookSecret(data.webhook.secret);
      setShowSecretModal(data.webhook.id);

      // Add to list (without secret for security)
      setWebhooks((prev) => [
        { ...data.webhook, secret: undefined },
        ...prev,
      ]);

      // Reset form
      setNewWebhook({ name: "", url: "", events: [] });
      setShowAddModal(false);

      toast({ title: "Webhook created!", variant: "success" });
    } catch (error) {
      toast({
        title: "Failed to create webhook",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestWebhook = async (webhookId: string) => {
    setTestingWebhook(webhookId);
    try {
      const response = await fetch(`/api/webhooks/${webhookId}/test`, {
        method: "POST",
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Test webhook sent!",
          description: `Status: ${data.status_code}`,
          variant: "success",
        });
      } else {
        toast({
          title: "Webhook test failed",
          description: data.error || `Status: ${data.status_code}`,
          variant: "destructive",
        });
      }
    } catch (_error) {
      toast({ title: "Failed to send test webhook", variant: "destructive" });
    } finally {
      setTestingWebhook(null);
    }
  };

  const handleToggleWebhook = async (webhookId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/webhooks/${webhookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: isActive }),
      });

      if (!response.ok) {
        throw new Error("Failed to update webhook");
      }

      setWebhooks((prev) =>
        prev.map((w) =>
          w.id === webhookId ? { ...w, is_active: isActive } : w
        )
      );

      toast({
        title: isActive ? "Webhook enabled" : "Webhook disabled",
        variant: "success",
      });
    } catch (_error) {
      toast({ title: "Failed to update webhook", variant: "destructive" });
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    try {
      const response = await fetch(`/api/webhooks/${webhookId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete webhook");
      }

      setWebhooks((prev) => prev.filter((w) => w.id !== webhookId));
      setDeletingWebhook(null);
      toast({ title: "Webhook deleted", variant: "success" });
    } catch (_error) {
      toast({ title: "Failed to delete webhook", variant: "destructive" });
    }
  };

  const toggleEvent = (eventId: string) => {
    setNewWebhook((prev) => ({
      ...prev,
      events: prev.events.includes(eventId)
        ? prev.events.filter((e) => e !== eventId)
        : [...prev.events, eventId],
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhooks
          </h2>
          <p className="text-sm text-muted-foreground">
            Send event data to Zapier, Make, or any URL when things happen
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Webhook
        </Button>
      </div>

      {/* Info banner */}
      <Card className="border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950">
        <CardContent className="flex items-start gap-3 pt-4">
          <Zap className="mt-0.5 h-5 w-5 flex-shrink-0 text-purple-600 dark:text-purple-400" />
          <div className="text-sm text-purple-800 dark:text-purple-200">
            <p className="font-medium">Connect to 5,000+ apps</p>
            <p className="mt-1 text-purple-700 dark:text-purple-300">
              Webhooks send data after events occur. Use with{" "}
              <a
                href="https://zapier.com/apps/webhook/integrations"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Zapier
              </a>
              ,{" "}
              <a
                href="https://www.make.com/en/integrations/webhooks"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Make
              </a>
              , or any custom endpoint to automate workflows.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Webhooks list */}
      {webhooks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Webhook className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium">No webhooks configured</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Add a webhook to send event data to external services
            </p>
            <Button onClick={() => setShowAddModal(true)} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Webhook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {webhooks.map((webhook) => (
            <Card key={webhook.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <Switch
                    checked={webhook.is_active}
                    onCheckedChange={(checked) =>
                      handleToggleWebhook(webhook.id, checked)
                    }
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{webhook.name}</span>
                      {!webhook.is_active && (
                        <Badge variant="secondary" className="text-xs">
                          Disabled
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                      {webhook.url}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {webhook.events.map((event) => (
                        <Badge
                          key={event}
                          variant="outline"
                          className="text-xs"
                        >
                          {event}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestWebhook(webhook.id)}
                    disabled={testingWebhook === webhook.id}
                  >
                    {testingWebhook === webhook.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeletingWebhook(webhook.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Webhook Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Webhook</DialogTitle>
            <DialogDescription>
              Configure a webhook to receive event notifications
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-name">Name</Label>
              <Input
                id="webhook-name"
                placeholder="e.g., Zapier - New Leads"
                value={newWebhook.name}
                onChange={(e) =>
                  setNewWebhook((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook-url">Webhook URL</Label>
              <Input
                id="webhook-url"
                placeholder="https://hooks.zapier.com/..."
                value={newWebhook.url}
                onChange={(e) =>
                  setNewWebhook((prev) => ({ ...prev, url: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Get this URL from Zapier, Make, or your webhook service
              </p>
            </div>

            <div className="space-y-2">
              <Label>Events to Send</Label>
              <div className="grid grid-cols-2 gap-2">
                {WEBHOOK_EVENTS.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start space-x-2 rounded-md border p-3 cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleEvent(event.id)}
                  >
                    <Checkbox
                      checked={newWebhook.events.includes(event.id)}
                      onCheckedChange={() => toggleEvent(event.id)}
                    />
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {event.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {event.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddWebhook} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Webhook"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Secret Modal */}
      <Dialog
        open={!!showSecretModal}
        onOpenChange={() => {
          setShowSecretModal(null);
          setWebhookSecret(null);
          setShowSecret(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              Webhook Created
            </DialogTitle>
            <DialogDescription>
              Save your signing secret - you won&apos;t be able to see it again
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Signing Secret</Label>
              <div className="flex items-center gap-2">
                <Input
                  type={showSecret ? "text" : "password"}
                  value={webhookSecret || ""}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(webhookSecret || "")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use this secret to verify webhook signatures. Each request
                includes an <code>X-Koya-Signature</code> header.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setShowSecretModal(null);
                setWebhookSecret(null);
                setShowSecret(false);
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={!!deletingWebhook}
        onOpenChange={() => setDeletingWebhook(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Webhook?</DialogTitle>
            <DialogDescription>
              This webhook will stop receiving events. This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingWebhook(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingWebhook && handleDeleteWebhook(deletingWebhook)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
