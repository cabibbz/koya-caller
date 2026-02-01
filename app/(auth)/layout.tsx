/**
 * Auth Layout
 * Centered card layout for auth pages
 * 
 * Spec Reference: Part 21, Lines 2233-2253 (Design System colors)
 */

import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      {/* Logo */}
      <Link href="/" className="mb-8">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
            <span className="text-xl font-bold text-white">K</span>
          </div>
          <span className="text-2xl font-bold">Koya</span>
        </div>
      </Link>

      {/* Auth Card */}
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-lg">
        {children}
      </div>

      {/* Footer */}
      <footer className="mt-8 text-center text-sm text-muted-foreground">
        <p>
          &copy; {new Date().getFullYear()} Koya. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
