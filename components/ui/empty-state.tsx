/**
 * Empty State Component
 * Displays helpful messaging when no data is available
 */

import * as React from "react";
import {
  Phone,
  Calendar,
  FileText,
  MessageSquare,
  Users,
  Search,
  Inbox,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  children?: React.ReactNode;
}

function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondaryAction,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
    >
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-4">
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-2">
          {action && (
            <Button onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

/** Preset empty states for common use cases */

function EmptyStateCalls({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={Phone}
      title="No calls yet"
      description="When your AI receptionist starts taking calls, they'll appear here."
      action={
        onAction
          ? { label: "Make a test call", onClick: onAction }
          : undefined
      }
    />
  );
}

function EmptyStateAppointments({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={Calendar}
      title="No appointments scheduled"
      description="Appointments booked through your AI receptionist will show up here."
      action={
        onAction
          ? { label: "Connect calendar", onClick: onAction }
          : undefined
      }
    />
  );
}

function EmptyStateKnowledge({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={FileText}
      title="Knowledge base is empty"
      description="Add FAQs, services, and business information to help your AI answer customer questions."
      action={
        onAction
          ? { label: "Add first entry", onClick: onAction }
          : undefined
      }
    />
  );
}

function EmptyStateTranscripts() {
  return (
    <EmptyState
      icon={MessageSquare}
      title="No transcript available"
      description="Call transcripts will appear here once calls are completed."
    />
  );
}

function EmptyStateContacts() {
  return (
    <EmptyState
      icon={Users}
      title="No contacts yet"
      description="Caller information will be saved here as calls come in."
    />
  );
}

/** Sanitize user query to prevent XSS and display issues */
function sanitizeSearchQuery(query: string): string {
  return query
    .slice(0, 100) // Limit length
    .replace(/[<>"'&]/g, ""); // Remove potentially dangerous characters
}

function EmptyStateSearch({ query }: { query?: string }) {
  const sanitizedQuery = query ? sanitizeSearchQuery(query) : null;

  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description={
        sanitizedQuery
          ? `We couldn't find anything matching "${sanitizedQuery}". Try a different search term.`
          : "Try adjusting your search or filters to find what you're looking for."
      }
    />
  );
}

export {
  EmptyState,
  EmptyStateCalls,
  EmptyStateAppointments,
  EmptyStateKnowledge,
  EmptyStateTranscripts,
  EmptyStateContacts,
  EmptyStateSearch,
};
