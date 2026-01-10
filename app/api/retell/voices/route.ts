/**
 * Retell Voices API
 * Fetches available voices from Retell with preview audio URLs
 */

import { NextResponse } from "next/server";
import { getRetellClient, isRetellConfigured } from "@/lib/retell";

// Fallback voices for when Retell is not configured
const FALLBACK_VOICES = [
  {
    voice_id: "11labs-Rachel",
    voice_name: "Rachel",
    provider: "elevenlabs",
    gender: "female",
    accent: "American",
    age: "Young",
    preview_audio_url: null,
  },
  {
    voice_id: "11labs-Sarah",
    voice_name: "Sarah",
    provider: "elevenlabs",
    gender: "female",
    accent: "American",
    age: "Middle-aged",
    preview_audio_url: null,
  },
  {
    voice_id: "11labs-Adam",
    voice_name: "Adam",
    provider: "elevenlabs",
    gender: "male",
    accent: "American",
    age: "Middle-aged",
    preview_audio_url: null,
  },
  {
    voice_id: "11labs-Josh",
    voice_name: "Josh",
    provider: "elevenlabs",
    gender: "male",
    accent: "American",
    age: "Young",
    preview_audio_url: null,
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
  } catch (error) {
    console.error("[Retell Voices] Error fetching voices:", error);
    return NextResponse.json({
      success: true,
      voices: FALLBACK_VOICES,
      error: "Failed to fetch from Retell, using fallback voices",
    });
  }
}
