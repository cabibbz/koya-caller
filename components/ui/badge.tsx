/**
 * Badge Component
 * Display status indicators and labels with optional pulse animation
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        success:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        warning:
          "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        info:
          "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  pulse?: boolean;
}

function Badge({ className, variant, pulse, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {pulse && (
        <span className="relative mr-1.5 flex h-2 w-2">
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              variant === "success" && "bg-emerald-500",
              variant === "destructive" && "bg-red-500",
              variant === "warning" && "bg-amber-500",
              variant === "info" && "bg-blue-500",
              (!variant || variant === "default") && "bg-primary",
              variant === "secondary" && "bg-secondary-foreground"
            )}
          />
          <span
            className={cn(
              "relative inline-flex h-2 w-2 rounded-full",
              variant === "success" && "bg-emerald-500",
              variant === "destructive" && "bg-red-500",
              variant === "warning" && "bg-amber-500",
              variant === "info" && "bg-blue-500",
              (!variant || variant === "default") && "bg-primary",
              variant === "secondary" && "bg-secondary-foreground"
            )}
          />
        </span>
      )}
      {children}
    </div>
  );
}

/** Status Badge - Preset for common statuses */
interface StatusBadgeProps extends Omit<BadgeProps, "variant" | "pulse"> {
  status: "active" | "inactive" | "busy" | "away" | "error";
}

const statusConfig = {
  active: { variant: "success" as const, pulse: true, label: "Active" },
  inactive: { variant: "secondary" as const, pulse: false, label: "Inactive" },
  busy: { variant: "warning" as const, pulse: true, label: "Busy" },
  away: { variant: "info" as const, pulse: false, label: "Away" },
  error: { variant: "destructive" as const, pulse: true, label: "Error" },
};

function StatusBadge({ status, children, ...props }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <Badge variant={config.variant} pulse={config.pulse} {...props}>
      {children || config.label}
    </Badge>
  );
}

export { Badge, StatusBadge, badgeVariants };
