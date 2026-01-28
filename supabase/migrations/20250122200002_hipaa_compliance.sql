-- Migration: HIPAA Compliance Infrastructure (Phase 3)
-- Creates tables for HIPAA compliance, PHI audit logging, and healthcare templates
-- Prerequisites: Run AFTER core_tables.sql and extended_tables.sql

-- ============================================
-- Compliance Settings
-- Per-business HIPAA compliance configuration
-- ============================================
CREATE TABLE compliance_settings (
  business_id uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  hipaa_enabled boolean DEFAULT false,
  hipaa_baa_signed_at timestamptz,
  hipaa_baa_signatory_name text,
  hipaa_baa_signatory_email text,
  hipaa_baa_document_url text,
  phi_handling_enabled boolean DEFAULT false,
  phi_in_transcripts boolean DEFAULT false,
  phi_in_recordings boolean DEFAULT false,
  recording_retention_days integer DEFAULT 2190, -- 6 years for HIPAA
  transcript_retention_days integer DEFAULT 2190,
  auto_redact_phi boolean DEFAULT true,
  phi_categories text[] DEFAULT ARRAY['ssn', 'dob', 'medical_record', 'insurance_id'],
  audit_log_retention_days integer DEFAULT 2190,
  encryption_key_id text, -- For customer-managed keys
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE compliance_settings IS 'HIPAA compliance configuration per business';
COMMENT ON COLUMN compliance_settings.hipaa_enabled IS 'Whether HIPAA compliance mode is enabled';
COMMENT ON COLUMN compliance_settings.hipaa_baa_signed_at IS 'When the Business Associate Agreement was signed';
COMMENT ON COLUMN compliance_settings.recording_retention_days IS 'Days to retain recordings (HIPAA requires 6 years = 2190 days)';
COMMENT ON COLUMN compliance_settings.auto_redact_phi IS 'Automatically redact PHI from transcripts';
COMMENT ON COLUMN compliance_settings.phi_categories IS 'Categories of PHI to detect and redact';
COMMENT ON COLUMN compliance_settings.encryption_key_id IS 'Customer-managed encryption key ID if applicable';

-- ============================================
-- PHI Audit Log
-- Separate audit log for PHI access (HIPAA requirement)
-- ============================================
CREATE TABLE phi_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  event_type text NOT NULL CHECK (event_type IN (
    'phi_access', 'phi_view', 'phi_export', 'phi_modify', 'phi_delete',
    'recording_access', 'recording_download', 'transcript_access', 'transcript_export',
    'report_generated', 'consent_recorded', 'consent_revoked'
  )),
  resource_type text NOT NULL, -- 'call', 'recording', 'transcript', 'contact', 'appointment'
  resource_id uuid,
  action text NOT NULL,
  ip_address inet,
  user_agent text,
  justification text, -- Why PHI was accessed
  phi_categories_accessed text[],
  outcome text DEFAULT 'success' CHECK (outcome IN ('success', 'denied', 'error')),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE phi_audit_log IS 'HIPAA-compliant audit log for PHI access events';
COMMENT ON COLUMN phi_audit_log.event_type IS 'Type of PHI access event';
COMMENT ON COLUMN phi_audit_log.resource_type IS 'Type of resource accessed: call, recording, transcript, contact, appointment';
COMMENT ON COLUMN phi_audit_log.justification IS 'Business justification for PHI access';
COMMENT ON COLUMN phi_audit_log.phi_categories_accessed IS 'Categories of PHI that were accessed';

-- ============================================
-- Healthcare Templates
-- Pre-built templates for healthcare verticals
-- ============================================
CREATE TABLE healthcare_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('dental', 'medical', 'mental_health', 'veterinary', 'optometry', 'physical_therapy', 'chiropractic', 'other')),
  description text,
  system_prompt text NOT NULL,
  greeting text,
  greeting_spanish text,
  functions_enabled text[] DEFAULT ARRAY['book_appointment', 'check_availability', 'transfer_call', 'take_message'],
  compliance_notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE healthcare_templates IS 'Pre-built AI templates for healthcare verticals';
COMMENT ON COLUMN healthcare_templates.category IS 'Healthcare specialty category';
COMMENT ON COLUMN healthcare_templates.functions_enabled IS 'AI functions enabled for this template';
COMMENT ON COLUMN healthcare_templates.compliance_notes IS 'Special compliance considerations for this specialty';

-- ============================================
-- Extend calls table for PHI tracking
-- ============================================
ALTER TABLE calls ADD COLUMN IF NOT EXISTS contains_phi boolean DEFAULT false;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS phi_categories text[];
ALTER TABLE calls ADD COLUMN IF NOT EXISTS phi_reviewed_at timestamptz;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS phi_reviewed_by uuid REFERENCES auth.users(id);
ALTER TABLE calls ADD COLUMN IF NOT EXISTS recording_encrypted boolean DEFAULT false;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS recording_encryption_key_id text;

COMMENT ON COLUMN calls.contains_phi IS 'Flag indicating call contains Protected Health Information';
COMMENT ON COLUMN calls.phi_categories IS 'Categories of PHI detected in this call';
COMMENT ON COLUMN calls.phi_reviewed_at IS 'When PHI content was reviewed by staff';
COMMENT ON COLUMN calls.phi_reviewed_by IS 'User who reviewed PHI content';
COMMENT ON COLUMN calls.recording_encrypted IS 'Whether recording is encrypted at rest';

-- ============================================
-- Patient Consent Tracking
-- Track patient consents for HIPAA compliance
-- ============================================
CREATE TABLE patient_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  patient_phone text NOT NULL,
  patient_name text,
  consent_type text NOT NULL CHECK (consent_type IN ('recording', 'ai_processing', 'sms', 'marketing', 'hipaa_disclosure')),
  consent_given boolean NOT NULL,
  consent_method text CHECK (consent_method IN ('verbal', 'written', 'electronic', 'implied')),
  collected_at timestamptz DEFAULT now(),
  collected_via text, -- 'call', 'web', 'paper'
  call_id uuid REFERENCES calls(id),
  ip_address inet,
  expires_at timestamptz,
  revoked_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE patient_consents IS 'Patient consent tracking for HIPAA compliance';
COMMENT ON COLUMN patient_consents.consent_type IS 'Type of consent: recording, ai_processing, sms, marketing, hipaa_disclosure';
COMMENT ON COLUMN patient_consents.consent_method IS 'How consent was obtained: verbal, written, electronic, implied';
COMMENT ON COLUMN patient_consents.collected_via IS 'Channel through which consent was collected';
COMMENT ON COLUMN patient_consents.revoked_at IS 'When consent was revoked (NULL if still active)';

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX idx_compliance_settings_hipaa ON compliance_settings(hipaa_enabled) WHERE hipaa_enabled = true;
CREATE INDEX idx_phi_audit_business ON phi_audit_log(business_id, created_at DESC);
CREATE INDEX idx_phi_audit_user ON phi_audit_log(user_id, created_at DESC);
CREATE INDEX idx_phi_audit_resource ON phi_audit_log(resource_type, resource_id);
CREATE INDEX idx_phi_audit_event_type ON phi_audit_log(event_type, created_at DESC);
CREATE INDEX idx_healthcare_templates_category ON healthcare_templates(category) WHERE is_active = true;
CREATE INDEX idx_patient_consents_phone ON patient_consents(business_id, patient_phone);
CREATE INDEX idx_patient_consents_type ON patient_consents(business_id, consent_type);
CREATE INDEX idx_patient_consents_active ON patient_consents(business_id, patient_phone, consent_type)
  WHERE consent_given = true AND revoked_at IS NULL;
CREATE INDEX idx_calls_phi ON calls(business_id, contains_phi) WHERE contains_phi = true;

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE compliance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE phi_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE healthcare_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_consents ENABLE ROW LEVEL SECURITY;

-- Compliance settings policies
CREATE POLICY "Users can manage their compliance settings" ON compliance_settings
  FOR ALL USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Service role bypass compliance_settings" ON compliance_settings
  FOR ALL USING (auth.role() = 'service_role');

-- PHI audit log policies (read-only for users, insert for system)
CREATE POLICY "Users can view their PHI audit logs" ON phi_audit_log
  FOR SELECT USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "System can insert PHI audit logs" ON phi_audit_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role bypass phi_audit_log" ON phi_audit_log
  FOR ALL USING (auth.role() = 'service_role');

-- Healthcare templates are public read-only
CREATE POLICY "Anyone can view healthcare templates" ON healthcare_templates
  FOR SELECT USING (is_active = true);

CREATE POLICY "Service role bypass healthcare_templates" ON healthcare_templates
  FOR ALL USING (auth.role() = 'service_role');

-- Patient consents policies
CREATE POLICY "Users can manage patient consents" ON patient_consents
  FOR ALL USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Service role bypass patient_consents" ON patient_consents
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Function to log PHI access
-- ============================================
CREATE OR REPLACE FUNCTION log_phi_access(
  p_business_id uuid,
  p_user_id uuid,
  p_event_type text,
  p_resource_type text,
  p_resource_id uuid,
  p_action text,
  p_ip inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_justification text DEFAULT NULL,
  p_phi_categories text[] DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO phi_audit_log (
    business_id, user_id, event_type, resource_type, resource_id,
    action, ip_address, user_agent, justification, phi_categories_accessed
  ) VALUES (
    p_business_id, p_user_id, p_event_type, p_resource_type, p_resource_id,
    p_action, p_ip, p_user_agent, p_justification, p_phi_categories
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_phi_access IS 'Log PHI access event for HIPAA compliance';

-- ============================================
-- Function to check if patient has active consent
-- ============================================
CREATE OR REPLACE FUNCTION has_patient_consent(
  p_business_id uuid,
  p_phone text,
  p_consent_type text
) RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM patient_consents
    WHERE business_id = p_business_id
      AND patient_phone = p_phone
      AND consent_type = p_consent_type
      AND consent_given = true
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION has_patient_consent IS 'Check if patient has active consent for a specific type';

-- ============================================
-- Function to record patient consent
-- ============================================
CREATE OR REPLACE FUNCTION record_patient_consent(
  p_business_id uuid,
  p_phone text,
  p_name text,
  p_consent_type text,
  p_consent_given boolean,
  p_method text DEFAULT 'verbal',
  p_via text DEFAULT 'call',
  p_call_id uuid DEFAULT NULL,
  p_ip inet DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_consent_id uuid;
BEGIN
  INSERT INTO patient_consents (
    business_id, patient_phone, patient_name, consent_type, consent_given,
    consent_method, collected_via, call_id, ip_address, expires_at
  ) VALUES (
    p_business_id, p_phone, p_name, p_consent_type, p_consent_given,
    p_method, p_via, p_call_id, p_ip, p_expires_at
  ) RETURNING id INTO v_consent_id;

  -- Log the consent event
  PERFORM log_phi_access(
    p_business_id,
    NULL,
    CASE WHEN p_consent_given THEN 'consent_recorded' ELSE 'consent_revoked' END,
    'consent',
    v_consent_id,
    'Patient consent ' || CASE WHEN p_consent_given THEN 'recorded' ELSE 'declined' END || ' for ' || p_consent_type,
    p_ip,
    NULL,
    NULL,
    NULL
  );

  RETURN v_consent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION record_patient_consent IS 'Record patient consent and log the event';

-- ============================================
-- Updated at trigger for compliance_settings
-- ============================================
CREATE TRIGGER update_compliance_settings_updated_at
  BEFORE UPDATE ON compliance_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Insert default healthcare templates
-- ============================================
INSERT INTO healthcare_templates (name, category, description, system_prompt, greeting, greeting_spanish, functions_enabled, compliance_notes) VALUES
(
  'Dental Practice',
  'dental',
  'Template for dental offices including general dentistry, orthodontics, and oral surgery',
  'You are an AI receptionist for a dental practice. Handle appointment scheduling for cleanings, exams, and procedures. Be mindful of dental anxiety - use reassuring language. Never discuss specific treatment costs or insurance coverage details - transfer to staff for those questions. If someone mentions severe tooth pain, swelling, or trauma, treat as urgent and offer same-day scheduling or advise emergency dental care.',
  'Thank you for calling! How can I help you with your dental care today?',
  'Gracias por llamar! Como puedo ayudarle con su cuidado dental hoy?',
  ARRAY['book_appointment', 'check_availability', 'transfer_call', 'take_message'],
  'Dental records are PHI. Do not discuss specific treatments or insurance details. Transfer insurance questions to staff.'
),
(
  'Medical Clinic',
  'medical',
  'Template for general medical practices, urgent care, and family medicine',
  'You are an AI receptionist for a medical clinic. Schedule appointments for checkups, sick visits, and follow-ups. If caller describes emergency symptoms (chest pain, difficulty breathing, severe bleeding, stroke symptoms like facial drooping or slurred speech), immediately advise calling 911 and transfer to staff. Never provide medical advice or diagnoses. Do not discuss test results - transfer those calls to nursing staff.',
  'Thank you for calling. How may I assist you with scheduling today?',
  'Gracias por llamar. Como puedo ayudarle con una cita hoy?',
  ARRAY['book_appointment', 'check_availability', 'transfer_call', 'take_message'],
  'Never provide medical advice. Transfer calls about test results, prescriptions, or medical questions to clinical staff. Flag emergency symptoms immediately.'
),
(
  'Mental Health Practice',
  'mental_health',
  'Template for therapy, counseling, and psychiatric practices',
  'You are an AI receptionist for a mental health practice. Handle intake and appointment scheduling with extra sensitivity and confidentiality. If caller expresses suicidal ideation, self-harm thoughts, or immediate crisis, provide the 988 Suicide and Crisis Lifeline number and transfer immediately to a clinician. Never ask for or discuss specific mental health conditions. Maintain strict confidentiality - do not confirm if someone is a patient.',
  'Hello, thank you for reaching out. How can I help you today?',
  'Hola, gracias por comunicarse. Como puedo ayudarle hoy?',
  ARRAY['book_appointment', 'check_availability', 'transfer_call', 'take_message'],
  'Extra confidentiality required. Never confirm patient status. Immediate escalation for crisis calls to 988 and staff.'
),
(
  'Veterinary Clinic',
  'veterinary',
  'Template for animal hospitals and veterinary practices',
  'You are an AI receptionist for a veterinary clinic. Schedule wellness visits, vaccinations, and sick pet appointments. For emergencies (pet not breathing, severe trauma, poisoning, difficulty giving birth, seizures), advise immediate emergency vet visit and provide emergency clinic info if available. Ask for pet name and species when booking. Be compassionate when pet owners are distressed.',
  'Hi there! How can I help you and your furry friend today?',
  'Hola! Como puedo ayudarle a usted y a su mascota hoy?',
  ARRAY['book_appointment', 'check_availability', 'transfer_call', 'take_message'],
  'While not HIPAA-covered, maintain client confidentiality. Be sensitive with distressed pet owners.'
),
(
  'Optometry Practice',
  'optometry',
  'Template for eye care, optometry, and ophthalmology practices',
  'You are an AI receptionist for an optometry practice. Schedule eye exams, contact lens fittings, and follow-up appointments. If caller reports sudden vision loss, eye injury, severe eye pain, or flashing lights with floaters, treat as urgent and advise immediate care. Do not discuss prescription details or provide medical advice about eye conditions.',
  'Thank you for calling! How can I help you with your eye care needs today?',
  'Gracias por llamar! Como puedo ayudarle con sus necesidades de cuidado visual hoy?',
  ARRAY['book_appointment', 'check_availability', 'transfer_call', 'take_message'],
  'Urgent symptoms: sudden vision loss, eye injury, severe pain. Transfer prescription and medical questions to clinical staff.'
),
(
  'Physical Therapy',
  'physical_therapy',
  'Template for physical therapy and rehabilitation clinics',
  'You are an AI receptionist for a physical therapy clinic. Schedule evaluation appointments and follow-up treatment sessions. Ask about the body area needing treatment when booking new patients. Do not provide exercise advice or treatment recommendations. If caller reports new injury, worsening symptoms, or severe pain, offer to connect with a therapist or advise appropriate medical care.',
  'Hello! How can I assist you with your physical therapy needs today?',
  'Hola! Como puedo ayudarle con sus necesidades de terapia fisica hoy?',
  ARRAY['book_appointment', 'check_availability', 'transfer_call', 'take_message'],
  'Do not provide exercise or treatment advice. New evaluations typically require referral verification.'
),
(
  'Chiropractic Office',
  'chiropractic',
  'Template for chiropractic and wellness practices',
  'You are an AI receptionist for a chiropractic office. Schedule adjustments, new patient consultations, and wellness visits. If caller describes symptoms that may indicate serious conditions (loss of bladder/bowel control, severe radiating pain, numbness, weakness), advise medical evaluation and transfer to staff. Do not provide treatment advice or make claims about chiropractic benefits.',
  'Welcome! How can I help you with your chiropractic care today?',
  'Bienvenido! Como puedo ayudarle con su cuidado quiropractico hoy?',
  ARRAY['book_appointment', 'check_availability', 'transfer_call', 'take_message'],
  'Red flag symptoms: bowel/bladder issues, severe neurological symptoms. Do not make treatment claims.'
);
