/**
 * Twilio Integration Test Script
 * Run with: npx tsx scripts/test-twilio.ts
 */

import Twilio from "twilio";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

async function testTwilioIntegration() {
  console.log("\n📱 TWILIO INTEGRATION TEST\n");
  console.log("=".repeat(50));

  // Check environment variables
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

  // Determine mode
  const isTestMode = accountSid?.startsWith("AC") && accountSid?.includes("test");

  console.log(`\n📋 Environment Check:`);
  console.log(`   Mode: ${isTestMode ? "🧪 TEST" : "🔴 LIVE/PRODUCTION"}`);
  console.log(`   Account SID: ${accountSid ? `✅ ${accountSid.substring(0, 8)}...` : "❌ Missing"}`);
  console.log(`   Auth Token: ${authToken ? "✅ Set" : "❌ Missing"}`);
  console.log(`   Phone Number: ${phoneNumber ? `✅ ${phoneNumber}` : "⚠️ Not set"}`);
  console.log(`   Messaging Service: ${messagingServiceSid ? `✅ ${messagingServiceSid}` : "⚠️ Not set"}`);

  if (!accountSid || !authToken) {
    console.log("\n❌ TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required. Exiting.");
    process.exit(1);
  }

  // Initialize Twilio client
  const client = Twilio(accountSid, authToken);

  // Test 1: Verify account credentials
  console.log(`\n🔑 Testing API Credentials...`);
  try {
    const account = await client.api.accounts(accountSid).fetch();
    console.log(`   ✅ Credentials valid`);
    console.log(`   Account Name: ${account.friendlyName}`);
    console.log(`   Status: ${account.status}`);
    console.log(`   Type: ${account.type}`);
  } catch (error: unknown) {
    const err = error as Error;
    console.log(`   ❌ Credentials invalid: ${err.message}`);
    process.exit(1);
  }

  // Test 2: List phone numbers
  console.log(`\n📞 Checking Phone Numbers...`);
  try {
    const incomingNumbers = await client.incomingPhoneNumbers.list({ limit: 10 });
    console.log(`   ✅ Phone numbers accessible`);
    console.log(`   Total numbers: ${incomingNumbers.length}`);

    if (incomingNumbers.length > 0) {
      console.log(`\n   Your phone numbers:`);
      incomingNumbers.forEach((num, i) => {
        console.log(`   ${i + 1}. ${num.phoneNumber}`);
        console.log(`      Friendly Name: ${num.friendlyName}`);
        console.log(`      Voice URL: ${num.voiceUrl || "Not set"}`);
        console.log(`      SMS URL: ${num.smsUrl || "Not set"}`);
      });
    } else {
      console.log(`   ⚠️ No phone numbers provisioned`);
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.log(`   ⚠️ Could not list phone numbers: ${err.message}`);
  }

  // Test 3: Check messaging service if configured
  if (messagingServiceSid) {
    console.log(`\n📨 Testing Messaging Service...`);
    try {
      const service = await client.messaging.v1.services(messagingServiceSid).fetch();
      console.log(`   ✅ Messaging service found`);
      console.log(`   Name: ${service.friendlyName}`);
      console.log(`   Use Case: ${service.usecase}`);

      // List phone numbers in the service
      const serviceNumbers = await client.messaging.v1
        .services(messagingServiceSid)
        .phoneNumbers.list({ limit: 5 });
      console.log(`   Phone numbers in service: ${serviceNumbers.length}`);
    } catch (error: unknown) {
      const err = error as Error;
      console.log(`   ⚠️ Messaging service issue: ${err.message}`);
    }
  }

  // Test 4: Check recent calls
  console.log(`\n📊 Checking Recent Activity...`);
  try {
    const recentCalls = await client.calls.list({ limit: 5 });
    console.log(`   Recent calls: ${recentCalls.length}`);

    if (recentCalls.length > 0) {
      console.log(`\n   Latest call:`);
      const latestCall = recentCalls[0];
      console.log(`   Direction: ${latestCall.direction}`);
      console.log(`   Status: ${latestCall.status}`);
      console.log(`   Duration: ${latestCall.duration}s`);
    }

    const recentMessages = await client.messages.list({ limit: 5 });
    console.log(`   Recent messages: ${recentMessages.length}`);
  } catch (error: unknown) {
    const err = error as Error;
    console.log(`   ⚠️ Could not fetch activity: ${err.message}`);
  }

  // Test 5: Check available phone numbers (search)
  console.log(`\n🔍 Testing Number Search...`);
  try {
    const available = await client.availablePhoneNumbers("US")
      .local.list({ areaCode: 407, limit: 3 });
    console.log(`   ✅ Number search works`);
    console.log(`   Sample available numbers in area code 407:`);
    available.forEach((num, i) => {
      console.log(`   ${i + 1}. ${num.phoneNumber} (${num.locality}, ${num.region})`);
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.log(`   ⚠️ Number search issue: ${err.message}`);
  }

  // Test 6: Check account balance
  console.log(`\n💰 Checking Account Balance...`);
  try {
    const balance = await client.balance.fetch();
    console.log(`   ✅ Balance: ${balance.currency} ${balance.balance}`);
  } catch (error: unknown) {
    const err = error as Error;
    console.log(`   ⚠️ Could not fetch balance: ${err.message}`);
  }

  // Summary
  console.log(`\n${"=".repeat(50)}`);
  console.log(`✅ Twilio integration test complete!`);

  console.log(`\n💡 Integration checklist:`);
  console.log(`   1. ✅ API credentials work`);
  console.log(`   2. ${phoneNumber ? "✅" : "⚠️"} Twilio phone number configured`);
  console.log(`   3. ${messagingServiceSid ? "✅" : "⚠️"} Messaging service (A2P 10DLC) configured`);
  console.log(`   4. Ensure webhook URLs point to your app:`);
  console.log(`      Voice: https://yourapp.com/api/twilio/webhook`);
  console.log(`      SMS: https://yourapp.com/api/twilio/sms`);

  console.log("\n");
}

testTwilioIntegration().catch(console.error);
