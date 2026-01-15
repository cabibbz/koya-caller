/**
 * Admin Customers Page
 * Part 8: Admin Dashboard - Customers
 * Spec Reference: Part 8, Lines 808-820
 *
 * Shows: All businesses with status, plan, metrics, actions
 */

import { Suspense } from "react";
import { AdminCustomersClient } from "./customers-client";

export const metadata = {
  title: "Customers - Koya Admin",
};

export default function AdminCustomersPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-96 bg-muted animate-pulse rounded-lg" />
        </div>
      }
    >
      <AdminCustomersClient />
    </Suspense>
  );
}
