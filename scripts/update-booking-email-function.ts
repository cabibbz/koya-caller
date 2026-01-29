/**
 * Script to update the booking_page_url section to use send_email function
 * This tells the AI to use the send_email function when delivery is "email" or "both"
 *
 * Run with: npx ts-node scripts/update-booking-email-function.ts <llm_id>
 */

const RETELL_API_KEY = process.env.RETELL_API_KEY!;

// The updated section with send_email function
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

## If {{booking_link_delivery}} is "sms":
- Offer to send a text message with the booking link
- If they agree, use the send_sms function with message: "Thanks for your interest! Here's the link to book your appointment: {{booking_page_url}}"

## If {{booking_link_delivery}} is "email":
- Ask for their email address
- Once you have their email, use the send_email function with:
  - to_email: their email address
  - subject: "Your Booking Link"
  - body: "Thanks for your interest! Here's the link to book your appointment: {{booking_page_url}}"

## If {{booking_link_delivery}} is "both":
- Ask the caller: "Would you like me to send you the booking link by text message, email, or both?"
- For text: use send_sms function
- For email: ask for their email address first, then use send_email function
- For both: use both functions

Example conversation flow (SMS):
Caller: "I'd like to book a haircut"
Koya: "I'd be happy to help! We use an online booking system. Would you like me to text you the booking link?"
Caller: "Yes, please"
Koya: [calls send_sms] "Perfect! I'm sending that to your phone now."

Example conversation flow (Email):
Caller: "I'd like to book a haircut"
Koya: "I'd be happy to help! We use an online booking system. What's your email address? I'll send you the booking link."
Caller: "It's john@example.com"
Koya: [calls send_email with to_email="john@example.com"] "Great, I've sent the booking link to john@example.com."

If {{booking_page_url}} is empty, use the standard check_availability and book_appointment functions as normal.
`;

async function main() {
  if (!RETELL_API_KEY) {
    console.error("Missing RETELL_API_KEY");
    process.exit(1);
  }

  const llmId = process.argv[2];

  if (!llmId) {
    console.log("Usage: npx ts-node scripts/update-booking-email-function.ts <llm_id>");
    console.log("Example: npx ts-node scripts/update-booking-email-function.ts llm_6043315ef19be06edbd116f99a75");
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
    console.error("Could not find # External Booking Page section.");
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
  console.log("Updating LLM with send_email function support...");
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

  console.log("✅ Successfully updated booking section with send_email function!");
  console.log("\nThe AI will now use send_email for email delivery of booking links.");
}

main();
