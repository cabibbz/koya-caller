"use client";

/**
 * Quick Actions Panel
 * Fast access to common tasks
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Phone,
  Calendar,
  Settings,
  BookOpen,
  Headphones,
} from "lucide-react";
import Link from "next/link";

const actions = [
  {
    label: "Test Call",
    description: "Call your Koya",
    icon: Phone,
    href: "/settings#test-call",
    color: "text-emerald-500",
  },
  {
    label: "View Calls",
    description: "Call history",
    icon: Headphones,
    href: "/calls",
    color: "text-blue-500",
  },
  {
    label: "Appointments",
    description: "Manage bookings",
    icon: Calendar,
    href: "/appointments",
    color: "text-purple-500",
  },
  {
    label: "Knowledge",
    description: "Train Koya",
    icon: BookOpen,
    href: "/knowledge",
    color: "text-amber-500",
  },
  {
    label: "Settings",
    description: "Configure",
    icon: Settings,
    href: "/settings",
    color: "text-slate-500",
  },
];

export function QuickActions() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              className="h-auto py-3 px-3 flex flex-col items-center gap-1.5 hover:bg-muted/50"
              asChild
            >
              <Link href={action.href}>
                <action.icon className={`h-5 w-5 ${action.color}`} />
                <span className="text-xs font-medium">{action.label}</span>
              </Link>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
