/**
 * Admin Reports & Export Page
 * Export data and generate reports
 */

import { Suspense } from "react";
import { ReportsClient } from "./reports-client";

export const metadata = {
  title: "Reports & Export - Koya Admin",
};

export default function AdminReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-96 bg-muted animate-pulse rounded-lg" />
        </div>
      }
    >
      <ReportsClient />
    </Suspense>
  );
}
