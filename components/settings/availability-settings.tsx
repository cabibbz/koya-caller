"use client";

/**
 * Availability Settings Component
 * Business hours configuration with weekly hours grid
 */

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Clock,
  Loader2,
  Save,
  RotateCcw,
} from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Label,
  Switch,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Alert,
  AlertDescription,
} from "@/components/ui";
import { toast } from "@/hooks/use-toast";
import type { BusinessHours } from "@/types";

// ============================================
// Types
// ============================================

interface DayHours {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

const DAYS_OF_WEEK = [
  { value: 0, labelKey: "sunday", short: "Sun" },
  { value: 1, labelKey: "monday", short: "Mon" },
  { value: 2, labelKey: "tuesday", short: "Tue" },
  { value: 3, labelKey: "wednesday", short: "Wed" },
  { value: 4, labelKey: "thursday", short: "Thu" },
  { value: 5, labelKey: "friday", short: "Fri" },
  { value: 6, labelKey: "saturday", short: "Sat" },
];

// Generate time options in 30-minute increments
const generateTimeOptions = () => {
  const options: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const h = hour.toString().padStart(2, "0");
      const m = minute.toString().padStart(2, "0");
      options.push(`${h}:${m}`);
    }
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

const DEFAULT_HOURS: DayHours[] = [
  { day_of_week: 0, is_closed: true, open_time: null, close_time: null },
  { day_of_week: 1, open_time: "09:00", close_time: "17:00", is_closed: false },
  { day_of_week: 2, open_time: "09:00", close_time: "17:00", is_closed: false },
  { day_of_week: 3, open_time: "09:00", close_time: "17:00", is_closed: false },
  { day_of_week: 4, open_time: "09:00", close_time: "17:00", is_closed: false },
  { day_of_week: 5, open_time: "09:00", close_time: "17:00", is_closed: false },
  { day_of_week: 6, is_closed: true, open_time: null, close_time: null },
];

// ============================================
// Helper Functions
// ============================================

const formatTime = (time: string | null) => {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

// ============================================
// Component
// ============================================

export function AvailabilitySettings() {
  const t = useTranslations("settings.availability");
  const tCommon = useTranslations("common");
  const [hours, setHours] = useState<DayHours[]>(DEFAULT_HOURS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalHours, setOriginalHours] = useState<DayHours[]>(DEFAULT_HOURS);

  // ============================================
  // Data Fetching
  // ============================================

  const fetchHours = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/dashboard/settings/availability");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch business hours");
      }

      if (data.data && data.data.length > 0) {
        // Sort by day_of_week and map to DayHours
        const sortedHours = [...data.data].sort(
          (a: BusinessHours, b: BusinessHours) => a.day_of_week - b.day_of_week
        );
        const mappedHours: DayHours[] = sortedHours.map((h: BusinessHours) => ({
          day_of_week: h.day_of_week,
          open_time: h.open_time,
          close_time: h.close_time,
          is_closed: h.is_closed,
        }));
        setHours(mappedHours);
        setOriginalHours(mappedHours);
      } else {
        // Use defaults if no hours set
        setHours(DEFAULT_HOURS);
        setOriginalHours(DEFAULT_HOURS);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load business hours",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHours();
  }, []);

  // Track changes
  useEffect(() => {
    const changed = JSON.stringify(hours) !== JSON.stringify(originalHours);
    setHasChanges(changed);
  }, [hours, originalHours]);

  // ============================================
  // Actions
  // ============================================

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/dashboard/settings/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save business hours");
      }

      setOriginalHours(hours);
      setHasChanges(false);

      toast({
        title: tCommon("save"),
        description: t("saved"),
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save business hours",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setHours(originalHours);
    setHasChanges(false);
  };

  const updateDay = (dayOfWeek: number, updates: Partial<DayHours>) => {
    setHours((prev) =>
      prev.map((day) =>
        day.day_of_week === dayOfWeek ? { ...day, ...updates } : day
      )
    );
  };

  const toggleDayClosed = (dayOfWeek: number, isClosed: boolean) => {
    updateDay(dayOfWeek, {
      is_closed: isClosed,
      open_time: isClosed ? null : "09:00",
      close_time: isClosed ? null : "17:00",
    });
  };

  const copyToAllWeekdays = (dayOfWeek: number) => {
    const sourceDay = hours.find((d) => d.day_of_week === dayOfWeek);
    if (!sourceDay) return;

    setHours((prev) =>
      prev.map((day) => {
        // Apply to Monday-Friday only (1-5)
        if (day.day_of_week >= 1 && day.day_of_week <= 5) {
          return {
            ...day,
            open_time: sourceDay.open_time,
            close_time: sourceDay.close_time,
            is_closed: sourceDay.is_closed,
          };
        }
        return day;
      })
    );

    toast({
      title: tCommon("save"),
      description: t("hoursCopied"),
    });
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
                <Clock className="h-5 w-5" />
                {t("title")}
              </CardTitle>
              <CardDescription>
                {t("description")}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {hasChanges && (
                <Button variant="outline" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {t("reset")}
                </Button>
              )}
              <Button onClick={handleSave} disabled={saving || !hasChanges}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {t("saveChanges")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <Clock className="h-4 w-4" />
            <AlertDescription>
              {t("hoursDescription")}
            </AlertDescription>
          </Alert>

          {/* Hours Grid */}
          <div className="space-y-4">
            {DAYS_OF_WEEK.map((dayInfo) => {
              const day = hours.find((h) => h.day_of_week === dayInfo.value);
              if (!day) return null;

              return (
                <div
                  key={dayInfo.value}
                  className="flex items-center gap-4 p-4 border rounded-lg"
                >
                  {/* Day Name */}
                  <div className="w-28 font-medium">{t(dayInfo.labelKey)}</div>

                  {/* Open/Closed Toggle */}
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!day.is_closed}
                      onCheckedChange={(checked) =>
                        toggleDayClosed(day.day_of_week, !checked)
                      }
                    />
                    <Label className="text-sm">
                      {day.is_closed ? t("closed") : t("open")}
                    </Label>
                  </div>

                  {/* Time Selectors */}
                  {!day.is_closed && (
                    <div className="flex items-center gap-2 flex-1">
                      <Select
                        value={day.open_time || "09:00"}
                        onValueChange={(value) =>
                          updateDay(day.day_of_week, { open_time: value })
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Open" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.map((time) => (
                            <SelectItem key={time} value={time}>
                              {formatTime(time)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <span className="text-muted-foreground">{t("to")}</span>

                      <Select
                        value={day.close_time || "17:00"}
                        onValueChange={(value) =>
                          updateDay(day.day_of_week, { close_time: value })
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Close" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.filter(
                            (time) => time > (day.open_time || "00:00")
                          ).map((time) => (
                            <SelectItem key={time} value={time}>
                              {formatTime(time)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Copy to weekdays button (only for weekdays) */}
                      {dayInfo.value >= 1 && dayInfo.value <= 5 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-2 text-xs"
                          onClick={() => copyToAllWeekdays(day.day_of_week)}
                        >
                          {t("copyToWeekdays")}
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Closed indicator */}
                  {day.is_closed && (
                    <div className="flex-1 text-muted-foreground text-sm">
                      {t("notTakingAppointments")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
