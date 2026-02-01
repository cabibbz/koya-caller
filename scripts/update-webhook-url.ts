/**
 * Script to update Retell agent webhook URL
 * Run with: npx tsx scripts/update-webhook-url.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createAdminClient } from "../lib/supabase/admin";
import { updateAgentWebhookUrl } from "../lib/retell";

async function main() {
  console.log("Updating Retell agent webhook URLs...\n");

  const supabase = createAdminClient();

  // Get all ai_config records with retell_agent_id
  const { data: configs, error } = await supabase
    .from("ai_config")
    .select("business_id, retell_agent_id")
    .not("retell_agent_id", "is", null);

  if (error) {
    console.error("Failed to fetch ai_config:", error);
    process.exit(1);
  }

  if (!configs || configs.length === 0) {
    console.log("No agents found to update.");
    process.exit(0);
  }

  console.log(`Found ${configs.length} agent(s) to update:\n`);

  for (const config of configs) {
    console.log(`Business: ${config.business_id}`);
    console.log(`Agent ID: ${config.retell_agent_id}`);

    const success = await updateAgentWebhookUrl(config.retell_agent_id);

    if (success) {
      console.log("✓ Updated successfully\n");
    } else {
      console.log("✗ Failed to update\n");
    }
  }

  console.log("Done!");
}

main().catch(console.error);
