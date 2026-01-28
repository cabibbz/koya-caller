/**
 * Koya Caller - Voice Samples
 * Static voice sample data for Step 7 (Voice & Personality)
 * Spec Reference: Part 5, Lines 396-404
 *
 * Uses local proxy endpoint to serve voice previews
 * Voice IDs sourced from Retell API /list-voices
 */

import type { VoiceSample } from "@/types/onboarding";

/**
 * Available voice samples for selection
 * Spec: "Play 4-6 sample voices, Male/Female options, Different styles"
 * All voices verified against Retell API as of 2026-01
 * Preview URLs use local proxy to avoid browser issues
 */
export const VOICE_SAMPLES: VoiceSample[] = [
  // Female Voices
  {
    id: "grace-warm",
    name: "Grace",
    gender: "female",
    style: "warm",
    provider: "elevenlabs",
    previewUrl: "/api/voices/preview?id=grace-warm",
    retellVoiceId: "11labs-Grace",
    supportsBilingual: true,
  },
  {
    id: "jenny-professional",
    name: "Jenny",
    gender: "female",
    style: "professional",
    provider: "elevenlabs",
    previewUrl: "/api/voices/preview?id=jenny-professional",
    retellVoiceId: "11labs-Jenny",
    supportsBilingual: true,
  },
  {
    id: "hailey-energetic",
    name: "Hailey",
    gender: "female",
    style: "energetic",
    provider: "elevenlabs",
    previewUrl: "/api/voices/preview?id=hailey-energetic",
    retellVoiceId: "11labs-Hailey",
    supportsBilingual: true,
  },

  // Male Voices
  {
    id: "adrian-professional",
    name: "Adrian",
    gender: "male",
    style: "professional",
    provider: "elevenlabs",
    previewUrl: "/api/voices/preview?id=adrian-professional",
    retellVoiceId: "11labs-Adrian",
    supportsBilingual: true,
  },
  {
    id: "brian-warm",
    name: "Brian",
    gender: "male",
    style: "warm",
    provider: "elevenlabs",
    previewUrl: "/api/voices/preview?id=brian-warm",
    retellVoiceId: "11labs-Brian",
    supportsBilingual: true,
  },
  {
    id: "nico-energetic",
    name: "Nico",
    gender: "male",
    style: "energetic",
    provider: "elevenlabs",
    previewUrl: "/api/voices/preview?id=nico-energetic",
    retellVoiceId: "11labs-Nico",
    supportsBilingual: true,
  },
];

/**
 * Get voices filtered by gender
 */
export function getVoicesByGender(gender: "male" | "female"): VoiceSample[] {
  return VOICE_SAMPLES.filter((voice) => voice.gender === gender);
}

/**
 * Get voices that support bilingual (English + Spanish)
 */
export function getBilingualVoices(): VoiceSample[] {
  return VOICE_SAMPLES.filter((voice) => voice.supportsBilingual);
}

/**
 * Get a voice by ID
 */
export function getVoiceById(id: string): VoiceSample | undefined {
  return VOICE_SAMPLES.find((voice) => voice.id === id);
}

/**
 * Get default greeting template
 * Spec Line 412: "Thanks for calling [Business Name], this is Koya. How can I help you today?"
 */
export function getDefaultGreeting(businessName: string, aiName: string = "Koya"): string {
  return `Thanks for calling ${businessName}, this is ${aiName}. How can I help you today?`;
}

/**
 * Get default Spanish greeting template
 */
export function getDefaultGreetingSpanish(businessName: string, aiName: string = "Koya"): string {
  return `Gracias por llamar a ${businessName}, soy ${aiName}. ¿En qué puedo ayudarle hoy?`;
}

/**
 * Style descriptions for UI display
 */
export const STYLE_DESCRIPTIONS: Record<string, string> = {
  warm: "Friendly and approachable",
  professional: "Clear and businesslike",
  energetic: "Upbeat and enthusiastic",
};
