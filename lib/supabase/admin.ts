/**
 * Supabase Admin Client
 * Session 19: Dashboard - Billing & Admin
 * 
 * Re-exports the admin client from server.ts for cleaner imports.
 * This client uses the service role key and bypasses RLS.
 * 
 * Use cases:
 * - Webhook handlers (no user session)
 * - Background jobs
 * - System-level operations
 */

export { createAdminClient, createServiceClient } from "./server";
