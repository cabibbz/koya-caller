/**
 * Koya Caller - Voice Samples
 * Static voice sample data for Step 7 (Voice & Personality)
 * Spec Reference: Part 5, Lines 396-404
 * 
 * Uses Retell AI's public voice preview URLs from their S3 bucket
 */

import type { VoiceSample } from "@/types/onboarding";

/**
 * Retell's public S3 bucket for voice previews
 */
const RETELL_VOICE_CDN = "https://retell-utils-public.s3.us-west-2.amazonaws.com";

/**
 * Available voice samples for selection
 * Spec: "Play 4-6 sample voices, Male/Female options, Different styles"
 */
export const VOICE_SAMPLES: VoiceSample[] = [
  // Female Voices
  {
    id: "rachel-warm",
    name: "Rachel",
    gender: "female",
    style: "warm",
    provider: "elevenlabs",
    previewUrl: `${RETELL_VOICE_CDN}/rachel.mp3`,
    retellVoiceId: "11labs-Rachel",
    supportsBilingual: true,
  },
  {
    id: "sarah-professional",
    name: "Sarah",
    gender: "female",
    style: "professional",
    provider: "elevenlabs",
    previewUrl: `${RETELL_VOICE_CDN}/sarah.mp3`,
    retellVoiceId: "11labs-Sarah",
    supportsBilingual: true,
  },
  {
    id: "coral-energetic",
    name: "Coral",
    gender: "female",
    style: "energetic",
    provider: "openai",
    previewUrl: `${RETELL_VOICE_CDN}/coral.mp3`,
    retellVoiceId: "openai-Coral",
    supportsBilingual: false,
  },
  
  // Male Voices
  {
    id: "adrian-professional",
    name: "Adrian",
    gender: "male",
    style: "professional",
    provider: "elevenlabs",
    previewUrl: `${RETELL_VOICE_CDN}/adrian.mp3`,
    retellVoiceId: "11labs-Adrian",
    supportsBilingual: true,
  },
  {
    id: "marcus-warm",
    name: "Marcus",
    gender: "male",
    style: "warm",
    provider: "elevenlabs",
    previewUrl: `${RETELL_VOICE_CDN}/marcus.mp3`,
    retellVoiceId: "11labs-Marcus",
    supportsBilingual: true,
  },
  {
    id: "alloy-energetic",
    name: "Alloy",
    gender: "male",
    style: "energetic",
    provider: "openai",
    previewUrl: `${RETELL_VOICE_CDN}/alloy.mp3`,
    retellVoiceId: "openai-Alloy",
    supportsBilingual: false,
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
