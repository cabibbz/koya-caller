/**
 * Health Check Endpoint
 * Used for monitoring and load balancer health checks
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  checks: {
    database: "ok" | "error";
    memory: "ok" | "warning" | "critical";
  };
  uptime: number;
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
    percentUsed: number;
  };
}

const startTime = Date.now();

export async function GET() {
  const checks = {
    database: "error" as "ok" | "error",
    memory: "ok" as "ok" | "warning" | "critical",
  };

  // Check database connectivity
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("business_types").select("id").limit(1);
    checks.database = error ? "error" : "ok";
  } catch {
    checks.database = "error";
  }

  // Check memory usage
  const memoryUsage = process.memoryUsage();
  const heapPercentUsed = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

  if (heapPercentUsed > 90) {
    checks.memory = "critical";
  } else if (heapPercentUsed > 75) {
    checks.memory = "warning";
  }

  // Determine overall status
  let status: HealthStatus["status"] = "healthy";
  if (checks.database === "error") {
    status = "unhealthy";
  } else if (checks.memory === "critical") {
    status = "unhealthy";
  } else if (checks.memory === "warning") {
    status = "degraded";
  }

  const response: HealthStatus = {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    checks,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    memoryUsage: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      percentUsed: Math.round(heapPercentUsed),
    },
  };

  // Return appropriate status code
  const statusCode = status === "healthy" ? 200 : status === "degraded" ? 200 : 503;

  return NextResponse.json(response, {
    status: statusCode,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
