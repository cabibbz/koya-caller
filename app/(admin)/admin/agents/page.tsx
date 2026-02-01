/**
 * Admin Retell Agents Page
 * View agent configurations across all businesses
 */

import { Suspense } from "react";
import { AgentsClient } from "./agents-client";

export const metadata = {
  title: "Retell Agents - Koya Admin",
};

export default function AdminAgentsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-96 bg-muted animate-pulse rounded-lg" />
        </div>
      }
    >
      <AgentsClient />
    </Suspense>
  );
}
