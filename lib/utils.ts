import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class names using clsx and tailwind-merge
 * Used by shadcn/ui components
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format phone number for display
 * (555) 123-4567
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phone;
}

/**
 * Format currency in cents to dollars
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/**
 * Format minutes with call equivalent
 * Per Spec Part 6: "156 / 200 minutes (~31 / 40 calls)"
 */
export function formatMinutesWithCalls(
  used: number,
  total: number
): { text: string; percent: number } {
  const avgCallMinutes = 5; // ~5 min per call
  const usedCalls = Math.round(used / avgCallMinutes);
  const totalCalls = Math.round(total / avgCallMinutes);
  const percent = Math.round((used / total) * 100);

  return {
    text: `${used} / ${total} minutes (~${usedCalls} / ${totalCalls} calls)`,
    percent,
  };
}

/**
 * Get usage alert color based on percentage
 * Per Spec Part 7, Line 669:
 * Green (<50%), Yellow (50-80%), Orange (80-95%), Red (>95%)
 */
export function getUsageColor(percent: number): string {
  if (percent < 50) return "text-success";
  if (percent < 80) return "text-warning";
  if (percent < 95) return "text-warning";
  return "text-error";
}

/**
 * Generate initials from a name
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
