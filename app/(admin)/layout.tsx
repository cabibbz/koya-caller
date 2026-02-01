/**
 * Admin Dashboard Layout
 * Part 8: Admin Dashboard
 * Spec Reference: Part 8, Lines 808-850
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminHeader } from "@/components/admin/header";
import { AdminSidebar } from "@/components/admin/sidebar";

// Prevent static prerendering - requires auth
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side authorization check for admin access
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Verify user is authenticated
  if (!user) {
    redirect("/login");
  }

  // Verify user has admin privileges
  const isAdmin = user.app_metadata?.is_admin === true;
  if (!isAdmin) {
    // Non-admin users are redirected to dashboard
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <div className="lg:pl-64">
        <AdminHeader />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
