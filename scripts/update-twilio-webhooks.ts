/**
 * Script to update Twilio phone number webhooks
 * Run with: npx tsx scripts/update-twilio-webhooks.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import twilio from "twilio";

async function main() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;

  if (!accountSid || !authToken) {
    console.error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN required");
    process.exit(1);
  }

  if (!phoneNumber) {
    console.error("TWILIO_PHONE_NUMBER required");
    process.exit(1);
  }

  if (!siteUrl) {
    console.error("NEXT_PUBLIC_SITE_URL or NEXT_PUBLIC_APP_URL required");
    process.exit(1);
  }

  const baseUrl = siteUrl.replace(/\/$/, "");
  console.log(`Updating Twilio webhooks to: ${baseUrl}\n`);

  const client = twilio(accountSid, authToken);

  // Find the phone number
  const numbers = await client.incomingPhoneNumbers.list({
    phoneNumber: phoneNumber,
  });

  if (numbers.length === 0) {
    console.error(`Phone number ${phoneNumber} not found in account`);
    process.exit(1);
  }

  const number = numbers[0];
  console.log(`Found number: ${number.phoneNumber} (${number.friendlyName})`);
  console.log(`  Current voice URL: ${number.voiceUrl || "NOT SET"}`);
  console.log(`  Current SMS URL: ${number.smsUrl || "NOT SET"}`);

  // Update webhooks
  const updated = await client.incomingPhoneNumbers(number.sid).update({
    voiceUrl: `${baseUrl}/api/retell/incoming`,
    voiceMethod: "POST",
    voiceFallbackUrl: `${baseUrl}/api/twilio/fallback`,
    voiceFallbackMethod: "POST",
    smsUrl: `${baseUrl}/api/twilio/sms`,
    smsMethod: "POST",
  });

  console.log(`\n✓ Updated webhooks:`);
  console.log(`  Voice URL: ${updated.voiceUrl}`);
  console.log(`  Voice Fallback: ${updated.voiceFallbackUrl}`);
  console.log(`  SMS URL: ${updated.smsUrl}`);

  console.log("\nDone!");
}

main().catch(console.error);
