/**
 * Retell Voices API
 * Fetches available voices from Retell with preview audio URLs
 */

import { NextResponse } from "next/server";
import { getRetellClient, isRetellConfigured } from "@/lib/retell";

// Fallback voices for when Retell is not configured
// All voice IDs verified against Retell API as of 2026-01
const FALLBACK_VOICES = [
  {
    voice_id: "11labs-Grace",
    voice_name: "Grace",
    provider: "elevenlabs",
    gender: "female",
    accent: "American",
    age: "Middle-aged",
    preview_audio_url: "https://retell-utils-public.s3.us-west-2.amazonaws.com/grace.mp3",
  },
  {
    voice_id: "11labs-Jenny",
    voice_name: "Jenny",
    provider: "elevenlabs",
    gender: "female",
    accent: "American",
    age: "Young",
    preview_audio_url: "https://retell-utils-public.s3.us-west-2.amazonaws.com/Jenny.mp3",
  },
  {
    voice_id: "11labs-Adrian",
    voice_name: "Adrian",
    provider: "elevenlabs",
    gender: "male",
    accent: "American",
    age: "Young",
    preview_audio_url: "https://retell-utils-public.s3.us-west-2.amazonaws.com/adrian.mp3",
  },
  {
    voice_id: "11labs-Brian",
    voice_name: "Brian",
    provider: "elevenlabs",
    gender: "male",
    accent: "American",
    age: "Young",
    preview_audio_url: "https://retell-utils-public.s3.us-west-2.amazonaws.com/brian.mp3",
  },
];

export async function GET() {
  try {
    if (!isRetellConfigured()) {
      // Return fallback voices in mock mode
      return NextResponse.json({
        success: true,
        voices: FALLBACK_VOICES,
        mock: true,
      });
    }

    const client = getRetellClient();
    if (!client) {
      return NextResponse.json({
        success: true,
        voices: FALLBACK_VOICES,
        mock: true,
      });
    }

    // Fetch voices from Retell API
    const voices = await client.voice.list();

    // Filter to only include ElevenLabs voices (most commonly used)
    // and map to a consistent format
    const formattedVoices = voices
      .filter((voice) => voice.provider === "elevenlabs" || voice.provider === "openai")
      .slice(0, 12) // Limit to 12 voices for UI
      .map((voice) => ({
        voice_id: voice.voice_id,
        voice_name: voice.voice_name,
        provider: voice.provider,
        gender: voice.gender,
        accent: voice.accent || "American",
        age: voice.age || "Adult",
        preview_audio_url: voice.preview_audio_url || null,
      }));

    return NextResponse.json({
      success: true,
      voices: formattedVoices.length > 0 ? formattedVoices : FALLBACK_VOICES,
    });
  } catch (_error) {
    return NextResponse.json({
      success: true,
      voices: FALLBACK_VOICES,
      error: "Failed to fetch from Retell, using fallback voices",
    });
  }
}
