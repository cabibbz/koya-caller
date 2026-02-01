/**
 * Script to update the booking_page_url section to include delivery method
 * This patches the existing prompt to respect the booking_link_delivery setting.
 *
 * Run with: npx ts-node scripts/update-booking-delivery.ts <llm_id>
 */

const RETELL_API_KEY = process.env.RETELL_API_KEY!;

// The updated section that includes delivery method
const UPDATED_BOOKING_SECTION = `

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
3. Check {{booking_link_delivery}} to determine how to send the link:
   - If "sms": Offer to send a text message with the booking link
   - If "email": Ask for their email address and offer to send the booking link via email
   - If "both": Offer to send via text message AND/OR email (let them choose or do both)
4. Use the appropriate function:
   - For SMS: use send_sms with message: "Thanks for your interest! Here's the link to book your appointment: {{booking_page_url}}"
   - For Email: use send_sms (which can also send emails) with the booking link and ask for their email first

Example conversation flow (SMS - {{booking_link_delivery}} is "sms"):
Caller: "I'd like to book a haircut for this Saturday"
Koya: "I'd be happy to help you book a haircut! We use an online booking system that shows all our available times. Would you like me to send you a text with the booking link?"
Caller: "Yes, please"
Koya: "Perfect! I'm sending that to your phone now."

Example conversation flow (Email - {{booking_link_delivery}} is "email"):
Caller: "I'd like to book a haircut for this Saturday"
Koya: "I'd be happy to help you book a haircut! We use an online booking system. What's your email address? I'll send you the booking link."
Caller: "It's john@email.com"
Koya: "Great, I'm sending the booking link to john@email.com now."

Example conversation flow (Both - {{booking_link_delivery}} is "both"):
Caller: "I'd like to book a haircut for this Saturday"
Koya: "I'd be happy to help you book a haircut! We use an online booking system. Would you like me to send you the booking link by text message, email, or both?"

If {{booking_page_url}} is empty, use the standard check_availability and book_appointment functions as normal.
`;

async function main() {
  if (!RETELL_API_KEY) {
    console.error("Missing RETELL_API_KEY");
    process.exit(1);
  }

  const llmId = process.argv[2];

  if (!llmId) {
    console.log("Usage: npx ts-node scripts/update-booking-delivery.ts <llm_id>");
    console.log("Example: npx ts-node scripts/update-booking-delivery.ts llm_6043315ef19be06edbd116f99a75");
    process.exit(1);
  }

  console.log(`Fetching LLM ${llmId}...`);

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

  // Find and replace the existing booking section
  const bookingSectionStart = currentPrompt.indexOf("# External Booking Page");

  if (bookingSectionStart === -1) {
    console.error("Could not find # External Booking Page section. Run add-booking-page-url.ts first.");
    process.exit(1);
  }

  // Find the end of the booking section (next # header or end of prompt)
  let bookingSectionEnd = currentPrompt.indexOf("\n#", bookingSectionStart + 1);
  if (bookingSectionEnd === -1) {
    bookingSectionEnd = currentPrompt.length;
  }

  // Replace the booking section
  const newPrompt =
    currentPrompt.slice(0, bookingSectionStart) +
    UPDATED_BOOKING_SECTION.trim() +
    "\n" +
    currentPrompt.slice(bookingSectionEnd);

  console.log("New prompt length:", newPrompt.length);

  // Update the LLM
  console.log("Updating LLM with delivery method support...");
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

  console.log("✅ Successfully updated booking section with delivery method support!");
  console.log("\nThe AI will now respect the booking_link_delivery setting (sms, email, or both).");
}

main();
