"use client";

/**
 * DateRangePicker Component
 * Dashboard date range selector with preset options and custom date range
 *
 * Features:
 * - Preset options: Today, 7d, 30d, This Month, Custom
 * - Custom date range with calendar picker
 * - URL-shareable state support
 */

import * as React from "react";
import { format, subDays, startOfMonth, startOfDay, endOfDay } from "date-fns";
import { Calendar as CalendarIcon, ChevronDown, Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, type DateRange } from "@/components/ui/calendar";

export type DateRangePreset = "today" | "7d" | "30d" | "this_month" | "custom";

export interface DateRangeValue {
  preset: DateRangePreset;
  from: Date;
  to: Date;
}

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  className?: string;
}

const presets: { value: DateRangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "this_month", label: "This Month" },
  { value: "custom", label: "Custom" },
];

export function getDateRangeFromPreset(preset: DateRangePreset): { from: Date; to: Date } {
  const now = new Date();
  const today = startOfDay(now);
  const endOfToday = endOfDay(now);

  switch (preset) {
    case "today":
      return { from: today, to: endOfToday };
    case "7d":
      return { from: subDays(today, 6), to: endOfToday };
    case "30d":
      return { from: subDays(today, 29), to: endOfToday };
    case "this_month":
      return { from: startOfMonth(today), to: endOfToday };
    case "custom":
    default:
      return { from: subDays(today, 29), to: endOfToday };
  }
}

export function DateRangePicker({
  value,
  onChange,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [showCalendar, setShowCalendar] = React.useState(false);
  const [tempRange, setTempRange] = React.useState<DateRange>({
    from: value.from,
    to: value.to,
  });

  const handlePresetSelect = (preset: DateRangePreset) => {
    if (preset === "custom") {
      setShowCalendar(true);
      setTempRange({ from: value.from, to: value.to });
    } else {
      const range = getDateRangeFromPreset(preset);
      onChange({
        preset,
        from: range.from,
        to: range.to,
      });
      setOpen(false);
      setShowCalendar(false);
    }
  };

  const handleCalendarSelect = (range: Date | DateRange | undefined) => {
    // In range mode, the calendar returns DateRange
    if (range && typeof range === "object" && "from" in range) {
      setTempRange(range as DateRange);
    }
  };

  const handleApplyCustomRange = () => {
    if (tempRange.from && tempRange.to) {
      onChange({
        preset: "custom",
        from: tempRange.from,
        to: tempRange.to,
      });
      setOpen(false);
      setShowCalendar(false);
    }
  };

  const handleCancel = () => {
    setShowCalendar(false);
    setTempRange({ from: value.from, to: value.to });
  };

  const getDisplayText = () => {
    if (value.preset === "custom") {
      return `${format(value.from, "MMM d, yyyy")} - ${format(value.to, "MMM d, yyyy")}`;
    }
    const preset = presets.find((p) => p.value === value.preset);
    return preset?.label || "Select range";
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-between gap-2 font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="h-4 w-4 opacity-50" />
          <span>{getDisplayText()}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "p-0",
          showCalendar ? "w-auto" : "w-48"
        )}
        align="start"
      >
        {!showCalendar ? (
          <div className="flex flex-col py-1">
            {presets.map((preset) => (
              <button
                key={preset.value}
                onClick={() => handlePresetSelect(preset.value)}
                className={cn(
                  "flex items-center justify-between px-3 py-2 text-sm hover:bg-accent transition-colors",
                  value.preset === preset.value && "bg-accent"
                )}
              >
                <span>{preset.label}</span>
                {value.preset === preset.value && (
                  <Check className="h-4 w-4" />
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="p-3 border-b">
              <p className="text-sm font-medium">Select date range</p>
              <p className="text-xs text-muted-foreground mt-1">
                {tempRange.from && tempRange.to
                  ? `${format(tempRange.from, "MMM d, yyyy")} - ${format(tempRange.to, "MMM d, yyyy")}`
                  : tempRange.from
                    ? `${format(tempRange.from, "MMM d, yyyy")} - Select end date`
                    : "Select start date"
                }
              </p>
            </div>
            <Calendar
              mode="range"
              selected={tempRange}
              onSelect={handleCalendarSelect}
              numberOfMonths={2}
              disabled={(date) => date > new Date()}
            />
            <div className="flex justify-between gap-2 p-3 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleApplyCustomRange}
                disabled={!tempRange.from || !tempRange.to}
              >
                Apply
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Hook to manage date range state with URL params
 */
export function useDateRangeParams(searchParams: URLSearchParams) {
  const rangeParam = searchParams.get("range") as DateRangePreset | null;
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  // Default to 30d if no params
  const preset: DateRangePreset = rangeParam || "30d";
  let from: Date;
  let to: Date;

  if (preset === "custom" && fromParam && toParam) {
    from = new Date(fromParam);
    to = new Date(toParam);
  } else {
    const range = getDateRangeFromPreset(preset);
    from = range.from;
    to = range.to;
  }

  return { preset, from, to };
}

/**
 * Generate URL search params from date range value
 */
export function dateRangeToParams(value: DateRangeValue): URLSearchParams {
  const params = new URLSearchParams();
  params.set("range", value.preset);

  if (value.preset === "custom") {
    params.set("from", format(value.from, "yyyy-MM-dd"));
    params.set("to", format(value.to, "yyyy-MM-dd"));
  }

  return params;
}
