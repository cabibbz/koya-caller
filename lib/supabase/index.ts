/**
 * Supabase Library Index
 */

// Client (browser)
export { createClient } from "./client";

// Server
export { createClient as createServerClient, createAdminClient, createServiceClient } from "./server";

// Middleware helper
export { updateSession } from "./middleware";
