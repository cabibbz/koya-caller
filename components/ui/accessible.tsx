/**
 * Accessible UI Utilities
 * Provides accessibility helpers and screen-reader utilities
 */

import * as React from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// SCREEN READER ONLY
// =============================================================================

interface ScreenReaderOnlyProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
}

/**
 * Visually hides content but keeps it accessible to screen readers
 */
export function ScreenReaderOnly({ children, className, ...props }: ScreenReaderOnlyProps) {
  return (
    <span
      className={cn(
        "absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0",
        "[clip:rect(0,0,0,0)]",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

// =============================================================================
// SKIP LINK
// =============================================================================

interface SkipLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  targetId: string;
  children?: React.ReactNode;
}

/**
 * Skip link for keyboard navigation
 */
export function SkipLink({ targetId, children = "Skip to main content", className, ...props }: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className={cn(
        "sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50",
        "focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        className
      )}
      {...props}
    >
      {children}
    </a>
  );
}

// =============================================================================
// FOCUS TRAP UTILITIES
// =============================================================================

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(", ");

  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors));
}

// =============================================================================
// ARIA LIVE REGION
// =============================================================================

interface LiveRegionProps extends React.HTMLAttributes<HTMLDivElement> {
  politeness?: "polite" | "assertive" | "off";
  atomic?: boolean;
  relevant?: "additions" | "removals" | "text" | "all";
  children: React.ReactNode;
}

/**
 * ARIA live region for announcing dynamic content changes
 */
export function LiveRegion({
  politeness = "polite",
  atomic = true,
  relevant = "additions",
  children,
  className,
  ...props
}: LiveRegionProps) {
  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic={atomic}
      aria-relevant={relevant}
      className={cn("sr-only", className)}
      {...props}
    >
      {children}
    </div>
  );
}

// =============================================================================
// LOADING ANNOUNCER
// =============================================================================

interface LoadingAnnouncerProps {
  isLoading: boolean;
  loadingMessage?: string;
  loadedMessage?: string;
}

/**
 * Announces loading state to screen readers
 */
export function LoadingAnnouncer({
  isLoading,
  loadingMessage = "Loading...",
  loadedMessage = "Content loaded",
}: LoadingAnnouncerProps) {
  const [message, setMessage] = React.useState<string>("");

  React.useEffect(() => {
    if (isLoading) {
      setMessage(loadingMessage);
    } else {
      setMessage(loadedMessage);
      // Clear message after announcement
      const timer = setTimeout(() => setMessage(""), 1000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, loadingMessage, loadedMessage]);

  return <LiveRegion>{message}</LiveRegion>;
}

// =============================================================================
// ERROR ANNOUNCER
// =============================================================================

interface ErrorAnnouncerProps {
  error: string | null;
}

/**
 * Announces errors to screen readers
 */
export function ErrorAnnouncer({ error }: ErrorAnnouncerProps) {
  return (
    <LiveRegion politeness="assertive" aria-relevant="all">
      {error && `Error: ${error}`}
    </LiveRegion>
  );
}

// =============================================================================
// ICON BUTTON
// =============================================================================

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  showLabel?: boolean;
}

/**
 * Icon button with proper accessibility
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, label, showLabel = false, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        className={cn(
          "inline-flex items-center justify-center rounded-md",
          "text-sm font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:pointer-events-none disabled:opacity-50",
          className
        )}
        {...props}
      >
        {icon}
        {showLabel ? (
          <span className="ml-2">{label}</span>
        ) : (
          <ScreenReaderOnly>{label}</ScreenReaderOnly>
        )}
      </button>
    );
  }
);
IconButton.displayName = "IconButton";

// =============================================================================
// FORM ERROR
// =============================================================================

interface FormErrorProps extends React.HTMLAttributes<HTMLParagraphElement> {
  id: string;
  children: React.ReactNode;
}

/**
 * Form error message with proper ARIA attributes
 */
export function FormError({ id, children, className, ...props }: FormErrorProps) {
  if (!children) return null;

  return (
    <p
      id={id}
      role="alert"
      aria-live="polite"
      className={cn("text-sm text-destructive mt-1", className)}
      {...props}
    >
      {children}
    </p>
  );
}

// =============================================================================
// FORM FIELD WRAPPER
// =============================================================================

interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  description?: string;
  children: React.ReactElement;
}

/**
 * Accessible form field wrapper with label, error, and description
 */
export function FormField({
  id,
  label,
  error,
  required,
  description,
  children,
}: FormFieldProps) {
  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;

  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        {label}
        {required && (
          <>
            <span className="text-destructive ml-1" aria-hidden="true">*</span>
            <ScreenReaderOnly>required</ScreenReaderOnly>
          </>
        )}
      </label>

      {description && (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}

      {React.cloneElement(children, {
        id,
        "aria-describedby": [
          description ? descriptionId : null,
          error ? errorId : null,
        ]
          .filter(Boolean)
          .join(" ") || undefined,
        "aria-invalid": error ? "true" : undefined,
        "aria-required": required,
      })}

      {error && <FormError id={errorId}>{error}</FormError>}
    </div>
  );
}

// =============================================================================
// TABLE CAPTION
// =============================================================================

interface TableCaptionProps extends React.HTMLAttributes<HTMLTableCaptionElement> {
  children: React.ReactNode;
  visuallyHidden?: boolean;
}

/**
 * Accessible table caption
 */
export function TableCaption({
  children,
  visuallyHidden = false,
  className,
  ...props
}: TableCaptionProps) {
  return (
    <caption
      className={cn(
        visuallyHidden && "sr-only",
        !visuallyHidden && "mt-4 text-sm text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
    </caption>
  );
}

// =============================================================================
// PROGRESS INDICATOR
// =============================================================================

interface ProgressIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  label: string;
  showLabel?: boolean;
}

/**
 * Accessible progress indicator
 */
export function ProgressIndicator({
  value,
  max = 100,
  label,
  showLabel = false,
  className,
  ...props
}: ProgressIndicatorProps) {
  const percentage = Math.round((value / max) * 100);

  return (
    <div className={cn("space-y-1", className)} {...props}>
      {showLabel && (
        <div className="flex justify-between text-sm">
          <span>{label}</span>
          <span>{percentage}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
        className="h-2 w-full bg-secondary rounded-full overflow-hidden"
      >
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {!showLabel && <ScreenReaderOnly>{label}: {percentage}%</ScreenReaderOnly>}
    </div>
  );
}
