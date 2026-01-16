"use client";

/**
 * Recent Calls List
 * Session 16: Dashboard - Home & Calls
 * Spec Reference: Part 7, Line 675
 * 
 * Shows: Last 5-10 calls with key info
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { 
  Phone, 
  ArrowRight,
  CalendarCheck, 
  PhoneForwarded, 
  Info, 
  MessageSquare,
  PhoneMissed,
  Clock
} from "lucide-react";
import Link from "next/link";
import type { Call } from "@/types";

interface RecentCallsListProps {
  calls: Call[];
}

const outcomeConfig = {
  booked: {
    label: "Booked",
    icon: CalendarCheck,
    variant: "default" as const,
    className: "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20",
  },
  transferred: {
    label: "Transferred",
    icon: PhoneForwarded,
    variant: "secondary" as const,
    className: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20",
  },
  info: {
    label: "Info",
    icon: Info,
    variant: "secondary" as const,
    className: "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20",
  },
  message: {
    label: "Message",
    icon: MessageSquare,
    variant: "secondary" as const,
    className: "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20",
  },
  missed: {
    label: "Missed",
    icon: PhoneMissed,
    variant: "destructive" as const,
    className: "bg-red-500/10 text-red-500 hover:bg-red-500/20",
  },
  minutes_exhausted: {
    label: "Over Limit",
    icon: Clock,
    variant: "outline" as const,
    className: "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20",
  },
};

function formatPhoneNumber(phone: string | null): string {
  if (!phone) return "Unknown";
  // Format as (XXX) XXX-XXXX for US numbers
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    const match = cleaned.slice(1).match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
  }
  if (cleaned.length === 10) {
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
  }
  return phone;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function RecentCallsList({ calls }: RecentCallsListProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Recent Calls
        </CardTitle>
        <Link href="/calls">
          <Button variant="ghost" size="sm" className="gap-1 h-8">
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {calls.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Phone className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No calls yet</p>
            <p className="text-xs mt-1">Recent calls will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {calls.map((call) => {
              const outcome = call.outcome || "info";
              const config = outcomeConfig[outcome as keyof typeof outcomeConfig] || outcomeConfig.info;
              const Icon = config.icon;

              return (
                <Link
                  key={call.id}
                  href={`/calls?id=${call.id}`}
                  className="flex items-center gap-4 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                >
                  {/* Icon */}
                  <div className={cn("rounded-lg p-2", config.className.split(" ")[0])}>
                    <Icon className={cn("h-4 w-4", config.className.split(" ")[1])} />
                  </div>

                  {/* Call info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {formatPhoneNumber(call.from_number)}
                      </span>
                      {call.language === "es" && (
                        <Badge variant="outline" className="text-xs">
                          🇪🇸 ES
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatDuration(call.duration_seconds)}</span>
                      <span>•</span>
                      <span>
                        {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>

                  {/* Outcome badge */}
                  <Badge variant="secondary" className={cn("shrink-0", config.className)}>
                    {config.label}
                  </Badge>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
