"use client";

/**
 * API Keys Settings Component
 * Manage API keys for Zapier and external integrations
 */

import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  Key,
  Copy,
  Check,
  AlertCircle,
  Clock,
  Activity,
  ExternalLink,
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

interface ApiKey {
  id: string;
  business_id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ApiKeyUsageStats {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  requests_by_endpoint: Record<string, number>;
}

const PERMISSION_OPTIONS = [
  { value: "read:calls", label: "Read Calls", description: "View call history and details" },
  { value: "write:appointments", label: "Create Appointments", description: "Create new appointments via API" },
  { value: "read:appointments", label: "Read Appointments", description: "View appointment data" },
  { value: "webhooks:manage", label: "Manage Webhooks", description: "Subscribe to webhook events" },
];

// ============================================
// Component
// ============================================

export function ApiKeysSettings() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Create dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>([
    "read:calls",
    "read:appointments",
  ]);

  // New key reveal state
  const [newKeyRevealed, setNewKeyRevealed] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Details dialog state
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [keyStats, setKeyStats] = useState<ApiKeyUsageStats | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<ApiKey | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ============================================
  // Data Fetching
  // ============================================

  const fetchApiKeys = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/dashboard/settings/api-keys");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch API keys");
      }

      setApiKeys(data.data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load API keys",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchKeyDetails = async (apiKey: ApiKey) => {
    setLoadingDetails(true);
    setSelectedKey(apiKey);
    setDetailsDialogOpen(true);

    try {
      const response = await fetch(`/api/dashboard/settings/api-keys/${apiKey.id}/stats`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch key details");
      }

      setKeyStats(data.data);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load stats",
        variant: "destructive",
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    fetchApiKeys();
  }, []);

  // ============================================
  // Actions
  // ============================================

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for the API key",
        variant: "destructive",
      });
      return;
    }

    if (newKeyPermissions.length === 0) {
      toast({
        title: "Permissions Required",
        description: "Please select at least one permission",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/dashboard/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyName.trim(),
          permissions: newKeyPermissions,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create API key");
      }

      // Show the full key to the user
      setNewKeyRevealed(data.data.fullKey);
      setCreateDialogOpen(false);

      // Reset form
      setNewKeyName("");
      setNewKeyPermissions(["read:calls", "read:appointments"]);

      // Refresh list
      await fetchApiKeys();

      toast({
        title: "API Key Created",
        description: "Save the key below - it won't be shown again!",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create API key",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (apiKey: ApiKey) => {
    try {
      const response = await fetch(`/api/dashboard/settings/api-keys/${apiKey.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !apiKey.is_active }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update API key");
      }

      // Update local state
      setApiKeys(prev =>
        prev.map(k => (k.id === apiKey.id ? { ...k, is_active: !k.is_active } : k))
      );

      toast({
        title: apiKey.is_active ? "API Key Revoked" : "API Key Activated",
        description: apiKey.is_active
          ? "Key can no longer be used for authentication"
          : "Key is now active",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update API key",
        variant: "destructive",
      });
    }
  };

  const handleDeleteKey = async () => {
    if (!keyToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/dashboard/settings/api-keys/${keyToDelete.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete API key");
      }

      // Remove from local state
      setApiKeys(prev => prev.filter(k => k.id !== keyToDelete.id));
      setDeleteDialogOpen(false);
      setKeyToDelete(null);

      toast({
        title: "API Key Deleted",
        description: "The API key has been permanently deleted",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete API key",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const copyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
      toast({
        title: "Copied",
        description: "API key copied to clipboard",
      });
    } catch {
      toast({
        title: "Copy Failed",
        description: "Please copy the key manually",
        variant: "destructive",
      });
    }
  };

  // ============================================
  // Helpers
  // ============================================

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return formatDate(dateStr);
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
                <Key className="h-5 w-5" />
                API Keys
              </CardTitle>
              <CardDescription>
                Create and manage API keys for Zapier and other external integrations
              </CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create API Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Info Banner */}
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              API keys allow external services like Zapier to access your Koya data securely.
              Keep your keys secret and never share them publicly.
              <a
                href="/docs/zapier-integration"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 inline-flex items-center text-primary hover:underline"
              >
                View Integration Guide
                <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </AlertDescription>
          </Alert>

          {/* API Keys List */}
          {apiKeys.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No API keys created</p>
              <p className="text-sm">Create an API key to connect Koya with external services</p>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map(apiKey => (
                <div
                  key={apiKey.id}
                  className="border rounded-lg p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{apiKey.name}</span>
                      {apiKey.is_active ? (
                        <Badge variant="default" className="bg-green-500 shrink-0">Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="shrink-0">Revoked</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <code className="bg-muted px-2 py-0.5 rounded text-xs">
                        {apiKey.key_prefix}...
                      </code>
                      <span className="text-xs">|</span>
                      <Clock className="h-3 w-3" />
                      <span className="text-xs">Last used: {getRelativeTime(apiKey.last_used_at)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {apiKey.permissions.map(perm => (
                        <Badge key={perm} variant="outline" className="text-xs">
                          {perm}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchKeyDetails(apiKey)}
                    >
                      <Activity className="h-4 w-4" />
                    </Button>
                    <Switch
                      checked={apiKey.is_active}
                      onCheckedChange={() => handleToggleActive(apiKey)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        setKeyToDelete(apiKey);
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

      {/* Create API Key Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Create a new API key for external integrations
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">Key Name</Label>
              <Input
                id="key-name"
                placeholder="e.g., Zapier Integration, CRM Sync"
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                A descriptive name to identify this key
              </p>
            </div>

            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="space-y-2 border rounded-lg p-3">
                {PERMISSION_OPTIONS.map(perm => (
                  <div key={perm.value} className="flex items-start gap-3">
                    <Checkbox
                      id={perm.value}
                      checked={newKeyPermissions.includes(perm.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setNewKeyPermissions(prev => [...prev, perm.value]);
                        } else {
                          setNewKeyPermissions(prev => prev.filter(p => p !== perm.value));
                        }
                      }}
                    />
                    <div className="flex-1">
                      <label htmlFor={perm.value} className="text-sm font-medium cursor-pointer">
                        {perm.label}
                      </label>
                      <p className="text-xs text-muted-foreground">{perm.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateKey} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Key Reveal Dialog */}
      <Dialog open={!!newKeyRevealed} onOpenChange={() => setNewKeyRevealed(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              API Key Created Successfully
            </DialogTitle>
            <DialogDescription>
              Copy this key now - it won&apos;t be shown again!
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                Store this API key securely. You will not be able to see it again.
              </AlertDescription>
            </Alert>

            <div className="mt-4 p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-between gap-2">
                <code className="text-sm font-mono break-all">{newKeyRevealed}</code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => newKeyRevealed && copyKey(newKeyRevealed)}
                >
                  {copiedKey ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="mt-4 text-sm text-muted-foreground">
              <p className="font-medium mb-2">Usage:</p>
              <code className="block p-2 bg-muted rounded text-xs">
                Authorization: Bearer {newKeyRevealed?.substring(0, 20)}...
              </code>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setNewKeyRevealed(null)}>
              I&apos;ve Saved the Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Key Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>API Key Usage</DialogTitle>
            <DialogDescription>
              {selectedKey?.name} - Last 7 days
            </DialogDescription>
          </DialogHeader>

          {loadingDetails ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : keyStats ? (
            <div className="space-y-6 py-4">
              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{keyStats.total_requests}</p>
                  <p className="text-xs text-muted-foreground">Total Requests</p>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{keyStats.successful_requests}</p>
                  <p className="text-xs text-muted-foreground">Successful</p>
                </div>
                <div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{keyStats.failed_requests}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
              </div>

              {/* Requests by Endpoint */}
              {Object.keys(keyStats.requests_by_endpoint).length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Requests by Endpoint</h4>
                  <div className="space-y-2">
                    {Object.entries(keyStats.requests_by_endpoint).map(([endpoint, count]) => (
                      <div
                        key={endpoint}
                        className="flex items-center justify-between text-sm"
                      >
                        <code className="text-xs bg-muted px-2 py-1 rounded">{endpoint}</code>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Info */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Key Information</h4>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Created: {formatDate(selectedKey?.created_at || null)}</p>
                  <p>Last used: {formatDate(selectedKey?.last_used_at || null)}</p>
                  <p>Status: {selectedKey?.is_active ? "Active" : "Revoked"}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No usage data available</p>
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
              Delete API Key
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this API key? This action cannot be undone
              and any integrations using this key will stop working.
            </DialogDescription>
          </DialogHeader>

          {keyToDelete && (
            <div className="py-4">
              <p className="font-medium">{keyToDelete.name}</p>
              <code className="text-sm text-muted-foreground">{keyToDelete.key_prefix}...</code>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteKey}
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
