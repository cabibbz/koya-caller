/**
 * Admin Global Search Page
 * Search across businesses, calls, and appointments
 */

import { Suspense } from "react";
import { SearchClient } from "./search-client";

export const metadata = {
  title: "Search - Koya Admin",
};

export default function AdminSearchPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-96 bg-muted animate-pulse rounded-lg" />
        </div>
      }
    >
      <SearchClient />
    </Suspense>
  );
}
