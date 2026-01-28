/**
 * Voice Preview Proxy API
 * Proxies voice preview audio to avoid any browser restrictions
 */

import { NextRequest, NextResponse } from "next/server";
import { logErrorWithMeta, logWarning } from "@/lib/logging";

// Map of voice IDs to their preview URLs
const VOICE_PREVIEWS: Record<string, string> = {
  "grace-warm": "https://retell-utils-public.s3.us-west-2.amazonaws.com/grace.mp3",
  "jenny-professional": "https://retell-utils-public.s3.us-west-2.amazonaws.com/Jenny.mp3",
  "hailey-energetic": "https://retell-utils-public.s3.us-west-2.amazonaws.com/11labs-9koBc4DQZJE0dLobwFBt.mp3",
  "adrian-professional": "https://retell-utils-public.s3.us-west-2.amazonaws.com/adrian.mp3",
  "brian-warm": "https://retell-utils-public.s3.us-west-2.amazonaws.com/brian.mp3",
  "nico-energetic": "https://retell-utils-public.s3.us-west-2.amazonaws.com/11labs-pdBC2RxjF7wu7aBAu86E.mp3",
};

// Error messages for different failure scenarios
const ERROR_MESSAGES = {
  MISSING_VOICE_ID: "Voice ID is required. Please provide a valid voice ID.",
  VOICE_NOT_FOUND: "The requested voice could not be found. Please select a different voice.",
  FETCH_FAILED: "Unable to load voice preview. The audio service may be temporarily unavailable.",
  FETCH_TIMEOUT: "Voice preview request timed out. Please try again.",
  INVALID_AUDIO: "The voice preview file is invalid or corrupted. Please try a different voice.",
  NETWORK_ERROR: "Network error while fetching voice preview. Please check your connection.",
  UNKNOWN_ERROR: "An unexpected error occurred while loading the voice preview.",
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const voiceId = searchParams.get("id");

  // Validate voice ID is provided
  if (!voiceId) {
    logWarning("Voice Preview", "Request received without voice ID");
    return NextResponse.json(
      { error: ERROR_MESSAGES.MISSING_VOICE_ID, code: "MISSING_VOICE_ID" },
      { status: 400 }
    );
  }

  // Validate voice ID exists in our map
  const previewUrl = VOICE_PREVIEWS[voiceId];
  if (!previewUrl) {
    logWarning("Voice Preview", `Unknown voice ID requested: ${voiceId}`);
    return NextResponse.json(
      { error: ERROR_MESSAGES.VOICE_NOT_FOUND, code: "VOICE_NOT_FOUND", voiceId },
      { status: 404 }
    );
  }

  try {
    // Fetch the audio from S3 with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    let response: Response;
    try {
      response = await fetch(previewUrl, {
        signal: controller.signal,
        headers: {
          "Accept": "audio/mpeg, audio/*",
        },
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);

      // Handle abort (timeout)
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        logErrorWithMeta("Voice Preview", fetchError, {
          voiceId,
          errorType: "timeout",
        });
        return NextResponse.json(
          { error: ERROR_MESSAGES.FETCH_TIMEOUT, code: "FETCH_TIMEOUT", voiceId },
          { status: 504 }
        );
      }

      // Handle network errors
      logErrorWithMeta("Voice Preview", fetchError, {
        voiceId,
        errorType: "network",
      });
      return NextResponse.json(
        { error: ERROR_MESSAGES.NETWORK_ERROR, code: "NETWORK_ERROR", voiceId },
        { status: 502 }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    // Handle non-200 responses from S3
    if (!response.ok) {
      const statusCode = response.status;
      const statusText = response.statusText;

      logErrorWithMeta("Voice Preview", new Error(`S3 fetch failed: ${statusCode} ${statusText}`), {
        voiceId,
        statusCode,
        previewUrl,
        errorType: "s3_error",
      });

      // Map S3 errors to user-friendly messages
      if (statusCode === 404) {
        return NextResponse.json(
          { error: "Voice preview file not found. This voice may no longer be available.", code: "AUDIO_NOT_FOUND", voiceId },
          { status: 404 }
        );
      }

      if (statusCode === 403) {
        return NextResponse.json(
          { error: "Access to voice preview denied. Please try again later.", code: "ACCESS_DENIED", voiceId },
          { status: 502 }
        );
      }

      return NextResponse.json(
        { error: ERROR_MESSAGES.FETCH_FAILED, code: "FETCH_FAILED", voiceId },
        { status: 502 }
      );
    }

    // Read and validate audio buffer
    let audioBuffer: ArrayBuffer;
    try {
      audioBuffer = await response.arrayBuffer();
    } catch (bufferError) {
      logErrorWithMeta("Voice Preview", bufferError, {
        voiceId,
        errorType: "buffer_read",
      });
      return NextResponse.json(
        { error: ERROR_MESSAGES.INVALID_AUDIO, code: "INVALID_AUDIO", voiceId },
        { status: 502 }
      );
    }

    // Validate buffer has content
    if (audioBuffer.byteLength === 0) {
      logErrorWithMeta("Voice Preview", new Error("Empty audio buffer received"), {
        voiceId,
        errorType: "empty_buffer",
      });
      return NextResponse.json(
        { error: ERROR_MESSAGES.INVALID_AUDIO, code: "EMPTY_AUDIO", voiceId },
        { status: 502 }
      );
    }

    // Return with proper audio headers
    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    // Catch-all for unexpected errors
    logErrorWithMeta("Voice Preview", error, {
      voiceId,
      errorType: "unexpected",
    });

    return NextResponse.json(
      { error: ERROR_MESSAGES.UNKNOWN_ERROR, code: "UNKNOWN_ERROR", voiceId },
      { status: 500 }
    );
  }
}
