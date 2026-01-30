/**
 * Admin System Logs Page
 * View errors, webhook failures, and system events
 */

import { Suspense } from "react";
import { LogsClient } from "./logs-client";

export const metadata = {
  title: "System Logs - Koya Admin",
};

export default function AdminLogsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-96 bg-muted animate-pulse rounded-lg" />
        </div>
      }
    >
      <LogsClient />
    </Suspense>
  );
}
