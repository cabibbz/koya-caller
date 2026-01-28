"use client";

/**
 * Integration Status Banner
 * Shows warnings when external integrations are not configured
 *
 * Displays at the top of the dashboard when:
 * - Critical integrations are missing (Retell, Twilio, Claude, Stripe)
 * - System is running in mock mode
 */

import { useState, useEffect } from "react";
import { AlertTriangle, X, ChevronDown, ChevronUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

interface IntegrationInfo {
  name: string;
  status: "connected" | "mock" | "error";
  description: string;
}

interface IntegrationStatusData {
  allConfigured: boolean;
  production: boolean;
  criticalMissing: string[];
  warnings: boolean | string[];
  integrations: Record<string, IntegrationInfo>;
}

export function IntegrationStatusBanner() {
  const t = useTranslations("dashboard");
  const [status, setStatus] = useState<IntegrationStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Check if already dismissed this session
    const wasDismissed = sessionStorage.getItem("integration-banner-dismissed");
    if (wasDismissed) {
      setDismissed(true);
      setLoading(false);
      return;
    }

    // Fetch integration status
    fetch("/api/dashboard/integrations/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStatus(data.data);
        }
      })
      .catch(() => {
        // Silently fail - don't show banner if we can't fetch status
      })
      .finally(() => setLoading(false));
  }, []);

  // Prevent dismissal in production when critical integrations are missing
  const canDismiss = !status?.production || status?.criticalMissing?.length === 0;

  const handleDismiss = () => {
    if (!canDismiss) {
      return; // Can't dismiss critical warnings in production
    }
    setDismissed(true);
    sessionStorage.setItem("integration-banner-dismissed", "true");
  };

  // Don't render if loading, dismissed (when allowed), or all configured
  if (loading || (dismissed && canDismiss) || !status || status.allConfigured) {
    return null;
  }

  // Get list of issues
  const issues: { name: string; description: string; critical: boolean }[] = [];

  Object.values(status.integrations).forEach((integration) => {
    if (integration.status !== "connected") {
      const isCritical = status.criticalMissing.includes(integration.name);
      issues.push({
        name: integration.name,
        description: integration.description,
        critical: isCritical,
      });
    }
  });

  const criticalIssues = issues.filter((i) => i.critical);
  const warningIssues = issues.filter((i) => !i.critical);

  return (
    <Alert
      variant="destructive"
      className="mb-4 border-warning/50 bg-warning/10 text-warning-foreground"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <AlertDescription className="font-medium text-foreground">
              {criticalIssues.length > 0 ? (
                t("mockModeWarning", {
                  count: criticalIssues.length,
                  plural: criticalIssues.length > 1 ? "s" : "",
                })
              ) : (
                t("optionalNotConfigured", {
                  count: warningIssues.length,
                  plural: warningIssues.length > 1 ? "s" : "",
                })
              )}
            </AlertDescription>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-muted-foreground hover:text-foreground"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
              {canDismiss ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-muted-foreground hover:text-foreground"
                  onClick={handleDismiss}
                  title={t("dismissWarning")}
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : (
                <span
                  className="h-7 px-2 flex items-center text-xs text-muted-foreground cursor-not-allowed"
                  title={t("cannotDismissProduction")}
                >
                  {t("mockModeLabel")}
                </span>
              )}
            </div>
          </div>

          {expanded && (
            <div className="mt-3 space-y-2">
              {criticalIssues.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-destructive mb-1">
                    {t("criticalRequired")}
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {criticalIssues.map((issue) => (
                      <li key={issue.name} className="flex items-start gap-2">
                        <span className="text-destructive">•</span>
                        <span>
                          <strong>{issue.name}:</strong> {issue.description}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {warningIssues.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-warning mb-1">
                    {t("optionalDisabled")}
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {warningIssues.map((issue) => (
                      <li key={issue.name} className="flex items-start gap-2">
                        <span className="text-warning">•</span>
                        <span>
                          <strong>{issue.name}:</strong> {issue.description}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {status.production && criticalIssues.length > 0 && (
                <p className="text-sm text-destructive font-medium mt-2">
                  ⚠️ {t("productionMissingIntegrations")}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Alert>
  );
}
