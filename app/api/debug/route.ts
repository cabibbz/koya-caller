import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  const results: Record<string, any> = {
    env: {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + "...",
    },
    queries: {},
  };

  try {
    const supabase = createAdminClient();

    // Test 1: Simple query
    const { data: phoneData, error: phoneError } = await supabase
      .from("phone_numbers")
      .select("number, business_id, is_active")
      .limit(5);

    results.queries.phoneNumbers = {
      success: !phoneError,
      error: phoneError?.message,
      count: phoneData?.length || 0,
      data: phoneData,
    };

    // Test 2: Specific number lookup
    const { data: specificPhone, error: specificError } = await supabase
      .from("phone_numbers")
      .select("business_id")
      .eq("number", "+14074568607")
      .eq("is_active", true)
      .single();

    results.queries.specificLookup = {
      success: !specificError,
      error: specificError?.message,
      data: specificPhone,
    };

    // Test 3: ai_config
    const { data: aiConfig, error: aiError } = await supabase
      .from("ai_config")
      .select("retell_agent_id, business_id")
      .limit(5);

    results.queries.aiConfig = {
      success: !aiError,
      error: aiError?.message,
      count: aiConfig?.length || 0,
      data: aiConfig,
    };

  } catch (err: any) {
    results.error = err.message;
  }

  return NextResponse.json(results, { status: 200 });
}
