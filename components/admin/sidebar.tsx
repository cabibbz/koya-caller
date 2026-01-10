"use client";

/**
 * Admin Sidebar Navigation
 * Part 8: Admin Dashboard - Extended
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Users,
  BarChart3,
  Activity,
  ArrowLeft,
  Shield,
  CreditCard,
  Phone,
  FileText,
  Search,
  Download,
  ClipboardList,
  Bell,
  Zap,
  Bot,
  Settings2,
  PenSquare,
} from "lucide-react";

interface NavSection {
  title: string;
  items: { label: string; href: string; icon: React.ComponentType<{ className?: string }> }[];
}

const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Customers", href: "/admin", icon: Users },
      { label: "Live Dashboard", href: "/admin/live", icon: Zap },
      { label: "Search", href: "/admin/search", icon: Search },
    ],
  },
  {
    title: "Monitoring",
    items: [
      { label: "Usage & Costs", href: "/admin/usage", icon: BarChart3 },
      { label: "Health", href: "/admin/health", icon: Activity },
      { label: "System Logs", href: "/admin/logs", icon: FileText },
    ],
  },
  {
    title: "Management",
    items: [
      { label: "Site Settings", href: "/admin/site-settings", icon: Settings2 },
      { label: "Blog Manager", href: "/admin/blog", icon: PenSquare },
      { label: "Subscriptions", href: "/admin/subscriptions", icon: CreditCard },
      { label: "Phone Numbers", href: "/admin/phones", icon: Phone },
      { label: "Retell Agents", href: "/admin/agents", icon: Bot },
      { label: "Announcements", href: "/admin/announcements", icon: Bell },
    ],
  },
  {
    title: "Reports",
    items: [
      { label: "Export Data", href: "/admin/reports", icon: Download },
      { label: "Audit Log", href: "/admin/audit", icon: ClipboardList },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/admin") {
      // Also match /admin/customers/* paths
      return pathname === "/admin" || pathname.startsWith("/admin/customers");
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-card overflow-hidden flex flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-border px-6 shrink-0">
        <Link href="/admin" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-orange-500">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight">Koya Admin</span>
            <span className="text-xs text-muted-foreground">Internal Dashboard</span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-6">
        {navSections.map((section) => (
          <div key={section.title}>
            <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {section.title}
            </h3>
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-red-500/10 text-red-500"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className={cn("h-4 w-4", active && "text-red-500")} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Back to Dashboard */}
      <div className="border-t border-border p-4 shrink-0">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>
    </aside>
  );
}
