/**
 * AI Config Database Helpers
 * Spec Reference: Part 9, Lines 960-987
 */

import type {
  AIConfig,
  AIConfigInsert,
  AIConfigUpdate,
} from '@/types/operations';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Get AI config for a business (1:1 relationship)
 */
export async function getAIConfigByBusinessId(
  supabase: SupabaseClient,
  businessId: string
): Promise<AIConfig | null> {
  const { data, error } = await supabase
    .from('ai_config')
    .select('*')
    .eq('business_id', businessId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Create or update AI config for a business (upsert due to 1:1)
 */
export async function upsertAIConfig(
  supabase: SupabaseClient,
  aiConfig: AIConfigInsert
): Promise<AIConfig> {
  const { data, error } = await supabase
    .from('ai_config')
    .upsert(aiConfig, { onConflict: 'business_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update existing AI config
 */
export async function updateAIConfig(
  supabase: SupabaseClient,
  businessId: string,
  updates: AIConfigUpdate
): Promise<AIConfig> {
  const { data, error } = await supabase
    .from('ai_config')
    .update(updates)
    .eq('business_id', businessId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Increment system prompt version and update generated timestamp
 */
export async function updateSystemPrompt(
  supabase: SupabaseClient,
  businessId: string,
  prompt: string,
  promptSpanish?: string | null
): Promise<AIConfig> {
  const { data: current, error: fetchError } = await supabase
    .from('ai_config')
    .select('system_prompt_version')
    .eq('business_id', businessId)
    .single();

  if (fetchError) throw fetchError;

  const { data, error } = await supabase
    .from('ai_config')
    .update({
      system_prompt: prompt,
      system_prompt_spanish: promptSpanish ?? null,
      system_prompt_version: (current?.system_prompt_version ?? 0) + 1,
      system_prompt_generated_at: new Date().toISOString(),
    })
    .eq('business_id', businessId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
