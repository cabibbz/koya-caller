/**
 * Dashboard Layout
 * Session 16: Dashboard - Home & Calls
 * Spec Reference: Part 7, Lines 654-665
 */

import { DashboardHeader } from "@/components/dashboard/header";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { IntegrationStatusBanner } from "@/components/dashboard/integration-status-banner";
import { TrialBanner } from "@/components/dashboard/trial-banner";
import { CommandPalette } from "@/components/command-palette";

// Prevent static prerendering - requires auth
export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />
      <div className="lg:pl-64">
        <DashboardHeader />
        <main className="p-6">
          <TrialBanner />
          <IntegrationStatusBanner />
          {children}
        </main>
      </div>
      {/* Global Command Palette - Cmd+K / Ctrl+K */}
      <CommandPalette />
    </div>
  );
}
