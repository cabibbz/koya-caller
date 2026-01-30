/**
 * AI FAQ Suggestion API Route
 * Generates FAQ suggestions based on business services and info
 *
 * POST /api/dashboard/knowledge/suggest-faqs
 * Returns: { faqs: Array<{ question: string, answer: string }> }
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { withAIGenerationRateLimit } from "@/lib/rate-limit/middleware";
import { logError } from "@/lib/logging";

interface SuggestedFaq {
  question: string;
  answer: string;
}

interface SuggestResponse {
  success: boolean;
  faqs?: SuggestedFaq[];
  error?: string;
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";

async function handlePost(_request: NextRequest): Promise<NextResponse<SuggestResponse>> {
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

    // Get services
    const { data: services } = await supabase
      .from("services")
      .select("name, description, duration_minutes, price_cents, price_type")
      .eq("business_id", biz.id)
      .order("sort_order");

    // Get existing FAQs to avoid duplicates
    const { data: existingFaqs } = await supabase
      .from("faqs")
      .select("question")
      .eq("business_id", biz.id);

    // Get business hours
    const { data: businessHours } = await supabase
      .from("business_hours")
      .select("day_of_week, open_time, close_time, is_closed")
      .eq("business_id", biz.id)
      .order("day_of_week");

    // Get additional knowledge
    const { data: knowledge } = await supabase
      .from("knowledge")
      .select("content")
      .eq("business_id", biz.id)
      .single();

    // Generate FAQ suggestions
    const suggestedFaqs = await generateFaqSuggestions({
      businessName: biz.name,
      businessType: biz.business_type,
      address: biz.address,
      serviceArea: biz.service_area,
      differentiator: biz.differentiator,
      services: (services || []) as Array<{
        name: string;
        description: string | null;
        duration_minutes: number;
        price_cents: number | null;
        price_type: string;
      }>,
      businessHours: (businessHours || []) as Array<{
        day_of_week: number;
        open_time: string;
        close_time: string;
        is_closed: boolean;
      }>,
      additionalInfo: (knowledge as { content: string | null } | null)?.content,
      existingQuestions: ((existingFaqs || []) as Array<{ question: string }>).map(f => f.question),
    });

    return NextResponse.json({
      success: true,
      faqs: suggestedFaqs,
    });
  } catch (error) {
    logError("Suggest FAQs", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}

interface BusinessContext {
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
  businessHours: Array<{
    day_of_week: number;
    open_time: string;
    close_time: string;
    is_closed: boolean;
  }>;
  additionalInfo: string | null | undefined;
  existingQuestions: string[];
}

async function generateFaqSuggestions(context: BusinessContext): Promise<SuggestedFaq[]> {
  if (!ANTHROPIC_API_KEY) {
    return generateMockFaqs(context);
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
        }
        if (s.duration_minutes) text += ` [${s.duration_minutes} min]`;
        return text;
      })
      .join("\n");

    const prompt = `You are helping create FAQ entries for a business phone AI receptionist. Generate helpful, natural FAQ questions and answers based on the business information below.

Business: ${context.businessName}
Type: ${context.businessType || "Not specified"}
Address: ${context.address || "Not specified"}
Service Area: ${context.serviceArea || "Not specified"}
What makes us special: ${context.differentiator || "Not specified"}

Services:
${servicesText || "No services listed yet"}

Business Hours:
${hoursText || "Hours not specified"}

Additional Info:
${context.additionalInfo || "None"}

${context.existingQuestions.length > 0 ? `\nExisting FAQs (do NOT duplicate these questions):\n${context.existingQuestions.map(q => `- ${q}`).join("\n")}` : ""}

Generate 5-8 NEW FAQ entries that a typical caller might ask. Focus on:
1. Service-specific questions (what's included, how long, preparation needed)
2. Booking/scheduling questions
3. Payment/pricing questions
4. Location/service area questions
5. Emergency or urgent service questions
6. Common concerns or objections

Return ONLY a valid JSON array with no additional text:
[
  { "question": "How do I...", "answer": "You can..." },
  ...
]

Make questions sound natural (as a caller would ask), and answers should be helpful but concise. Don't start answers with "Yes," or "No," - be direct and informative.`;

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return generateMockFaqs(context);
    }

    try {
      let jsonText = textBlock.text.trim();
      // Clean up markdown if present
      if (jsonText.startsWith("```json")) jsonText = jsonText.slice(7);
      if (jsonText.startsWith("```")) jsonText = jsonText.slice(3);
      if (jsonText.endsWith("```")) jsonText = jsonText.slice(0, -3);
      jsonText = jsonText.trim();

      const parsed = JSON.parse(jsonText) as SuggestedFaq[];
      return parsed.filter(f => f.question && f.answer);
    } catch {
      return generateMockFaqs(context);
    }
  } catch (error) {
    logError("Suggest FAQs Claude", error);
    return generateMockFaqs(context);
  }
}

function generateMockFaqs(context: BusinessContext): SuggestedFaq[] {
  const faqs: SuggestedFaq[] = [];

  // Add service-based FAQs
  if (context.services.length > 0) {
    const firstService = context.services[0];
    faqs.push({
      question: `How long does ${firstService.name.toLowerCase()} typically take?`,
      answer: firstService.duration_minutes
        ? `${firstService.name} typically takes about ${firstService.duration_minutes} minutes, though this can vary depending on the specific situation.`
        : `The duration for ${firstService.name} varies depending on the specific requirements. We'll give you a better estimate after understanding your needs.`,
    });

    if (context.services.length > 1) {
      faqs.push({
        question: "What services do you offer?",
        answer: `We offer ${context.services.map(s => s.name.toLowerCase()).join(", ")}. Would you like more details about any of these?`,
      });
    }
  }

  // Hours FAQ
  faqs.push({
    question: "What are your business hours?",
    answer: context.businessHours.length > 0
      ? "We're open during regular business hours. Would you like me to check availability for a specific day?"
      : "Our hours vary. Would you like me to check our availability for a specific day?",
  });

  // Booking FAQ
  faqs.push({
    question: "How do I schedule an appointment?",
    answer: "I can help you schedule an appointment right now. What day and time works best for you?",
  });

  // Service area FAQ
  if (context.serviceArea) {
    faqs.push({
      question: "What areas do you serve?",
      answer: `We serve ${context.serviceArea}. Let me know your location and I can confirm if we can help you.`,
    });
  }

  // Payment FAQ
  faqs.push({
    question: "What forms of payment do you accept?",
    answer: "We accept all major credit cards, cash, and checks. We can discuss payment options when you schedule your appointment.",
  });

  // Emergency FAQ
  faqs.push({
    question: "Do you offer emergency services?",
    answer: "For urgent situations, please let me know the nature of your emergency and I'll do my best to assist you or connect you with someone who can help right away.",
  });

  return faqs;
}

// Export with AI generation rate limiting (10 requests per minute per user)
export const POST = withAIGenerationRateLimit(handlePost);
