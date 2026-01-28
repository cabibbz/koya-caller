/**
 * Export Utilities
 * Provides CSV and PDF generation for reports
 * Part of User-Facing Reports feature (PRODUCT_ROADMAP.md Section 2.4)
 */

import { format } from "date-fns";

/**
 * Escapes special characters in CSV values
 * - Wraps in quotes if contains comma, quote, or newline
 * - Escapes internal quotes by doubling them
 * - Prevents CSV formula injection by prefixing dangerous characters
 */
function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  let stringValue = String(value);

  // CSV Formula Injection Prevention: Prefix formula characters with single quote
  // This prevents Excel/Google Sheets from executing formulas in user data
  // Characters that trigger formula execution: = + - @ | and tab
  const formulaChars = /^[=+\-@|\t]/;
  if (formulaChars.test(stringValue)) {
    stringValue = "'" + stringValue;
  }

  // Check if value needs quoting
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes("\r") ||
    stringValue.includes("'")  // Also quote if we added formula protection prefix
  ) {
    // Escape internal quotes by doubling them
    const escaped = stringValue.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  return stringValue;
}

/**
 * Generic function to convert an array of objects to CSV format
 * @param data - Array of objects to convert
 * @param columns - Column definitions with key and header
 * @returns CSV string with proper escaping
 */
export function arrayToCsv<T>(
  data: T[],
  columns: { key: keyof T | string; header: string; transform?: (value: unknown, row: T) => string; width?: number }[]
): string {
  // Build header row
  const headerRow = columns.map((col) => escapeCsvValue(col.header)).join(",");

  // Build data rows
  const dataRows = data.map((row) => {
    return columns
      .map((col) => {
        const rowObj = row as Record<string, unknown>;
        const key = col.key as string;
        const value = key.includes(".")
          ? getNestedValue(rowObj, key)
          : rowObj[key];

        if (col.transform) {
          return escapeCsvValue(col.transform(value, row));
        }
        return escapeCsvValue(value);
      })
      .join(",");
  });

  // Combine with proper line endings
  return [headerRow, ...dataRows].join("\r\n");
}

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((current: unknown, key: string) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Format a date for display in exports
 */
export function formatExportDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    return format(new Date(dateStr), "yyyy-MM-dd HH:mm:ss");
  } catch {
    return dateStr;
  }
}

/**
 * Format duration in seconds to mm:ss
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format phone number for export
 */
export function formatPhoneForExport(phone: string | null | undefined): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    const match = cleaned.slice(1).match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  if (cleaned.length === 10) {
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phone;
}

// =============================================================================
// PDF Generation
// =============================================================================

/**
 * Generate a simple PDF table using raw PDF commands
 * Note: For more complex PDFs, consider using a library like pdfmake or jsPDF
 * This is a lightweight implementation for basic tabular reports
 */
export function generatePdfTable(
  title: string,
  subtitle: string,
  columns: { header: string; width: number }[],
  rows: string[][],
  generatedAt: string
): Uint8Array {
  // PDF basic structure
  const objects: string[] = [];
  let objectCount = 0;

  // Helper to add PDF object
  const addObject = (content: string): number => {
    objectCount++;
    objects.push(content);
    return objectCount;
  };

  // Calculate page metrics
  const pageWidth = 612; // Letter width in points
  const pageHeight = 792; // Letter height in points
  const margin = 50;
  const contentWidth = pageWidth - 2 * margin;
  const rowHeight = 18;
  const headerHeight = 24;

  // Calculate column widths proportionally
  const totalColumnWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const columnWidths = columns.map((col) => (col.width / totalColumnWidth) * contentWidth);

  // Catalog object
  const catalogId = addObject(`<< /Type /Catalog /Pages 2 0 R >>`);

  // Pages object (placeholder - will be updated after page is created)
  const _pagesId = addObject(`<< /Type /Pages /Kids [3 0 R] /Count 1 >>`);

  // Build content stream
  let content = "";

  // Title
  content += `BT /F1 16 Tf ${margin} ${pageHeight - margin - 20} Td (${escapeString(title)}) Tj ET\n`;

  // Subtitle
  content += `BT /F1 10 Tf ${margin} ${pageHeight - margin - 40} Td (${escapeString(subtitle)}) Tj ET\n`;

  // Generated at timestamp
  content += `BT /F1 8 Tf ${margin} ${pageHeight - margin - 55} Td (Generated: ${escapeString(generatedAt)}) Tj ET\n`;

  // Table header background
  const tableStartY = pageHeight - margin - 80;
  content += `0.9 0.9 0.9 rg ${margin} ${tableStartY - headerHeight} ${contentWidth} ${headerHeight} re f\n`;

  // Table headers
  let xPos = margin + 5;
  content += `BT /F1 10 Tf\n`;
  for (let i = 0; i < columns.length; i++) {
    content += `${xPos} ${tableStartY - 16} Td (${escapeString(columns[i].header)}) Tj\n`;
    xPos += columnWidths[i];
    if (i < columns.length - 1) {
      content += `${columnWidths[i] - 5} 0 Td `;
    }
  }
  content += `ET\n`;

  // Table rows
  let currentY = tableStartY - headerHeight;
  for (let rowIdx = 0; rowIdx < Math.min(rows.length, 35); rowIdx++) {
    const row = rows[rowIdx];
    currentY -= rowHeight;

    // Alternating row background
    if (rowIdx % 2 === 1) {
      content += `0.95 0.95 0.95 rg ${margin} ${currentY} ${contentWidth} ${rowHeight} re f\n`;
    }

    // Row data
    content += `BT /F1 9 Tf\n`;
    xPos = margin + 5;
    for (let i = 0; i < row.length; i++) {
      // Truncate long values
      let cellValue = row[i] || "";
      const maxChars = Math.floor(columnWidths[i] / 5);
      if (cellValue.length > maxChars) {
        cellValue = cellValue.substring(0, maxChars - 3) + "...";
      }
      content += `${xPos} ${currentY + 5} Td (${escapeString(cellValue)}) Tj\n`;
      xPos += columnWidths[i];
      if (i < row.length - 1) {
        content += `${columnWidths[i] - 5} 0 Td `;
      }
    }
    content += `ET\n`;
  }

  // Table border
  content += `0 0 0 RG 0.5 w ${margin} ${tableStartY} ${contentWidth} ${-((Math.min(rows.length, 35) + 1) * rowHeight + 6)} re S\n`;

  // Row count note
  if (rows.length > 35) {
    content += `BT /F1 8 Tf ${margin} ${currentY - 20} Td (Showing 35 of ${rows.length} records. Export to CSV for complete data.) Tj ET\n`;
  }

  // Footer
  content += `BT /F1 8 Tf ${margin} 30 Td (Koya Caller - AI Receptionist) Tj ET\n`;

  // Content stream object
  const streamId = addObject(
    `<< /Length ${content.length} >>\nstream\n${content}endstream`
  );

  // Page object
  const pageId = addObject(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${streamId} 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>`
  );

  // Fix pages Kids array reference
  objects[1] = `<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`;

  // Build PDF
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  // Cross-reference table
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }

  // Trailer
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

/**
 * Escape special characters for PDF strings
 */
function escapeString(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, ""); // Remove non-printable chars
}

// =============================================================================
// Column Definitions for Exports
// =============================================================================

import type { Call, Appointment } from "@/types";

/**
 * Column definitions for calls export
 */
export const callsExportColumns: {
  key: keyof Call | string;
  header: string;
  transform?: (value: unknown, row: Call) => string;
  width: number;
}[] = [
  {
    key: "created_at",
    header: "Date/Time",
    transform: (v) => formatExportDate(v as string),
    width: 150,
  },
  {
    key: "from_number",
    header: "Caller",
    transform: (v) => formatPhoneForExport(v as string),
    width: 120,
  },
  {
    key: "duration_seconds",
    header: "Duration",
    transform: (v) => formatDuration(v as number),
    width: 80,
  },
  {
    key: "outcome",
    header: "Outcome",
    transform: (v) => {
      const outcomes: Record<string, string> = {
        booked: "Booked",
        transferred: "Transferred",
        info: "Info Only",
        message: "Message",
        missed: "Missed",
        minutes_exhausted: "Over Limit",
      };
      return outcomes[v as string] || String(v || "");
    },
    width: 100,
  },
  {
    key: "language",
    header: "Language",
    transform: (v) => (v === "es" ? "Spanish" : "English"),
    width: 80,
  },
  {
    key: "summary",
    header: "Summary",
    width: 200,
  },
  {
    key: "message_taken",
    header: "Message",
    width: 150,
  },
  {
    key: "flagged",
    header: "Flagged",
    transform: (v) => (v ? "Yes" : "No"),
    width: 60,
  },
  {
    key: "notes",
    header: "Notes",
    width: 150,
  },
];

/**
 * Column definitions for appointments export
 */
export const appointmentsExportColumns: {
  key: keyof Appointment | string;
  header: string;
  transform?: (value: unknown, row: Appointment) => string;
  width: number;
}[] = [
  {
    key: "scheduled_at",
    header: "Date/Time",
    transform: (v) => formatExportDate(v as string),
    width: 150,
  },
  {
    key: "customer_name",
    header: "Customer",
    width: 120,
  },
  {
    key: "customer_phone",
    header: "Phone",
    transform: (v) => formatPhoneForExport(v as string),
    width: 120,
  },
  {
    key: "customer_email",
    header: "Email",
    width: 150,
  },
  {
    key: "service_name",
    header: "Service",
    width: 120,
  },
  {
    key: "duration_minutes",
    header: "Duration (min)",
    transform: (v) => (v ? `${v} min` : ""),
    width: 80,
  },
  {
    key: "status",
    header: "Status",
    transform: (v) => {
      const statuses: Record<string, string> = {
        confirmed: "Confirmed",
        cancelled: "Cancelled",
        completed: "Completed",
        no_show: "No Show",
      };
      return statuses[v as string] || String(v || "");
    },
    width: 80,
  },
  {
    key: "call_id",
    header: "Booked By",
    transform: (v) => (v ? "Koya (AI)" : "Manual"),
    width: 80,
  },
  {
    key: "notes",
    header: "Notes",
    width: 150,
  },
];
