/**
 * AI Image Generation API for Blog Posts
 * Generates featured images using OpenAI DALL-E
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import OpenAI from "openai";
import { withImageGenerationRateLimit } from "@/lib/rate-limit/middleware";

export const dynamic = "force-dynamic";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function handlePost(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin status
    const isAdmin = user.app_metadata?.is_admin === true;
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limiting is now handled by withImageGenerationRateLimit wrapper

    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: "Image generation service unavailable" }, { status: 503 });
    }

    const body = await request.json();
    const { postId, title, topic, style = "modern" } = body as {
      postId: string;
      title: string;
      topic?: string;
      style?: "modern" | "minimalist" | "illustration" | "photo";
    };

    if (!postId || !title) {
      return NextResponse.json({ error: "Post ID and title are required" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    // Build image prompt based on style
    const stylePrompts: Record<string, string> = {
      modern: "Modern, professional business graphic with clean design, gradient colors, abstract shapes",
      minimalist: "Minimalist design with simple shapes, limited color palette, lots of white space",
      illustration: "Flat illustration style, vector-like graphics, colorful and friendly",
      photo: "Professional stock photo style, high quality, business-related imagery",
    };

    const imagePrompt = `Create a blog header image for: "${title}".
Style: ${stylePrompts[style] || stylePrompts.modern}.
Theme: Technology, AI, business communication, phone systems.
No text or words in the image. 16:9 aspect ratio composition.
${topic ? `Related to: ${topic}` : ""}`;


    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: imagePrompt,
      n: 1,
      size: "1792x1024",
      quality: "standard",
    });

    const imageUrl = response.data?.[0]?.url;

    if (!imageUrl) {
      throw new Error("No image URL in response");
    }

    // Download the image and upload to Supabase Storage
    const imageResponse = await fetch(imageUrl);
    const imageBlob = await imageResponse.blob();
    const imageBuffer = Buffer.from(await imageBlob.arrayBuffer());

    const adminClient = createAdminClient() as any;
    const fileName = `blog/${postId}-${Date.now()}.png`;

    // Upload to Supabase Storage (create bucket if needed)
    const { data: _uploadData, error: uploadError } = await adminClient.storage
      .from("public")
      .upload(fileName, imageBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      // If bucket doesn't exist, try to create it
      if (uploadError.message?.includes("Bucket not found")) {
        // Fall back to using the original URL (expires after some time)
        await adminClient
          .from("blog_posts")
          .update({
            featured_image_url: imageUrl,
            featured_image_alt: title,
          })
          .eq("id", postId);

        return NextResponse.json({
          success: true,
          imageUrl,
          temporary: true,
        });
      }
      throw new Error("Failed to upload image");
    }

    // Get public URL
    const { data: { publicUrl } } = adminClient.storage
      .from("public")
      .getPublicUrl(fileName);

    // Update post with image URL
    await adminClient
      .from("blog_posts")
      .update({
        featured_image_url: publicUrl,
        featured_image_alt: title,
      })
      .eq("id", postId);

    return NextResponse.json({
      success: true,
      imageUrl: publicUrl,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image generation failed" },
      { status: 500 }
    );
  }
}

// Export with image generation rate limiting (5 requests per minute per user)
export const POST = withImageGenerationRateLimit(handlePost);
