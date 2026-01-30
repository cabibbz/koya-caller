/**
 * Koya Caller - Inngest API Route
 * Session 21: Background Jobs
 * Spec Reference: Part 16, Lines 1918-1968
 *
 * This route serves as the webhook endpoint for Inngest.
 * Inngest will call this endpoint to execute background functions.
 */

import { serve } from "inngest/next";
import { inngest, functions } from "@/lib/inngest";

// Create the serve handler for Next.js App Router
// Use the base Inngest client for the serve handler (our wrapper is for send() only)
export const { GET, POST, PUT } = serve({
  client: inngest._base,
  functions,
});
