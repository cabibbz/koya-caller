"use client";

/**
 * Privacy Settings Component
 * GDPR/CCPA Compliance - Data Export and Account Deletion
 */

import { useState, useEffect } from "react";
import {
  Download,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle,
  X,
  Clock,
} from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Label,
  Textarea,
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
import type { DataRequest } from "@/types";

interface PrivacySettingsProps {
  businessName: string;
}

export function PrivacySettings({ businessName }: PrivacySettingsProps) {
  const [exportRequests, setExportRequests] = useState<DataRequest[]>([]);
  const [pendingDeletion, setPendingDeletion] = useState<DataRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [feedbackReason, setFeedbackReason] = useState("");
  const [confirmText, setConfirmText] = useState("");

  // Load privacy data
  useEffect(() => {
    const fetchPrivacyData = async () => {
      setLoading(true);
      try {
        // Fetch export requests
        const exportRes = await fetch("/api/privacy/export");
        if (exportRes.ok) {
          const exportData = await exportRes.json();
          setExportRequests(exportData.data || []);
        }

        // Fetch deletion status
        const deletionRes = await fetch("/api/privacy/deletion");
        if (deletionRes.ok) {
          const deletionData = await deletionRes.json();
          setPendingDeletion(deletionData.data?.pendingDeletion || null);
        }
      } catch {
        // Silently fail - privacy data will use defaults
      } finally {
        setLoading(false);
      }
    };

    fetchPrivacyData();
  }, []);

  // Handle data export
  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await fetch("/api/privacy/export", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create export");
      }

      toast({
        title: "Export ready",
        description: "Your data export is ready for download.",
        variant: "success",
      });

      // Download the file immediately
      if (data.data?.downloadUrl) {
        window.location.href = data.data.downloadUrl;
      }

      // Refresh export requests
      const refreshRes = await fetch("/api/privacy/export");
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        setExportRequests(refreshData.data || []);
      }
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  // Handle download of existing export
  const handleDownload = (requestId: string) => {
    window.location.href = `/api/privacy/export/${requestId}/download`;
  };

  // Handle account deletion request
  const handleDeleteAccount = async () => {
    if (confirmText !== "DELETE") {
      toast({
        title: "Confirmation required",
        description: "Please type DELETE to confirm",
        variant: "destructive",
      });
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch("/api/privacy/deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackReason }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to request deletion");
      }

      setPendingDeletion(data.data?.request || null);
      setDeleteDialogOpen(false);
      setFeedbackReason("");
      setConfirmText("");

      toast({
        title: "Deletion scheduled",
        description: "Your account will be deleted in 14 days. You can cancel this anytime.",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Request failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  // Handle cancellation of pending deletion
  const handleCancelDeletion = async () => {
    if (!pendingDeletion) return;

    setCancelling(true);
    try {
      const response = await fetch(`/api/privacy/deletion/${pendingDeletion.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel deletion");
      }

      setPendingDeletion(null);

      toast({
        title: "Deletion cancelled",
        description: "Your account has been restored.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Cancellation failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setCancelling(false);
    }
  };

  // Calculate days until deletion
  const getDaysUntilDeletion = () => {
    if (!pendingDeletion?.grace_period_ends_at) return 0;
    const endDate = new Date(pendingDeletion.grace_period_ends_at);
    const now = new Date();
    const diff = endDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Deletion Warning */}
      {pendingDeletion && (
        <Alert variant="destructive" className="border-red-500 bg-red-50 dark:bg-red-950">
          <AlertTriangle className="h-5 w-5" />
          <AlertDescription className="ml-2">
            <div className="flex flex-col gap-2">
              <p className="font-semibold">
                Account scheduled for deletion in {getDaysUntilDeletion()} days
              </p>
              <p className="text-sm">
                Your account and all associated data will be permanently deleted on{" "}
                <strong>
                  {pendingDeletion.grace_period_ends_at
                    ? formatDate(pendingDeletion.grace_period_ends_at)
                    : "soon"}
                </strong>
                . You can cancel this anytime before then.
              </p>
              <div className="mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelDeletion}
                  disabled={cancelling}
                  className="border-red-500 text-red-600 hover:bg-red-100 dark:hover:bg-red-900"
                >
                  {cancelling ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <X className="h-4 w-4 mr-2" />
                  )}
                  Cancel Deletion
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Data Export Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export My Data
          </CardTitle>
          <CardDescription>
            Download a copy of all your data including business information, calls,
            appointments, contacts, and settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-4">
            <h4 className="font-medium mb-2">What&apos;s included in the export:</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Business profile and settings</li>
              <li>Services and pricing</li>
              <li>FAQs and knowledge base</li>
              <li>Call history and recordings</li>
              <li>Appointments and contacts</li>
              <li>AI configuration and prompts</li>
              <li>Notification preferences</li>
            </ul>
          </div>

          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {exporting ? "Preparing Export..." : "Export My Data"}
          </Button>

          {/* Recent Exports */}
          {exportRequests.length > 0 && (
            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium mb-3">Recent Exports</h4>
              <div className="space-y-2">
                {exportRequests.slice(0, 3).map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      {request.status === "completed" ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <Clock className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="text-sm font-medium">
                          {formatDate(request.created_at)}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {request.status}
                          {request.export_expires_at &&
                            request.status === "completed" && (
                              <>
                                {" "}
                                - Expires {formatDate(request.export_expires_at)}
                              </>
                            )}
                        </p>
                      </div>
                    </div>
                    {request.status === "completed" &&
                      request.export_file_path && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(request.id)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Account Card */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete Account
          </CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data. This action
            cannot be undone after the grace period.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-destructive/10 p-4">
            <h4 className="font-medium text-destructive mb-2">
              What happens when you delete your account:
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Your account will be scheduled for deletion</li>
              <li>You have 14 days to cancel and restore your account</li>
              <li>After 14 days, all data is permanently deleted</li>
              <li>This includes all calls, appointments, and settings</li>
              <li>Your Koya phone number will be released</li>
              <li>Any active subscription will be cancelled</li>
            </ul>
          </div>

          {pendingDeletion ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">
                Deletion already scheduled. Cancel to remove the request.
              </span>
            </div>
          ) : (
            <Button
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete My Account
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete your account for{" "}
              <strong>{businessName}</strong>? This action will schedule your
              account for permanent deletion.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="feedbackReason">
                Why are you leaving? (optional)
              </Label>
              <Textarea
                id="feedbackReason"
                placeholder="Help us improve by sharing your feedback..."
                value={feedbackReason}
                onChange={(e) => setFeedbackReason(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmText">
                Type <strong>DELETE</strong> to confirm
              </Label>
              <input
                id="confirmText"
                type="text"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="DELETE"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setFeedbackReason("");
                setConfirmText("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleting || confirmText !== "DELETE"}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
