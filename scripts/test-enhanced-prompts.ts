/**
 * Test script for the Enhanced Prompt System
 * Run with: npx tsx scripts/test-enhanced-prompts.ts
 */

import {
  // Error templates
  getFullErrorResponse,
  type Personality,

  // Industry prompts
  getIndustryEnhancement,
  generateIndustryContextSection,

  // Sentiment
  generateSentimentInstructions,
  detectSentimentLevel,

  // Few-shot examples
  getRelevantExamples,

  // Caller context
  buildCallerContextPrompt,
  getPersonalizedGreeting,
  type CallerContext,
} from "../lib/claude";

console.log("=".repeat(60));
console.log("ENHANCED PROMPT SYSTEM - TEST SUITE");
console.log("=".repeat(60));

// Test 1: Error Templates
console.log("\n📋 TEST 1: Personality-Aware Error Messages\n");

const personalities: Personality[] = ["professional", "friendly", "casual"];
const errorType = "availability_check_failed";

for (const personality of personalities) {
  console.log(`[${personality.toUpperCase()}]`);
  console.log(getFullErrorResponse(errorType, personality));
  console.log();
}

// Test 2: Industry Prompts
console.log("\n🏢 TEST 2: Industry-Specific Enhancements\n");

const industries = ["dental", "restaurant", "legal"];
for (const industry of industries) {
  const enhancement = getIndustryEnhancement(industry);
  console.log(`[${enhancement.displayName}]`);
  console.log(`  Terminology: ${enhancement.terminology.slice(0, 5).join(", ")}...`);
  console.log(`  Urgency keywords: ${enhancement.urgencyKeywords.slice(0, 3).join(", ")}...`);
  console.log(`  Guardrails: ${enhancement.guardrails.length} rules`);
  console.log();
}

// Test 3: Sentiment Detection
console.log("\n😊 TEST 3: Sentiment Detection\n");

const testPhrases = [
  "Thank you so much, this is exactly what I needed!",
  "I've been waiting for 20 minutes already, can we speed this up?",
  "This is ridiculous, I've called three times and no one can help!",
  "I'm going to sue you if this isn't fixed immediately!",
];

for (const phrase of testPhrases) {
  const sentiment = detectSentimentLevel(phrase);
  console.log(`"${phrase.substring(0, 50)}..."`);
  console.log(`  → Detected: ${sentiment}`);
  console.log();
}

// Test 4: Caller Context
console.log("\n👤 TEST 4: Caller Context Personalization\n");

const newCaller: CallerContext = {
  isRepeatCaller: false,
  knownName: null,
  knownEmail: null,
  previousCallCount: 0,
  lastCallOutcome: null,
  lastCallDate: null,
  knownPreferences: {},
  appointmentHistory: { count: 0, lastServiceBooked: null, lastAppointmentDate: null },
};

const repeatCaller: CallerContext = {
  isRepeatCaller: true,
  knownName: "Sarah Johnson",
  knownEmail: "sarah@example.com",
  previousCallCount: 5,
  lastCallOutcome: "booked",
  lastCallDate: "2025-01-05",
  knownPreferences: { preferredService: "Cleaning", preferredTime: "morning" },
  appointmentHistory: { count: 3, lastServiceBooked: "Cleaning", lastAppointmentDate: "2025-01-05" },
};

console.log("[NEW CALLER]");
console.log(getPersonalizedGreeting(newCaller, "Sunrise Dental", "Koya"));
console.log();

console.log("[REPEAT CALLER - Sarah Johnson]");
console.log(getPersonalizedGreeting(repeatCaller, "Sunrise Dental", "Koya"));
console.log();

console.log("[CALLER CONTEXT PROMPT SECTION]");
console.log(buildCallerContextPrompt(repeatCaller, "en").trim());
console.log();

// Test 5: Few-Shot Examples
console.log("\n📝 TEST 5: Few-Shot Examples\n");

const examples = getRelevantExamples("friendly", "dental", "en", 2);
console.log(`Found ${examples.length} relevant examples for friendly dental:`);
for (const ex of examples) {
  console.log(`  - ${ex.category}: ${ex.context}`);
}
console.log();

// Test 6: Full Industry Context Section
console.log("\n🎯 TEST 6: Full Industry Context Section (Dental + Professional)\n");
console.log(generateIndustryContextSection("dental", "professional", "en"));

// Test 7: Sentiment Instructions
console.log("\n💭 TEST 7: Sentiment Instructions Sample (Friendly)\n");
const sentimentInstructions = generateSentimentInstructions("friendly", "en");
console.log(sentimentInstructions.substring(0, 1000) + "...\n");

console.log("=".repeat(60));
console.log("✅ All tests completed!");
console.log("=".repeat(60));
