-- Migration: Admin Extended Features
-- Audit logs and announcements tables for admin dashboard

-- ============================================
-- Audit Logs Table
-- Track admin actions for accountability
-- ============================================
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id UUID NOT NULL,
  admin_email TEXT,
  action TEXT NOT NULL, -- 'subscription.pause', 'subscription.cancel', 'credit.apply', etc.
  target_type TEXT, -- 'business', 'subscription', 'user', etc.
  target_id UUID,
  target_name TEXT,
  details JSONB, -- Additional context about the action
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_admin ON admin_audit_logs(admin_user_id);
CREATE INDEX idx_audit_logs_action ON admin_audit_logs(action);
CREATE INDEX idx_audit_logs_target ON admin_audit_logs(target_type, target_id);
CREATE INDEX idx_audit_logs_created ON admin_audit_logs(created_at DESC);

COMMENT ON TABLE admin_audit_logs IS 'Tracks all admin actions for accountability';

-- ============================================
-- Announcements Table
-- System-wide or targeted announcements
-- ============================================
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'info', -- 'info', 'warning', 'success', 'error'
  target_audience TEXT DEFAULT 'all', -- 'all', 'active', 'trial', 'specific'
  target_business_ids UUID[], -- For specific targeting
  is_active BOOLEAN DEFAULT TRUE,
  starts_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_announcements_active ON announcements(is_active, starts_at, expires_at);

COMMENT ON TABLE announcements IS 'System announcements shown to users';

-- ============================================
-- System Logs Table
-- Track errors, webhook failures, etc.
-- ============================================
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level TEXT NOT NULL, -- 'error', 'warning', 'info'
  category TEXT NOT NULL, -- 'webhook', 'api', 'retell', 'twilio', 'stripe', 'calendar'
  message TEXT NOT NULL,
  details JSONB,
  business_id UUID,
  call_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_system_logs_level ON system_logs(level);
CREATE INDEX idx_system_logs_category ON system_logs(category);
CREATE INDEX idx_system_logs_business ON system_logs(business_id);
CREATE INDEX idx_system_logs_created ON system_logs(created_at DESC);

COMMENT ON TABLE system_logs IS 'System-wide error and event logging';

-- ============================================
-- RLS Policies for Admin Tables
-- ============================================

-- Audit logs - admin only
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
  ON admin_audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

CREATE POLICY "Admins can insert audit logs"
  ON admin_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_user());

-- Announcements - admin can manage, users can view active
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage announcements"
  ON announcements
  FOR ALL
  TO authenticated
  USING (public.is_admin_user());

CREATE POLICY "Users can view active announcements"
  ON announcements
  FOR SELECT
  TO authenticated
  USING (
    is_active = TRUE
    AND starts_at <= NOW()
    AND (expires_at IS NULL OR expires_at > NOW())
  );

-- System logs - admin only
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view system logs"
  ON system_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

CREATE POLICY "System can insert logs"
  ON system_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);
