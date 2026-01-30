/**
 * Admin Audit Log Page
 * Track all admin actions for accountability
 */

import { Suspense } from "react";
import { AuditClient } from "./audit-client";

export const metadata = {
  title: "Audit Log - Koya Admin",
};

export default function AdminAuditPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-96 bg-muted animate-pulse rounded-lg" />
        </div>
      }
    >
      <AuditClient />
    </Suspense>
  );
}
