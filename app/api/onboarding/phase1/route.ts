/**
 * Onboarding Phase 1 API
 * Saves business type and name from conversational onboarding
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { businessType, businessTypeName, businessName } = body;

    if (!businessType) {
      return NextResponse.json(
        { error: "Business type is required" },
        { status: 400 }
      );
    }

    // Get or create business
    const tenantId = user.app_metadata?.tenant_id;

    if (tenantId) {
      // Update existing business
      const { error } = await (supabase as any)
        .from("businesses")
        .update({
          business_type: businessType,
          name: businessName || businessTypeName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tenantId);

      if (error) throw error;
    } else {
      // Create new business
      const { data: newBusiness, error: createError } = await (supabase as any)
        .from("businesses")
        .insert({
          user_id: user.id,
          business_type: businessType,
          name: businessName || businessTypeName,
          onboarding_step: 2,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Update user metadata with tenant_id
      await supabase.auth.updateUser({
        data: { tenant_id: newBusiness.id },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save" },
      { status: 500 }
    );
  }
}
