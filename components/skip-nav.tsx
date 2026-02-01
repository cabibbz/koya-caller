/**
 * Skip Navigation Link
 * Accessibility feature for keyboard users to skip to main content
 */

import Link from "next/link";

export function SkipNavLink() {
  return (
    <Link
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      Skip to main content
    </Link>
  );
}

export function SkipNavContent({
  id = "main-content",
  children,
}: {
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <main id={id} tabIndex={-1} className="outline-none">
      {children}
    </main>
  );
}
