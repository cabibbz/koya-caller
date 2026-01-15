"use client";

/**
 * Stats Cards Component
 * Session 16: Dashboard - Home & Calls
 * Spec Reference: Part 7, Lines 671-674
 * 
 * Shows:
 * - Today's calls count
 * - This week's calls count
 * - Appointments booked (today/week)
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Calendar, TrendingUp } from "lucide-react";

interface StatsCardsProps {
  todayCalls: number;
  weekCalls: number;
  todayAppointments: number;
  weekAppointments: number;
}

export function StatsCards({
  todayCalls,
  weekCalls,
  todayAppointments,
  weekAppointments,
}: StatsCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Today's Calls */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Today&apos;s Calls
          </CardTitle>
          <Phone className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{todayCalls}</div>
          <p className="text-xs text-muted-foreground">
            {todayCalls === 1 ? "call" : "calls"} received today
          </p>
        </CardContent>
      </Card>

      {/* This Week's Calls */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            This Week
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{weekCalls}</div>
          <p className="text-xs text-muted-foreground">
            {weekCalls === 1 ? "call" : "calls"} this week
          </p>
        </CardContent>
      </Card>

      {/* Today's Appointments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Booked Today
          </CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{todayAppointments}</div>
          <p className="text-xs text-muted-foreground">
            {todayAppointments === 1 ? "appointment" : "appointments"} booked
          </p>
        </CardContent>
      </Card>

      {/* This Week's Appointments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Booked This Week
          </CardTitle>
          <Calendar className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{weekAppointments}</div>
          <p className="text-xs text-muted-foreground">
            {weekAppointments === 1 ? "appointment" : "appointments"} this week
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
