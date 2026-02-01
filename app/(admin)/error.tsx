"use client";

/**
 * Admin Error Boundary
 * Handles runtime errors in admin pages
 * Reports errors to Sentry for production monitoring
 */

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, LayoutDashboard } from "lucide-react";
import Link from "next/link";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Report error to Sentry
    Sentry.captureException(error, {
      tags: {
        errorBoundary: "admin",
        digest: error.digest,
      },
    });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center px-4 max-w-md">
        <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-10 h-10 text-destructive" />
        </div>

        <h1 className="text-2xl font-bold mb-2">Admin Error</h1>
        <p className="text-muted-foreground mb-6">
          Something went wrong in the admin panel. Please try again or return to the dashboard.
        </p>

        {process.env.NODE_ENV === "development" && error.message && (
          <div className="bg-muted rounded-lg p-4 mb-6 text-left">
            <p className="text-xs font-mono text-muted-foreground break-all">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-muted-foreground mt-2">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button onClick={reset} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Try Again
          </Button>
          <Button asChild className="gap-2">
            <Link href="/admin">
              <LayoutDashboard className="w-4 h-4" />
              Admin Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
