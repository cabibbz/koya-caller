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
import { useTranslations } from "next-intl";
import { useToast } from "@/hooks/use-toast";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExportButton } from "@/components/ui/export-button";
import type { Call, Appointment } from "@/types";
import {
  CallFilters,
  CallFiltersToggle,
  CallsList,
  CallsPagination,
  CallDetailPanel,
  type CallFiltersValues,
} from "@/components/calls";

interface CallsListClientProps {
  initialCalls: Call[];
  total: number;
  page: number;
  limit: number;
  filters: CallFiltersValues;
  selectedCallId?: string;
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
  const { toast } = useToast();
  const t = useTranslations("calls");
  const tCommon = useTranslations("common");

  const [calls] = useState(initialCalls);
  const [searchQuery, setSearchQuery] = useState(filters.search || "");
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const totalPages = Math.ceil(total / limit);
  const hasActiveFilters = !!(
    filters.outcome ||
    filters.language ||
    filters.startDate
  );

  const loadCallDetails = useCallback(
    async (call: Call) => {
      setSelectedCall(call);
      setNoteText(call.notes || "");
      setDetailsLoading(true);

      try {
        const res = await fetch(`/api/dashboard/calls/${call.id}`);
        if (res.ok) {
          const data = await res.json();
          setAppointment(data.data.appointment);
        } else {
          toast({
            title: "Failed to load call details",
            description: "Please try again",
            variant: "destructive",
          });
        }
      } catch (_error) {
        toast({
          title: "Failed to load call details",
          description: "Network error occurred",
          variant: "destructive",
        });
      } finally {
        setDetailsLoading(false);
      }
    },
    [toast]
  );

  // Load selected call details if ID is in URL
  useEffect(() => {
    if (selectedCallId) {
      const call = calls.find((c) => c.id === selectedCallId);
      if (call) {
        loadCallDetails(call);
      }
    }
  }, [selectedCallId, calls, loadCallDetails]);

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

  const handleClearFilters = useCallback(() => {
    router.push("/calls");
  }, [router]);

  const handleFlag = async (call: Call) => {
    try {
      const res = await fetch("/api/dashboard/calls", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: call.id, flagged: !call.flagged }),
      });
      if (!res.ok) {
        toast({
          title: "Failed to update flag",
          description: "Please try again",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: call.flagged ? "Call unflagged" : "Call flagged",
        variant: "success",
      });
      router.refresh();
    } catch (_error) {
      toast({
        title: "Failed to update flag",
        description: "Network error occurred",
        variant: "destructive",
      });
    }
  };

  const handleSaveNote = async () => {
    if (!selectedCall) return;
    setSavingNote(true);
    try {
      const res = await fetch("/api/dashboard/calls", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedCall.id, notes: noteText }),
      });
      if (!res.ok) {
        toast({
          title: "Failed to save note",
          description: "Please try again",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Note saved",
        variant: "success",
      });
      router.refresh();
    } catch (_error) {
      toast({
        title: "Failed to save note",
        description: "Network error occurred",
        variant: "destructive",
      });
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

  const hasFilters = !!(
    filters.search ||
    filters.outcome ||
    filters.language
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">
            {total} {total === 1 ? "call" : "calls"} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton exportUrl="/api/dashboard/calls/export" label="Calls" />
          <Button
            variant="outline"
            size="sm"
            className="gap-2 w-fit"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
            {tCommon("filter")}
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-1">
                Active
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <CallFilters
          filters={filters}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onSearch={handleSearch}
          onFilterChange={updateFilters}
          onClearFilters={handleClearFilters}
        />
      )}

      {/* Calls List */}
      <CallsList
        calls={calls}
        selectedCallId={selectedCall?.id}
        onSelectCall={loadCallDetails}
        hasFilters={hasFilters}
      />

      {/* Pagination */}
      <CallsPagination
        page={page}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />

      {/* Call Details Sheet */}
      <CallDetailPanel
        call={selectedCall}
        appointment={appointment}
        detailsLoading={detailsLoading}
        isOpen={!!selectedCall}
        onClose={closeDetails}
        noteText={noteText}
        onNoteChange={setNoteText}
        onSaveNote={handleSaveNote}
        onToggleFlag={handleFlag}
        savingNote={savingNote}
      />
    </div>
  );
}
