/**
 * AI Email Generation API
 * POST /api/dashboard/ai/generate-email
 * Generates professional email content using Claude AI
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { withAuth } from "@/lib/api/auth-middleware";
import { logError, logInfo } from "@/lib/logging";

export const dynamic = "force-dynamic";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";

interface GenerateEmailRequest {
  prompt: string;
  tone?: "professional" | "friendly" | "casual" | "urgent";
  purpose?: "marketing" | "follow_up" | "reminder" | "announcement" | "thank_you" | "general";
  businessName?: string;
  includeCallToAction?: boolean;
}

export const POST = withAuth(async (request: NextRequest, { business }) => {
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI service not configured. Please set ANTHROPIC_API_KEY." },
      { status: 503 }
    );
  }

  try {
    const body: GenerateEmailRequest = await request.json();

    if (!body.prompt || body.prompt.trim().length < 10) {
      return NextResponse.json(
        { error: "Please provide a description of at least 10 characters" },
        { status: 400 }
      );
    }

    if (body.prompt.length > 1000) {
      return NextResponse.json(
        { error: "Description too long. Maximum 1000 characters." },
        { status: 400 }
      );
    }

    const tone = body.tone || "professional";
    const purpose = body.purpose || "general";
    const businessName = body.businessName || business.name || "Our Business";
    const includeCallToAction = body.includeCallToAction !== false;

    // Build the meta-prompt for email generation
    const toneDescriptions: Record<string, string> = {
      professional: "formal and business-like, respectful and polished",
      friendly: "warm and personable, conversational but still professional",
      casual: "relaxed and informal, like writing to a friend",
      urgent: "time-sensitive and action-oriented, emphasizing importance",
    };

    const purposeGuidance: Record<string, string> = {
      marketing: "promoting a product, service, or offer",
      follow_up: "checking in after a previous interaction or visit",
      reminder: "reminding about an upcoming appointment, event, or deadline",
      announcement: "sharing news or an update",
      thank_you: "expressing gratitude",
      general: "general communication",
    };

    const systemPrompt = `You are an email writer. Your job is to write an email based ONLY on what the user tells you.

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. ONLY include information the user explicitly provides. Do NOT invent or assume:
   - Specific percentages or discounts (unless user mentions them)
   - Dates, times, or deadlines (unless user mentions them)
   - Product names, service names, or prices (unless user mentions them)
   - Event names or locations (unless user mentions them)
   - Any specific details not in the user's description

2. If the user says something vague like "announce a sale", write about a sale in general terms WITHOUT making up a specific percentage or end date.

3. Keep it simple and short (100-200 words max). Don't over-elaborate.

4. Write in a ${tone} tone (${toneDescriptions[tone]}).

5. The email purpose is: ${purposeGuidance[purpose]}.

6. Do NOT use placeholder brackets like [Name] or [Date]. Either use real info from the user's description or write generically.

7. Do NOT add a signature - just the email body.

8. ${includeCallToAction ? "End with a simple call-to-action relevant to what the user described." : "Do not include a call-to-action."}

Return your response as JSON:
{"subject": "subject line here", "body": "email body here"}`;

    const userPrompt = `Write an email for "${businessName}".

The user wants to say: "${body.prompt}"

Remember: ONLY use details from what the user wrote above. Do not make up any specifics they didn't mention. Return valid JSON only.`;

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `${systemPrompt}\n\n${userPrompt}`,
        },
      ],
    });

    // Extract the text response
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from AI");
    }

    // Parse the JSON response
    let emailContent: { subject: string; body: string };
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      emailContent = JSON.parse(jsonMatch[0]);
    } catch {
      // If JSON parsing fails, try to extract subject and body manually
      const lines = textBlock.text.split("\n");
      const subjectLine = lines.find((l) => l.toLowerCase().includes("subject:"));
      const subject = subjectLine
        ? subjectLine.replace(/^.*subject:\s*/i, "").trim()
        : "Message from " + businessName;
      const body = textBlock.text
        .replace(/^.*subject:.*$/im, "")
        .replace(/^[\s\n]+/, "")
        .trim();
      emailContent = { subject, body };
    }

    if (!emailContent.subject || !emailContent.body) {
      throw new Error("Invalid email content generated");
    }

    logInfo(
      "AI Email",
      `Generated email for business ${business.id}: "${emailContent.subject.substring(0, 50)}..."`
    );

    return NextResponse.json({
      success: true,
      subject: emailContent.subject,
      body: emailContent.body,
    });
  } catch (err) {
    logError("AI Email Generation", err);
    return NextResponse.json(
      { error: "Failed to generate email. Please try again." },
      { status: 500 }
    );
  }
});
