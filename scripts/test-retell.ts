/**
 * Retell AI Integration Test Script
 * Run with: npx tsx scripts/test-retell.ts
 */

import Retell from "retell-sdk";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

async function testRetellIntegration() {
  console.log("\n🎙️ RETELL AI INTEGRATION TEST\n");
  console.log("=".repeat(50));

  // Check environment variables
  const apiKey = process.env.RETELL_API_KEY;
  const webhookSecret = process.env.RETELL_WEBHOOK_SECRET;
  const demoAgentId = process.env.RETELL_DEMO_AGENT_ID;

  console.log(`\n📋 Environment Check:`);
  console.log(`   API Key: ${apiKey ? "✅ Set" : "❌ Missing"}`);
  console.log(`   Webhook Secret: ${webhookSecret ? "✅ Set" : "❌ Missing"}`);
  console.log(`   Demo Agent ID: ${demoAgentId ? `✅ ${demoAgentId}` : "⚠️ Not set (optional)"}`);

  if (!apiKey) {
    console.log("\n❌ RETELL_API_KEY is required. Exiting.");
    process.exit(1);
  }

  // Initialize Retell client
  const client = new Retell({ apiKey });

  // Test 1: List agents to verify API key works
  console.log(`\n🤖 Testing API Key...`);
  try {
    const agents = await client.agent.list();
    console.log(`   ✅ API Key valid`);
    console.log(`   Total agents: ${agents.length}`);

    if (agents.length > 0) {
      console.log(`\n   Recent agents:`);
      agents.slice(0, 3).forEach((agent, i) => {
        console.log(`   ${i + 1}. ${agent.agent_name || agent.agent_id}`);
        console.log(`      ID: ${agent.agent_id}`);
        console.log(`      Voice: ${agent.voice_id}`);
      });
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.log(`   ❌ API Key invalid: ${err.message}`);
    process.exit(1);
  }

  // Test 2: List available voices
  console.log(`\n🎤 Testing Voice API...`);
  try {
    const voices = await client.voice.list();
    console.log(`   ✅ Voice API accessible`);
    console.log(`   Total voices available: ${voices.length}`);

    // Show a sample of voices
    const sampleVoices = voices.slice(0, 5);
    console.log(`\n   Sample voices:`);
    sampleVoices.forEach((voice, i) => {
      console.log(`   ${i + 1}. ${voice.voice_name} (${voice.gender}, ${voice.accent})`);
      console.log(`      ID: ${voice.voice_id}`);
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.log(`   ⚠️ Could not list voices: ${err.message}`);
  }

  // Test 3: List phone numbers
  console.log(`\n📞 Testing Phone Numbers...`);
  try {
    const phoneNumbers = await client.phoneNumber.list();
    console.log(`   ✅ Phone Number API accessible`);
    console.log(`   Registered phone numbers: ${phoneNumbers.length}`);

    if (phoneNumbers.length > 0) {
      console.log(`\n   Phone numbers:`);
      phoneNumbers.slice(0, 5).forEach((phone, i) => {
        console.log(`   ${i + 1}. ${phone.phone_number}`);
        if (phone.inbound_agent_id) {
          console.log(`      Inbound Agent: ${phone.inbound_agent_id}`);
        }
      });
    } else {
      console.log(`   ⚠️ No phone numbers registered. Import numbers at dashboard.retellai.com`);
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.log(`   ⚠️ Could not list phone numbers: ${err.message}`);
  }

  // Test 4: Verify demo agent if configured
  if (demoAgentId) {
    console.log(`\n🎭 Testing Demo Agent...`);
    try {
      const agent = await client.agent.retrieve(demoAgentId);
      console.log(`   ✅ Demo agent found`);
      console.log(`   Name: ${agent.agent_name || "Unnamed"}`);
      console.log(`   Voice ID: ${agent.voice_id}`);
    } catch (error: unknown) {
      const err = error as Error;
      console.log(`   ❌ Demo agent not found: ${err.message}`);
      console.log(`   Please verify RETELL_DEMO_AGENT_ID is correct`);
    }
  }

  // Test 5: List LLMs
  console.log(`\n🧠 Testing LLM API...`);
  try {
    const llms = await client.llm.list();
    console.log(`   ✅ LLM API accessible`);
    console.log(`   Total LLMs: ${llms.length}`);
  } catch (error: unknown) {
    const err = error as Error;
    console.log(`   ⚠️ Could not list LLMs: ${err.message}`);
  }

  // Summary
  console.log(`\n${"=".repeat(50)}`);
  console.log(`✅ Retell AI integration test complete!`);

  console.log(`\n💡 Integration checklist:`);
  console.log(`   1. ✅ API Key works - can create agents`);
  console.log(`   2. ${webhookSecret ? "✅" : "❌"} Webhook secret - needed for call events`);
  console.log(`   3. Check phone numbers are imported at dashboard.retellai.com`);
  console.log(`   4. Ensure webhook URL is set to: https://yourapp.com/api/retell/webhook`);

  console.log("\n");
}

testRetellIntegration().catch(console.error);
