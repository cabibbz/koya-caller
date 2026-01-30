/**
 * Admin Subscriptions Page
 * Manage customer subscriptions, apply credits, change plans
 */

import { Suspense } from "react";
import { SubscriptionsClient } from "./subscriptions-client";

export const metadata = {
  title: "Subscriptions - Koya Admin",
};

export default function AdminSubscriptionsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-96 bg-muted animate-pulse rounded-lg" />
        </div>
      }
    >
      <SubscriptionsClient />
    </Suspense>
  );
}
