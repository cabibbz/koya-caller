"use client";

/**
 * Calendar Component
 * Simple calendar component built with native HTML and date-fns
 */

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isWithinInterval,
  isBefore,
  isAfter,
} from "date-fns";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface CalendarProps {
  mode?: "single" | "range";
  selected?: Date | DateRange;
  onSelect?: (date: Date | DateRange | undefined) => void;
  disabled?: (date: Date) => boolean;
  className?: string;
  numberOfMonths?: number;
}

export function Calendar({
  mode = "single",
  selected,
  onSelect,
  disabled,
  className,
  numberOfMonths = 1,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(
    mode === "range" && (selected as DateRange)?.from
      ? (selected as DateRange).from!
      : selected instanceof Date
        ? selected
        : new Date()
  );
  const [rangeStart, setRangeStart] = React.useState<Date | undefined>(
    mode === "range" ? (selected as DateRange)?.from : undefined
  );
  const [hoverDate, setHoverDate] = React.useState<Date | undefined>();

  const handleDateClick = (date: Date) => {
    if (disabled?.(date)) return;

    if (mode === "single") {
      onSelect?.(date);
    } else {
      // Range mode
      if (!rangeStart) {
        setRangeStart(date);
        onSelect?.({ from: date, to: undefined });
      } else {
        if (isBefore(date, rangeStart)) {
          onSelect?.({ from: date, to: rangeStart });
        } else {
          onSelect?.({ from: rangeStart, to: date });
        }
        setRangeStart(undefined);
      }
    }
  };

  const renderMonth = (monthDate: Date, monthIndex: number) => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    const days: Date[] = [];
    let day = calendarStart;
    while (day <= calendarEnd) {
      days.push(day);
      day = addDays(day, 1);
    }

    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    const isSelected = (date: Date) => {
      if (mode === "single" && selected instanceof Date) {
        return isSameDay(date, selected);
      }
      if (mode === "range" && selected && typeof selected === "object") {
        const range = selected as DateRange;
        if (range.from && isSameDay(date, range.from)) return true;
        if (range.to && isSameDay(date, range.to)) return true;
      }
      return false;
    };

    const isInRange = (date: Date) => {
      if (mode !== "range") return false;
      const range = selected as DateRange;

      // If we have a complete range
      if (range?.from && range?.to) {
        return isWithinInterval(date, { start: range.from, end: range.to });
      }

      // If we're selecting and hovering
      if (rangeStart && hoverDate) {
        const start = isBefore(rangeStart, hoverDate) ? rangeStart : hoverDate;
        const end = isAfter(rangeStart, hoverDate) ? rangeStart : hoverDate;
        return isWithinInterval(date, { start, end });
      }

      return false;
    };

    const isRangeStart = (date: Date) => {
      if (mode !== "range") return false;
      const range = selected as DateRange;
      return range?.from && isSameDay(date, range.from);
    };

    const isRangeEnd = (date: Date) => {
      if (mode !== "range") return false;
      const range = selected as DateRange;
      return range?.to && isSameDay(date, range.to);
    };

    return (
      <div key={monthIndex} className="p-3">
        <div className="flex items-center justify-between mb-4">
          {monthIndex === 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          {monthIndex !== 0 && <div className="w-7" />}
          <span className="text-sm font-medium">
            {format(monthDate, "MMMM yyyy")}
          </span>
          {monthIndex === numberOfMonths - 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          {monthIndex !== numberOfMonths - 1 && <div className="w-7" />}
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <th
                  key={day}
                  className="text-muted-foreground text-xs font-medium h-8 w-8 text-center"
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, weekIndex) => (
              <tr key={weekIndex}>
                {week.map((date, dayIndex) => {
                  const isCurrentMonth = isSameMonth(date, monthDate);
                  const isDisabled = disabled?.(date) ?? false;
                  const selected = isSelected(date);
                  const inRange = isInRange(date);
                  const rangeStartDay = isRangeStart(date);
                  const rangeEndDay = isRangeEnd(date);

                  return (
                    <td key={dayIndex} className="p-0 text-center">
                      <button
                        type="button"
                        disabled={isDisabled}
                        onClick={() => handleDateClick(date)}
                        onMouseEnter={() => mode === "range" && rangeStart && setHoverDate(date)}
                        onMouseLeave={() => setHoverDate(undefined)}
                        className={cn(
                          "inline-flex items-center justify-center h-8 w-8 text-sm rounded-md transition-colors",
                          !isCurrentMonth && "text-muted-foreground opacity-50",
                          isCurrentMonth && !selected && !inRange && "hover:bg-accent",
                          selected && "bg-primary text-primary-foreground hover:bg-primary",
                          inRange && !selected && "bg-accent",
                          rangeStartDay && "rounded-r-none",
                          rangeEndDay && "rounded-l-none",
                          inRange && !rangeStartDay && !rangeEndDay && "rounded-none",
                          isDisabled && "opacity-50 cursor-not-allowed hover:bg-transparent"
                        )}
                      >
                        {format(date, "d")}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const months: Date[] = [];
  for (let i = 0; i < numberOfMonths; i++) {
    months.push(addMonths(currentMonth, i));
  }

  return (
    <div className={cn("", className)}>
      <div className="flex">
        {months.map((month, index) => renderMonth(month, index))}
      </div>
    </div>
  );
}
