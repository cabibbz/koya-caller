/**
 * Welcome Page - Post Email Verification
 * Gives users the choice to start onboarding now or later
 */

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Rocket, Clock, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Welcome to Koya Caller",
  description: "Your account is verified. Choose how to get started.",
};

export default async function WelcomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If not logged in, redirect to login
  if (!user) {
    redirect("/login");
  }

  // If already onboarded (has tenant_id and completed onboarding), go to dashboard
  const tenantId = user.app_metadata?.tenant_id;
  if (tenantId) {
    // Check if onboarding is completed
    const { data: business } = await supabase
      .from("businesses")
      .select("onboarding_completed_at")
      .eq("id", tenantId)
      .single();

    // Type assertion needed since the schema may not include this column
    const businessData = business as { onboarding_completed_at?: string | null } | null;
    if (businessData?.onboarding_completed_at) {
      redirect("/dashboard");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
      <div className="w-full max-w-lg">
        {/* Success message */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Email Verified!</h1>
          <p className="text-muted-foreground">
            Your account is ready. How would you like to get started?
          </p>
        </div>

        {/* Options */}
        <div className="space-y-4">
          {/* Start onboarding now */}
          <Card className="relative overflow-hidden border-2 border-primary/20 hover:border-primary/50 transition-colors">
            <div className="absolute top-2 right-2">
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                Recommended
              </span>
            </div>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Rocket className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Start Onboarding Now</CardTitle>
                  <CardDescription>Set up your AI receptionist in 5 minutes</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1 mb-4">
                <li>• Configure your business details</li>
                <li>• Choose your AI voice</li>
                <li>• Get your phone number</li>
              </ul>
              <Button asChild className="w-full gap-2">
                <Link href="/onboarding">
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Start later */}
          <Card className="hover:border-muted-foreground/30 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg">Start Later</CardTitle>
                  <CardDescription>Explore the dashboard first</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                You can complete onboarding anytime from your dashboard. Your 14-day trial starts now.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/dashboard">
                  Go to Dashboard
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Trial info */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Your 14-day free trial has started. No credit card required.
        </p>
      </div>
    </div>
  );
}
