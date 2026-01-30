/**
 * Script to fix Retell agent webhook URL
 * Run with: npx tsx scripts/fix-agent-webhook.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import Retell from "retell-sdk";

async function main() {
  const apiKey = process.env.RETELL_API_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;

  if (!apiKey) {
    console.error("RETELL_API_KEY not set");
    process.exit(1);
  }

  if (!appUrl) {
    console.error("NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_SITE_URL not set");
    process.exit(1);
  }

  const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/retell/webhook`;
  console.log(`Setting webhook URL to: ${webhookUrl}\n`);

  const client = new Retell({ apiKey });

  // List all agents
  const agents = await client.agent.list();

  for (const agent of agents) {
    console.log(`Updating agent: ${agent.agent_name || agent.agent_id}`);
    console.log(`  Current webhook: ${(agent as any).webhook_url || "NOT SET"}`);

    try {
      await client.agent.update(agent.agent_id, {
        webhook_url: webhookUrl,
      });
      console.log(`  ✓ Updated to: ${webhookUrl}`);
    } catch (error) {
      console.log(`  ✗ Failed: ${error}`);
    }
    console.log("");
  }

  console.log("Done!");
}

main().catch(console.error);
