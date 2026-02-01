/**
 * Admin Phone Numbers Page
 * View and manage all Twilio phone numbers
 */

import { Suspense } from "react";
import { PhonesClient } from "./phones-client";

export const metadata = {
  title: "Phone Numbers - Koya Admin",
};

export default function AdminPhonesPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-96 bg-muted animate-pulse rounded-lg" />
        </div>
      }
    >
      <PhonesClient />
    </Suspense>
  );
}
