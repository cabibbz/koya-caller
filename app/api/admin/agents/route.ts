/**
 * Admin Retell Agents API Route
 * View agent configurations across all businesses
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logging";
import { success, errors } from "@/lib/api/responses";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return errors.unauthorized();
    }
    if (user.app_metadata?.is_admin !== true) {
      return errors.forbidden();
    }

    // Get all businesses with their agent configurations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: businesses, error } = await (supabase as any)
      .from("businesses")
      .select(`
        id,
        name,
        retell_agent_id,
        subscription_status,
        created_at,
        updated_at,
        ai_prompts (
          id,
          system_prompt,
          voice_id,
          language,
          created_at,
          updated_at
        )
      `)
      .not("retell_agent_id", "is", null);

    if (error) {
      logError("Admin Agents GET - businesses", error);
    }

    // Get call counts per business
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: callCounts } = await (supabase as any)
      .from("calls")
      .select("business_id, created_at");

    const callStats: Record<string, { total: number; lastCall: string | null }> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response iteration
    (callCounts || []).forEach((call: any) => {
      if (!callStats[call.business_id]) {
        callStats[call.business_id] = { total: 0, lastCall: null };
      }
      callStats[call.business_id].total++;
      const current = callStats[call.business_id].lastCall;
      if (!current || call.created_at > current) {
        callStats[call.business_id].lastCall = call.created_at;
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response mapping
    const agents = (businesses || []).map((b: any) => {
      const prompt = b.ai_prompts?.[0];
      return {
        id: b.id,
        agent_id: b.retell_agent_id,
        business_id: b.id,
        business_name: b.name,
        voice_id: prompt?.voice_id || "default",
        voice_name: prompt?.voice_id || "Default Voice",
        language: prompt?.language || "en-US",
        status: b.subscription_status === "active" ? "active" : "inactive",
        total_calls: callStats[b.id]?.total || 0,
        last_call_at: callStats[b.id]?.lastCall || null,
        prompt_preview: prompt?.system_prompt?.slice(0, 500) || "No prompt configured",
        created_at: b.created_at,
        updated_at: prompt?.updated_at || b.updated_at,
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Filtering mapped response
    const activeCount = agents.filter((a: any) => a.status === "active").length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Filtering mapped response
    const inactiveCount = agents.filter((a: any) => a.status === "inactive").length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Filtering mapped response
    const errorCount = agents.filter((a: any) => a.status === "error").length;

    // Audit log for admin data access
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    await (supabase as any).from("admin_audit_logs").insert({
      admin_user_id: user.id,
      admin_email: user.email,
      action: "view.list",
      target_type: "agents",
      details: { count: agents.length, active: activeCount, inactive: inactiveCount },
      ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
    });

    return success({
      agents,
      stats: {
        total_agents: agents.length,
        active_agents: activeCount,
        inactive_agents: inactiveCount,
        error_agents: errorCount,
      },
    });
  } catch (error) {
    logError("Admin Agents GET", error);
    return errors.internalError();
  }
}
