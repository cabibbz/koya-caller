/**
 * New Onboarding Layout
 * Minimal layout for the experimental onboarding
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function NewOnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <>{children}</>;
}
