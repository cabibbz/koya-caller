"use client";

/**
 * Contacts List Client Component
 * Customer/Contact Management feature
 * PRODUCT_ROADMAP.md Section 2.3
 *
 * Features:
 * - List view with name, phone, email, calls, last contact, VIP badge
 * - Search by name, phone, email
 * - Filter by VIP status and tier
 * - Pagination
 * - Click row to open detail dialog
 * - Export to CSV
 */

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Search,
  Filter,
  Phone,
  Mail,
  Star,
  ChevronLeft,
  ChevronRight,
  X,
  Users,
  UserPlus,
  Crown,
  RefreshCw,
  Download,
  Loader2,
} from "lucide-react";
import type { ContactWithStats } from "@/lib/db/contacts";
import { EmptyStateContacts } from "@/components/ui/empty-state";
import { ContactDetailDialog } from "@/components/contacts/contact-detail-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface ContactsClientProps {
  initialContacts: ContactWithStats[];
  total: number;
  page: number;
  limit: number;
  filters: {
    search?: string;
    vipOnly?: boolean;
    tier?: string;
  };
  stats: {
    total: number;
    vipCount: number;
    newThisMonth: number;
    returningCount: number;
  };
  selectedContactId?: string;
}

function formatPhoneNumber(phone: string | null): string {
  if (!phone) return "Unknown";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    const match = cleaned.slice(1).match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  if (cleaned.length === 10) {
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phone;
}

export function ContactsClient({
  initialContacts,
  total,
  page,
  limit,
  filters,
  stats,
  selectedContactId,
}: ContactsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const t = useTranslations("contacts");
  const tCommon = useTranslations("common");

  const [contacts, setContacts] = useState(initialContacts);
  const [searchQuery, setSearchQuery] = useState(filters.search || "");
  const [selectedContact, setSelectedContact] = useState<ContactWithStats | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Create contact dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newContactNotes, setNewContactNotes] = useState("");
  const [newContactVip, setNewContactVip] = useState(false);

  const totalPages = Math.ceil(total / limit);

  // Load selected contact details if ID is in URL
  useEffect(() => {
    if (selectedContactId) {
      const contact = contacts.find((c) => c.id === selectedContactId);
      if (contact) {
        setSelectedContact(contact);
      }
    }
  }, [selectedContactId, contacts]);

  const updateFilters = useCallback(
    (key: string, value: string | boolean | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value !== undefined && value !== "" && value !== false) {
        params.set(key, String(value));
      } else {
        params.delete(key);
      }
      params.delete("page"); // Reset to page 1 on filter change
      router.push(`/contacts?${params.toString()}`);
    },
    [router, searchParams]
  );

  const handleSearch = useCallback(() => {
    updateFilters("search", searchQuery || undefined);
  }, [searchQuery, updateFilters]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", newPage.toString());
      router.push(`/contacts?${params.toString()}`);
    },
    [router, searchParams]
  );

  const handleContactClick = (contact: ContactWithStats) => {
    setSelectedContact(contact);
    const params = new URLSearchParams(searchParams.toString());
    params.set("id", contact.id);
    router.push(`/contacts?${params.toString()}`);
  };

  const closeDetails = () => {
    setSelectedContact(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("id");
    router.push(`/contacts?${params.toString()}`);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("format", "csv");
      if (filters.vipOnly) params.set("vipOnly", "true");
      if (filters.tier) params.set("tier", filters.tier);

      const response = await fetch(`/api/dashboard/contacts/export?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Export failed");
      }

      // Get filename from header
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "contacts.csv";
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
        if (match) filename = match[1];
      }

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: t("exportSuccess"),
        variant: "success",
      });
    } catch {
      toast({
        title: t("exportFailed"),
        description: tCommon("tryAgain") || "Please try again",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleCreateContact = async () => {
    if (!newContactPhone.trim()) {
      toast({
        title: t("phoneRequired") || "Phone number required",
        description: t("phoneRequiredDesc") || "Please enter a phone number for this contact",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/dashboard/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newContactName.trim() || null,
          phone_number: newContactPhone.trim(),
          email: newContactEmail.trim() || null,
          notes: newContactNotes.trim() || null,
          vip_status: newContactVip,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create contact");
      }

      // Add to local state
      const newContact: ContactWithStats = {
        ...data.data,
        total_calls: 0,
      };
      setContacts((prev) => [newContact, ...prev]);

      // Close dialog and reset form
      setCreateDialogOpen(false);
      setNewContactName("");
      setNewContactPhone("");
      setNewContactEmail("");
      setNewContactNotes("");
      setNewContactVip(false);

      toast({
        title: t("contactCreated") || "Contact created",
        description: t("contactCreatedDesc") || "New contact has been added",
        variant: "success",
      });

      // Refresh page to get updated stats
      router.refresh();
    } catch (error) {
      toast({
        title: t("createFailed") || "Failed to create contact",
        description: error instanceof Error ? error.message : tCommon("tryAgain"),
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleContactUpdate = () => {
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">
            {total} {total === 1 ? t("contact") : t("contactsPlural")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="gap-2"
            onClick={() => setCreateDialogOpen(true)}
          >
            <UserPlus className="h-4 w-4" />
            {t("addContact") || "Add Contact"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {t("export")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
            {tCommon("filter")}
            {(filters.vipOnly || filters.tier || filters.search) && (
              <Badge variant="secondary" className="ml-1">
                {t("active")}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">{t("totalContacts")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-500/10 p-2.5">
                <Crown className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.vipCount}</p>
                <p className="text-xs text-muted-foreground">{t("vipContacts")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-2.5">
                <UserPlus className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.newThisMonth}</p>
                <p className="text-xs text-muted-foreground">{t("newThisMonth")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2.5">
                <RefreshCw className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.returningCount}</p>
                <p className="text-xs text-muted-foreground">{t("returning")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Search */}
              <div className="sm:col-span-2">
                <Label className="text-xs text-muted-foreground">{tCommon("search")}</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input
                    placeholder={t("searchPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="flex-1"
                  />
                  <Button variant="secondary" size="icon" onClick={handleSearch}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* VIP filter */}
              <div>
                <Label className="text-xs text-muted-foreground">{t("status")}</Label>
                <Select
                  value={filters.vipOnly ? "vip" : "all"}
                  onValueChange={(v) => updateFilters("vipOnly", v === "vip" ? true : undefined)}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder={t("allContacts")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allContacts")}</SelectItem>
                    <SelectItem value="vip">{t("vipOnly")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tier filter */}
              <div>
                <Label className="text-xs text-muted-foreground">{t("tier")}</Label>
                <Select
                  value={filters.tier || "all"}
                  onValueChange={(v) => updateFilters("tier", v === "all" ? undefined : v)}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder={t("allTiers")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allTiers")}</SelectItem>
                    <SelectItem value="vip">{t("vipTier")}</SelectItem>
                    <SelectItem value="returning">{t("returningTier")}</SelectItem>
                    <SelectItem value="new">{t("newTier")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Clear filters */}
            {(filters.vipOnly || filters.tier || filters.search) && (
              <div className="mt-4 pt-4 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/contacts")}
                  className="gap-2"
                >
                  <X className="h-4 w-4" />
                  {t("clearFilters")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Contacts List */}
      <Card>
        <CardContent className="p-0">
          {contacts.length === 0 ? (
            filters.search || filters.vipOnly || filters.tier ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-medium">{t("noContactsFound")}</h3>
                <p className="text-muted-foreground mt-1">{t("adjustFilters")}</p>
              </div>
            ) : (
              <EmptyStateContacts />
            )
          ) : (
            <div className="divide-y divide-border">
              {/* Table Header */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 text-sm font-medium text-muted-foreground bg-muted/50">
                <div className="col-span-3">{tCommon("name")}</div>
                <div className="col-span-2">{tCommon("phone")}</div>
                <div className="col-span-3">{tCommon("email")}</div>
                <div className="col-span-1 text-center">{t("calls")}</div>
                <div className="col-span-2">{t("lastContact")}</div>
                <div className="col-span-1 text-center">{t("status")}</div>
              </div>

              {/* Contact Rows */}
              {contacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => handleContactClick(contact)}
                  className={cn(
                    "w-full flex md:grid md:grid-cols-12 items-center gap-4 p-4 text-left transition-colors hover:bg-muted/50",
                    selectedContact?.id === contact.id && "bg-muted/50"
                  )}
                >
                  {/* Name with avatar */}
                  <div className="flex items-center gap-3 flex-1 md:flex-none md:col-span-3 min-w-0">
                    <div className="shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-semibold text-primary">
                        {(contact.name || "U").charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {contact.name || t("unknownCaller")}
                      </p>
                      {/* Mobile: show phone under name */}
                      <p className="text-sm text-muted-foreground md:hidden">
                        {formatPhoneNumber(contact.phone_number)}
                      </p>
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="hidden md:flex items-center gap-2 col-span-2">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">
                      {formatPhoneNumber(contact.phone_number)}
                    </span>
                  </div>

                  {/* Email */}
                  <div className="hidden md:flex items-center gap-2 col-span-3 min-w-0">
                    {contact.email ? (
                      <>
                        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">{contact.email}</span>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </div>

                  {/* Calls count */}
                  <div className="hidden md:block text-center col-span-1">
                    <span className="text-sm font-medium">{contact.total_calls}</span>
                  </div>

                  {/* Last contact */}
                  <div className="hidden md:block col-span-2 text-sm text-muted-foreground">
                    {contact.last_call_at
                      ? format(new Date(contact.last_call_at), "MMM d, yyyy")
                      : "-"}
                  </div>

                  {/* VIP badge */}
                  <div className="col-span-1 flex justify-center shrink-0">
                    {contact.vip_status && (
                      <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">
                        <Star className="h-3 w-3 mr-1 fill-current" />
                        VIP
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("page")} {page} {t("of")} {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              {tCommon("previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
            >
              {tCommon("next")}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Contact Detail Dialog */}
      <ContactDetailDialog
        contact={selectedContact}
        open={!!selectedContact}
        onOpenChange={(open) => !open && closeDetails()}
        onUpdate={handleContactUpdate}
      />

      {/* Create Contact Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              {t("addContact") || "Add Contact"}
            </DialogTitle>
            <DialogDescription>
              {t("addContactDesc") || "Create a new contact manually"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Phone (required) */}
            <div className="space-y-2">
              <Label htmlFor="phone">
                {tCommon("phone")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={newContactPhone}
                onChange={(e) => setNewContactPhone(e.target.value)}
              />
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">{tCommon("name")}</Label>
              <Input
                id="name"
                placeholder={t("namePlaceholder") || "Contact name"}
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">{tCommon("email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder="contact@example.com"
                value={newContactEmail}
                onChange={(e) => setNewContactEmail(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">{t("notes") || "Notes"}</Label>
              <Textarea
                id="notes"
                placeholder={t("notesPlaceholder") || "Optional notes about this contact"}
                value={newContactNotes}
                onChange={(e) => setNewContactNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* VIP Toggle */}
            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                id="vip"
                checked={newContactVip}
                onChange={(e) => setNewContactVip(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="vip" className="flex items-center gap-2 cursor-pointer">
                <Star className="h-4 w-4 text-amber-500" />
                {t("markAsVip") || "Mark as VIP"}
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleCreateContact} disabled={creating}>
              {creating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4 mr-2" />
              )}
              {t("createContact") || "Create Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
