"use client";

/**
 * Holiday Blocker Component
 * Calendar to select dates to block (holidays, vacations, etc.)
 */

import { useState, useEffect } from "react";
import {
  CalendarOff,
  Loader2,
  Plus,
  Trash2,
  AlertCircle,
  RefreshCw,
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
  Alert,
  AlertDescription,
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
import { Calendar } from "@/components/ui/calendar";
import { toast } from "@/hooks/use-toast";
import type { BlockedDate } from "@/types";
import { format, parseISO, isSameDay, isAfter, startOfDay } from "date-fns";

// ============================================
// Component
// ============================================

export function HolidayBlocker() {
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [reason, setReason] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ============================================
  // Data Fetching
  // ============================================

  const fetchBlockedDates = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        "/api/dashboard/settings/availability/blocked-dates"
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch blocked dates");
      }

      setBlockedDates(data.data || []);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to load blocked dates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlockedDates();
  }, []);

  // ============================================
  // Actions
  // ============================================

  const handleAddBlockedDate = async () => {
    if (!selectedDate) {
      toast({
        title: "Date Required",
        description: "Please select a date to block",
        variant: "destructive",
      });
      return;
    }

    setAdding(true);
    try {
      const dateString = format(selectedDate, "yyyy-MM-dd");
      const response = await fetch(
        "/api/dashboard/settings/availability/blocked-dates",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: dateString,
            reason: reason || null,
            isRecurring,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to add blocked date");
      }

      // Add to local state
      setBlockedDates((prev) =>
        [...prev, data.data].sort(
          (a, b) =>
            new Date(a.blocked_date).getTime() -
            new Date(b.blocked_date).getTime()
        )
      );

      // Reset form
      setAddDialogOpen(false);
      setSelectedDate(undefined);
      setReason("");
      setIsRecurring(false);

      toast({
        title: "Date Blocked",
        description: `${format(selectedDate, "MMMM d, yyyy")} has been blocked`,
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to add blocked date",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteBlockedDate = async (blockedDateId: string) => {
    setDeletingId(blockedDateId);
    try {
      const response = await fetch(
        `/api/dashboard/settings/availability/blocked-dates?id=${blockedDateId}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to remove blocked date");
      }

      // Remove from local state
      setBlockedDates((prev) => prev.filter((bd) => bd.id !== blockedDateId));

      toast({
        title: "Date Unblocked",
        description: "The date has been removed from blocked dates",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to remove blocked date",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  // Check if a date is blocked (for calendar highlighting)
  const isDateBlocked = (date: Date) => {
    return blockedDates.some((bd) =>
      isSameDay(parseISO(bd.blocked_date), date)
    );
  };

  // Get upcoming blocked dates (today and future)
  const upcomingBlockedDates = blockedDates.filter((bd) =>
    isAfter(parseISO(bd.blocked_date), startOfDay(new Date())) ||
    isSameDay(parseISO(bd.blocked_date), new Date())
  );

  // Get past blocked dates
  const pastBlockedDates = blockedDates.filter(
    (bd) =>
      !isAfter(parseISO(bd.blocked_date), startOfDay(new Date())) &&
      !isSameDay(parseISO(bd.blocked_date), new Date())
  );

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
                <CalendarOff className="h-5 w-5" />
                Blocked Dates
              </CardTitle>
              <CardDescription>
                Block specific dates for holidays, vacations, or maintenance
              </CardDescription>
            </div>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Block Date
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Koya will not book appointments on blocked dates. Callers will be
              informed that you are closed on these days.
            </AlertDescription>
          </Alert>

          {/* Blocked Dates List */}
          {blockedDates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No blocked dates</p>
              <p className="text-sm">Add holidays or vacation days to block bookings</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Upcoming Blocked Dates */}
              {upcomingBlockedDates.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 text-sm text-muted-foreground uppercase">
                    Upcoming Blocked Dates
                  </h4>
                  <div className="space-y-2">
                    {upcomingBlockedDates.map((bd) => (
                      <div
                        key={bd.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-center min-w-[60px]">
                            <div className="text-2xl font-bold">
                              {format(parseISO(bd.blocked_date), "d")}
                            </div>
                            <div className="text-xs text-muted-foreground uppercase">
                              {format(parseISO(bd.blocked_date), "MMM")}
                            </div>
                          </div>
                          <div>
                            <div className="font-medium">
                              {format(parseISO(bd.blocked_date), "EEEE")}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {bd.reason || "No reason specified"}
                            </div>
                          </div>
                          {bd.is_recurring && (
                            <Badge variant="secondary" className="ml-2">
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Recurring
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteBlockedDate(bd.id)}
                          disabled={deletingId === bd.id}
                        >
                          {deletingId === bd.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Past Blocked Dates */}
              {pastBlockedDates.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 text-sm text-muted-foreground uppercase">
                    Past Blocked Dates
                  </h4>
                  <div className="space-y-2 opacity-60">
                    {pastBlockedDates.slice(0, 5).map((bd) => (
                      <div
                        key={bd.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-center min-w-[60px]">
                            <div className="text-lg font-medium">
                              {format(parseISO(bd.blocked_date), "d")}
                            </div>
                            <div className="text-xs text-muted-foreground uppercase">
                              {format(parseISO(bd.blocked_date), "MMM")}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm">
                              {format(parseISO(bd.blocked_date), "EEEE")}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {bd.reason || "No reason specified"}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteBlockedDate(bd.id)}
                          disabled={deletingId === bd.id}
                        >
                          {deletingId === bd.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                    {pastBlockedDates.length > 5 && (
                      <p className="text-sm text-muted-foreground text-center">
                        +{pastBlockedDates.length - 5} more past dates
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Blocked Date Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Block a Date</DialogTitle>
            <DialogDescription>
              Select a date to prevent bookings
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Calendar */}
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => setSelectedDate(date as Date | undefined)}
                disabled={(date) => {
                  // Disable past dates and already blocked dates
                  return (
                    date < startOfDay(new Date()) ||
                    isDateBlocked(date)
                  );
                }}
                className="rounded-md border"
              />
            </div>

            {/* Selected Date Display */}
            {selectedDate && (
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="font-medium">
                  {format(selectedDate, "EEEE, MMMM d, yyyy")}
                </p>
              </div>
            )}

            {/* Reason Input */}
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Input
                id="reason"
                placeholder="e.g., Christmas, Company Retreat, Vacation"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {/* Recurring Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Annual Recurring</Label>
                <p className="text-sm text-muted-foreground">
                  Block this date every year
                </p>
              </div>
              <Switch
                checked={isRecurring}
                onCheckedChange={setIsRecurring}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddBlockedDate}
              disabled={adding || !selectedDate}
            >
              {adding ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CalendarOff className="h-4 w-4 mr-2" />
              )}
              Block Date
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
