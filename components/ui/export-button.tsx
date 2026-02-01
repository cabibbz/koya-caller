"use client";

/**
 * Export Button Component
 * Reusable export dropdown with date range picker
 * Part of User-Facing Reports feature (PRODUCT_ROADMAP.md Section 2.4)
 */

import { useState, useCallback } from "react";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileSpreadsheet, FileText, Calendar, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type ExportFormat = "csv" | "pdf";

type DatePreset = "today" | "last7" | "last30" | "thisMonth" | "lastMonth" | "custom";

interface ExportButtonProps {
  /** The base URL for the export API (e.g., "/api/dashboard/calls/export") */
  exportUrl: string;
  /** Label for the export (used in filename and dialog) */
  label: string;
  /** Optional className for the button */
  className?: string;
  /** Optional variant for the button */
  variant?: "default" | "outline" | "secondary" | "ghost";
  /** Optional size for the button */
  size?: "default" | "sm" | "lg" | "icon";
}

/**
 * Get date range for a preset
 */
function getPresetDateRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const today = format(now, "yyyy-MM-dd");

  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "last7":
      return { from: format(subDays(now, 6), "yyyy-MM-dd"), to: today };
    case "last30":
      return { from: format(subDays(now, 29), "yyyy-MM-dd"), to: today };
    case "thisMonth":
      return {
        from: format(startOfMonth(now), "yyyy-MM-dd"),
        to: format(endOfMonth(now), "yyyy-MM-dd"),
      };
    case "lastMonth":
      const lastMonth = subMonths(now, 1);
      return {
        from: format(startOfMonth(lastMonth), "yyyy-MM-dd"),
        to: format(endOfMonth(lastMonth), "yyyy-MM-dd"),
      };
    default:
      return { from: today, to: today };
  }
}

export function ExportButton({
  exportUrl,
  label,
  className,
  variant = "outline",
  size = "sm",
}: ExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [pendingFormat, setPendingFormat] = useState<ExportFormat>("csv");
  const [customFrom, setCustomFrom] = useState(() => format(subDays(new Date(), 29), "yyyy-MM-dd"));
  const [customTo, setCustomTo] = useState(() => format(new Date(), "yyyy-MM-dd"));

  /**
   * Perform the actual export
   */
  const performExport = useCallback(async (formatType: ExportFormat, from: string, to: string) => {
    setLoading(true);

    try {
      const params = new URLSearchParams({
        format: formatType,
        from,
        to,
      });

      const response = await fetch(`${exportUrl}?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Export failed");
      }

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `${label.toLowerCase().replace(/\s+/g, "-")}-${from}-to-${to}.${formatType}`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^";\n]+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export successful",
        description: `${label} exported to ${formatType.toUpperCase()}`,
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [exportUrl, label]);

  /**
   * Handle export with preset date range
   */
  const handleExport = useCallback(
    async (formatType: ExportFormat, preset: DatePreset) => {
      if (preset === "custom") {
        setPendingFormat(formatType);
        setCustomDialogOpen(true);
        return;
      }

      const { from, to } = getPresetDateRange(preset);
      await performExport(formatType, from, to);
    },
    [performExport]
  );

  /**
   * Handle custom date range export
   */
  const handleCustomExport = useCallback(async () => {
    setCustomDialogOpen(false);
    await performExport(pendingFormat, customFrom, customTo);
  }, [performExport, pendingFormat, customFrom, customTo]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={variant} size={size} className={className} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Export {label}</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* CSV Export Sub-menu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export as CSV
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Select Date Range
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExport("csv", "today")}>
                Today
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("csv", "last7")}>
                Last 7 Days
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("csv", "last30")}>
                Last 30 Days
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("csv", "thisMonth")}>
                This Month
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("csv", "lastMonth")}>
                Last Month
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExport("csv", "custom")}>
                <Calendar className="h-4 w-4 mr-2" />
                Custom Range...
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* PDF Export Sub-menu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FileText className="h-4 w-4 mr-2" />
              Export as PDF
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Select Date Range
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExport("pdf", "today")}>
                Today
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("pdf", "last7")}>
                Last 7 Days
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("pdf", "last30")}>
                Last 30 Days
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("pdf", "thisMonth")}>
                This Month
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("pdf", "lastMonth")}>
                Last Month
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExport("pdf", "custom")}>
                <Calendar className="h-4 w-4 mr-2" />
                Custom Range...
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Custom Date Range Dialog */}
      <Dialog open={customDialogOpen} onOpenChange={setCustomDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Custom Date Range</DialogTitle>
            <DialogDescription>
              Select a date range for your {label.toLowerCase()} export.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="export-from">From Date</Label>
              <Input
                id="export-from"
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                max={customTo}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="export-to">To Date</Label>
              <Input
                id="export-to"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                min={customFrom}
                max={format(new Date(), "yyyy-MM-dd")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCustomExport} disabled={!customFrom || !customTo}>
              Export {pendingFormat.toUpperCase()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
