/**
 * Test script for send_email function
 * Run after connecting Nylas (Google/Outlook) in the Connections page
 *
 * Usage: npx ts-node -r dotenv/config scripts/test-send-email.ts dotenv_config_path=.env.local
 */

import { createClient } from "@supabase/supabase-js";
import Nylas from "nylas";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const NYLAS_API_KEY = process.env.NYLAS_API_KEY!;

// Initialize Nylas client
function getNylasClient() {
  return new Nylas({
    apiKey: NYLAS_API_KEY,
    apiUri: process.env.NYLAS_API_URI || "https://api.us.nylas.com",
  });
}

// Send a message using Nylas REST API directly
async function sendMessage(
  grantId: string,
  params: {
    to: Array<{ name?: string; email: string }>;
    subject: string;
    body: string;
  }
): Promise<{ id: string }> {
  const apiUri = (process.env.NYLAS_API_URI || "https://api.us.nylas.com").replace(/\/$/, "");

  const requestBody = {
    to: params.to.map((r) => ({ name: r.name || "", email: r.email })),
    subject: params.subject,
    body: params.body,
  };

  const response = await fetch(`${apiUri}/v3/grants/${grantId}/messages/send`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${NYLAS_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return { id: data.data?.id || data.id };
}

async function testSendEmail() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  if (!NYLAS_API_KEY) {
    console.error("Missing NYLAS_API_KEY");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Get the first business with an active Nylas grant
  const { data: integrations, error } = await supabase
    .from("calendar_integrations")
    .select("business_id, grant_id, grant_email, grant_status")
    .eq("grant_status", "active")
    .not("grant_id", "is", null)
    .limit(1);

  if (error) {
    console.error("Error fetching integrations:", error);
    process.exit(1);
  }

  if (!integrations || integrations.length === 0) {
    console.log("\nNo business has completed Nylas OAuth yet.");
    console.log("\nTo test email sending:");
    console.log("1. Go to http://localhost:3000/connections");
    console.log("2. Click 'Connect Google' or 'Connect Microsoft'");
    console.log("3. Complete the OAuth flow");
    console.log("4. Run this script again\n");
    process.exit(0);
  }

  const integration = integrations[0];
  console.log(`\nFound active Nylas grant:`);
  console.log(`   Business ID: ${integration.business_id}`);
  console.log(`   Grant ID: ${integration.grant_id}`);
  console.log(`   Email: ${integration.grant_email}`);

  // Test email - send to the same email for testing
  const testEmail = integration.grant_email || "test@example.com";

  console.log(`\nSending test email to: ${testEmail}`);

  try {
    const result = await sendMessage(integration.grant_id, {
      to: [{ email: testEmail }],
      subject: "Koya Test - Booking Link Email",
      body: `
        <h2>Test Email from Koya</h2>
        <p>This is a test of the automated booking link email feature.</p>
        <p>If you're seeing this, the email integration is working!</p>
        <p><strong>Sample booking link:</strong></p>
        <p><a href="https://example.com/book">Click here to book your appointment</a></p>
        <br>
        <p style="color: #666; font-size: 12px;">Sent via Koya AI Receptionist</p>
      `,
    });

    console.log(`\nEmail sent successfully!`);
    console.log(`   Message ID: ${result.id}`);
    console.log(`\nCheck your inbox at: ${testEmail}`);

  } catch (error: any) {
    console.error(`\nFailed to send email:`, error?.message || error);
    if (error?.statusCode === 401) {
      console.log("\nThe Nylas grant may have expired. Try reconnecting in the Connections page.");
    }
  }
}

testSendEmail();
