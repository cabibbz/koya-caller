"use client";

/**
 * Contact Detail Dialog Component
 * Customer/Contact Management feature
 * PRODUCT_ROADMAP.md Section 2.3
 *
 * Features:
 * - Contact info display and editing (name, email, notes)
 * - VIP toggle
 * - Call history list
 * - Appointment history list
 */

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Phone,
  Mail,
  Star,
  Edit2,
  Save,
  X,
  Loader2,
  Calendar,
  Clock,
  CalendarCheck,
  PhoneForwarded,
  Info,
  MessageSquare,
  PhoneMissed,
  User,
} from "lucide-react";
import type { ContactWithStats } from "@/lib/db/contacts";
import type { Call, Appointment } from "@/types";

interface ContactDetailDialogProps {
  contact: ContactWithStats | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const outcomeConfig = {
  booked: {
    label: "Booked",
    icon: CalendarCheck,
    className: "bg-emerald-500/10 text-emerald-500",
  },
  transferred: {
    label: "Transferred",
    icon: PhoneForwarded,
    className: "bg-blue-500/10 text-blue-500",
  },
  info: {
    label: "Info Only",
    icon: Info,
    className: "bg-purple-500/10 text-purple-500",
  },
  message: {
    label: "Message",
    icon: MessageSquare,
    className: "bg-amber-500/10 text-amber-500",
  },
  missed: {
    label: "Missed",
    icon: PhoneMissed,
    className: "bg-red-500/10 text-red-500",
  },
  minutes_exhausted: {
    label: "Over Limit",
    icon: Clock,
    className: "bg-gray-500/10 text-gray-500",
  },
};

const statusConfig = {
  confirmed: { label: "Confirmed", className: "bg-emerald-500/10 text-emerald-600" },
  cancelled: { label: "Cancelled", className: "bg-red-500/10 text-red-600" },
  completed: { label: "Completed", className: "bg-blue-500/10 text-blue-600" },
  no_show: { label: "No Show", className: "bg-gray-500/10 text-gray-600" },
  pending: { label: "Pending", className: "bg-amber-500/10 text-amber-600" },
};

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

function formatDuration(seconds: number | null): string {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function ContactDetailDialog({
  contact,
  open,
  onOpenChange,
  onUpdate,
}: ContactDetailDialogProps) {
  const t = useTranslations("contacts");
  const tCommon = useTranslations("common");
  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [callHistory, setCallHistory] = useState<Call[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  // Editable fields
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editVip, setEditVip] = useState(false);

  // Reset form when contact changes
  useEffect(() => {
    if (contact) {
      setEditName(contact.name || "");
      setEditEmail(contact.email || "");
      setEditNotes(contact.notes || "");
      setEditVip(contact.vip_status);
      setIsEditing(false);
    }
  }, [contact]);

  // Load contact details when opened
  const loadContactDetails = useCallback(async () => {
    if (!contact) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/dashboard/contacts/${contact.id}`);
      if (response.ok) {
        const data = await response.json();
        setCallHistory(data.data.callHistory || []);
        setAppointments(data.data.appointments || []);
      }
    } catch {
      // Silently fail - details will remain empty
    } finally {
      setLoading(false);
    }
  }, [contact]);

  useEffect(() => {
    if (open && contact) {
      loadContactDetails();
    }
  }, [open, contact, loadContactDetails]);

  const handleSave = async () => {
    if (!contact) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/dashboard/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName || null,
          email: editEmail || null,
          notes: editNotes || null,
          vip_status: editVip,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update contact");
      }

      toast({
        title: t("contactUpdated"),
        variant: "success",
      });

      setIsEditing(false);
      onUpdate();
    } catch {
      toast({
        title: t("updateFailed"),
        description: tCommon("tryAgain") || "Please try again",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleVipToggle = async (checked: boolean) => {
    if (!contact || isEditing) {
      setEditVip(checked);
      return;
    }

    // Quick toggle without edit mode
    try {
      const response = await fetch(`/api/dashboard/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vip_status: checked }),
      });

      if (!response.ok) throw new Error("Failed to update");

      setEditVip(checked);
      toast({
        title: checked ? t("markedAsVip") : t("removedVip"),
        variant: "success",
      });
      onUpdate();
    } catch {
      toast({
        title: t("updateFailed"),
        variant: "destructive",
      });
    }
  };

  const cancelEdit = () => {
    if (contact) {
      setEditName(contact.name || "");
      setEditEmail(contact.email || "");
      setEditNotes(contact.notes || "");
      setEditVip(contact.vip_status);
    }
    setIsEditing(false);
  };

  if (!contact) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-lg font-bold text-primary">
                {(contact.name || "U").charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <span className="flex items-center gap-2">
                {contact.name || t("unknownCaller")}
                {editVip && (
                  <Badge className="bg-amber-500/10 text-amber-600">
                    <Star className="h-3 w-3 mr-1 fill-current" />
                    VIP
                  </Badge>
                )}
              </span>
              <DialogDescription className="flex items-center gap-2 mt-1">
                <Phone className="h-4 w-4" />
                {formatPhoneNumber(contact.phone_number)}
              </DialogDescription>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="info">{t("info")}</TabsTrigger>
              <TabsTrigger value="calls">
                {t("calls")} ({callHistory.length})
              </TabsTrigger>
              <TabsTrigger value="appointments">
                {t("appointments")} ({appointments.length})
              </TabsTrigger>
            </TabsList>

            {/* Info Tab */}
            <TabsContent value="info" className="mt-4 space-y-6">
              {/* Edit/Save buttons */}
              <div className="flex justify-end gap-2">
                {isEditing ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={cancelEdit}>
                      <X className="h-4 w-4 mr-2" />
                      {tCommon("cancel")}
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                      {saving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      {tCommon("save")}
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    {tCommon("edit")}
                  </Button>
                )}
              </div>

              {/* Contact Info */}
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Name */}
                  <div>
                    <Label htmlFor="contact-name">{tCommon("name")}</Label>
                    {isEditing ? (
                      <Input
                        id="contact-name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder={t("enterName")}
                        className="mt-1.5"
                      />
                    ) : (
                      <p className="mt-1.5 text-sm flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {contact.name || <span className="text-muted-foreground">-</span>}
                      </p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <Label htmlFor="contact-email">{tCommon("email")}</Label>
                    {isEditing ? (
                      <Input
                        id="contact-email"
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder={t("enterEmail")}
                        className="mt-1.5"
                      />
                    ) : (
                      <p className="mt-1.5 text-sm flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {contact.email || <span className="text-muted-foreground">-</span>}
                      </p>
                    )}
                  </div>
                </div>

                {/* VIP Status */}
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <Star
                      className={cn(
                        "h-5 w-5",
                        editVip ? "text-amber-500 fill-amber-500" : "text-muted-foreground"
                      )}
                    />
                    <div>
                      <p className="font-medium">{t("vipStatus")}</p>
                      <p className="text-sm text-muted-foreground">{t("vipDescription")}</p>
                    </div>
                  </div>
                  <Switch
                    checked={editVip}
                    onCheckedChange={handleVipToggle}
                    aria-label={t("toggleVip")}
                  />
                </div>

                {/* Notes */}
                <div>
                  <Label htmlFor="contact-notes">{tCommon("notes")}</Label>
                  {isEditing ? (
                    <Textarea
                      id="contact-notes"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder={t("addNotes")}
                      className="mt-1.5"
                      rows={4}
                    />
                  ) : (
                    <p className="mt-1.5 text-sm text-muted-foreground bg-muted rounded-lg p-3">
                      {contact.notes || t("noNotes")}
                    </p>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{contact.total_calls}</p>
                    <p className="text-xs text-muted-foreground">{t("totalCalls")}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{appointments.length}</p>
                    <p className="text-xs text-muted-foreground">{t("appointments")}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">
                      {contact.last_call_at
                        ? format(new Date(contact.last_call_at), "MMM d, yyyy")
                        : "-"}
                    </p>
                    <p className="text-xs text-muted-foreground">{t("lastContact")}</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Calls Tab */}
            <TabsContent value="calls" className="mt-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : callHistory.length === 0 ? (
                <div className="text-center py-8">
                  <Phone className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">{t("noCallHistory")}</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {callHistory.map((call) => {
                    const outcome = call.outcome || "info";
                    const config =
                      outcomeConfig[outcome as keyof typeof outcomeConfig] || outcomeConfig.info;
                    const Icon = config.icon;

                    return (
                      <div
                        key={call.id}
                        className="flex items-center gap-4 p-3 rounded-lg border bg-card"
                      >
                        <div className={cn("rounded-lg p-2 shrink-0", config.className)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm">{config.label}</p>
                            <span className="text-xs text-muted-foreground">
                              {formatDuration(call.duration_seconds)}
                            </span>
                          </div>
                          {call.summary && (
                            <p className="text-sm text-muted-foreground truncate mt-0.5">
                              {call.summary}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(call.created_at), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Appointments Tab */}
            <TabsContent value="appointments" className="mt-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : appointments.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">{t("noAppointments")}</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {appointments.map((apt) => {
                    const status = apt.status || "pending";
                    const config =
                      statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

                    return (
                      <div
                        key={apt.id}
                        className="flex items-center gap-4 p-3 rounded-lg border bg-card"
                      >
                        <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                          <Calendar className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-sm truncate">
                              {apt.service_name || t("appointment")}
                            </p>
                            <Badge className={cn("shrink-0", config.className)}>
                              {config.label}
                            </Badge>
                          </div>
                          {apt.scheduled_at && (
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {format(new Date(apt.scheduled_at), "EEEE, MMMM d, yyyy 'at' h:mm a")}
                            </p>
                          )}
                          {apt.duration_minutes && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {apt.duration_minutes} {t("minutes")}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
