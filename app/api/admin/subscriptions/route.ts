/**
 * Admin Subscriptions API Route
 * Get all subscriptions with details
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logging";
import { success, errors } from "@/lib/api/responses";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return errors.unauthorized();
    }
    if (user.app_metadata?.is_admin !== true) {
      return errors.forbidden();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: businesses, error } = await (supabase as any)
      .from("businesses")
      .select(`
        id,
        name,
        subscription_status,
        minutes_used_this_cycle,
        minutes_included,
        current_cycle_start,
        current_cycle_end,
        stripe_customer_id,
        stripe_subscription_id,
        plan_id,
        plans (id, name, price_cents, included_minutes),
        users (email, phone)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      logError("Admin Subscriptions GET", error);
      return errors.internalError("Failed to fetch subscriptions");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response mapping
    const subscriptions = (businesses || []).map((b: any) => ({
      business_id: b.id,
      business_name: b.name,
      owner_email: b.users?.email,
      subscription_status: b.subscription_status,
      plan_name: b.plans?.name,
      plan_price: b.plans?.price_cents,
      stripe_subscription_id: b.stripe_subscription_id,
      stripe_customer_id: b.stripe_customer_id,
      minutes_included: b.minutes_included || b.plans?.included_minutes || 0,
      minutes_used_this_cycle: b.minutes_used_this_cycle || 0,
      current_cycle_start: b.current_cycle_start,
      current_cycle_end: b.current_cycle_end,
    }));

    return success({ subscriptions });
  } catch (error) {
    logError("Admin Subscriptions GET", error);
    return errors.internalError();
  }
}
