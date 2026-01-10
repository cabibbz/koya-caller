/**
 * Admin Customer Detail Page
 * View and edit individual business details
 */

import { Suspense } from "react";
import { CustomerDetailClient } from "./customer-detail-client";

export const metadata = {
  title: "Customer Details - Koya Admin",
};

export default function CustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-96 bg-muted animate-pulse rounded-lg" />
        </div>
      }
    >
      <CustomerDetailClient businessId={params.id} />
    </Suspense>
  );
}
