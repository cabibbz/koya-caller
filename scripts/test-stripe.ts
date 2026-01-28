/**
 * Stripe Integration Test Script
 * Run with: npx tsx scripts/test-stripe.ts
 */

import Stripe from "stripe";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

async function testStripeIntegration() {
  console.log("\n🔍 STRIPE INTEGRATION TEST\n");
  console.log("=".repeat(50));

  // Check environment variables
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const priceStarter = process.env.STRIPE_PRICE_STARTER;
  const pricePro = process.env.STRIPE_PRICE_PROFESSIONAL;
  const priceBusiness = process.env.STRIPE_PRICE_BUSINESS;

  // Determine mode
  const isTestMode = secretKey?.includes("_test_");
  const isLiveMode = secretKey?.includes("_live_");

  console.log(`\n📋 Environment Check:`);
  console.log(`   Mode: ${isTestMode ? "🧪 TEST" : isLiveMode ? "🔴 LIVE" : "❌ UNKNOWN"}`);
  console.log(`   Secret Key: ${secretKey ? "✅ Set" : "❌ Missing"}`);
  console.log(`   Publishable Key: ${publishableKey ? "✅ Set" : "❌ Missing"}`);
  console.log(`   Webhook Secret: ${webhookSecret ? "✅ Set" : "❌ Missing"}`);
  console.log(`   Price (Starter): ${priceStarter ? "✅ Set" : "❌ Missing"}`);
  console.log(`   Price (Professional): ${pricePro ? "✅ Set" : "❌ Missing"}`);
  console.log(`   Price (Business): ${priceBusiness ? "✅ Set" : "❌ Missing"}`);

  if (!secretKey) {
    console.log("\n❌ STRIPE_SECRET_KEY is required. Exiting.");
    process.exit(1);
  }

  // Initialize Stripe
  const stripe = new Stripe(secretKey);

  // Test 1: Verify API key works
  console.log(`\n🔑 Testing API Key...`);
  try {
    const account = await stripe.accounts.retrieve();
    console.log(`   ✅ API Key valid`);
    console.log(`   Account ID: ${account.id}`);
    console.log(`   Business: ${account.business_profile?.name || "Not set"}`);
    console.log(`   Country: ${account.country}`);
  } catch (error: unknown) {
    const err = error as Error;
    console.log(`   ❌ API Key invalid: ${err.message}`);
    process.exit(1);
  }

  // Test 2: Verify price IDs exist
  console.log(`\n💰 Testing Price IDs...`);
  const priceIds = [
    { name: "Starter", id: priceStarter },
    { name: "Professional", id: pricePro },
    { name: "Business", id: priceBusiness },
  ];

  for (const price of priceIds) {
    if (!price.id) {
      console.log(`   ⚠️ ${price.name}: Not configured`);
      continue;
    }
    try {
      const priceData = await stripe.prices.retrieve(price.id);
      const amount = priceData.unit_amount ? priceData.unit_amount / 100 : 0;
      const currency = priceData.currency.toUpperCase();
      const interval = priceData.recurring?.interval || "one-time";
      console.log(`   ✅ ${price.name}: $${amount} ${currency}/${interval}`);
    } catch (error: unknown) {
      const err = error as Error;
      console.log(`   ❌ ${price.name}: ${err.message}`);
    }
  }

  // Test 3: List recent customers (shows API works)
  console.log(`\n👥 Checking Recent Activity...`);
  try {
    const customers = await stripe.customers.list({ limit: 3 });
    console.log(`   Total customers accessible: ${customers.data.length > 0 ? "Yes" : "None yet"}`);

    const subscriptions = await stripe.subscriptions.list({ limit: 3 });
    console.log(`   Active subscriptions: ${subscriptions.data.length}`);
  } catch (error: unknown) {
    const err = error as Error;
    console.log(`   ⚠️ Could not list customers: ${err.message}`);
  }

  // Test 4: Create a test checkout session (dry run)
  console.log(`\n🛒 Testing Checkout Session Creation...`);
  if (priceStarter) {
    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: priceStarter, quantity: 1 }],
        success_url: "https://example.com/success",
        cancel_url: "https://example.com/cancel",
      });
      console.log(`   ✅ Checkout session created: ${session.id}`);
      console.log(`   URL: ${session.url?.substring(0, 60)}...`);

      // Expire it immediately (cleanup)
      await stripe.checkout.sessions.expire(session.id);
      console.log(`   🧹 Test session expired (cleaned up)`);
    } catch (error: unknown) {
      const err = error as Error;
      console.log(`   ❌ Checkout creation failed: ${err.message}`);
    }
  } else {
    console.log(`   ⚠️ Skipped - no Starter price configured`);
  }

  // Summary
  console.log(`\n${"=".repeat(50)}`);
  console.log(`✅ Stripe integration test complete!`);

  if (isTestMode) {
    console.log(`\n💡 You're in TEST mode. To go live:`);
    console.log(`   1. Switch to live API keys (sk_live_*, pk_live_*)`);
    console.log(`   2. Create live price IDs in Stripe dashboard`);
    console.log(`   3. Set up live webhook endpoint`);
  }

  console.log("\n");
}

testStripeIntegration().catch(console.error);
