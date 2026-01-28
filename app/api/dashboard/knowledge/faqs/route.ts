/**
 * FAQs Knowledge API Route
 * Session 17: Dashboard - Appointments & Knowledge
 * Spec Reference: Part 7, Lines 729-733
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { inngest } from "@/lib/inngest/client";
import { logError } from "@/lib/logging";
import { z } from "zod";

// Input validation schema for FAQs
const faqSchema = z.object({
  question: z.string()
    .min(1, "Question is required")
    .max(500, "Question must be 500 characters or less")
    .trim(),
  answer: z.string()
    .min(1, "Answer is required")
    .max(2000, "Answer must be 2000 characters or less")
    .trim(),
});

const faqsRequestSchema = z.object({
  faqs: z.array(faqSchema)
    .max(100, "Maximum 100 FAQs allowed"),
});

async function handlePut(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    const body = await request.json();

    // Validate input with Zod
    const validationResult = faqsRequestSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors
        .map(e => e.message)
        .join(", ");
      return errors.badRequest(`Validation failed: ${errorMessages}`);
    }

    const { faqs } = validationResult.data;

    // Delete existing FAQs
    const { error: deleteError } = await supabase
      .from("faqs")
      .delete()
      .eq("business_id", business.id);

    if (deleteError) {
      return errors.internalError("Failed to update FAQs");
    }

    // Insert new FAQs
    // Type assertion needed for Supabase RLS type inference limitations
    if (faqs.length > 0) {
      const faqsToInsert = faqs.map((f, index) => ({
        business_id: business.id,
        question: f.question,
        answer: f.answer,
        sort_order: index,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
      const { error: insertError } = await (supabase as any)
        .from("faqs")
        .insert(faqsToInsert);

      if (insertError) {
        return errors.internalError("Failed to save FAQs");
      }
    }

    // Trigger Retell AI sync via prompt regeneration
    await inngest.send({
      name: "prompt/regeneration.requested",
      data: {
        businessId: business.id,
        triggeredBy: "faqs_update",
      },
    });

    return success({ updated: true });
  } catch (error) {
    logError("Knowledge FAQs PUT", error);
    return errors.internalError("Failed to update FAQs");
  }
}

export const PUT = withAuth(handlePut);
