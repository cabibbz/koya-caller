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
import { useTranslations } from "next-intl";

export function QuickActions() {
  const t = useTranslations("dashboard");
  const tNav = useTranslations("nav");

  const actions = [
    {
      labelKey: "testCall",
      icon: Phone,
      href: "/settings#test-call",
      color: "text-emerald-500",
    },
    {
      labelKey: "viewCalls",
      icon: Headphones,
      href: "/calls",
      color: "text-blue-500",
    },
    {
      labelKey: "appointments",
      navKey: true,
      icon: Calendar,
      href: "/appointments",
      color: "text-purple-500",
    },
    {
      labelKey: "knowledge",
      navKey: true,
      icon: BookOpen,
      href: "/knowledge",
      color: "text-amber-500",
    },
    {
      labelKey: "settings",
      navKey: true,
      icon: Settings,
      href: "/settings",
      color: "text-slate-500",
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{t("quickActions")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {actions.map((action) => (
            <Button
              key={action.labelKey}
              variant="outline"
              className="h-auto py-3 px-3 flex flex-col items-center gap-1.5 hover:bg-muted/50"
              asChild
            >
              <Link href={action.href}>
                <action.icon className={`h-5 w-5 ${action.color}`} />
                <span className="text-xs font-medium">
                  {action.navKey ? tNav(action.labelKey) : t(action.labelKey)}
                </span>
              </Link>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
