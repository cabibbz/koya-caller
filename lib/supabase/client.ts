import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/types/supabase";

/**
 * Supabase Client (Browser)
 * For use in client components
 * 
 * Note: Once your Supabase database is set up, regenerate types with:
 * npx supabase gen types typescript --project-id <your-project-id> > types/supabase.ts
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
