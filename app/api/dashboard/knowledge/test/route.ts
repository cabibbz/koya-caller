/**
 * Knowledge Test API Route
 * Tests how the AI would respond to a question based on business knowledge
 *
 * POST /api/dashboard/knowledge/test
 * Body: { question: string }
 * Returns: { response: string }
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { withAIGenerationRateLimit } from "@/lib/rate-limit/middleware";
import { logError } from "@/lib/logging";

interface TestResponse {
  success: boolean;
  response?: string;
  error?: string;
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";

async function handlePost(request: NextRequest): Promise<NextResponse<TestResponse>> {
  try {
    // Rate limiting is now handled by withAIGenerationRateLimit wrapper

    const supabase = await createClient();

    // Verify auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Parse request
    const body = await request.json();
    const { question } = body;

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Question is required" },
        { status: 400 }
      );
    }

    // Input length validation
    const MAX_QUESTION_LENGTH = 500;
    if (question.length > MAX_QUESTION_LENGTH) {
      return NextResponse.json(
        { success: false, error: `Question too long. Maximum ${MAX_QUESTION_LENGTH} characters.` },
        { status: 400 }
      );
    }

    // Get business
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, name, business_type, address, service_area, differentiator")
      .eq("user_id", user.id)
      .single();

    if (businessError || !business) {
      return NextResponse.json({ success: false, error: "Business not found" }, { status: 404 });
    }

    const biz = business as {
      id: string;
      name: string;
      business_type: string | null;
      address: string | null;
      service_area: string | null;
      differentiator: string | null;
    };

    // Get all knowledge data
    const [servicesResult, faqsResult, hoursResult, knowledgeResult, aiConfigResult] = await Promise.all([
      supabase.from("services").select("name, description, duration_minutes, price_cents, price_type").eq("business_id", biz.id).order("sort_order"),
      supabase.from("faqs").select("question, answer").eq("business_id", biz.id).order("sort_order"),
      supabase.from("business_hours").select("day_of_week, open_time, close_time, is_closed").eq("business_id", biz.id).order("day_of_week"),
      supabase.from("knowledge").select("content, never_say").eq("business_id", biz.id).single(),
      supabase.from("ai_config").select("ai_name, personality, greeting").eq("business_id", biz.id).single(),
    ]);

    // Generate test response
    const response = await generateTestResponse({
      question: question.trim(),
      businessName: biz.name,
      businessType: biz.business_type,
      address: biz.address,
      serviceArea: biz.service_area,
      differentiator: biz.differentiator,
      services: (servicesResult.data || []) as Array<{
        name: string;
        description: string | null;
        duration_minutes: number;
        price_cents: number | null;
        price_type: string;
      }>,
      faqs: (faqsResult.data || []) as Array<{ question: string; answer: string }>,
      businessHours: (hoursResult.data || []) as Array<{
        day_of_week: number;
        open_time: string;
        close_time: string;
        is_closed: boolean;
      }>,
      knowledge: knowledgeResult.data as { content: string | null; never_say: string | null } | null,
      aiConfig: (aiConfigResult.data || { ai_name: "Koya", personality: "professional" }) as {
        ai_name: string;
        personality: string;
        greeting: string | null;
      },
    });

    return NextResponse.json({
      success: true,
      response,
    });
  } catch (error) {
    logError("Knowledge Test", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate response" },
      { status: 500 }
    );
  }
}

interface BusinessContext {
  question: string;
  businessName: string;
  businessType: string | null;
  address: string | null;
  serviceArea: string | null;
  differentiator: string | null;
  services: Array<{
    name: string;
    description: string | null;
    duration_minutes: number;
    price_cents: number | null;
    price_type: string;
  }>;
  faqs: Array<{ question: string; answer: string }>;
  businessHours: Array<{
    day_of_week: number;
    open_time: string;
    close_time: string;
    is_closed: boolean;
  }>;
  knowledge: { content: string | null; never_say: string | null } | null;
  aiConfig: { ai_name: string; personality: string; greeting: string | null };
}

async function generateTestResponse(context: BusinessContext): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    return generateMockResponse(context);
  }

  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const hoursText = context.businessHours
      .map(h => {
        if (h.is_closed) return `${dayNames[h.day_of_week]}: Closed`;
        return `${dayNames[h.day_of_week]}: ${h.open_time} - ${h.close_time}`;
      })
      .join("\n");

    const servicesText = context.services
      .map(s => {
        let text = `- ${s.name}`;
        if (s.description) text += `: ${s.description}`;
        if (s.price_type === "fixed" && s.price_cents) {
          text += ` ($${(s.price_cents / 100).toFixed(2)})`;
        } else if (s.price_type === "quote") {
          text += " (Call for quote)";
        }
        if (s.duration_minutes) text += ` [${s.duration_minutes} min]`;
        return text;
      })
      .join("\n");

    const faqsText = context.faqs
      .map(f => `Q: ${f.question}\nA: ${f.answer}`)
      .join("\n\n");

    const systemPrompt = `You are ${context.aiConfig.ai_name}, a ${context.aiConfig.personality} AI phone receptionist for ${context.businessName}${context.businessType ? ` (${context.businessType})` : ""}.

Your job is to helpfully answer caller questions based on the business information below. Be conversational, natural, and helpful. Keep responses concise (1-3 sentences typically) as you would on a phone call.

BUSINESS INFORMATION:
${context.address ? `Address: ${context.address}` : ""}
${context.serviceArea ? `Service Area: ${context.serviceArea}` : ""}
${context.differentiator ? `What makes us special: ${context.differentiator}` : ""}

SERVICES:
${servicesText || "No services listed yet."}

BUSINESS HOURS:
${hoursText || "Hours not specified."}

FREQUENTLY ASKED QUESTIONS:
${faqsText || "No FAQs available."}

${context.knowledge?.content ? `ADDITIONAL INFORMATION:\n${context.knowledge.content}` : ""}

${context.knowledge?.never_say ? `TOPICS TO AVOID:\n${context.knowledge.never_say}` : ""}

GUIDELINES:
- Be warm and professional
- Keep responses conversational and concise
- If you don't know something, offer to take a message or transfer the call
- Don't make up information not provided above
- Offer to help with booking when appropriate`;

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: context.question }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return generateMockResponse(context);
    }

    return textBlock.text;
  } catch (error) {
    logError("Knowledge Test Claude", error);
    return generateMockResponse(context);
  }
}

function generateMockResponse(context: BusinessContext): string {
  const question = context.question.toLowerCase();

  // Check FAQs first
  for (const faq of context.faqs) {
    const faqQuestion = faq.question.toLowerCase();
    const words = question.split(/\s+/);
    const matchCount = words.filter(w => faqQuestion.includes(w) && w.length > 3).length;
    if (matchCount >= 2) {
      return faq.answer;
    }
  }

  // Service-related questions
  if (question.includes("service") || question.includes("offer") || question.includes("do you")) {
    if (context.services.length > 0) {
      const serviceNames = context.services.map(s => s.name.toLowerCase()).join(", ");
      return `We offer ${serviceNames}. Would you like more details about any of these services?`;
    }
    return "We offer a variety of services. What specifically are you looking for?";
  }

  // Hours questions
  if (question.includes("hour") || question.includes("open") || question.includes("close")) {
    return "We're open during regular business hours. Would you like me to check availability for a specific day?";
  }

  // Location questions
  if (question.includes("where") || question.includes("location") || question.includes("address")) {
    if (context.address) {
      return `We're located at ${context.address}. Is there anything else I can help you with?`;
    }
    return "I'd be happy to provide our location details. Can I get your contact information to send those to you?";
  }

  // Booking questions
  if (question.includes("appointment") || question.includes("book") || question.includes("schedule")) {
    return "I can help you schedule an appointment. What day and time works best for you?";
  }

  // Default response
  return "That's a great question. Let me get some information from you so I can have someone get back to you with the details.";
}

// Export with AI generation rate limiting (10 requests per minute per user)
export const POST = withAIGenerationRateLimit(handlePost);
