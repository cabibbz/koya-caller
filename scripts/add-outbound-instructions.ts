/**
 * Script to add outbound_instructions support to Retell LLM prompt
 * This patches the existing prompt to include a section that uses the
 * {{outbound_instructions}} dynamic variable for behavioral guidance.
 *
 * Run with: npx ts-node scripts/add-outbound-instructions.ts
 */

const RETELL_API_KEY = process.env.RETELL_API_KEY!;

// The section to add to the prompt (after Call Direction Detection)
const OUTBOUND_INSTRUCTIONS_SECTION = `

# Custom Campaign Instructions (Outbound Calls)

IMPORTANT: If {{is_outbound}} is "true" and {{outbound_instructions}} is set, you MUST follow these behavioral guidelines throughout the entire call:

{{outbound_instructions}}

These instructions define how you should behave during this outbound campaign. Incorporate them naturally into your conversation style. The instructions may include:
- Personality traits (e.g., be persistent, friendly, empathetic)
- Sales approach (e.g., handle objections, create urgency)
- Specific talking points or goals

Even if the instructions seem different from your base personality, adapt your approach accordingly for this campaign.
`;

async function main() {
  if (!RETELL_API_KEY) {
    console.error("Missing RETELL_API_KEY");
    process.exit(1);
  }

  // Get the LLM ID from command line arg or use default
  const llmId = process.argv[2];

  if (!llmId) {
    console.log("Usage: npx ts-node scripts/add-outbound-instructions.ts <llm_id>");
    console.log("Example: npx ts-node scripts/add-outbound-instructions.ts llm_6043315ef19be06edbd116f99a75");
    process.exit(1);
  }

  console.log(`Fetching LLM ${llmId}...`);

  // Get current LLM config
  const getLlmRes = await fetch(`https://api.retellai.com/get-retell-llm/${llmId}`, {
    headers: { Authorization: `Bearer ${RETELL_API_KEY}` },
  });

  if (!getLlmRes.ok) {
    const errorText = await getLlmRes.text();
    console.error(`Failed to fetch LLM: ${getLlmRes.status} - ${errorText}`);
    process.exit(1);
  }

  const llmConfig = await getLlmRes.json();
  const currentPrompt = llmConfig.general_prompt || "";

  console.log("Current prompt length:", currentPrompt.length);

  // Check if already has outbound_instructions section
  if (currentPrompt.includes("outbound_instructions")) {
    console.log("✅ Prompt already has outbound_instructions section. Nothing to do.");
    return;
  }

  // Find where to insert the section (after "# Call Direction Detection" section)
  const insertPoint = currentPrompt.indexOf("# Personality");

  if (insertPoint === -1) {
    console.error("Could not find # Personality section to insert after. Manual update required.");
    process.exit(1);
  }

  // Insert the new section before # Personality
  const newPrompt =
    currentPrompt.slice(0, insertPoint) +
    OUTBOUND_INSTRUCTIONS_SECTION +
    "\n" +
    currentPrompt.slice(insertPoint);

  console.log("New prompt length:", newPrompt.length);

  // Update the LLM
  console.log("Updating LLM with outbound_instructions section...");
  const updateRes = await fetch(`https://api.retellai.com/update-retell-llm/${llmId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${RETELL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      general_prompt: newPrompt,
    }),
  });

  if (!updateRes.ok) {
    const errorText = await updateRes.text();
    console.error(`Failed to update LLM: ${updateRes.status} - ${errorText}`);
    process.exit(1);
  }

  console.log("✅ Successfully added outbound_instructions section to LLM prompt!");
  console.log("\nThe AI will now follow {{outbound_instructions}} during outbound calls.");
}

main();
