/**
 * Koya Caller - Twilio Phone Number Search API
 * Session 12: Full Twilio Integration
 *
 * Spec Reference: Part 12, Lines 1534-1546
 *
 * Searches available phone numbers by area code.
 * Cost: FREE (searching doesn't cost anything)
 *
 * REQUIRES AUTHENTICATION to prevent API abuse
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchPhoneNumbers } from "@/lib/twilio";

interface SearchRequest {
  areaCode: string;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user to prevent API abuse
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: SearchRequest = await request.json();
    const { areaCode } = body;

    // Validate area code
    if (!areaCode || !/^\d{3}$/.test(areaCode)) {
      return NextResponse.json(
        { error: "Invalid area code", message: "Please provide a 3-digit area code" },
        { status: 400 }
      );
    }

    // Search for available numbers
    const numbers = await searchPhoneNumbers(areaCode, 5);

    return NextResponse.json({ numbers });

  } catch (error) {
    // Check for specific Twilio errors
    if (error instanceof Error) {
      if (error.message.includes("authenticate")) {
        return NextResponse.json(
          { error: "Configuration error", message: "Twilio credentials are invalid" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: "Search failed", message: "Unable to search for phone numbers" },
      { status: 500 }
    );
  }
}
