-- Migration: CRM Integrations
-- HubSpot and other CRM integrations support
-- Includes OAuth token storage and sync logging

-- ============================================
-- CRM Integrations Table
-- Stores CRM provider configurations for businesses
-- ============================================
create table crm_integrations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  provider text not null,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  hub_id text, -- HubSpot portal/hub ID
  settings jsonb default '{}',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- One integration per provider per business
  unique(business_id, provider),

  -- Validate provider
  constraint valid_crm_provider check (provider in ('hubspot', 'salesforce', 'zoho'))
);

comment on table crm_integrations is 'CRM integration configurations (HubSpot, Salesforce, etc.)';
comment on column crm_integrations.provider is 'CRM provider: hubspot, salesforce, zoho';
comment on column crm_integrations.access_token is 'OAuth access token (encrypted at rest)';
comment on column crm_integrations.refresh_token is 'OAuth refresh token for token renewal';
comment on column crm_integrations.hub_id is 'HubSpot portal/hub ID for the connected account';
comment on column crm_integrations.settings is 'Integration settings: auto_sync_contacts, log_calls, create_deals, etc.';

-- Indexes for efficient queries
create index idx_crm_integrations_business_id on crm_integrations(business_id);
create index idx_crm_integrations_provider on crm_integrations(provider);
create index idx_crm_integrations_active on crm_integrations(is_active) where is_active = true;

-- ============================================
-- CRM Sync Log Table
-- Tracks all sync operations between Koya and CRM
-- ============================================
create table crm_sync_log (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid references crm_integrations(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  crm_id text,
  sync_direction text not null,
  status text not null default 'pending',
  error_message text,
  request_payload jsonb,
  response_payload jsonb,
  created_at timestamptz default now(),

  -- Validate entity type
  constraint valid_entity_type check (entity_type in ('contact', 'call', 'appointment', 'deal')),
  -- Validate sync direction
  constraint valid_sync_direction check (sync_direction in ('outbound', 'inbound')),
  -- Validate status
  constraint valid_sync_status check (status in ('pending', 'success', 'failed', 'skipped'))
);

comment on table crm_sync_log is 'Tracks sync operations between Koya and external CRMs';
comment on column crm_sync_log.entity_type is 'Type of entity synced: contact, call, appointment, deal';
comment on column crm_sync_log.entity_id is 'Koya internal ID of the synced entity';
comment on column crm_sync_log.crm_id is 'External CRM ID of the synced entity';
comment on column crm_sync_log.sync_direction is 'outbound (Koya->CRM) or inbound (CRM->Koya)';

-- Indexes for efficient queries
create index idx_crm_sync_log_integration_id on crm_sync_log(integration_id);
create index idx_crm_sync_log_entity on crm_sync_log(entity_type, entity_id);
create index idx_crm_sync_log_status on crm_sync_log(status) where status != 'success';
create index idx_crm_sync_log_created_at on crm_sync_log(created_at);

-- ============================================
-- CRM Contact Mapping Table
-- Maps Koya contacts to CRM contact IDs
-- ============================================
create table crm_contact_mapping (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid references crm_integrations(id) on delete cascade,
  koya_contact_id uuid not null,
  crm_contact_id text not null,
  last_synced_at timestamptz default now(),
  created_at timestamptz default now(),

  -- One mapping per integration per contact
  unique(integration_id, koya_contact_id),
  unique(integration_id, crm_contact_id)
);

comment on table crm_contact_mapping is 'Maps Koya contacts to external CRM contact IDs';

-- Indexes
create index idx_crm_contact_mapping_integration on crm_contact_mapping(integration_id);
create index idx_crm_contact_mapping_koya_contact on crm_contact_mapping(koya_contact_id);

-- ============================================
-- Updated At Trigger
-- ============================================
create trigger update_crm_integrations_updated_at
  before update on crm_integrations
  for each row
  execute function update_updated_at_column();

-- ============================================
-- RLS Policies
-- ============================================
alter table crm_integrations enable row level security;
alter table crm_sync_log enable row level security;
alter table crm_contact_mapping enable row level security;

-- CRM integrations policies
create policy "Users can view own business CRM integrations" on crm_integrations
  for select using (business_id = public.tenant_id());
create policy "Users can insert own business CRM integrations" on crm_integrations
  for insert with check (business_id = public.tenant_id());
create policy "Users can update own business CRM integrations" on crm_integrations
  for update using (business_id = public.tenant_id());
create policy "Users can delete own business CRM integrations" on crm_integrations
  for delete using (business_id = public.tenant_id());

-- CRM sync log policies
create policy "Users can view own business CRM sync logs" on crm_sync_log
  for select using (
    integration_id in (
      select id from crm_integrations where business_id = public.tenant_id()
    )
  );

-- CRM contact mapping policies
create policy "Users can view own business CRM contact mappings" on crm_contact_mapping
  for select using (
    integration_id in (
      select id from crm_integrations where business_id = public.tenant_id()
    )
  );

-- Service role bypass for background processing
create policy "Service role bypass crm_integrations" on crm_integrations
  for all using (auth.role() = 'service_role');
create policy "Service role bypass crm_sync_log" on crm_sync_log
  for all using (auth.role() = 'service_role');
create policy "Service role bypass crm_contact_mapping" on crm_contact_mapping
  for all using (auth.role() = 'service_role');

-- ============================================
-- Default CRM Settings
-- ============================================
comment on column crm_integrations.settings is E'Default settings structure:\n{\n  "auto_sync_contacts": true,\n  "log_calls": true,\n  "create_deals": true,\n  "deal_pipeline_id": null,\n  "deal_stage_id": null,\n  "deal_owner_id": null\n}';
