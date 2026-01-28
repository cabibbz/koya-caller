/**
 * Phone Numbers API Route
 * /api/dashboard/phone-numbers
 *
 * Returns phone numbers available for outbound calling
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

async function handleGet(
  _request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    // Query phone numbers from phone_numbers table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: phoneNumbers, error } = await (supabase as any)
      .from("phone_numbers")
      .select("id, phone_number, is_active, setup_type")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    // Map to expected format
    const formattedNumbers = (phoneNumbers || []).map((phone: {
      id: string;
      phone_number: string;
      is_active: boolean;
      setup_type: string;
    }) => ({
      id: phone.id,
      number: phone.phone_number,
      is_active: phone.is_active,
      setup_type: phone.setup_type
    }));

    return success(formattedNumbers);
  } catch (error) {
    logError("Phone Numbers GET", error);
    return errors.internalError("Failed to fetch phone numbers");
  }
}

export const GET = withAuth(handleGet);
