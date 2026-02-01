/**
 * Script to regenerate prompt and sync to Retell
 * Run with: npx ts-node scripts/regenerate-and-sync.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const RETELL_API_KEY = process.env.RETELL_API_KEY!;

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  if (!RETELL_API_KEY) {
    console.error("Missing RETELL_API_KEY");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Get all businesses with Retell agents
  console.log("Fetching businesses with Retell agents...");
  const { data: configs, error } = await supabase
    .from("ai_config")
    .select("business_id, retell_agent_id, system_prompt")
    .not("retell_agent_id", "is", null);

  if (error) {
    console.error("Failed to fetch configs:", error);
    process.exit(1);
  }

  console.log(`Found ${configs?.length || 0} businesses with Retell agents`);

  for (const config of configs || []) {
    console.log(`\n--- Processing business ${config.business_id} ---`);

    if (!config.system_prompt) {
      console.log("No system prompt found, skipping...");
      continue;
    }

    try {
      // Get the agent to find LLM ID
      console.log(`Fetching Retell agent ${config.retell_agent_id}...`);
      const agentRes = await fetch(
        `https://api.retellai.com/get-agent/${config.retell_agent_id}`,
        {
          headers: { Authorization: `Bearer ${RETELL_API_KEY}` },
        }
      );

      if (!agentRes.ok) {
        const errorText = await agentRes.text();
        console.error(`Failed to fetch agent: ${agentRes.status} - ${errorText}`);
        continue;
      }

      const agent = await agentRes.json();
      const llmId = agent.response_engine?.llm_id;

      if (!llmId) {
        console.error("Agent has no LLM ID");
        continue;
      }

      console.log(`Found LLM ID: ${llmId}`);

      // Update the LLM with the current system prompt
      console.log("Updating LLM with current system prompt...");
      const updateRes = await fetch(
        `https://api.retellai.com/update-retell-llm/${llmId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${RETELL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            general_prompt: config.system_prompt,
          }),
        }
      );

      if (!updateRes.ok) {
        const errorText = await updateRes.text();
        console.error(`Failed to update LLM: ${updateRes.status} - ${errorText}`);
        continue;
      }

      // Update sync timestamp
      await supabase
        .from("ai_config")
        .update({ retell_synced_at: new Date().toISOString() })
        .eq("business_id", config.business_id);

      console.log("✅ Successfully synced to Retell!");
    } catch (err) {
      console.error("Error:", err);
    }
  }

  console.log("\n=== Done ===");
}

main();
