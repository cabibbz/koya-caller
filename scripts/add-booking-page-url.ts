/**
 * Script to add booking_page_url support to Retell LLM prompt
 * This patches the existing prompt to include instructions for offering
 * the external booking page URL when customers want to book.
 *
 * Run with: npx ts-node scripts/add-booking-page-url.ts <llm_id>
 */

const RETELL_API_KEY = process.env.RETELL_API_KEY!;

// The section to add to the prompt (after the booking-related section)
const BOOKING_PAGE_URL_SECTION = `

# External Booking Page

If {{booking_page_url}} is set (not empty), the business uses an external booking system (like Vagaro, Square Appointments, Calendly, Fresha, etc.).

When a caller expresses interest in:
- Booking an appointment
- Scheduling a service
- Checking availability
- Making a reservation

AND {{booking_page_url}} is set, you should:

1. Acknowledge their request warmly
2. Explain that the business uses an online booking system
3. Offer to send them a text message with the booking link so they can easily book online
4. If they agree, use the send_sms function to send them the booking page URL with a friendly message like:
   "Thanks for your interest! Here's the link to book your appointment: {{booking_page_url}}"

Example conversation flow:
Caller: "I'd like to book a haircut for this Saturday"
Koya: "I'd be happy to help you book a haircut! We use an online booking system that shows all our available times. Would you like me to send you a text with the booking link? It'll let you see all the available slots and pick the one that works best for you."
Caller: "Yes, please"
Koya: "Perfect! I'm sending that to your phone now. You should receive the link in just a moment. Is there anything else I can help you with?"

If {{booking_page_url}} is empty, use the standard check_availability and book_appointment functions as normal.
`;

async function main() {
  if (!RETELL_API_KEY) {
    console.error("Missing RETELL_API_KEY");
    process.exit(1);
  }

  // Get the LLM ID from command line arg
  const llmId = process.argv[2];

  if (!llmId) {
    console.log("Usage: npx ts-node scripts/add-booking-page-url.ts <llm_id>");
    console.log("Example: npx ts-node scripts/add-booking-page-url.ts llm_6043315ef19be06edbd116f99a75");
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

  // Check if already has booking_page_url section
  if (currentPrompt.includes("booking_page_url")) {
    console.log("✅ Prompt already has booking_page_url section. Nothing to do.");
    return;
  }

  // Find where to insert the section (before # Ending Calls or at the end)
  let insertPoint = currentPrompt.indexOf("# Ending Calls");

  if (insertPoint === -1) {
    // Try to find another good insertion point
    insertPoint = currentPrompt.indexOf("# Taking Messages");
  }

  if (insertPoint === -1) {
    // Just append at the end
    insertPoint = currentPrompt.length;
    console.log("No specific section found, appending at end of prompt.");
  }

  // Insert the new section
  const newPrompt =
    currentPrompt.slice(0, insertPoint) +
    BOOKING_PAGE_URL_SECTION +
    "\n" +
    currentPrompt.slice(insertPoint);

  console.log("New prompt length:", newPrompt.length);

  // Update the LLM
  console.log("Updating LLM with booking_page_url section...");
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

  console.log("✅ Successfully added booking_page_url section to LLM prompt!");
  console.log("\nThe AI will now offer to send the booking page URL when customers want to book.");
  console.log("Make sure to set the booking_page_url in the Connections page for businesses.");
}

main();
