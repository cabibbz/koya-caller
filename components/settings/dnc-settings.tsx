"use client";

/**
 * DNC Settings Component
 * Do-Not-Call List Management
 * Phase 3: Compliance and Outbound Calling
 */

import { useState, useEffect } from "react";
import {
  PhoneOff,
  Plus,
  Trash2,
  Loader2,
  Search,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
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
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Textarea,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Badge,
} from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "@/hooks/use-toast";

// ============================================
// Types
// ============================================

type DNCReason = "customer_request" | "complaint" | "legal" | "bounced" | "other";

interface DNCEntry {
  id: string;
  phone_number: string;
  reason: DNCReason;
  notes: string | null;
  added_by: string | null;
  added_by_name: string | null;
  expires_at: string | null;
  created_at: string;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const DNC_REASONS: { value: DNCReason; label: string }[] = [
  { value: "customer_request", label: "Customer Request" },
  { value: "complaint", label: "Complaint" },
  { value: "legal", label: "Legal Requirement" },
  { value: "bounced", label: "Number Bounced" },
  { value: "other", label: "Other" },
];

const getReasonBadgeVariant = (reason: DNCReason) => {
  switch (reason) {
    case "customer_request":
      return "default";
    case "complaint":
      return "destructive";
    case "legal":
      return "destructive";
    case "bounced":
      return "secondary";
    default:
      return "outline";
  }
};

// ============================================
// Component
// ============================================

export function DNCSettings() {
  const [entries, setEntries] = useState<DNCEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  });

  // Add dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newEntry, setNewEntry] = useState({
    phone_number: "",
    reason: "customer_request" as DNCReason,
    notes: "",
    expires_at: "",
  });
  const [adding, setAdding] = useState(false);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<DNCEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ============================================
  // Data Fetching
  // ============================================

  const fetchEntries = async (page = 1, search = "") => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "10",
      });
      if (search) {
        params.append("search", search);
      }

      const response = await fetch(`/api/dashboard/settings/dnc?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch DNC list");
      }

      setEntries(data.data?.entries || []);
      setPagination(data.data?.pagination || {
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 0,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load DNC list",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries(1, searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Initial fetch only, searchQuery changes handled by debounced effect below
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEntries(1, searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ============================================
  // Actions
  // ============================================

  const handleAddEntry = async () => {
    if (!newEntry.phone_number) {
      toast({
        title: "Phone Required",
        description: "Please enter a phone number",
        variant: "destructive",
      });
      return;
    }

    // Basic phone validation
    const phoneRegex = /^\+?[1-9]\d{9,14}$/;
    const cleanPhone = newEntry.phone_number.replace(/[\s\-()]/g, "");
    if (!phoneRegex.test(cleanPhone)) {
      toast({
        title: "Invalid Phone",
        description: "Please enter a valid phone number",
        variant: "destructive",
      });
      return;
    }

    setAdding(true);
    try {
      const response = await fetch("/api/dashboard/settings/dnc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: cleanPhone.startsWith("+") ? cleanPhone : `+${cleanPhone}`,
          reason: newEntry.reason,
          notes: newEntry.notes || null,
          expires_at: newEntry.expires_at || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to add number");
      }

      // Reset form and close dialog
      setNewEntry({
        phone_number: "",
        reason: "customer_request",
        notes: "",
        expires_at: "",
      });
      setAddDialogOpen(false);

      // Refresh list
      await fetchEntries(pagination.page, searchQuery);

      toast({
        title: "Number Added",
        description: "The phone number has been added to the DNC list",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add number",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteEntry = async () => {
    if (!entryToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/dashboard/settings/dnc/${entryToDelete.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to remove number");
      }

      setDeleteDialogOpen(false);
      setEntryToDelete(null);

      // Refresh list
      await fetchEntries(pagination.page, searchQuery);

      toast({
        title: "Number Removed",
        description: "The phone number has been removed from the DNC list",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove number",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    fetchEntries(newPage, searchQuery);
  };

  // ============================================
  // Helper Functions
  // ============================================

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatPhone = (phone: string) => {
    // Format as (XXX) XXX-XXXX for US numbers
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const getReasonLabel = (reason: DNCReason) => {
    return DNC_REASONS.find((r) => r.value === reason)?.label || reason;
  };

  // ============================================
  // Render
  // ============================================

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <PhoneOff className="h-5 w-5" />
                Do-Not-Call List
              </CardTitle>
              <CardDescription>
                Manage phone numbers that should not receive outbound calls
              </CardDescription>
            </div>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Number
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by phone number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <PhoneOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No numbers in the DNC list</p>
              <p className="text-sm">
                {searchQuery
                  ? "No results match your search"
                  : "Add phone numbers to prevent outbound calls"}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Phone Number</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Added Date</TableHead>
                    <TableHead>Added By</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono">
                        {formatPhone(entry.phone_number)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getReasonBadgeVariant(entry.reason)}>
                          {getReasonLabel(entry.reason)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(entry.created_at)}</TableCell>
                      <TableCell>
                        {entry.added_by_name || "System"}
                      </TableCell>
                      <TableCell>
                        {entry.expires_at ? (
                          <span className="text-muted-foreground">
                            {formatDate(entry.expires_at)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setEntryToDelete(entry);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {(pagination.page - 1) * pagination.pageSize + 1} to{" "}
                    {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{" "}
                    {pagination.total} entries
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Add Number Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to DNC List</DialogTitle>
            <DialogDescription>
              Add a phone number to prevent outbound calls to this number
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dnc-phone">Phone Number</Label>
              <Input
                id="dnc-phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={newEntry.phone_number}
                onChange={(e) =>
                  setNewEntry((prev) => ({ ...prev, phone_number: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Enter the phone number with country code
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dnc-reason">Reason</Label>
              <Select
                value={newEntry.reason}
                onValueChange={(value: DNCReason) =>
                  setNewEntry((prev) => ({ ...prev, reason: value }))
                }
              >
                <SelectTrigger id="dnc-reason">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  {DNC_REASONS.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dnc-notes">Notes (optional)</Label>
              <Textarea
                id="dnc-notes"
                placeholder="Additional details about why this number was added..."
                value={newEntry.notes}
                onChange={(e) =>
                  setNewEntry((prev) => ({ ...prev, notes: e.target.value }))
                }
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dnc-expires">Expiry Date (optional)</Label>
              <DatePicker
                id="dnc-expires"
                value={newEntry.expires_at}
                onChange={(e) =>
                  setNewEntry((prev) => ({ ...prev, expires_at: e.target.value }))
                }
                min={new Date().toISOString().split("T")[0]}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank for permanent DNC status
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddEntry} disabled={adding}>
              {adding ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add Number
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
              Remove from DNC List
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this number from the Do-Not-Call list?
              This number may receive outbound calls again.
            </DialogDescription>
          </DialogHeader>

          {entryToDelete && (
            <div className="py-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-mono text-lg">
                  {formatPhone(entryToDelete.phone_number)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Reason: {getReasonLabel(entryToDelete.reason)}
                </p>
                {entryToDelete.notes && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Notes: {entryToDelete.notes}
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteEntry}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
