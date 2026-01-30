/**
 * Knowledge Database Helpers
 * Spec Reference: Part 9, Lines 950-958
 */

import type {
  Knowledge,
  KnowledgeInsert,
  KnowledgeUpdate,
} from '@/types/operations';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Get knowledge for a business (1:1 relationship)
 */
export async function getKnowledgeByBusinessId(
  supabase: SupabaseClient,
  businessId: string
): Promise<Knowledge | null> {
  const { data, error } = await supabase
    .from('knowledge')
    .select('*')
    .eq('business_id', businessId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Create or update knowledge for a business (upsert due to 1:1)
 */
export async function upsertKnowledge(
  supabase: SupabaseClient,
  knowledge: KnowledgeInsert
): Promise<Knowledge> {
  const { data, error } = await supabase
    .from('knowledge')
    .upsert(knowledge, { onConflict: 'business_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update existing knowledge
 */
export async function updateKnowledge(
  supabase: SupabaseClient,
  businessId: string,
  updates: KnowledgeUpdate
): Promise<Knowledge> {
  const { data, error } = await supabase
    .from('knowledge')
    .update(updates)
    .eq('business_id', businessId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
