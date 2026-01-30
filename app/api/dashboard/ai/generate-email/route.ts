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
  businessType?: string;
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
    const businessType = body.businessType || business.business_type || "business";
    const includeCallToAction = body.includeCallToAction !== false;

    // Build the meta-prompt for email generation
    const systemPrompt = `You are an expert email copywriter for small businesses. Generate professional, engaging email content that drives action while maintaining authenticity.

Guidelines:
- Write in a ${tone} tone
- Keep emails concise but complete (150-300 words ideal)
- Use short paragraphs for readability
- Include a clear subject line
- ${includeCallToAction ? "Include a clear call-to-action" : "Do not include a call-to-action"}
- Do not use placeholder text like [Name] - write naturally
- Do not include sender signatures - the system will add those
- Make it feel personal, not like a template
- For ${businessType} businesses, use appropriate terminology

Respond in this exact JSON format:
{
  "subject": "The email subject line",
  "body": "The email body content with natural line breaks"
}`;

    const userPrompt = `Generate an email for ${businessName} (a ${businessType}).

Purpose: ${purpose.replace(/_/g, " ")}
User's description: ${body.prompt}

Remember to return valid JSON with "subject" and "body" fields only.`;

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
