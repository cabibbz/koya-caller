/**
 * Admin Announcements Page
 * Create and manage system-wide announcements
 */

import { Suspense } from "react";
import { AnnouncementsClient } from "./announcements-client";

export const metadata = {
  title: "Announcements - Koya Admin",
};

export default function AdminAnnouncementsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-96 bg-muted animate-pulse rounded-lg" />
        </div>
      }
    >
      <AnnouncementsClient />
    </Suspense>
  );
}
