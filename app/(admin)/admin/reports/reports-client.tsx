"use client";

/**
 * Admin Reports & Export Client Component
 * Generate and download various reports
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Download,
  FileSpreadsheet,
  Users,
  Phone,
  Calendar,
  DollarSign,
  Loader2,
  CheckCircle,
  Clock,
} from "lucide-react";

interface Report {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  endpoint: string;
  filename: string;
}

const reports: Report[] = [
  {
    id: "customers",
    name: "Customer Export",
    description: "All businesses with subscription status, plan, and contact info",
    icon: <Users className="h-5 w-5" />,
    endpoint: "/api/admin/export/customers",
    filename: "koya-customers.csv",
  },
  {
    id: "calls",
    name: "Calls Export",
    description: "All calls with duration, status, and business info",
    icon: <Phone className="h-5 w-5" />,
    endpoint: "/api/admin/export/calls",
    filename: "koya-calls.csv",
  },
  {
    id: "appointments",
    name: "Appointments Export",
    description: "All appointments with customer details and status",
    icon: <Calendar className="h-5 w-5" />,
    endpoint: "/api/admin/export/appointments",
    filename: "koya-appointments.csv",
  },
  {
    id: "revenue",
    name: "Revenue Report",
    description: "Monthly revenue breakdown by plan and customer",
    icon: <DollarSign className="h-5 w-5" />,
    endpoint: "/api/admin/export/revenue",
    filename: "koya-revenue.csv",
  },
  {
    id: "usage",
    name: "Usage Report",
    description: "Minutes used per business with overage tracking",
    icon: <Clock className="h-5 w-5" />,
    endpoint: "/api/admin/export/usage",
    filename: "koya-usage.csv",
  },
];

export function ReportsClient() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  const handleDownload = async (report: Report) => {
    setDownloading(report.id);
    try {
      const response = await fetch(report.endpoint);
      if (!response.ok) throw new Error("Failed to generate report");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = report.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setCompleted((prev) => new Set(prev).add(report.id));
      setTimeout(() => {
        setCompleted((prev) => {
          const next = new Set(prev);
          next.delete(report.id);
          return next;
        });
      }, 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports & Export</h1>
        <p className="text-muted-foreground">Generate and download data exports</p>
      </div>

      {/* Reports Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <div
            key={report.id}
            className="p-6 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                {report.icon}
              </div>
              {completed.has(report.id) && (
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              )}
            </div>
            <h3 className="font-semibold mb-1">{report.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">{report.description}</p>
            <Button
              onClick={() => handleDownload(report)}
              disabled={downloading === report.id}
              variant="outline"
              className="w-full"
            >
              {downloading === report.id ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download CSV
                </>
              )}
            </Button>
          </div>
        ))}
      </div>

      {/* Custom Date Range Export */}
      <div className="p-6 rounded-lg border border-border bg-card">
        <div className="flex items-center gap-3 mb-4">
          <FileSpreadsheet className="h-5 w-5" />
          <h3 className="font-semibold">Custom Export</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Generate a custom export with specific date ranges and filters.
        </p>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-sm font-medium mb-1 block">Start Date</label>
            <input
              type="date"
              className="h-10 px-3 rounded-md border border-input bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">End Date</label>
            <input
              type="date"
              className="h-10 px-3 rounded-md border border-input bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Data Type</label>
            <select className="h-10 px-3 rounded-md border border-input bg-background text-sm">
              <option value="calls">Calls</option>
              <option value="appointments">Appointments</option>
              <option value="usage">Usage</option>
            </select>
          </div>
          <Button>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>
    </div>
  );
}
