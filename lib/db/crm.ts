/**
 * CRM Integration Database Helpers
 * CRUD operations for CRM integrations and sync logging
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================
// Types
// ============================================

export type CRMProvider = 'hubspot' | 'salesforce' | 'zoho';
export type SyncEntityType = 'contact' | 'call' | 'appointment' | 'deal';
export type SyncDirection = 'outbound' | 'inbound';
export type SyncStatus = 'pending' | 'success' | 'failed' | 'skipped';

export interface CRMIntegrationSettings {
  auto_sync_contacts: boolean;
  log_calls: boolean;
  create_deals: boolean;
  deal_pipeline_id?: string | null;
  deal_stage_id?: string | null;
  deal_owner_id?: string | null;
}

export interface CRMIntegration {
  id: string;
  business_id: string;
  provider: CRMProvider;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  hub_id: string | null;
  settings: CRMIntegrationSettings;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CRMIntegrationInsert {
  business_id: string;
  provider: CRMProvider;
  access_token?: string | null;
  refresh_token?: string | null;
  token_expires_at?: string | null;
  hub_id?: string | null;
  settings?: CRMIntegrationSettings;
  is_active?: boolean;
}

export interface CRMIntegrationUpdate {
  access_token?: string | null;
  refresh_token?: string | null;
  token_expires_at?: string | null;
  hub_id?: string | null;
  settings?: CRMIntegrationSettings;
  is_active?: boolean;
}

export interface CRMSyncLog {
  id: string;
  integration_id: string;
  entity_type: SyncEntityType;
  entity_id: string;
  crm_id: string | null;
  sync_direction: SyncDirection;
  status: SyncStatus;
  error_message: string | null;
  request_payload: Record<string, unknown> | null;
  response_payload: Record<string, unknown> | null;
  created_at: string;
}

export interface CRMSyncLogInsert {
  integration_id: string;
  entity_type: SyncEntityType;
  entity_id: string;
  crm_id?: string | null;
  sync_direction: SyncDirection;
  status?: SyncStatus;
  error_message?: string | null;
  request_payload?: Record<string, unknown> | null;
  response_payload?: Record<string, unknown> | null;
}

export interface CRMContactMapping {
  id: string;
  integration_id: string;
  koya_contact_id: string;
  crm_contact_id: string;
  last_synced_at: string;
  created_at: string;
}

// Default settings for new integrations
export const DEFAULT_CRM_SETTINGS: CRMIntegrationSettings = {
  auto_sync_contacts: true,
  log_calls: true,
  create_deals: true,
  deal_pipeline_id: null,
  deal_stage_id: null,
  deal_owner_id: null,
};

// ============================================
// CRM Integration CRUD Operations
// ============================================

/**
 * Get CRM integration by business and provider
 */
export async function getCRMIntegration(
  supabase: SupabaseClient,
  businessId: string,
  provider: CRMProvider
): Promise<CRMIntegration | null> {
  const { data, error } = await supabase
    .from('crm_integrations')
    .select('*')
    .eq('business_id', businessId)
    .eq('provider', provider)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as CRMIntegration | null;
}

/**
 * Get all CRM integrations for a business
 */
export async function getCRMIntegrationsByBusinessId(
  supabase: SupabaseClient,
  businessId: string
): Promise<CRMIntegration[]> {
  const { data, error } = await supabase
    .from('crm_integrations')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as CRMIntegration[];
}

/**
 * Get active CRM integration by business and provider
 */
export async function getActiveCRMIntegration(
  supabase: SupabaseClient,
  businessId: string,
  provider: CRMProvider
): Promise<CRMIntegration | null> {
  const { data, error } = await supabase
    .from('crm_integrations')
    .select('*')
    .eq('business_id', businessId)
    .eq('provider', provider)
    .eq('is_active', true)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as CRMIntegration | null;
}

/**
 * Create or update CRM integration (upsert)
 */
export async function upsertCRMIntegration(
  supabase: SupabaseClient,
  integration: CRMIntegrationInsert
): Promise<CRMIntegration> {
  const insertData = {
    ...integration,
    settings: integration.settings ?? DEFAULT_CRM_SETTINGS,
  };

  const { data, error } = await supabase
    .from('crm_integrations')
    .upsert(insertData, { onConflict: 'business_id,provider' })
    .select()
    .single();

  if (error) throw error;
  return data as CRMIntegration;
}

/**
 * Update CRM integration
 */
export async function updateCRMIntegration(
  supabase: SupabaseClient,
  integrationId: string,
  updates: CRMIntegrationUpdate
): Promise<CRMIntegration> {
  const { data, error } = await supabase
    .from('crm_integrations')
    .update(updates)
    .eq('id', integrationId)
    .select()
    .single();

  if (error) throw error;
  return data as CRMIntegration;
}

/**
 * Update CRM integration tokens
 */
export async function updateCRMTokens(
  supabase: SupabaseClient,
  integrationId: string,
  accessToken: string,
  refreshToken: string | null,
  expiresAt: Date
): Promise<CRMIntegration> {
  const { data, error } = await supabase
    .from('crm_integrations')
    .update({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expires_at: expiresAt.toISOString(),
    })
    .eq('id', integrationId)
    .select()
    .single();

  if (error) throw error;
  return data as CRMIntegration;
}

/**
 * Update CRM integration settings
 */
export async function updateCRMSettings(
  supabase: SupabaseClient,
  integrationId: string,
  settings: Partial<CRMIntegrationSettings>
): Promise<CRMIntegration> {
  // Get current settings first
  const { data: current, error: fetchError } = await supabase
    .from('crm_integrations')
    .select('settings')
    .eq('id', integrationId)
    .single();

  if (fetchError) throw fetchError;

  const mergedSettings = {
    ...(current?.settings ?? DEFAULT_CRM_SETTINGS),
    ...settings,
  };

  const { data, error } = await supabase
    .from('crm_integrations')
    .update({ settings: mergedSettings })
    .eq('id', integrationId)
    .select()
    .single();

  if (error) throw error;
  return data as CRMIntegration;
}

/**
 * Delete CRM integration
 */
export async function deleteCRMIntegration(
  supabase: SupabaseClient,
  integrationId: string
): Promise<void> {
  const { error } = await supabase
    .from('crm_integrations')
    .delete()
    .eq('id', integrationId);

  if (error) throw error;
}

/**
 * Toggle CRM integration active status
 */
export async function toggleCRMIntegrationActive(
  supabase: SupabaseClient,
  integrationId: string,
  isActive: boolean
): Promise<CRMIntegration> {
  return updateCRMIntegration(supabase, integrationId, { is_active: isActive });
}

/**
 * Check if CRM tokens need refresh (expired or expiring soon)
 */
export function crmTokensNeedRefresh(
  integration: CRMIntegration,
  bufferMinutes: number = 5
): boolean {
  if (!integration.token_expires_at) return true;

  const expiresAt = new Date(integration.token_expires_at);
  const now = new Date();
  const bufferMs = bufferMinutes * 60 * 1000;

  return expiresAt.getTime() - now.getTime() < bufferMs;
}

// ============================================
// CRM Sync Log Operations
// ============================================

/**
 * Create sync log entry
 */
export async function createCRMSyncLog(
  supabase: SupabaseClient,
  log: CRMSyncLogInsert
): Promise<CRMSyncLog> {
  const { data, error } = await supabase
    .from('crm_sync_log')
    .insert(log)
    .select()
    .single();

  if (error) throw error;
  return data as CRMSyncLog;
}

/**
 * Update sync log entry
 */
export async function updateCRMSyncLog(
  supabase: SupabaseClient,
  logId: string,
  updates: {
    crm_id?: string | null;
    status?: SyncStatus;
    error_message?: string | null;
    response_payload?: Record<string, unknown> | null;
  }
): Promise<CRMSyncLog> {
  const { data, error } = await supabase
    .from('crm_sync_log')
    .update(updates)
    .eq('id', logId)
    .select()
    .single();

  if (error) throw error;
  return data as CRMSyncLog;
}

/**
 * Get recent sync logs for an integration
 */
export async function getCRMSyncLogs(
  supabase: SupabaseClient,
  integrationId: string,
  options: { limit?: number; offset?: number; status?: SyncStatus } = {}
): Promise<{ logs: CRMSyncLog[]; total: number }> {
  const { limit = 20, offset = 0, status } = options;

  let query = supabase
    .from('crm_sync_log')
    .select('*', { count: 'exact' })
    .eq('integration_id', integrationId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error, count } = await query;

  if (error) throw error;
  return { logs: (data ?? []) as CRMSyncLog[], total: count ?? 0 };
}

/**
 * Get sync stats for an integration
 */
export async function getCRMSyncStats(
  supabase: SupabaseClient,
  integrationId: string
): Promise<{
  total: number;
  success: number;
  failed: number;
  pending: number;
  successRate: number;
}> {
  const { data, error } = await supabase
    .from('crm_sync_log')
    .select('status')
    .eq('integration_id', integrationId);

  if (error) throw error;

  const logs = (data ?? []) as Array<{ status: string }>;
  const total = logs.length;
  const success = logs.filter(l => l.status === 'success').length;
  const failed = logs.filter(l => l.status === 'failed').length;
  const pending = logs.filter(l => l.status === 'pending').length;
  const successRate = total > 0 ? Math.round((success / total) * 100) : 100;

  return { total, success, failed, pending, successRate };
}

// ============================================
// CRM Contact Mapping Operations
// ============================================

/**
 * Get CRM contact mapping by Koya contact ID
 */
export async function getCRMContactMapping(
  supabase: SupabaseClient,
  integrationId: string,
  koyaContactId: string
): Promise<CRMContactMapping | null> {
  const { data, error } = await supabase
    .from('crm_contact_mapping')
    .select('*')
    .eq('integration_id', integrationId)
    .eq('koya_contact_id', koyaContactId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as CRMContactMapping | null;
}

/**
 * Get CRM contact mapping by CRM contact ID
 */
export async function getCRMContactMappingByCRMId(
  supabase: SupabaseClient,
  integrationId: string,
  crmContactId: string
): Promise<CRMContactMapping | null> {
  const { data, error } = await supabase
    .from('crm_contact_mapping')
    .select('*')
    .eq('integration_id', integrationId)
    .eq('crm_contact_id', crmContactId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as CRMContactMapping | null;
}

/**
 * Create or update CRM contact mapping
 */
export async function upsertCRMContactMapping(
  supabase: SupabaseClient,
  integrationId: string,
  koyaContactId: string,
  crmContactId: string
): Promise<CRMContactMapping> {
  const { data, error } = await supabase
    .from('crm_contact_mapping')
    .upsert(
      {
        integration_id: integrationId,
        koya_contact_id: koyaContactId,
        crm_contact_id: crmContactId,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: 'integration_id,koya_contact_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data as CRMContactMapping;
}

/**
 * Delete CRM contact mapping
 */
export async function deleteCRMContactMapping(
  supabase: SupabaseClient,
  integrationId: string,
  koyaContactId: string
): Promise<void> {
  const { error } = await supabase
    .from('crm_contact_mapping')
    .delete()
    .eq('integration_id', integrationId)
    .eq('koya_contact_id', koyaContactId);

  if (error) throw error;
}
