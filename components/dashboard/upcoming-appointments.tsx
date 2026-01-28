"use client";

/**
 * Upcoming Appointments Widget
 * Shows next 5 upcoming appointments
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, User, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface AppointmentData {
  id: string;
  customerName: string;
  serviceName: string;
  scheduledAt: string;
  status: string;
}

interface UpcomingAppointmentsProps {
  appointments: AppointmentData[];
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(dateString: string, todayText: string, tomorrowText: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return todayText;
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return tomorrowText;
  }
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function isToday(dateString: string): boolean {
  const date = new Date(dateString);
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

export function UpcomingAppointments({ appointments }: UpcomingAppointmentsProps) {
  const t = useTranslations("dashboard");

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">{t("upcomingAppointmentsTitle")}</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/appointments" className="text-xs">
              {t("viewAll")}
              <ChevronRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {appointments.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{t("noUpcomingAppointments")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.map((apt) => (
              <div
                key={apt.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border transition-colors hover:bg-muted/50",
                  isToday(apt.scheduledAt) && "border-primary/50 bg-primary/5"
                )}
              >
                <div
                  className={cn(
                    "flex flex-col items-center justify-center w-12 h-12 rounded-lg text-center",
                    isToday(apt.scheduledAt)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <span className="text-xs font-medium">
                    {formatDate(apt.scheduledAt, t("today"), t("tomorrow")).split(" ")[0]}
                  </span>
                  <span className="text-lg font-bold leading-none">
                    {new Date(apt.scheduledAt).getDate()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium text-sm truncate">
                      {apt.customerName}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {apt.serviceName}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{formatTime(apt.scheduledAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
