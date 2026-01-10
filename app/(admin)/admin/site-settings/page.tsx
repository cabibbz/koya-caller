/**
 * Admin Site Settings Page
 * Configure landing page stats and pricing
 */

import { Suspense } from "react";
import { SiteSettingsClient } from "./site-settings-client";

export const metadata = {
  title: "Site Settings - Koya Admin",
};

export default function SiteSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-96 bg-muted animate-pulse rounded-lg" />
        </div>
      }
    >
      <SiteSettingsClient />
    </Suspense>
  );
}
