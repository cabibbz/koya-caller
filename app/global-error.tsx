"use client";

/**
 * Global Error Page
 * Handles errors in the root layout
 * Reports errors to Sentry for production monitoring
 */

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Report critical error to Sentry
    Sentry.captureException(error, {
      tags: {
        errorBoundary: "global",
        digest: error.digest,
        critical: "true",
      },
    });
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
          <div className="text-center px-4 max-w-md">
            {/* Error icon */}
            <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-10 h-10 text-red-600 dark:text-red-400" />
            </div>

            {/* Message */}
            <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
              Critical Error
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Something went seriously wrong. Please try refreshing the page.
            </p>

            {/* Actions */}
            <Button
              onClick={reset}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Page
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
