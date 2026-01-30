/**
 * Admin Health Page
 * Part 8: Admin Dashboard - Health Monitoring
 * Spec Reference: Part 8, Lines 833-850
 *
 * Shows: Churn risk, upsell opportunities, failed calls, sync failures
 */

import { Suspense } from "react";
import { AdminHealthClient } from "./health-client";

export const metadata = {
  title: "Health - Koya Admin",
};

export default function AdminHealthPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
          <div className="h-96 bg-muted animate-pulse rounded-lg" />
        </div>
      }
    >
      <AdminHealthClient />
    </Suspense>
  );
}
