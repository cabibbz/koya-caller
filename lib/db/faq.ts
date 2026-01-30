/**
 * FAQ Database Helpers
 * Spec Reference: Part 9, Lines 937-948
 */

import type {
  FAQ,
  FAQInsert,
  FAQUpdate,
} from '@/types/operations';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Get all FAQs for a business, ordered by sort_order
 */
export async function getFAQsByBusinessId(
  supabase: SupabaseClient,
  businessId: string
): Promise<FAQ[]> {
  const { data, error } = await supabase
    .from('faqs')
    .select('*')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Create a new FAQ
 */
export async function createFAQ(
  supabase: SupabaseClient,
  faq: FAQInsert
): Promise<FAQ> {
  const { data, error } = await supabase
    .from('faqs')
    .insert(faq)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update an existing FAQ
 */
export async function updateFAQ(
  supabase: SupabaseClient,
  faqId: string,
  updates: FAQUpdate
): Promise<FAQ> {
  const { data, error } = await supabase
    .from('faqs')
    .update(updates)
    .eq('id', faqId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a FAQ
 */
export async function deleteFAQ(
  supabase: SupabaseClient,
  faqId: string
): Promise<void> {
  const { error } = await supabase
    .from('faqs')
    .delete()
    .eq('id', faqId);

  if (error) throw error;
}

/**
 * Bulk create FAQs for a business
 */
export async function bulkCreateFAQs(
  supabase: SupabaseClient,
  faqs: FAQInsert[]
): Promise<FAQ[]> {
  const { data, error } = await supabase
    .from('faqs')
    .insert(faqs)
    .select();

  if (error) throw error;
  return data ?? [];
}

/**
 * Reorder FAQs by updating sort_order values
 * Uses Promise.all for parallel execution to prevent race conditions
 */
export async function reorderFAQs(
  supabase: SupabaseClient,
  faqIds: string[]
): Promise<void> {
  // Execute all updates in parallel using Promise.all
  const updatePromises = faqIds.map((id, index) =>
    supabase
      .from('faqs')
      .update({ sort_order: index })
      .eq('id', id)
  );

  const results = await Promise.all(updatePromises);

  // Check for any errors
  const errorResult = results.find(result => result.error);
  if (errorResult?.error) {
    throw errorResult.error;
  }
}
