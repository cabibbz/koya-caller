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
    nylasInstance = new Nylas({
      apiKey,
      apiUri: process.env.NYLAS_API_URI || "https://api.us.nylas.com",
    });
  }
  return nylasInstance;
}

export const NYLAS_CLIENT_ID = process.env.NYLAS_CLIENT_ID || "";
export const NYLAS_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/api/calendar/nylas/callback`;
