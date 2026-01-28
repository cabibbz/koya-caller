/**
 * Prompt Management API
 * GET - Read current prompt
 * PUT - Direct edit (raw prompt)
 * POST - Regenerate prompt with options
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { logError, logWarning } from "@/lib/logging";

// GET - Read current prompt and config
async function handleGet(
  _request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const anySupabase = supabase as any;

    const { data: config } = await anySupabase
      .from("ai_config")
      .select(`
        system_prompt,
        system_prompt_spanish,
        system_prompt_version,
        system_prompt_generated_at,
        ai_name,
        personality,
        greeting,
        retell_agent_id,
        retell_synced_at
      `)
      .eq("business_id", business.id)
      .single();

    // Also get FAQs, services, knowledge for context
    const faqsRes = await anySupabase.from("faqs").select("question, answer").eq("business_id", business.id).order("sort_order");
    const servicesRes = await anySupabase.from("services").select("name, description").eq("business_id", business.id);
    const knowledgeRes = await anySupabase.from("knowledge").select("content, never_say").eq("business_id", business.id).single();

    // Extract data
    const faqs = faqsRes.data || [];
    const services = servicesRes.data || [];
    const knowledgeData = knowledgeRes.data;

    return success({
      prompt: config?.system_prompt || null,
      promptSpanish: config?.system_prompt_spanish || null,
      version: config?.system_prompt_version || 0,
      generatedAt: config?.system_prompt_generated_at || null,
      syncedAt: config?.retell_synced_at || null,
      aiName: config?.ai_name || "Koya",
      personality: config?.personality || "friendly",
      greeting: config?.greeting || null,
      retellAgentId: config?.retell_agent_id || null,
      // Context data
      faqs,
      services,
      knowledge: knowledgeData?.content || null,
      neverSay: knowledgeData?.never_say || null,
    });
  } catch (error) {
    logError("Prompt API GET", error);
    return errors.internalError("Failed to fetch prompt");
  }
}

// PUT - Direct raw edit of prompt
async function handlePut(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const anySupabase = supabase as any;

    const body = await request.json();
    const { prompt, promptSpanish, syncToRetell } = body;

    if (!prompt || typeof prompt !== "string") {
      return errors.badRequest("Prompt is required");
    }

    // Validate prompt length to prevent abuse
    const MAX_PROMPT_LENGTH = 100000; // 100KB limit for prompts
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return errors.badRequest(`Prompt must be ${MAX_PROMPT_LENGTH} characters or less`);
    }
    if (promptSpanish && typeof promptSpanish === "string" && promptSpanish.length > MAX_PROMPT_LENGTH) {
      return errors.badRequest(`Spanish prompt must be ${MAX_PROMPT_LENGTH} characters or less`);
    }

    // Get current version
    const { data: current } = await anySupabase
      .from("ai_config")
      .select("system_prompt_version, retell_agent_id")
      .eq("business_id", business.id)
      .single();

    const newVersion = (current?.system_prompt_version || 0) + 1;

    // Update the prompt directly
    const { error: updateError } = await anySupabase
      .from("ai_config")
      .update({
        system_prompt: prompt,
        system_prompt_spanish: promptSpanish || null,
        system_prompt_version: newVersion,
        system_prompt_generated_at: new Date().toISOString(),
      })
      .eq("business_id", business.id);

    if (updateError) {
      return errors.internalError("Failed to save prompt");
    }

    // Sync to Retell if requested and agent exists
    let synced = false;
    if (syncToRetell && current?.retell_agent_id) {
      try {
        const RETELL_API_KEY = process.env.RETELL_API_KEY;
        if (RETELL_API_KEY) {
          // Get LLM ID from agent
          const agentRes = await fetch(`https://api.retellai.com/get-agent/${current.retell_agent_id}`, {
            headers: { Authorization: `Bearer ${RETELL_API_KEY}` },
          });

          if (agentRes.ok) {
            const agent = await agentRes.json();
            const llmId = agent.response_engine?.llm_id;

            if (llmId) {
              const updateRes = await fetch(`https://api.retellai.com/update-retell-llm/${llmId}`, {
                method: "PATCH",
                headers: {
                  Authorization: `Bearer ${RETELL_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ general_prompt: prompt }),
              });

              if (updateRes.ok) {
                synced = true;
                await anySupabase
                  .from("ai_config")
                  .update({ retell_synced_at: new Date().toISOString() })
                  .eq("business_id", business.id);
              }
            }
          }
        }
      } catch (syncError) {
        logWarning("Prompt API Retell Sync", String(syncError));
      }
    }

    return success({
      version: newVersion,
      synced,
    });
  } catch (error) {
    logError("Prompt API PUT", error);
    return errors.internalError("Failed to update prompt");
  }
}

// POST - Regenerate prompt with options
async function handlePost(
  request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    const body = await request.json();
    const { syncToRetell: _syncToRetell = true, waitForResult = false } = body;

    // Import inngest and trigger regeneration
    const { inngest } = await import("@/lib/inngest/client");

    if (waitForResult) {
      // Synchronous regeneration - call process-queue directly and wait
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      const response = await fetch(`${baseUrl}/api/claude/process-queue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-call": "true",
        },
        body: JSON.stringify({
          businessId: business.id,
          triggeredBy: "manual_regeneration",
        }),
      });

      const result = await response.json();

      return success({
        regenerated: result.success,
        message: result.success ? "Prompt regenerated and synced" : "Regeneration failed",
        errors: result.errors,
      });
    } else {
      // Async regeneration - fire and forget
      await inngest.send({
        name: "prompt/regeneration.requested",
        data: {
          businessId: business.id,
          triggeredBy: "manual_regeneration",
        },
      });

      return success({
        regenerated: true,
        message: "Regeneration started in background",
      });
    }
  } catch (error) {
    logError("Prompt API POST", error);
    return errors.internalError("Failed to regenerate prompt");
  }
}

export const GET = withAuth(handleGet);
export const PUT = withAuth(handlePut);
export const POST = withAuth(handlePost);
