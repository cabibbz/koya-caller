/**
 * Login Page
 */

import { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth";

export const metadata: Metadata = {
  title: "Log In | Koya",
  description: "Log in to your Koya account.",
};

// Wrap LoginForm in Suspense because it uses useSearchParams
function LoginFormWrapper() {
  return <LoginForm />;
}

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="mt-2 text-muted-foreground">
          Log in to manage your AI receptionist
        </p>
      </div>

      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted" />}>
        <LoginFormWrapper />
      </Suspense>
    </div>
  );
}
