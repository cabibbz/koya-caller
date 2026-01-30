/**
 * Auth Code Error Page
 * Shown when auth callback fails
 */

import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Authentication Error | Koya",
  description: "There was an error with authentication.",
};

export default function AuthCodeErrorPage() {
  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <div className="rounded-full bg-error/10 p-4">
          <AlertTriangle className="h-10 w-10 text-error" />
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Authentication Error</h1>
        <p className="mt-2 text-muted-foreground">
          We couldn&apos;t complete the authentication process. This could happen if:
        </p>
      </div>

      <ul className="space-y-2 text-sm text-muted-foreground">
        <li>• The link has expired</li>
        <li>• The link has already been used</li>
        <li>• There was a network error</li>
      </ul>

      <div className="flex flex-col gap-2">
        <Link href="/login">
          <Button className="w-full">Try again</Button>
        </Link>
        <Link href="/">
          <Button variant="ghost" className="w-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to home
          </Button>
        </Link>
      </div>

      <p className="text-xs text-muted-foreground">
        If this problem persists, please{" "}
        <Link href="/contact" className="text-primary hover:underline">
          contact support
        </Link>
        .
      </p>
    </div>
  );
}
