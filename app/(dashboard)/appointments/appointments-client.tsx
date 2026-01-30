"use client";

/**
 * Appointments Client Component
 * Session 17: Dashboard - Appointments & Knowledge
 * Spec Reference: Part 7, Lines 700-717
 *
 * Features:
 * - Calendar view (month/week/day) - Line 702-703
 * - List view (upcoming/past) - Line 705-708
 * - Appointment details and actions - Line 710-716
 */

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isSameMonth,
  isSameDay,
  parseISO,
} from "date-fns";
import { DateTime } from "luxon";
import {
  Calendar,
  List,
  ChevronLeft,
  ChevronRight,
  Clock,
  Phone,
  Mail,
  User,
  Check,
  XCircle,
  AlertCircle,
  Loader2,
  Bot,
  UserPlus,
  CalendarClock,
  Plus,
} from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardContent,
  Badge,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Skeleton,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
  Label,
  Textarea,
} from "@/components/ui";
import type { Appointment, AppointmentStatus } from "@/types";
import { EmptyStateAppointments } from "@/components/ui/empty-state";
import { SkeletonCard } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { ExportButton } from "@/components/ui/export-button";

interface AppointmentsClientProps {
  businessId: string;
  timezone: string;
  services: { id: string; name: string; duration_minutes: number }[];
}

type ViewMode = "calendar" | "list";
type CalendarView = "month" | "week" | "day";
type ListFilter = "upcoming" | "past" | "all";

export function AppointmentsClient({
  businessId: _businessId,
  timezone,
  services,
}: AppointmentsClientProps) {
  const t = useTranslations("appointments");
  const tCommon = useTranslations("common");
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [calendarView, setCalendarView] = useState<CalendarView>("month");
  const [listFilter, setListFilter] = useState<ListFilter>("upcoming");
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "all">("all");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");

  // Add appointment modal state
  const [addAppointmentOpen, setAddAppointmentOpen] = useState(false);
  const [addAppointmentLoading, setAddAppointmentLoading] = useState(false);
  const [newAppointment, setNewAppointment] = useState({
    service_id: "",
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    scheduled_date: "",
    scheduled_time: "",
    notes: "",
  });

  // Fetch appointments with abort controller to prevent race conditions
  useEffect(() => {
    const abortController = new AbortController();

    const fetchAppointments = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();

        // For calendar view, filter by visible date range for performance
        if (viewMode === "calendar") {
          let rangeStart: Date;
          let rangeEnd: Date;

          if (calendarView === "month") {
            rangeStart = startOfWeek(startOfMonth(currentDate));
            rangeEnd = endOfWeek(endOfMonth(currentDate));
          } else if (calendarView === "week") {
            rangeStart = startOfWeek(currentDate);
            rangeEnd = endOfWeek(currentDate);
          } else {
            // Day view
            rangeStart = currentDate;
            rangeEnd = addDays(currentDate, 1);
          }

          params.set("from", rangeStart.toISOString());
          params.set("to", rangeEnd.toISOString());
        } else {
          // List view uses upcoming/past filters
          if (listFilter === "upcoming") params.set("upcoming", "true");
          if (listFilter === "past") params.set("past", "true");
        }

        if (statusFilter !== "all") params.set("status", statusFilter);

        const res = await fetch(`/api/dashboard/appointments?${params.toString()}`, {
          signal: abortController.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setAppointments(data.appointments || []);
        } else {
          toast({
            title: "Failed to load appointments",
            description: "Please try again",
            variant: "destructive",
          });
        }
      } catch (error) {
        // Ignore aborted requests (expected during cleanup)
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        toast({
          title: "Failed to load appointments",
          description: "Network error occurred",
          variant: "destructive",
        });
      } finally {
        // Only update loading state if request wasn't aborted
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchAppointments();

    return () => {
      abortController.abort();
    };
  }, [viewMode, calendarView, currentDate, listFilter, statusFilter]);

  // Refetch appointments (for use after actions)
  const refetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (viewMode === "calendar") {
        let rangeStart: Date;
        let rangeEnd: Date;

        if (calendarView === "month") {
          rangeStart = startOfWeek(startOfMonth(currentDate));
          rangeEnd = endOfWeek(endOfMonth(currentDate));
        } else if (calendarView === "week") {
          rangeStart = startOfWeek(currentDate);
          rangeEnd = endOfWeek(currentDate);
        } else {
          rangeStart = currentDate;
          rangeEnd = addDays(currentDate, 1);
        }

        params.set("from", rangeStart.toISOString());
        params.set("to", rangeEnd.toISOString());
      } else {
        if (listFilter === "upcoming") params.set("upcoming", "true");
        if (listFilter === "past") params.set("past", "true");
      }

      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/dashboard/appointments?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAppointments(data.appointments || []);
      }
    } catch (_error) {
      // Silent catch - error already shown via action toast
    } finally {
      setLoading(false);
    }
  }, [viewMode, calendarView, currentDate, listFilter, statusFilter]);

  // Handle appointment actions
  const handleAction = async (action: "cancel" | "complete" | "no_show") => {
    if (!selectedAppointment) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/dashboard/appointments/${selectedAppointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        await refetchAppointments();
        setSheetOpen(false);
        setSelectedAppointment(null);

        const messages = {
          cancel: "Appointment cancelled",
          complete: "Appointment marked as complete",
          no_show: "Appointment marked as no-show",
        };
        toast({
          title: messages[action],
          variant: action === "complete" ? "success" : "default",
        });
      } else {
        toast({
          title: "Action failed",
          description: "Please try again.",
          variant: "destructive",
        });
      }
    } catch (_error) {
      toast({
        title: "Something went wrong",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle reschedule action
  const openRescheduleDialog = () => {
    if (!selectedAppointment) return;
    // Pre-populate with current date/time
    const scheduledDate = parseISO(selectedAppointment.scheduled_at || "");
    setRescheduleDate(format(scheduledDate, "yyyy-MM-dd"));
    setRescheduleTime(format(scheduledDate, "HH:mm"));
    setRescheduleOpen(true);
  };

  const handleReschedule = async () => {
    if (!selectedAppointment || !rescheduleDate || !rescheduleTime) return;

    setActionLoading(true);
    try {
      // Combine date and time into ISO string using business timezone
      const newScheduledAt = toUTCInBusinessTimezone(rescheduleDate, rescheduleTime);

      const res = await fetch(`/api/dashboard/appointments/${selectedAppointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reschedule",
          scheduled_at: newScheduledAt,
        }),
      });

      if (res.ok) {
        await refetchAppointments();
        setRescheduleOpen(false);
        setSheetOpen(false);
        setSelectedAppointment(null);
        toast({
          title: "Appointment rescheduled",
          description: `New time: ${format(new Date(newScheduledAt), "EEEE, MMM d 'at' h:mm a")}`,
          variant: "success",
        });
      } else {
        const data = await res.json();
        toast({
          title: data.error || "Reschedule failed",
          description: data.message || "Please try a different time.",
          variant: "destructive",
        });
      }
    } catch (_error) {
      toast({
        title: "Something went wrong",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Reset add appointment form
  const resetAddAppointmentForm = () => {
    setNewAppointment({
      service_id: "",
      customer_name: "",
      customer_phone: "",
      customer_email: "",
      scheduled_date: "",
      scheduled_time: "",
      notes: "",
    });
  };

  /**
   * Convert a local date and time to UTC ISO string in the business's timezone
   * This ensures appointments are stored correctly regardless of the user's browser timezone
   */
  const toUTCInBusinessTimezone = (date: string, time: string): string => {
    // Parse the date and time in the business's timezone
    const dt = DateTime.fromFormat(`${date} ${time}`, "yyyy-MM-dd HH:mm", {
      zone: timezone || "America/New_York",
    });
    // Return as UTC ISO string for storage
    return dt.toUTC().toISO() || new Date(`${date}T${time}:00`).toISOString();
  };

  // Handle add appointment
  const handleAddAppointment = async () => {
    // Validate required fields
    if (!newAppointment.service_id) {
      toast({
        title: "Service required",
        description: "Please select a service.",
        variant: "destructive",
      });
      return;
    }
    if (!newAppointment.customer_name.trim()) {
      toast({
        title: "Customer name required",
        description: "Please enter the customer's name.",
        variant: "destructive",
      });
      return;
    }
    if (!newAppointment.customer_phone.trim()) {
      toast({
        title: "Phone number required",
        description: "Please enter the customer's phone number.",
        variant: "destructive",
      });
      return;
    }
    if (!newAppointment.scheduled_date || !newAppointment.scheduled_time) {
      toast({
        title: "Date and time required",
        description: "Please select a date and time for the appointment.",
        variant: "destructive",
      });
      return;
    }

    // Get selected service details
    const selectedService = services.find((s) => s.id === newAppointment.service_id);
    if (!selectedService) {
      toast({
        title: "Invalid service",
        description: "Please select a valid service.",
        variant: "destructive",
      });
      return;
    }

    setAddAppointmentLoading(true);
    try {
      // Combine date and time into ISO string using business timezone
      const scheduledAt = toUTCInBusinessTimezone(
        newAppointment.scheduled_date,
        newAppointment.scheduled_time
      );

      const res = await fetch("/api/dashboard/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: newAppointment.service_id,
          service_name: selectedService.name,
          customer_name: newAppointment.customer_name.trim(),
          customer_phone: newAppointment.customer_phone.trim(),
          customer_email: newAppointment.customer_email.trim() || null,
          scheduled_at: scheduledAt,
          duration_minutes: selectedService.duration_minutes,
          notes: newAppointment.notes.trim() || null,
        }),
      });

      if (res.ok) {
        await refetchAppointments();
        setAddAppointmentOpen(false);
        resetAddAppointmentForm();
        toast({
          title: "Appointment created",
          description: `Appointment scheduled for ${format(new Date(scheduledAt), "EEEE, MMM d 'at' h:mm a")}`,
          variant: "success",
        });
      } else {
        const data = await res.json();
        toast({
          title: data.error || "Failed to create appointment",
          description: data.message || "Please try again.",
          variant: "destructive",
        });
      }
    } catch (_error) {
      toast({
        title: "Something went wrong",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setAddAppointmentLoading(false);
    }
  };

  // Calendar navigation
  const navigateCalendar = (direction: "prev" | "next") => {
    if (calendarView === "month") {
      setCurrentDate(direction === "prev" ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
    } else if (calendarView === "week") {
      setCurrentDate(direction === "prev" ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
    } else {
      setCurrentDate(direction === "prev" ? addDays(currentDate, -1) : addDays(currentDate, 1));
    }
  };

  // Get appointments for a specific day
  const getAppointmentsForDay = (date: Date) => {
    return appointments.filter((apt) => {
      if (!apt.scheduled_at) return false;
      return isSameDay(parseISO(apt.scheduled_at), date);
    });
  };

  // Status badge styling
  const getStatusBadge = (status: AppointmentStatus) => {
    const styles: Record<AppointmentStatus, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      confirmed: { variant: "default", label: "Confirmed" },
      cancelled: { variant: "destructive", label: "Cancelled" },
      completed: { variant: "secondary", label: "Completed" },
      no_show: { variant: "outline", label: "No Show" },
    };
    return styles[status] || { variant: "outline", label: status };
  };

  // Render calendar skeleton loading state
  const renderCalendarSkeleton = () => {
    if (calendarView === "month") {
      return (
        <div className="grid grid-cols-7 gap-1">
          {/* Day headers */}
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
              {d}
            </div>
          ))}
          {/* Skeleton cells */}
          {Array.from({ length: 35 }, (_, i) => (
            <Skeleton key={i} className="min-h-[100px] rounded-md" />
          ))}
        </div>
      );
    }
    if (calendarView === "week") {
      return (
        <div className="min-w-[700px]">
          <div className="grid grid-cols-8 border-b">
            <div className="p-2"></div>
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} className="h-14 m-1" />
            ))}
          </div>
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="grid grid-cols-8 border-b min-h-[60px]">
              <Skeleton className="h-4 w-12 m-2" />
              {Array.from({ length: 7 }, (_, j) => (
                <div key={j} className="border-l p-1">
                  {Math.random() > 0.8 && <Skeleton className="h-10 w-full" />}
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    }
    // Day view skeleton
    return (
      <div className="min-w-[300px]">
        <Skeleton className="h-24 w-full mb-2" />
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex border-b min-h-[80px]">
            <Skeleton className="w-20 h-6 m-2" />
            <div className="flex-1 p-2">
              {Math.random() > 0.7 && <Skeleton className="h-16 w-full" />}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render calendar month view
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days = [];
    let day = startDate;

    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }

    return (
      <div className="grid grid-cols-7 gap-1">
        {/* Day headers */}
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
            {d}
          </div>
        ))}
        {/* Day cells */}
        {days.map((d, i) => {
          const dayAppointments = getAppointmentsForDay(d);
          const isCurrentMonth = isSameMonth(d, currentDate);
          const isToday = isSameDay(d, new Date());

          return (
            <div
              key={i}
              className={`min-h-[100px] border rounded-md p-1 ${
                isCurrentMonth ? "bg-background" : "bg-muted/30"
              } ${isToday ? "border-primary" : "border-border"}`}
            >
              <div className={`text-xs font-medium mb-1 ${isToday ? "text-primary" : ""}`}>
                {format(d, "d")}
              </div>
              <div className="space-y-1">
                {dayAppointments.slice(0, 3).map((apt) => (
                  <button
                    key={apt.id}
                    onClick={() => {
                      setSelectedAppointment(apt);
                      setSheetOpen(true);
                    }}
                    className="w-full text-left text-xs p-1 rounded bg-primary/10 hover:bg-primary/20 truncate"
                  >
                    {apt.scheduled_at && format(parseISO(apt.scheduled_at), "h:mm a")} -{" "}
                    {apt.customer_name || "Unknown"}
                  </button>
                ))}
                {dayAppointments.length > 3 && (
                  <div className="text-xs text-muted-foreground text-center">
                    +{dayAppointments.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render calendar week view with duration spanning
  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate);
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const hours = Array.from({ length: 12 }, (_, i) => i + 8); // 8 AM to 7 PM
    const HOUR_HEIGHT = 60; // Height of each hour slot in pixels

    // Get appointments for a day that start in the given hour
    const getAppointmentsStartingAt = (date: Date, hour: number) => {
      return getAppointmentsForDay(date).filter((apt) => {
        if (!apt.scheduled_at) return false;
        return parseISO(apt.scheduled_at).getHours() === hour;
      });
    };

    // Calculate height based on duration (in pixels)
    const getAppointmentHeight = (durationMinutes: number | null) => {
      const duration = durationMinutes || 60;
      return Math.max((duration / 60) * HOUR_HEIGHT - 4, 24); // Min 24px, subtract padding
    };

    return (
      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Day headers */}
          <div className="grid grid-cols-8 border-b">
            <div className="p-2"></div>
            {days.map((d, i) => (
              <div
                key={i}
                className={`p-2 text-center border-l ${
                  isSameDay(d, new Date()) ? "bg-primary/10" : ""
                }`}
              >
                <div className="text-xs text-muted-foreground">{format(d, "EEE")}</div>
                <div className={`text-lg font-medium ${isSameDay(d, new Date()) ? "text-primary" : ""}`}>
                  {format(d, "d")}
                </div>
              </div>
            ))}
          </div>
          {/* Time slots */}
          {hours.map((hour) => (
            <div key={hour} className="grid grid-cols-8 border-b" style={{ height: HOUR_HEIGHT }}>
              <div className="p-2 text-xs text-muted-foreground text-right pr-4">
                {format(new Date().setHours(hour, 0), "h a")}
              </div>
              {days.map((d, i) => {
                const hourAppointments = getAppointmentsStartingAt(d, hour);

                return (
                  <div key={i} className="border-l p-1 relative">
                    {hourAppointments.map((apt, aptIndex) => {
                      const height = getAppointmentHeight(apt.duration_minutes);
                      const startMinute = apt.scheduled_at ? parseISO(apt.scheduled_at).getMinutes() : 0;
                      const topOffset = (startMinute / 60) * HOUR_HEIGHT;

                      return (
                        <button
                          key={apt.id}
                          onClick={() => {
                            setSelectedAppointment(apt);
                            setSheetOpen(true);
                          }}
                          className="absolute left-1 right-1 text-left text-xs p-1.5 rounded bg-primary/20 hover:bg-primary/30 border border-primary/30 overflow-hidden z-10"
                          style={{
                            top: topOffset + 2,
                            height: height,
                            // Stack overlapping appointments
                            marginLeft: aptIndex * 4,
                          }}
                        >
                          <div className="font-medium truncate">{apt.customer_name}</div>
                          <div className="text-muted-foreground truncate text-[10px]">
                            {apt.service_name} • {apt.duration_minutes}m
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render calendar day view
  const renderDayView = () => {
    const hours = Array.from({ length: 12 }, (_, i) => i + 8); // 8 AM to 7 PM
    const dayAppointments = getAppointmentsForDay(currentDate);

    return (
      <div className="min-w-[300px]">
        {/* Day header */}
        <div className={`p-4 text-center border-b ${isSameDay(currentDate, new Date()) ? "bg-primary/10" : ""}`}>
          <div className="text-sm text-muted-foreground">{format(currentDate, "EEEE")}</div>
          <div className={`text-2xl font-medium ${isSameDay(currentDate, new Date()) ? "text-primary" : ""}`}>
            {format(currentDate, "MMMM d, yyyy")}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {dayAppointments.length} appointment{dayAppointments.length !== 1 ? "s" : ""}
          </div>
        </div>
        {/* Time slots */}
        {hours.map((hour) => {
          const hourAppointments = dayAppointments.filter((apt) => {
            if (!apt.scheduled_at) return false;
            return parseISO(apt.scheduled_at).getHours() === hour;
          });

          return (
            <div key={hour} className="flex border-b min-h-[80px]">
              <div className="w-20 p-3 text-sm text-muted-foreground text-right border-r shrink-0">
                {format(new Date().setHours(hour, 0), "h:mm a")}
              </div>
              <div className="flex-1 p-2 space-y-1">
                {hourAppointments.map((apt) => {
                  const statusBadge = getStatusBadge(apt.status);
                  return (
                    <button
                      key={apt.id}
                      onClick={() => {
                        setSelectedAppointment(apt);
                        setSheetOpen(true);
                      }}
                      className="w-full text-left p-3 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{apt.customer_name || "Unknown"}</span>
                        <Badge variant={statusBadge.variant} className="text-xs">
                          {statusBadge.label}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {apt.service_name} • {apt.duration_minutes} min
                      </div>
                      {apt.customer_phone && (
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {apt.customer_phone}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {dayAppointments.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No appointments scheduled for this day</p>
          </div>
        )}
      </div>
    );
  };

  // Render list view
  const renderListView = () => {
    // Note: Status filtering is already done in the API call
    // No need for additional client-side filtering
    
    if (loading) {
      return (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      );
    }

    if (appointments.length === 0) {
      return (
        <Card>
          <CardContent className="p-0">
            <EmptyStateAppointments />
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-3">
        {appointments.map((apt) => {
          const statusBadge = getStatusBadge(apt.status);
          return (
            <Card
              key={apt.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => {
                setSelectedAppointment(apt);
                setSheetOpen(true);
              }}
            >
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{apt.customer_name || "Unknown Customer"}</span>
                      <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {apt.scheduled_at
                          ? format(parseISO(apt.scheduled_at), "MMM d, yyyy 'at' h:mm a")
                          : "Not scheduled"}
                      </div>
                      {apt.duration_minutes && (
                        <span>({apt.duration_minutes} min)</span>
                      )}
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Service: </span>
                      <span>{apt.service_name || "Not specified"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {apt.call_id ? (
                      <Badge variant="outline" className="text-xs">
                        <Bot className="w-3 h-3 mr-1" />
                        Koya
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        <UserPlus className="w-3 h-3 mr-1" />
                        Manual
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ExportButton
            exportUrl="/api/dashboard/appointments/export"
            label="Appointments"
          />
          <Button
            variant="default"
            size="sm"
            onClick={() => setAddAppointmentOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            {t("addAppointment")}
          </Button>
          <Button
            variant={viewMode === "calendar" ? "secondary" : "outline"}
            size="sm"
            onClick={() => setViewMode("calendar")}
          >
            <Calendar className="w-4 h-4 mr-2" />
            {t("calendar")}
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            <List className="w-4 h-4 mr-2" />
            {t("list")}
          </Button>
        </div>
      </div>

      {/* Calendar View Controls */}
      {viewMode === "calendar" && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => navigateCalendar("prev")}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => navigateCalendar("next")}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                <h2 className="text-lg font-medium">
                  {calendarView === "month" && format(currentDate, "MMMM yyyy")}
                  {calendarView === "week" &&
                    `${format(startOfWeek(currentDate), "MMM d")} - ${format(endOfWeek(currentDate), "MMM d, yyyy")}`}
                  {calendarView === "day" && format(currentDate, "EEEE, MMMM d, yyyy")}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDate(new Date())}
                >
                  {t("today")}
                </Button>
                <Select
                  value={calendarView}
                  onValueChange={(v) => setCalendarView(v as CalendarView)}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">{t("month")}</SelectItem>
                    <SelectItem value="week">{t("week")}</SelectItem>
                    <SelectItem value="day">{t("day")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              renderCalendarSkeleton()
            ) : (
              <>
                {calendarView === "month" && renderMonthView()}
                {calendarView === "week" && renderWeekView()}
                {calendarView === "day" && renderDayView()}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* List View Controls */}
      {viewMode === "list" && (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <Select value={listFilter} onValueChange={(v) => setListFilter(v as ListFilter)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={tCommon("filter")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allAppointments")}</SelectItem>
                <SelectItem value="upcoming">{t("upcoming")}</SelectItem>
                <SelectItem value="past">{t("past")}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as AppointmentStatus | "all")}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={tCommon("status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allStatuses")}</SelectItem>
                <SelectItem value="confirmed">{t("confirmed")}</SelectItem>
                <SelectItem value="completed">{t("completed")}</SelectItem>
                <SelectItem value="cancelled">{t("cancelled")}</SelectItem>
                <SelectItem value="no_show">{t("noShow")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {renderListView()}
        </>
      )}

      {/* Appointment Details Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t("appointmentDetails")}</SheetTitle>
          </SheetHeader>

          {selectedAppointment && (
            <div className="mt-6 space-y-6">
              {/* Status */}
              <div>
                <Badge variant={getStatusBadge(selectedAppointment.status).variant} className="text-sm">
                  {getStatusBadge(selectedAppointment.status).label}
                </Badge>
              </div>

              {/* Customer Info - Line 711 */}
              <div className="space-y-3">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Customer Information
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedAppointment.customer_name || "Unknown"}</span>
                  </div>
                  {selectedAppointment.customer_phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <a
                        href={`tel:${selectedAppointment.customer_phone}`}
                        className="text-primary hover:underline"
                      >
                        {selectedAppointment.customer_phone}
                      </a>
                    </div>
                  )}
                  {selectedAppointment.customer_email && (
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <a
                        href={`mailto:${selectedAppointment.customer_email}`}
                        className="text-primary hover:underline"
                      >
                        {selectedAppointment.customer_email}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Service - Line 712 */}
              <div className="space-y-2">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Service
                </h3>
                <p>{selectedAppointment.service_name || "Not specified"}</p>
              </div>

              {/* Date/Time - Line 713 */}
              <div className="space-y-2">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Date & Time
                </h3>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span>
                    {selectedAppointment.scheduled_at
                      ? format(parseISO(selectedAppointment.scheduled_at), "EEEE, MMMM d, yyyy 'at' h:mm a")
                      : "Not scheduled"}
                  </span>
                </div>
                {selectedAppointment.duration_minutes && (
                  <p className="text-sm text-muted-foreground">
                    Duration: {selectedAppointment.duration_minutes} minutes
                  </p>
                )}
              </div>

              {/* How Booked - Line 714 */}
              <div className="space-y-2">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Booked By
                </h3>
                <Badge variant="outline">
                  {selectedAppointment.call_id ? (
                    <>
                      <Bot className="w-3 h-3 mr-1" />
                      Koya (AI)
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3 h-3 mr-1" />
                      Manual
                    </>
                  )}
                </Badge>
              </div>

              {/* Notes - Line 715 */}
              {selectedAppointment.notes && (
                <div className="space-y-2">
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                    Notes
                  </h3>
                  <p className="text-sm bg-muted/50 p-3 rounded-md">{selectedAppointment.notes}</p>
                </div>
              )}

              {/* Actions - Line 716 */}
              {selectedAppointment.status === "confirmed" && (
                <div className="space-y-3 pt-4 border-t">
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                    Actions
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAction("complete")}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 mr-2" />
                      )}
                      Mark Complete
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAction("no_show")}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <AlertCircle className="w-4 h-4 mr-2" />
                      )}
                      No Show
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleAction("cancel")}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4 mr-2" />
                      )}
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Reschedule button */}
              {selectedAppointment.status === "confirmed" && (
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={openRescheduleDialog}
                    disabled={actionLoading}
                  >
                    <CalendarClock className="w-4 h-4 mr-2" />
                    Reschedule
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Reschedule Dialog */}
      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule Appointment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reschedule-date">New Date</Label>
              <Input
                id="reschedule-date"
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reschedule-time">New Time</Label>
              <Input
                id="reschedule-time"
                type="time"
                value={rescheduleTime}
                onChange={(e) => setRescheduleTime(e.target.value)}
              />
            </div>
            {selectedAppointment && (
              <p className="text-sm text-muted-foreground">
                Current: {format(parseISO(selectedAppointment.scheduled_at || ""), "EEEE, MMM d 'at' h:mm a")}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReschedule}
              disabled={actionLoading || !rescheduleDate || !rescheduleTime}
            >
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm Reschedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Appointment Dialog */}
      <Dialog
        open={addAppointmentOpen}
        onOpenChange={(open) => {
          setAddAppointmentOpen(open);
          if (!open) resetAddAppointmentForm();
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t("addAppointment")}</DialogTitle>
            <DialogDescription>
              {t("addAppointmentDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {/* Service Selector */}
            <div className="space-y-2">
              <Label htmlFor="add-service">{t("service")} *</Label>
              <Select
                value={newAppointment.service_id}
                onValueChange={(value) =>
                  setNewAppointment((prev) => ({ ...prev, service_id: value }))
                }
              >
                <SelectTrigger id="add-service">
                  <SelectValue placeholder={t("selectService")} />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name} ({service.duration_minutes} min)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {services.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t("noServicesConfigured")}
                </p>
              )}
            </div>

            {/* Customer Name */}
            <div className="space-y-2">
              <Label htmlFor="add-customer-name">{t("customerName")} *</Label>
              <Input
                id="add-customer-name"
                type="text"
                placeholder={t("enterCustomerName")}
                value={newAppointment.customer_name}
                onChange={(e) =>
                  setNewAppointment((prev) => ({ ...prev, customer_name: e.target.value }))
                }
              />
            </div>

            {/* Customer Phone */}
            <div className="space-y-2">
              <Label htmlFor="add-customer-phone">{t("customerPhone")} *</Label>
              <Input
                id="add-customer-phone"
                type="tel"
                placeholder={t("enterCustomerPhone")}
                value={newAppointment.customer_phone}
                onChange={(e) =>
                  setNewAppointment((prev) => ({ ...prev, customer_phone: e.target.value }))
                }
              />
            </div>

            {/* Customer Email (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="add-customer-email">{t("customerEmail")}</Label>
              <Input
                id="add-customer-email"
                type="email"
                placeholder={t("enterCustomerEmail")}
                value={newAppointment.customer_email}
                onChange={(e) =>
                  setNewAppointment((prev) => ({ ...prev, customer_email: e.target.value }))
                }
              />
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="add-date">{t("date")} *</Label>
              <Input
                id="add-date"
                type="date"
                value={newAppointment.scheduled_date}
                onChange={(e) =>
                  setNewAppointment((prev) => ({ ...prev, scheduled_date: e.target.value }))
                }
                min={format(new Date(), "yyyy-MM-dd")}
              />
            </div>

            {/* Time */}
            <div className="space-y-2">
              <Label htmlFor="add-time">{t("time")} *</Label>
              <Input
                id="add-time"
                type="time"
                value={newAppointment.scheduled_time}
                onChange={(e) =>
                  setNewAppointment((prev) => ({ ...prev, scheduled_time: e.target.value }))
                }
              />
            </div>

            {/* Notes (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="add-notes">{t("notes")}</Label>
              <Textarea
                id="add-notes"
                placeholder={t("enterNotes")}
                value={newAppointment.notes}
                onChange={(e) =>
                  setNewAppointment((prev) => ({ ...prev, notes: e.target.value }))
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddAppointmentOpen(false);
                resetAddAppointmentForm();
              }}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={handleAddAppointment}
              disabled={
                addAppointmentLoading ||
                !newAppointment.service_id ||
                !newAppointment.customer_name ||
                !newAppointment.customer_phone ||
                !newAppointment.scheduled_date ||
                !newAppointment.scheduled_time
              }
            >
              {addAppointmentLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("createAppointment")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
