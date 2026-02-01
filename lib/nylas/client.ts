/**
 * Nylas v3 SDK Client
 * Singleton initialization for server-side usage
 */

import Nylas from "nylas";

let nylasInstance: Nylas | null = null;

export function getNylasClient(): Nylas {
  if (!nylasInstance) {
    const apiKey = process.env.NYLAS_API_KEY;
    if (!apiKey) {
      throw new Error("NYLAS_API_KEY environment variable is not set");
    }
    // Remove trailing slash from API URI to prevent double slashes
    const apiUri = (process.env.NYLAS_API_URI || "https://api.us.nylas.com").replace(/\/$/, "");
    console.log("[Nylas Client] Initializing with API URI:", apiUri, "API Key prefix:", apiKey.substring(0, 10) + "...");
    nylasInstance = new Nylas({
      apiKey,
      apiUri,
    });
  }
  return nylasInstance;
}

export const NYLAS_CLIENT_ID = process.env.NYLAS_CLIENT_ID || "";

// Remove trailing slash from base URL to prevent double slashes
const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
export const NYLAS_REDIRECT_URI = `${baseUrl}/api/calendar/nylas/callback`;
