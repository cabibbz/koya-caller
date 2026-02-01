/**
 * Script to check Retell agent webhook URL
 * Run with: npx tsx scripts/check-agent-webhook.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import Retell from "retell-sdk";

async function main() {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) {
    console.error("RETELL_API_KEY not set");
    process.exit(1);
  }

  const client = new Retell({ apiKey });

  // List all agents
  const agents = await client.agent.list();

  console.log("Found agents:\n");
  for (const agent of agents) {
    console.log(`Agent: ${agent.agent_name || agent.agent_id}`);
    console.log(`  ID: ${agent.agent_id}`);
    console.log(`  Webhook URL: ${(agent as any).webhook_url || "NOT SET"}`);
    console.log("");
  }
}

main().catch(console.error);
