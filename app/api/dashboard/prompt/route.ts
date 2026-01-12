/**
 * Prompt Management API
 * GET - Read current prompt
 * PUT - Direct edit (raw prompt)
 * POST - Regenerate prompt with options
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

// GET - Read current prompt and config
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const { data: config } = await supabase
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
    const [faqsRes, servicesRes, knowledgeRes] = await Promise.all([
      supabase.from("faqs").select("question, answer").eq("business_id", business.id).order("sort_order"),
      supabase.from("services").select("name, description").eq("business_id", business.id),
      supabase.from("knowledge").select("content, never_say").eq("business_id", business.id).single(),
    ]);

    return NextResponse.json({
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
      faqs: faqsRes.data || [],
      services: servicesRes.data || [],
      knowledge: knowledgeRes.data?.content || null,
      neverSay: knowledgeRes.data?.never_say || null,
    });
  } catch (error) {
    console.error("[Prompt API] GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT - Direct raw edit of prompt
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const body = await request.json();
    const { prompt, promptSpanish, syncToRetell } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Get current version
    const { data: current } = await supabase
      .from("ai_config")
      .select("system_prompt_version, retell_agent_id")
      .eq("business_id", business.id)
      .single();

    const newVersion = (current?.system_prompt_version || 0) + 1;

    // Update the prompt directly
    const { error: updateError } = await supabase
      .from("ai_config")
      .update({
        system_prompt: prompt,
        system_prompt_spanish: promptSpanish || null,
        system_prompt_version: newVersion,
        system_prompt_generated_at: new Date().toISOString(),
      })
      .eq("business_id", business.id);

    if (updateError) {
      return NextResponse.json({ error: "Failed to save prompt" }, { status: 500 });
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
                await supabase
                  .from("ai_config")
                  .update({ retell_synced_at: new Date().toISOString() })
                  .eq("business_id", business.id);
              }
            }
          }
        }
      } catch (syncError) {
        console.error("[Prompt API] Retell sync error:", syncError);
      }
    }

    return NextResponse.json({
      success: true,
      version: newVersion,
      synced,
    });
  } catch (error) {
    console.error("[Prompt API] PUT error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Regenerate prompt with options
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const body = await request.json();
    const { syncToRetell = true, waitForResult = false } = body;

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

      return NextResponse.json({
        success: result.success,
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

      return NextResponse.json({
        success: true,
        message: "Regeneration started in background",
      });
    }
  } catch (error) {
    console.error("[Prompt API] POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
