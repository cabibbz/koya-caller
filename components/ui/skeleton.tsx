/**
 * Skeleton Component
 * Loading placeholder animations with preset variants
 */

import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

/** Avatar skeleton - circular placeholder */
function SkeletonAvatar({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };
  return <Skeleton className={cn("rounded-full", sizes[size], className)} />;
}

/** Text skeleton - single line of text */
function SkeletonText({
  className,
  width = "full",
}: {
  className?: string;
  width?: "full" | "3/4" | "1/2" | "1/4";
}) {
  const widths = {
    full: "w-full",
    "3/4": "w-3/4",
    "1/2": "w-1/2",
    "1/4": "w-1/4",
  };
  return <Skeleton className={cn("h-4", widths[width], className)} />;
}

/** Card skeleton - full card placeholder */
function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 space-y-3",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <SkeletonAvatar />
        <div className="space-y-2 flex-1">
          <SkeletonText width="1/2" />
          <SkeletonText width="1/4" />
        </div>
      </div>
      <SkeletonText />
      <SkeletonText width="3/4" />
    </div>
  );
}

/** Table row skeleton */
function SkeletonTableRow({
  columns = 4,
  className,
}: {
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-4 py-3", className)}>
      {Array.from({ length: columns }).map((_, i) => (
        <SkeletonText
          key={i}
          width={i === 0 ? "1/4" : i === columns - 1 ? "1/4" : "1/2"}
          className="flex-1"
        />
      ))}
    </div>
  );
}

/** Stats card skeleton */
function SkeletonStats({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-6 space-y-2",
        className
      )}
    >
      <SkeletonText width="1/2" className="h-3" />
      <Skeleton className="h-8 w-24" />
      <SkeletonText width="3/4" className="h-3" />
    </div>
  );
}

/** Chat message skeleton */
function SkeletonMessage({
  align = "left",
  className,
}: {
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-3",
        align === "right" && "flex-row-reverse",
        className
      )}
    >
      <SkeletonAvatar size="sm" />
      <div
        className={cn(
          "space-y-2 max-w-[70%]",
          align === "right" && "items-end"
        )}
      >
        <Skeleton className="h-16 w-48 rounded-2xl" />
        <SkeletonText width="1/4" className="h-3" />
      </div>
    </div>
  );
}

/** List skeleton */
function SkeletonList({
  items = 3,
  className,
}: {
  items?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <SkeletonAvatar size="sm" />
          <div className="space-y-1.5 flex-1">
            <SkeletonText width="1/2" />
            <SkeletonText width="1/4" className="h-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export {
  Skeleton,
  SkeletonAvatar,
  SkeletonText,
  SkeletonCard,
  SkeletonTableRow,
  SkeletonStats,
  SkeletonMessage,
  SkeletonList,
};
