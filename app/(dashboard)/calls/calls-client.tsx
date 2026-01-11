"use client";

/**
 * Calls List Client Component
 * Session 16: Dashboard - Home & Calls
 * Spec Reference: Part 7, Lines 678-699
 * 
 * Features:
 * - List view with date/time, caller, duration, outcome, language, summary
 * - Expandable details with transcript, recording, lead info, appointment
 * - Filters: date range, outcome type, language, search transcripts
 * - Actions: Flag, Add note
 */

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { DatePicker } from "@/components/ui/date-picker";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import {
  Search,
  Filter,
  Phone,
  Play,
  Pause,
  Flag,
  MessageSquare,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  CalendarCheck,
  PhoneForwarded,
  Info,
  PhoneMissed,
  Clock,
  User,
  Mail,
  FileText,
  Loader2,
} from "lucide-react";
import type { Call, Appointment } from "@/types";

interface CallsListClientProps {
  initialCalls: Call[];
  total: number;
  page: number;
  limit: number;
  filters: {
    startDate?: string;
    endDate?: string;
    outcome?: string;
    language?: string;
    search?: string;
  };
  selectedCallId?: string;
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

export function CallsListClient({
  initialCalls,
  total,
  page,
  limit,
  filters,
  selectedCallId,
}: CallsListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [calls] = useState(initialCalls);
  const [searchQuery, setSearchQuery] = useState(filters.search || "");
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const totalPages = Math.ceil(total / limit);

  // Load selected call details if ID is in URL
  useEffect(() => {
    if (selectedCallId) {
      const call = calls.find((c) => c.id === selectedCallId);
      if (call) {
        loadCallDetails(call);
      }
    }
  }, [selectedCallId, calls]);

  const loadCallDetails = async (call: Call) => {
    setSelectedCall(call);
    setNoteText(call.notes || "");
    setDetailsLoading(true);
    
    try {
      const res = await fetch(`/api/dashboard/calls/${call.id}`);
      if (res.ok) {
        const data = await res.json();
        setAppointment(data.data.appointment);
      }
    } catch (error) {
      // Error handled silently
    } finally {
      setDetailsLoading(false);
    }
  };

  const updateFilters = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page"); // Reset to page 1 on filter change
      router.push(`/calls?${params.toString()}`);
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
      router.push(`/calls?${params.toString()}`);
    },
    [router, searchParams]
  );

  const handleFlag = async (call: Call) => {
    try {
      await fetch("/api/dashboard/calls", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: call.id, flagged: !call.flagged }),
      });
      router.refresh();
    } catch (error) {
      // Error handled silently
    }
  };

  const handleSaveNote = async () => {
    if (!selectedCall) return;
    setSavingNote(true);
    try {
      await fetch("/api/dashboard/calls", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedCall.id, notes: noteText }),
      });
      router.refresh();
    } catch (error) {
      // Error handled silently
    } finally {
      setSavingNote(false);
    }
  };

  const closeDetails = () => {
    setSelectedCall(null);
    setAppointment(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("id");
    router.push(`/calls?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calls</h1>
          <p className="text-muted-foreground">
            {total} {total === 1 ? "call" : "calls"} total
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 w-fit"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-4 w-4" />
          Filters
          {(filters.outcome || filters.language || filters.startDate) && (
            <Badge variant="secondary" className="ml-1">
              Active
            </Badge>
          )}
        </Button>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Search */}
              <div className="sm:col-span-2">
                <Label className="text-xs text-muted-foreground">Search transcripts</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input
                    placeholder="Search calls..."
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

              {/* Outcome filter */}
              <div>
                <Label className="text-xs text-muted-foreground">Outcome</Label>
                <Select
                  value={filters.outcome || "all"}
                  onValueChange={(v) => updateFilters("outcome", v === "all" ? undefined : v)}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="All outcomes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All outcomes</SelectItem>
                    <SelectItem value="booked">Booked</SelectItem>
                    <SelectItem value="transferred">Transferred</SelectItem>
                    <SelectItem value="info">Info Only</SelectItem>
                    <SelectItem value="message">Message Taken</SelectItem>
                    <SelectItem value="missed">Missed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Language filter */}
              <div>
                <Label className="text-xs text-muted-foreground">Language</Label>
                <Select
                  value={filters.language || "all"}
                  onValueChange={(v) => updateFilters("language", v === "all" ? undefined : v)}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="All languages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All languages</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date Range Filters */}
            <div className="grid gap-4 sm:grid-cols-2 mt-4 pt-4 border-t">
              <div>
                <DatePicker
                  label="From Date"
                  value={filters.startDate || ""}
                  onChange={(e) => updateFilters("startDate", e.target.value || undefined)}
                />
              </div>
              <div>
                <DatePicker
                  label="To Date"
                  value={filters.endDate || ""}
                  onChange={(e) => updateFilters("endDate", e.target.value || undefined)}
                />
              </div>
            </div>

            {/* Clear filters */}
            {(filters.outcome || filters.language || filters.search || filters.startDate || filters.endDate) && (
              <div className="mt-4 pt-4 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/calls")}
                  className="gap-2"
                >
                  <X className="h-4 w-4" />
                  Clear all filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Calls List */}
      <Card>
        <CardContent className="p-0">
          {calls.length === 0 ? (
            <div className="text-center py-12">
              <Phone className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium">No calls found</h3>
              <p className="text-muted-foreground mt-1">
                {filters.search || filters.outcome || filters.language
                  ? "Try adjusting your filters"
                  : "Calls will appear here once Koya handles them"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {calls.map((call) => {
                const outcome = call.outcome || "info";
                const config = outcomeConfig[outcome as keyof typeof outcomeConfig] || outcomeConfig.info;
                const Icon = config.icon;
                const isFlagged = call.flagged;

                return (
                  <button
                    key={call.id}
                    onClick={() => loadCallDetails(call)}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 text-left transition-colors hover:bg-muted/50",
                      selectedCall?.id === call.id && "bg-muted/50"
                    )}
                  >
                    {/* Outcome icon */}
                    <div className={cn("rounded-lg p-2.5 shrink-0", config.className)}>
                      <Icon className="h-5 w-5" />
                    </div>

                    {/* Call info */}
                    <div className="flex-1 min-w-0 grid gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {formatPhoneNumber(call.from_number)}
                        </span>
                        {call.language === "es" && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            🇪🇸 ES
                          </Badge>
                        )}
                        {isFlagged && (
                          <Flag className="h-3.5 w-3.5 text-red-500 shrink-0" />
                        )}
                      </div>
                      {call.summary && (
                        <p className="text-sm text-muted-foreground truncate">
                          {call.summary}
                        </p>
                      )}
                    </div>

                    {/* Duration and time */}
                    <div className="text-right shrink-0 hidden sm:block">
                      <div className="text-sm font-medium">
                        {formatDuration(call.duration_seconds)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(call.started_at || call.created_at), "MMM d, h:mm a")}
                      </div>
                    </div>

                    {/* Outcome badge */}
                    <Badge variant="secondary" className={cn("shrink-0 hidden lg:flex", config.className)}>
                      {config.label}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Call Details Sheet */}
      <Sheet open={!!selectedCall} onOpenChange={(open) => !open && closeDetails()}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedCall && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  {formatPhoneNumber(selectedCall.from_number)}
                </SheetTitle>
                <SheetDescription>
                  {format(new Date(selectedCall.started_at || selectedCall.created_at), "EEEE, MMMM d, yyyy 'at' h:mm a")}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Call metadata */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p className="font-medium">{formatDuration(selectedCall.duration_seconds)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Language</p>
                    <p className="font-medium">{selectedCall.language === "es" ? "Spanish" : "English"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Outcome</p>
                    <Badge variant="secondary" className={cn(
                      outcomeConfig[selectedCall.outcome as keyof typeof outcomeConfig]?.className
                    )}>
                      {outcomeConfig[selectedCall.outcome as keyof typeof outcomeConfig]?.label || "Unknown"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Billed Minutes</p>
                    <p className="font-medium">{selectedCall.duration_minutes_billed || 0} min</p>
                  </div>
                </div>

                {/* Summary */}
                {selectedCall.summary && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Summary
                    </h4>
                    <p className="text-sm text-muted-foreground bg-muted rounded-lg p-3">
                      {selectedCall.summary}
                    </p>
                  </div>
                )}

                {/* Message taken */}
                {selectedCall.message_taken && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Message Taken
                    </h4>
                    <p className="text-sm text-muted-foreground bg-muted rounded-lg p-3">
                      {selectedCall.message_taken}
                    </p>
                  </div>
                )}

                {/* Lead info */}
                {selectedCall.lead_info && Object.keys(selectedCall.lead_info).length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Lead Information
                    </h4>
                    <div className="bg-muted rounded-lg p-3 space-y-2">
                      {Object.entries(selectedCall.lead_info).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                          <span className="font-medium">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Appointment booked */}
                {detailsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : appointment && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Appointment Booked
                    </h4>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Service</span>
                        <span className="font-medium">{appointment.service_name}</span>
                      </div>
                      {appointment.scheduled_at && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Date & Time</span>
                          <span className="font-medium">
                            {format(new Date(appointment.scheduled_at), "MMM d, yyyy 'at' h:mm a")}
                          </span>
                        </div>
                      )}
                      {appointment.customer_name && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Customer</span>
                          <span className="font-medium">{appointment.customer_name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Recording */}
                {selectedCall.recording_url && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Play className="h-4 w-4" />
                      Recording
                    </h4>
                    <audio
                      controls
                      className="w-full"
                      src={selectedCall.recording_url}
                    />
                  </div>
                )}

                {/* Transcript */}
                {selectedCall.transcript && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Transcript</h4>
                    <div className="bg-muted rounded-lg p-3 max-h-64 overflow-y-auto">
                      <pre className="text-xs whitespace-pre-wrap font-mono">
                        {typeof selectedCall.transcript === "string"
                          ? selectedCall.transcript
                          : JSON.stringify(selectedCall.transcript, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="border-t pt-6 space-y-4">
                  <div className="flex gap-2">
                    <Button
                      variant={selectedCall.flagged ? "destructive" : "outline"}
                      size="sm"
                      className="gap-2"
                      onClick={() => handleFlag(selectedCall)}
                    >
                      <Flag className="h-4 w-4" />
                      {selectedCall.flagged ? "Unflag" : "Flag"}
                    </Button>
                  </div>

                  {/* Notes */}
                  <div>
                    <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
                    <Textarea
                      id="notes"
                      placeholder="Add a note about this call..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      className="mt-2"
                      rows={3}
                    />
                    <Button
                      size="sm"
                      className="mt-2"
                      onClick={handleSaveNote}
                      disabled={savingNote}
                    >
                      {savingNote ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Saving...
                        </>
                      ) : (
                        "Save Note"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
