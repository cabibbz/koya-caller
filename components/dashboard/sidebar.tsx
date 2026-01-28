"use client";

/**
 * Dashboard Sidebar Navigation
 * Session 16: Dashboard - Home & Calls
 * Spec Reference: Part 7, Lines 657-664
 *
 * Navigation structure:
 * 📊 Dashboard
 * 📞 Calls
 * 📅 Appointments
 * 🧠 Koya's Knowledge
 * ⚙️ Settings
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Phone,
  Calendar,
  Brain,
  Settings,
  Menu,
  X,
  BarChart3,
  HelpCircle,
  Users,
  Megaphone,
  Mail,
  Plug,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";

const navItems = [
  {
    labelKey: "dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    labelKey: "stats",
    href: "/stats",
    icon: BarChart3,
  },
  {
    labelKey: "calls",
    href: "/calls",
    icon: Phone,
  },
  {
    labelKey: "appointments",
    href: "/appointments",
    icon: Calendar,
  },
  {
    labelKey: "contacts",
    href: "/contacts",
    icon: Users,
  },
  {
    labelKey: "campaigns",
    href: "/campaigns",
    icon: Megaphone,
  },
  {
    labelKey: "inbox",
    href: "/inbox",
    icon: Mail,
  },
  {
    labelKey: "knowledge",
    href: "/knowledge",
    icon: Brain,
  },
  {
    labelKey: "connections",
    href: "/connections",
    icon: Plug,
  },
  {
    labelKey: "settings",
    href: "/settings",
    icon: Settings,
  },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = useTranslations("nav");

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-card transition-transform lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center border-b border-border px-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
              <span className="text-lg font-bold text-white">K</span>
            </div>
            <span className="text-xl font-bold tracking-tight">Koya</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 p-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", active && "text-primary")} />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>

        {/* Footer with Help and Status */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-border p-4 space-y-3">
          <Link
            href="/help"
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              pathname === "/help"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <HelpCircle className={cn("h-5 w-5", pathname === "/help" && "text-primary")} />
            {t("help") || "Help"}
          </Link>
          <StatusBadge status="active" className="w-full justify-center py-2">
            {t("koyaActive")}
          </StatusBadge>
        </div>
      </aside>
    </>
  );
}
