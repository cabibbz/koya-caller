/**
 * Koya Caller - Carrier Forwarding Instructions
 * Call forwarding instructions by carrier for Step 8
 * Spec Reference: Part 5, Lines 493-520 + Appendix A (Lines 2452-2596)
 */

import type { PhoneProvider } from "@/types/onboarding";

export interface CarrierInstructions {
  provider: PhoneProvider;
  name: string;
  enableSteps: string[];
  enableCode: string;
  disableCode: string;
  notes: string[];
  helpUrl?: string;
}

/**
 * Call forwarding instructions by carrier
 * From Appendix A: Call Forwarding Help Center
 */
export const CARRIER_INSTRUCTIONS: Record<PhoneProvider, CarrierInstructions> = {
  att: {
    provider: "att",
    name: "AT&T",
    enableSteps: [
      "From your AT&T business phone, dial: *72",
      "Enter your Koya number (e.g., 5551234567)",
      "Press # or wait for confirmation tone",
      "You'll hear a confirmation tone - forwarding is now active",
    ],
    enableCode: "*72",
    disableCode: "*73",
    notes: [
      "Call forwarding may incur additional charges (~$5-10/month)",
      "Check your AT&T business plan for details",
      "Forwarded calls still count against your AT&T minutes (if applicable)",
    ],
    helpUrl: "https://www.att.com/support/article/local-long-distance/KM1000839/",
  },
  
  verizon: {
    provider: "verizon",
    name: "Verizon",
    enableSteps: [
      "From your Verizon business phone, dial: *72",
      "Enter your Koya number (e.g., 5551234567)",
      "Press # or wait",
      "Wait for confirmation tone",
    ],
    enableCode: "*72",
    disableCode: "*73",
    notes: [
      "Business accounts may need to enable this feature first",
      "Contact Verizon Business support if *72 doesn't work: 1-800-922-0204",
    ],
    helpUrl: "https://www.verizon.com/support/call-forwarding-faqs/",
  },
  
  tmobile: {
    provider: "tmobile",
    name: "T-Mobile",
    enableSteps: [
      "From your T-Mobile phone, dial: **21*[Koya number]#",
      "Example: **21*5551234567#",
      "Press Call/Send",
      "Wait for confirmation message",
    ],
    enableCode: "**21*[number]#",
    disableCode: "##21#",
    notes: [
      "You can also set this up via the T-Mobile app",
      "Go to Account → Line Settings → Call Forwarding",
    ],
    helpUrl: "https://www.t-mobile.com/support/plans-features/call-forwarding",
  },
  
  spectrum: {
    provider: "spectrum",
    name: "Spectrum Business",
    enableSteps: [
      "Log in to your Spectrum Business account",
      "Go to Voice Settings → Call Forwarding",
      "Enter your Koya number",
      "Save changes",
    ],
    enableCode: "*72",
    disableCode: "*73",
    notes: [
      "You can also dial *72 from your Spectrum phone",
      "Enter your Koya number and wait for confirmation",
    ],
    helpUrl: "https://www.spectrum.net/support/voice/how-use-call-forwarding",
  },
  
  comcast: {
    provider: "comcast",
    name: "Comcast Business",
    enableSteps: [
      "Log in to your Comcast Business MyAccount",
      "Navigate to Phone Settings",
      "Select Call Forwarding",
      "Enter your Koya number and save",
    ],
    enableCode: "*72",
    disableCode: "*73",
    notes: [
      "You can also dial *72 + Koya number from your Comcast phone",
      "Wait for the confirmation tone",
    ],
    helpUrl: "https://business.comcast.com/help-and-support/voice/call-forwarding",
  },
  
  voip: {
    provider: "voip",
    name: "VoIP Provider",
    enableSteps: [
      "Log in to your VoIP provider's admin panel",
      "Navigate to Call Settings or Call Routing",
      "Find the Call Forwarding option",
      "Enter your Koya number as the forwarding destination",
      "Save your changes",
    ],
    enableCode: "Varies by provider",
    disableCode: "Varies by provider",
    notes: [
      "Common VoIP providers: RingCentral, Vonage, Grasshopper, Google Voice",
      "Each provider has a different settings interface",
      "Look for 'Call Forwarding', 'Call Routing', or 'Answering Rules'",
      "Contact your VoIP provider's support if you need help",
    ],
  },
  
  other: {
    provider: "other",
    name: "Other Provider",
    enableSteps: [
      "Contact your phone provider for call forwarding instructions",
      "Most providers use *72 + forwarding number to enable",
      "Most providers use *73 to disable",
      "Some may require activating the feature through an online portal",
    ],
    enableCode: "*72 (most common)",
    disableCode: "*73 (most common)",
    notes: [
      "If you're unsure of your provider, check your phone bill",
      "Call forwarding may have additional monthly charges",
      "Contact us if you need help setting up forwarding",
    ],
  },
};

/**
 * Get instructions for a specific carrier
 */
export function getCarrierInstructions(provider: PhoneProvider): CarrierInstructions {
  return CARRIER_INSTRUCTIONS[provider];
}

/**
 * Format a phone number for display in instructions
 * E.164 (+14155551234) -> Plain digits (4155551234)
 */
export function formatNumberForDialing(e164Number: string): string {
  // Remove the + and country code (assuming US +1)
  return e164Number.replace(/^\+1/, "");
}

/**
 * Format the enable code with the actual Koya number
 */
export function formatEnableCode(provider: PhoneProvider, koyaNumber: string): string {
  const plainNumber = formatNumberForDialing(koyaNumber);
  const instructions = CARRIER_INSTRUCTIONS[provider];
  
  if (provider === "tmobile") {
    return `**21*${plainNumber}#`;
  }
  
  return `${instructions.enableCode}${plainNumber}`;
}
