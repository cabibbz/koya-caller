/**
 * Website Scraping API Route
 * Scrapes a website and uses Claude AI to extract business content
 *
 * POST /api/dashboard/knowledge/scrape
 * Body: { url: string }
 * Returns: { services, faqs, businessInfo, additionalContent }
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { withAIGenerationRateLimit } from "@/lib/rate-limit/middleware";

interface ExtractedContent {
  businessName?: string;
  businessType?: string;
  address?: string;
  serviceArea?: string;
  differentiator?: string;
  services: Array<{
    name: string;
    description: string;
    duration_minutes?: number;
    price?: number;
  }>;
  faqs: Array<{
    question: string;
    answer: string;
  }>;
  additionalInfo?: string;
}

interface ScrapeResponse {
  success: boolean;
  data?: ExtractedContent;
  error?: string;
  scrapedUrl?: string;
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";

async function handlePost(request: NextRequest): Promise<NextResponse<ScrapeResponse>> {
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
      .select("id, name, business_type")
      .eq("user_id", user.id)
      .single();

    if (businessError || !business) {
      return NextResponse.json({ success: false, error: "Business not found" }, { status: 404 });
    }

    // Parse request body
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ success: false, error: "URL is required" }, { status: 400 });
    }

    // Input length validation
    const MAX_URL_LENGTH = 2048;
    if (url.length > MAX_URL_LENGTH) {
      return NextResponse.json(
        { success: false, error: `URL too long. Maximum ${MAX_URL_LENGTH} characters.` },
        { status: 400 }
      );
    }

    // Validate URL
    let validatedUrl: URL;
    try {
      validatedUrl = new URL(url.startsWith("http") ? url : `https://${url}`);
    } catch {
      return NextResponse.json({ success: false, error: "Invalid URL format" }, { status: 400 });
    }

    // SSRF Protection - Block internal/dangerous URLs
    if (isBlockedUrl(validatedUrl)) {
      return NextResponse.json(
        { success: false, error: "This URL is not allowed for security reasons" },
        { status: 400 }
      );
    }

    // Scrape the website
    const websiteContent = await fetchWebsiteContent(validatedUrl.toString());

    if (!websiteContent) {
      return NextResponse.json(
        { success: false, error: "Could not fetch website content. Please check the URL and try again." },
        { status: 400 }
      );
    }

    // Use Claude to extract structured content
    const extractedContent = await extractContentWithClaude(
      websiteContent,
      (business as { name: string; business_type: string | null }).name,
      (business as { name: string; business_type: string | null }).business_type || undefined
    );

    if (!extractedContent) {
      return NextResponse.json(
        { success: false, error: "Could not extract content from website. Try a different page." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: extractedContent,
      scrapedUrl: validatedUrl.toString(),
    });
  } catch (_error) {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * SSRF Protection - Block internal and dangerous URLs
 */
const BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "169.254.169.254", // AWS metadata
  "metadata.google.internal", // GCP metadata
  "metadata.azure.com", // Azure metadata
];

const BLOCKED_IP_PATTERNS = [
  /^10\./, // Private Class A
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private Class B
  /^192\.168\./, // Private Class C
  /^fc00:/, // IPv6 private
  /^fe80:/, // IPv6 link-local
];

function isBlockedUrl(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();

  // Block known dangerous hosts
  if (BLOCKED_HOSTS.includes(hostname)) {
    return true;
  }

  // Block private IP ranges
  if (BLOCKED_IP_PATTERNS.some((regex) => regex.test(hostname))) {
    return true;
  }

  // Only allow http/https
  if (!["http:", "https:"].includes(url.protocol)) {
    return true;
  }

  // Block uncommon ports (only allow 80, 443, 8080, 8443)
  const port = url.port ? parseInt(url.port) : url.protocol === "https:" ? 443 : 80;
  if (![80, 443, 8080, 8443].includes(port)) {
    return true;
  }

  return false;
}

/**
 * Fetch website content (basic HTML fetching)
 */
async function fetchWebsiteContent(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; KoyaBot/1.0; +https://getkoya.com)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    // Basic HTML to text conversion
    const textContent = extractTextFromHtml(html);

    // Limit content size for Claude
    const maxLength = 50000;
    if (textContent.length > maxLength) {
      return textContent.slice(0, maxLength) + "\n...[content truncated]";
    }

    return textContent;
  } catch (_error) {
    return null;
  }
}

/**
 * Extract readable text from HTML
 */
function extractTextFromHtml(html: string): string {
  // Remove script and style tags with their content
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "");

  // Replace common block elements with newlines
  text = text
    .replace(/<(br|hr|p|div|h[1-6]|li|tr|section|article|header|footer|nav)[^>]*>/gi, "\n")
    .replace(/<\/p>|<\/div>|<\/h[1-6]>|<\/li>|<\/tr>/gi, "\n");

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–");

  // Clean up whitespace
  text = text
    .replace(/\s+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

/**
 * Use Claude to extract structured business content
 */
async function extractContentWithClaude(
  websiteContent: string,
  businessName: string,
  businessType?: string
): Promise<ExtractedContent | null> {
  if (!ANTHROPIC_API_KEY) {
    return generateMockContent(businessName, businessType);
  }

  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const prompt = `You are analyzing a business website to extract relevant information for an AI phone receptionist. The business is "${businessName}"${businessType ? ` (${businessType})` : ""}.

Extract the following information from the website content below. Return ONLY a valid JSON object with no additional text or markdown:

{
  "businessName": "string or null - the official business name if found",
  "businessType": "string or null - the type/category of business (e.g., 'HVAC Company', 'Dental Office', 'Auto Repair Shop')",
  "address": "string or null - full physical address if found",
  "serviceArea": "string or null - geographic area served if mentioned",
  "differentiator": "string or null - what makes this business unique/special",
  "services": [
    {
      "name": "service name",
      "description": "brief description of the service",
      "duration_minutes": null,
      "price": null
    }
  ],
  "faqs": [
    {
      "question": "common question a caller might ask",
      "answer": "answer based on website content"
    }
  ],
  "additionalInfo": "string or null - other important information about the business"
}

Guidelines:
- Extract real services/offerings mentioned on the website
- Create relevant FAQs based on information found (5-10 FAQs)
- For FAQs, phrase questions as a caller would ask them
- Include pricing if mentioned
- Include business hours if found
- Be factual - only extract information that's actually on the website
- If information is not found, use null

Website content:
---
${websiteContent}
---

Return only the JSON object:`;

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Extract text from response
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return null;
    }

    // Parse JSON response
    try {
      // Clean up the response - remove markdown code blocks if present
      let jsonText = textBlock.text.trim();
      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.slice(7);
      }
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.slice(3);
      }
      if (jsonText.endsWith("```")) {
        jsonText = jsonText.slice(0, -3);
      }
      jsonText = jsonText.trim();

      const parsed = JSON.parse(jsonText) as ExtractedContent;

      // Validate and clean the response
      return {
        businessName: parsed.businessName || undefined,
        businessType: parsed.businessType || undefined,
        address: parsed.address || undefined,
        serviceArea: parsed.serviceArea || undefined,
        differentiator: parsed.differentiator || undefined,
        services: Array.isArray(parsed.services) ? parsed.services.filter(s => s.name) : [],
        faqs: Array.isArray(parsed.faqs) ? parsed.faqs.filter(f => f.question && f.answer) : [],
        additionalInfo: parsed.additionalInfo || undefined,
      };
    } catch (_parseError) {
      return null;
    }
  } catch (_error) {
    return null;
  }
}

/**
 * Generate mock content for development
 */
function generateMockContent(businessName: string, businessType?: string): ExtractedContent {
  return {
    businessName,
    businessType: businessType || "Service Business",
    address: "123 Main Street, City, State 12345",
    serviceArea: "Serving the greater metro area",
    differentiator: "Family-owned business with 20+ years of experience",
    services: [
      {
        name: "Standard Service",
        description: "Our most popular service option",
        duration_minutes: 60,
        price: undefined,
      },
      {
        name: "Premium Service",
        description: "Comprehensive service with additional features",
        duration_minutes: 90,
        price: undefined,
      },
      {
        name: "Emergency Service",
        description: "Available for urgent situations",
        duration_minutes: 30,
        price: undefined,
      },
    ],
    faqs: [
      {
        question: "What are your business hours?",
        answer: "We're open Monday through Friday, 8am to 6pm, and Saturday 9am to 2pm.",
      },
      {
        question: "Do you offer free estimates?",
        answer: "Yes, we provide free estimates for all our services. Just give us a call to schedule.",
      },
      {
        question: "What areas do you serve?",
        answer: "We serve the entire metro area and surrounding communities within 30 miles.",
      },
      {
        question: "Do you offer emergency services?",
        answer: "Yes, we offer 24/7 emergency services for urgent situations.",
      },
      {
        question: "What forms of payment do you accept?",
        answer: "We accept all major credit cards, cash, and checks. Financing is also available.",
      },
    ],
    additionalInfo: "Licensed and insured. All technicians are background-checked and certified.",
  };
}

// Export with AI generation rate limiting (10 requests per minute per user)
export const POST = withAIGenerationRateLimit(handlePost);
