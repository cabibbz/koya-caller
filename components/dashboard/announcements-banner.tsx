"use client";

/**
 * Announcements Banner
 * Shows system announcements from admin
 */

import { useState } from "react";
import { X, Info, AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: "info" | "warning" | "success" | "error";
}

interface AnnouncementsBannerProps {
  announcements: Announcement[];
}

const typeStyles = {
  info: {
    bg: "bg-blue-500/10 border-blue-500/20",
    text: "text-blue-600 dark:text-blue-400",
    icon: Info,
  },
  warning: {
    bg: "bg-amber-500/10 border-amber-500/20",
    text: "text-amber-600 dark:text-amber-400",
    icon: AlertTriangle,
  },
  success: {
    bg: "bg-emerald-500/10 border-emerald-500/20",
    text: "text-emerald-600 dark:text-emerald-400",
    icon: CheckCircle,
  },
  error: {
    bg: "bg-red-500/10 border-red-500/20",
    text: "text-red-600 dark:text-red-400",
    icon: AlertCircle,
  },
};

export function AnnouncementsBanner({ announcements }: AnnouncementsBannerProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const visibleAnnouncements = announcements.filter(
    (a) => !dismissedIds.has(a.id)
  );

  if (visibleAnnouncements.length === 0) {
    return null;
  }

  const dismiss = (id: string) => {
    setDismissedIds((prev) => new Set([...Array.from(prev), id]));
    // Optionally persist to localStorage
    try {
      const dismissed = JSON.parse(
        localStorage.getItem("dismissed_announcements") || "[]"
      );
      localStorage.setItem(
        "dismissed_announcements",
        JSON.stringify([...dismissed, id])
      );
    } catch {
      // Ignore localStorage errors
    }
  };

  return (
    <div className="space-y-2">
      {visibleAnnouncements.map((announcement) => {
        const style = typeStyles[announcement.type] || typeStyles.info;
        const Icon = style.icon;

        return (
          <div
            key={announcement.id}
            className={cn(
              "flex items-start gap-3 p-4 rounded-lg border",
              style.bg
            )}
          >
            <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", style.text)} />
            <div className="flex-1 min-w-0">
              <p className={cn("font-medium text-sm", style.text)}>
                {announcement.title}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {announcement.content}
              </p>
            </div>
            <button
              onClick={() => dismiss(announcement.id)}
              className="p-1 rounded hover:bg-background/50 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
