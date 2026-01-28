/**
 * Agents API Route
 * /api/dashboard/agents
 *
 * Returns available agents for outbound calling configuration
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

async function handleGet(
  _request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    // Query agents from ai_config table (where retell_agent_id is stored)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: aiConfig, error } = await (supabase as any)
      .from("ai_config")
      .select("retell_agent_id, retell_agent_id_spanish")
      .eq("business_id", business.id)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows found, which is fine
      throw error;
    }

    // Build agents list from available agent IDs
    const agentsList: { id: string; name: string }[] = [];

    if (aiConfig?.retell_agent_id) {
      agentsList.push({
        id: aiConfig.retell_agent_id,
        name: "Main Agent (English)"
      });
    }

    if (aiConfig?.retell_agent_id_spanish) {
      agentsList.push({
        id: aiConfig.retell_agent_id_spanish,
        name: "Main Agent (Spanish)"
      });
    }

    return success(agentsList);
  } catch (error) {
    logError("Agents GET", error);
    return errors.internalError("Failed to fetch agents");
  }
}

export const GET = withAuth(handleGet);
