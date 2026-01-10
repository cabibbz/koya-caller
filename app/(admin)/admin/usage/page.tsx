/**
 * Admin Usage & Costs Page
 * Part 8: Admin Dashboard - Usage & Costs
 * Spec Reference: Part 8, Lines 821-832
 *
 * Shows: Total calls, minutes, Retell/Twilio costs, margins
 */

import { Suspense } from "react";
import { AdminUsageClient } from "./usage-client";

export const metadata = {
  title: "Usage & Costs - Koya Admin",
};

export default function AdminUsagePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
          <div className="h-96 bg-muted animate-pulse rounded-lg" />
        </div>
      }
    >
      <AdminUsageClient />
    </Suspense>
  );
}
