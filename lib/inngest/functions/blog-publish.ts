/**
 * Blog Scheduled Publishing
 * Automatically publishes scheduled blog posts at their designated time
 */

import { inngest } from "../client";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Check for scheduled posts that need to be published
 * Runs every 5 minutes via cron
 */
export const checkScheduledPosts = inngest.createFunction(
  {
    id: "blog-check-scheduled-posts",
    name: "Check Scheduled Blog Posts",
  },
  { cron: "*/5 * * * *" }, // Every 5 minutes
  async ({ step }) => {
    const supabase = createAdminClient() as any;

    // Find scheduled posts that are due
    const now = new Date().toISOString();

    const { data: duePosts, error } = await supabase
      .from("blog_posts")
      .select("id, title, slug, scheduled_for")
      .eq("status", "scheduled")
      .lte("scheduled_for", now);

    if (error) {
      return { error: error.message };
    }

    if (!duePosts || duePosts.length === 0) {
      return { published: 0 };
    }

    // Publish each post
    const results = await Promise.all(
      duePosts.map((post: any) =>
        step.run(`publish-${post.id}`, async () => {
          const { error: updateError } = await supabase
            .from("blog_posts")
            .update({
              status: "published",
              published_at: new Date().toISOString(),
              scheduled_for: null,
            })
            .eq("id", post.id);

          if (updateError) {
            return { id: post.id, success: false, error: updateError.message };
          }

          return { id: post.id, success: true, title: post.title };
        })
      )
    );

    const successCount = results.filter((r: any) => r.success).length;
    return { published: successCount, results };
  }
);

/**
 * Manual trigger to publish a specific scheduled post immediately
 */
export const publishScheduledPost = inngest.createFunction(
  {
    id: "blog-publish-scheduled-post",
    name: "Publish Scheduled Blog Post",
  },
  { event: "blog/post.publish" },
  async ({ event, step }) => {
    const { postId } = event.data;

    const supabase = createAdminClient() as any;

    const result = await step.run("publish-post", async () => {
      const { data: post, error: fetchError } = await supabase
        .from("blog_posts")
        .select("id, title, status")
        .eq("id", postId)
        .single();

      if (fetchError || !post) {
        return { success: false, error: "Post not found" };
      }

      if (post.status === "published") {
        return { success: true, message: "Already published" };
      }

      const { error: updateError } = await supabase
        .from("blog_posts")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          scheduled_for: null,
        })
        .eq("id", postId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      return { success: true, title: post.title };
    });

    return result;
  }
);
