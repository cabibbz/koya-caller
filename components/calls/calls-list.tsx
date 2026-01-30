"use client";

/**
 * Calls List Component
 * Displays the list/table of calls with pagination
 */

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Phone,
  Flag,
  CalendarCheck,
  PhoneForwarded,
  Info,
  MessageSquare,
  PhoneMissed,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Call } from "@/types";
import { EmptyStateCalls } from "@/components/ui/empty-state";
import { useTranslations } from "next-intl";

export interface CallsListProps {
  calls: Call[];
  selectedCallId?: string;
  onSelectCall: (call: Call) => void;
  hasFilters: boolean;
}

export interface CallsPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
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

export function formatPhoneNumber(phone: string | null): string {
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

export function formatDuration(seconds: number | null): string {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function getOutcomeConfig(outcome: string | null) {
  const key = outcome || "info";
  return outcomeConfig[key as keyof typeof outcomeConfig] || outcomeConfig.info;
}

export function CallsList({
  calls,
  selectedCallId,
  onSelectCall,
  hasFilters,
}: CallsListProps) {
  const t = useTranslations("calls");

  if (calls.length === 0) {
    if (hasFilters) {
      return (
        <Card>
          <CardContent className="p-0">
            <div className="text-center py-12">
              <Phone className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium">{t("noCallsFound")}</h3>
              <p className="text-muted-foreground mt-1">{t("adjustFilters")}</p>
            </div>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyStateCalls />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {calls.map((call) => {
            const config = getOutcomeConfig(call.outcome);
            const Icon = config.icon;
            const isFlagged = call.flagged;

            return (
              <button
                key={call.id}
                onClick={() => onSelectCall(call)}
                className={cn(
                  "w-full flex items-center gap-4 p-4 text-left transition-colors hover:bg-muted/50",
                  selectedCallId === call.id && "bg-muted/50"
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
                        ES
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
                    {format(
                      new Date(call.started_at || call.created_at),
                      "MMM d, h:mm a"
                    )}
                  </div>
                </div>

                {/* Outcome badge */}
                <Badge
                  variant="secondary"
                  className={cn("shrink-0 hidden lg:flex", config.className)}
                >
                  {config.label}
                </Badge>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function CallsPagination({
  page,
  totalPages,
  onPageChange,
}: CallsPaginationProps) {
  const t = useTranslations("calls");
  const tCommon = useTranslations("common");

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        {t("page")} {page} {t("of")} {totalPages}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
          {tCommon("previous")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          {tCommon("next")}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
