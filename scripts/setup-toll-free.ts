/**
 * Script to purchase and configure a toll-free number
 * Run with: npx tsx scripts/setup-toll-free.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import twilio from "twilio";

async function main() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;

  if (!accountSid || !authToken) {
    console.error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN required");
    process.exit(1);
  }

  if (!siteUrl) {
    console.error("NEXT_PUBLIC_SITE_URL required");
    process.exit(1);
  }

  const baseUrl = siteUrl.replace(/\/$/, "");
  const client = twilio(accountSid, authToken);

  console.log("Searching for available toll-free numbers...\n");

  // Search for available toll-free numbers
  const available = await client.availablePhoneNumbers("US")
    .tollFree.list({
      smsEnabled: true,
      voiceEnabled: true,
      limit: 5,
    });

  if (available.length === 0) {
    console.error("No toll-free numbers available");
    process.exit(1);
  }

  console.log("Available toll-free numbers:");
  available.forEach((num, i) => {
    console.log(`  ${i + 1}. ${num.friendlyName} (${num.phoneNumber})`);
  });

  // Purchase the first one
  const selectedNumber = available[0];
  console.log(`\nPurchasing: ${selectedNumber.phoneNumber}...`);

  const purchased = await client.incomingPhoneNumbers.create({
    phoneNumber: selectedNumber.phoneNumber,
    voiceUrl: `${baseUrl}/api/retell/incoming`,
    voiceMethod: "POST",
    voiceFallbackUrl: `${baseUrl}/api/twilio/fallback`,
    voiceFallbackMethod: "POST",
    smsUrl: `${baseUrl}/api/twilio/sms`,
    smsMethod: "POST",
  });

  console.log("\n✓ Toll-free number purchased and configured!");
  console.log(`  Number: ${purchased.phoneNumber}`);
  console.log(`  SID: ${purchased.sid}`);
  console.log(`  Voice URL: ${purchased.voiceUrl}`);
  console.log(`  SMS URL: ${purchased.smsUrl}`);

  console.log("\n===========================================");
  console.log("NEXT STEPS:");
  console.log("===========================================");
  console.log(`1. Update .env.local with: TWILIO_PHONE_NUMBER=${purchased.phoneNumber}`);
  console.log("2. Add this number to Retell dashboard");
  console.log("3. Submit toll-free verification in Twilio console");
  console.log("   https://console.twilio.com/us1/develop/phone-numbers/manage/toll-free-verification");
  console.log("===========================================\n");
}

main().catch(console.error);
