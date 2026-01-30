# Koya Caller - Detailed Requirements Specification Document
## Version 1.0 | January 2026

---

## Executive Summary

This document provides detailed requirements specifications for the top 10 priority gaps identified in Koya Caller's market analysis. Based on codebase analysis, the current architecture is:

**Current Technical Foundation:**
- **Database**: Supabase PostgreSQL with RLS (Row Level Security)
- **Authentication**: Supabase Auth with app_metadata for tenant_id
- **API Pattern**: Next.js App Router with rate limiting middleware
- **SMS**: Twilio integration (partial opt-out handling exists)
- **Payments**: Stripe with webhook handling
- **Background Jobs**: Inngest for async processing
- **UI Components**: shadcn/ui component library

---

## RQ-TCPA-001: SMS Opt-Out Handling

### Priority: CRITICAL (Legal Risk)
### Risk: FCC fines up to $1,500 per violation

### Current State Analysis

The existing code in `app/api/twilio/sms/route.ts` has partial opt-out handling:
- Lines 139-143: STOP/UNSUBSCRIBE keywords detected but relies on Twilio auto-handling
- No internal opt-out database
- No confirmation messages
- No audit trail

### User Stories

| ID | User Story | Priority |
|----|-----------|----------|
| US-TCPA-01 | As a **caller**, I want to text "STOP" to opt-out of SMS messages, so that I don't receive unwanted communications | Must Have |
| US-TCPA-02 | As a **caller**, I want to receive confirmation when I opt-out | Must Have |
| US-TCPA-03 | As a **business owner**, I want the system to automatically block SMS to opted-out numbers | Must Have |

### Acceptance Criteria

```gherkin
Scenario: User opts out with STOP keyword
  Given a caller has phone number "+15551234567"
  When the caller texts "STOP" to the business number
  Then the system records the opt-out in the database
  And sends confirmation: "You have been unsubscribed. Reply START to resubscribe."
  And no future SMS messages are sent to that number from that business

Scenario: Business attempts to send SMS to opted-out number
  Given a caller "+15551234567" has opted out
  When the business attempts to send an SMS to that number
  Then the SMS is blocked before reaching Twilio
  And an audit log entry is created
```

### Data Model Changes

```sql
-- New table: sms_opt_outs
CREATE TABLE sms_opt_outs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    opted_out_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    opted_back_in_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    opt_out_keyword TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'sms',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sms_opt_outs_lookup
ON sms_opt_outs(business_id, phone_number, is_active)
WHERE is_active = TRUE;

-- Audit table for compliance
CREATE TABLE sms_opt_out_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    phone_number TEXT NOT NULL,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/dashboard/sms/opt-outs` | GET | List opted-out numbers with pagination |
| `/api/twilio/sms` | POST | Modified to handle opt-out keywords |

### Security Considerations

1. All opt-out actions logged with timestamps for compliance
2. Data retained for 7 years per FCC guidelines
3. Phone numbers normalized to E.164 format to prevent bypass

---

## RQ-GDPR-001: Data Deletion Workflow

### Priority: CRITICAL (Legal Risk)
### Risk: GDPR fines up to 4% of annual revenue

### Current State Analysis

The codebase has no user-facing data deletion:
- No "Delete My Data" option in settings
- No data export functionality
- Admin panel can view but not process deletions

### User Stories

| ID | User Story | Priority |
|----|-----------|----------|
| US-GDPR-01 | As a **user**, I want to request deletion of all my data | Must Have |
| US-GDPR-02 | As a **user**, I want to export all my data before deletion | Must Have |
| US-GDPR-03 | As a **user**, I want a 14-day grace period to cancel deletion | Must Have |

### Acceptance Criteria

```gherkin
Scenario: User requests data export
  Given a user is logged in
  When they click "Export My Data" in Settings > Privacy
  Then a data export job is queued
  And user receives email when export is ready
  And export link expires in 7 days

Scenario: User requests account deletion
  Given a user is logged in
  When they confirm deletion with password
  Then a 14-day grace period begins
  And user can cancel within grace period
  And after grace period, all data is permanently deleted
```

### Data Model Changes

```sql
CREATE TABLE data_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    business_id UUID REFERENCES businesses(id),
    request_type TEXT NOT NULL, -- 'export', 'deletion'
    status TEXT NOT NULL DEFAULT 'pending',
    grace_period_ends_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    feedback_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE deletion_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL,
    entity_type TEXT NOT NULL,
    records_deleted INTEGER NOT NULL DEFAULT 0,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/privacy/export` | POST | Request data export |
| `/api/privacy/export/[id]/download` | GET | Download completed export |
| `/api/privacy/deletion` | POST | Request account deletion |
| `/api/privacy/deletion/[id]` | DELETE | Cancel pending deletion |

### UI/UX Requirements

New page: `/settings/privacy` with:
- "Export My Data" button
- "Delete Account" button (opens confirmation modal)
- Display pending deletion status with cancel option

---

## RQ-BILL-001: Trial Period Support

### Priority: HIGH (Customer Acquisition)

### Current State Analysis

The codebase mentions trials but implementation is incomplete:
- `subscription_status: "trial"` exists in `lib/auth/actions.ts` line 203
- Pricing page mentions "14-day free trial"
- No actual trial period tracking or enforcement

### User Stories

| ID | User Story | Priority |
|----|-----------|----------|
| US-TRIAL-01 | As a **new user**, I want to start a 14-day free trial without credit card | Must Have |
| US-TRIAL-02 | As a **trial user**, I want to see how many trial days remain | Must Have |
| US-TRIAL-03 | As a **trial user**, I want limited but functional access (30 minutes) | Must Have |

### Acceptance Criteria

```gherkin
Scenario: New user starts trial
  Given a new user signs up
  When they complete onboarding
  Then subscription_status is set to "trialing"
  And trial_ends_at is set to 14 days from now
  And trial_minutes_limit is set to 30

Scenario: Trial usage limits
  Given a trial user has used 28 of 30 trial minutes
  When they receive a call lasting 5 minutes
  Then the call handles first 2 minutes
  Then AI says "Please visit our website to continue"
  And user receives upgrade notification

Scenario: Trial expires
  Given a trial has expired without conversion
  When user tries to access dashboard
  Then "Trial Expired" modal appears
  And receptionist stops answering calls
```

### Data Model Changes

```sql
-- Add columns to businesses table
ALTER TABLE businesses
ADD COLUMN trial_ends_at TIMESTAMPTZ,
ADD COLUMN trial_minutes_limit INTEGER DEFAULT 30,
ADD COLUMN trial_minutes_used INTEGER DEFAULT 0,
ADD COLUMN trial_reminder_3_day_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN trial_reminder_1_day_sent BOOLEAN DEFAULT FALSE;

-- Trial events for analytics
CREATE TABLE trial_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    event_type TEXT NOT NULL,
    event_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Modified Signup Flow

Update `lib/auth/actions.ts`:

```typescript
// In signup function, modify business creation:
const trialEndsAt = new Date();
trialEndsAt.setDate(trialEndsAt.getDate() + 14);

const { data: businessData } = await adminClient
  .from("businesses")
  .insert({
    user_id: authData.user.id,
    name: data.businessName,
    onboarding_step: 1,
    subscription_status: "trialing",
    trial_ends_at: trialEndsAt.toISOString(),
    trial_minutes_limit: 30,
    trial_minutes_used: 0,
  })
  .select("id")
  .single();
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/dashboard/trial` | GET | Get trial status |
| `/api/admin/trial/extend` | POST | Extend trial (admin only) |

### UI Component: Trial Banner

```tsx
// components/dashboard/trial-banner.tsx
export function TrialBanner({ trialInfo }: { trialInfo: TrialInfo }) {
  if (!trialInfo.isTrialing) return null;

  return (
    <div className={cn(
      "flex items-center justify-between px-4 py-2",
      trialInfo.daysRemaining <= 3 ? "bg-amber-500" : "bg-blue-500",
      "text-white"
    )}>
      <span>Trial: {trialInfo.daysRemaining} days left | {trialInfo.minutesUsed}/{trialInfo.minutesLimit} minutes used</span>
      <Button size="sm" variant="outline" asChild>
        <Link href="/settings?tab=billing">Upgrade Now</Link>
      </Button>
    </div>
  );
}
```

---

## RQ-INT-001: Zapier Integration

### Priority: HIGH (Market Competitiveness)
### Impact: Opens 5,000+ app connections

### User Stories

| ID | User Story | Priority |
|----|-----------|----------|
| US-ZAP-01 | As a **business owner**, I want to connect Koya to Zapier | Must Have |
| US-ZAP-02 | As a **business owner**, I want Zapier to trigger on new calls | Must Have |
| US-ZAP-03 | As a **business owner**, I want Zapier to trigger on appointments | Must Have |
| US-ZAP-04 | As a **business owner**, I want to send SMS via Zapier actions | Should Have |

### Data Model Changes

```sql
-- API Keys for authentication
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    permissions TEXT[] NOT NULL DEFAULT ARRAY['read'],
    last_used_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Webhook subscriptions for triggers
CREATE TABLE webhook_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    event_type TEXT NOT NULL,
    target_url TEXT NOT NULL,
    secret TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    failure_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/zapier/auth` | POST | Validate API key |
| `/api/v1/zapier/triggers/calls` | GET | Poll trigger for calls |
| `/api/v1/zapier/triggers/appointments` | GET | Poll trigger for appointments |
| `/api/v1/zapier/hooks` | POST | Subscribe to webhook |
| `/api/v1/zapier/hooks/[id]` | DELETE | Unsubscribe |
| `/api/v1/zapier/actions/sms` | POST | Send SMS action |

### Zapier Triggers

**New Call Trigger Output:**
```json
{
  "id": "call_123",
  "from_number": "+15551234567",
  "duration_seconds": 180,
  "outcome": "booked",
  "summary": "Customer called to book a haircut",
  "lead_name": "John Smith",
  "lead_email": "john@example.com",
  "created_at": "2026-01-21T10:30:00Z"
}
```

**New Appointment Trigger Output:**
```json
{
  "id": "apt_456",
  "customer_name": "John Smith",
  "customer_phone": "+15551234567",
  "service_name": "Haircut",
  "scheduled_at": "2026-01-25T14:00:00Z",
  "status": "confirmed"
}
```

---

## RQ-INT-002: HubSpot CRM Integration

### Priority: HIGH (Most Requested SMB Integration)

### User Stories

| ID | User Story | Priority |
|----|-----------|----------|
| US-HS-01 | As a **business owner**, I want to connect my HubSpot account | Must Have |
| US-HS-02 | As a **business owner**, I want contacts synced to HubSpot | Must Have |
| US-HS-03 | As a **business owner**, I want call activities logged in HubSpot | Must Have |
| US-HS-04 | As a **business owner**, I want appointments to create deals | Should Have |

### Data Model Changes

```sql
CREATE TABLE crm_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    provider TEXT NOT NULL, -- 'hubspot', 'salesforce'
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT NOT NULL,
    token_expires_at TIMESTAMPTZ NOT NULL,
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE crm_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL REFERENCES crm_integrations(id),
    sync_type TEXT NOT NULL, -- 'contacts', 'activities', 'deals'
    direction TEXT NOT NULL, -- 'push', 'pull'
    records_processed INTEGER NOT NULL DEFAULT 0,
    errors JSONB,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/integrations/hubspot/auth` | GET | Start OAuth flow |
| `/api/integrations/hubspot/callback` | GET | OAuth callback |
| `/api/integrations/hubspot/sync` | POST | Manual sync trigger |
| `/api/integrations/hubspot/settings` | PATCH | Update sync settings |
| `/api/integrations/hubspot/disconnect` | DELETE | Remove integration |

### Sync Logic

```typescript
// lib/integrations/hubspot/sync.ts

export async function syncContactToHubSpot(
  integration: CRMIntegration,
  contact: CallerProfile
) {
  const hubspotClient = getHubSpotClient(integration);

  // Check if contact exists
  const existing = await hubspotClient.crm.contacts.searchApi.doSearch({
    filterGroups: [{
      filters: [{
        propertyName: 'phone',
        operator: 'EQ',
        value: contact.phone_number
      }]
    }]
  });

  const properties = {
    firstname: contact.name?.split(' ')[0] || '',
    lastname: contact.name?.split(' ').slice(1).join(' ') || '',
    phone: contact.phone_number,
    email: contact.email || '',
    koya_caller_id: contact.id,
    koya_total_calls: contact.call_count?.toString() || '0',
  };

  if (existing.results.length > 0) {
    await hubspotClient.crm.contacts.basicApi.update(
      existing.results[0].id,
      { properties }
    );
  } else {
    await hubspotClient.crm.contacts.basicApi.create({ properties });
  }
}
```

---

## RQ-UX-001: In-App Help System

### Priority: HIGH (User Experience)

### Current State Analysis

No help system exists:
- Dashboard header has no help icon
- No FAQ or knowledge base
- No support chat widget
- Users have no way to get assistance

### User Stories

| ID | User Story | Priority |
|----|-----------|----------|
| US-HELP-01 | As a **user**, I want to access help from any page | Must Have |
| US-HELP-02 | As a **user**, I want contextual help for complex features | Must Have |
| US-HELP-03 | As a **user**, I want to search for answers | Should Have |
| US-HELP-04 | As a **user**, I want to contact support directly | Must Have |

### UI/UX Requirements

**Help Button in Header:**
```tsx
// Add to components/dashboard/header.tsx
<Button variant="ghost" size="icon" onClick={() => setHelpOpen(true)}>
  <HelpCircle className="h-5 w-5" />
</Button>
```

**Help Panel Component:**
```tsx
// components/dashboard/help-panel.tsx
export function HelpPanel({ isOpen, onClose, context }: HelpPanelProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[400px]">
        <SheetHeader>
          <SheetTitle>Help & Support</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {/* Search */}
          <Input placeholder="Search help articles..." />

          {/* Contextual Help */}
          {context && <ContextualHelp context={context} />}

          {/* Quick Links */}
          <QuickHelpLinks />

          {/* Contact Support */}
          <Button className="w-full">
            <MessageCircle className="mr-2 h-4 w-4" />
            Contact Support
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

### Help Content Structure

```
/help
├── getting-started/
│   ├── setup-guide.md
│   ├── your-first-call.md
│   └── billing-overview.md
├── features/
│   ├── call-handling.md
│   ├── appointments.md
│   ├── knowledge-base.md
│   └── voice-settings.md
├── integrations/
│   ├── google-calendar.md
│   ├── outlook-calendar.md
│   └── zapier.md
└── troubleshooting/
    ├── call-quality.md
    ├── calendar-sync.md
    └── billing-issues.md
```

---

## RQ-UX-002: Setup Completion Checklist

### Priority: HIGH (Activation Rate)

### User Stories

| ID | User Story | Priority |
|----|-----------|----------|
| US-SETUP-01 | As a **new user**, I want to see what setup steps remain | Must Have |
| US-SETUP-02 | As a **new user**, I want to know which steps are required vs optional | Must Have |
| US-SETUP-03 | As a **user**, I want to dismiss the checklist after completing setup | Should Have |

### Checklist Items

| Step | Required | Validation |
|------|----------|------------|
| Business Name | Yes | `business.name` exists |
| Phone Number | Yes | `business.phone_number` exists |
| Business Hours | Yes | At least one day configured |
| Services | Yes | At least one service added |
| FAQs | No | At least 3 FAQs added |
| Voice Selection | No | Non-default voice selected |
| Calendar Integration | No | Google or Outlook connected |
| Test Call | No | At least one test call made |

### Component Implementation

```tsx
// components/dashboard/setup-checklist.tsx

interface ChecklistItem {
  id: string;
  label: string;
  required: boolean;
  completed: boolean;
  href: string;
}

export function SetupChecklist({ business }: { business: Business }) {
  const items: ChecklistItem[] = [
    {
      id: 'phone',
      label: 'Connect phone number',
      required: true,
      completed: !!business.phone_number,
      href: '/settings?tab=phone',
    },
    {
      id: 'hours',
      label: 'Set business hours',
      required: true,
      completed: business.business_hours?.length > 0,
      href: '/settings?tab=hours',
    },
    // ... more items
  ];

  const completedCount = items.filter(i => i.completed).length;
  const progress = (completedCount / items.length) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Complete Your Setup</CardTitle>
        <Progress value={progress} />
      </CardHeader>
      <CardContent>
        {items.map(item => (
          <ChecklistItemRow key={item.id} item={item} />
        ))}
      </CardContent>
    </Card>
  );
}
```

---

## RQ-UX-003: Recording Playback UI

### Priority: MEDIUM (User Experience)

### Current State Analysis

The codebase has recording data but limited UI:
- `recording_url` exists on calls
- Basic audio element in `calls-client.tsx` lines 672-677
- No transcript sync, no waveform, limited controls

### User Stories

| ID | User Story | Priority |
|----|-----------|----------|
| US-REC-01 | As a **business owner**, I want to play call recordings | Must Have |
| US-REC-02 | As a **business owner**, I want transcript synced with audio | Should Have |
| US-REC-03 | As a **business owner**, I want to download recordings | Must Have |
| US-REC-04 | As a **business owner**, I want to adjust playback speed | Should Have |

### Component Design

```tsx
// components/ui/audio-player.tsx

interface AudioPlayerProps {
  src: string;
  transcript?: TranscriptEntry[];
  downloadFilename?: string;
  agentName?: string;
}

interface TranscriptEntry {
  role: "agent" | "user";
  content: string;
  start_time?: number;
}

export function AudioPlayer({ src, transcript, downloadFilename, agentName = "Koya" }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Features:
  // - Play/Pause with keyboard shortcuts (space)
  // - Progress bar with seek
  // - Skip forward/backward 10 seconds (arrow keys)
  // - Volume control
  // - Playback speed (0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x)
  // - Download button
  // - Transcript panel with click-to-seek
  // - Auto-scroll transcript with playback
  // - Highlight current transcript entry

  return (
    <div className="border rounded-lg p-4">
      <audio ref={audioRef} src={src} />

      {/* Progress Bar */}
      <Slider
        value={[currentTime]}
        max={duration}
        step={0.1}
        onValueChange={([value]) => seekTo(value)}
      />

      {/* Controls */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={() => skip(-10)}>
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button size="icon" onClick={togglePlay}>
            {isPlaying ? <Pause /> : <Play />}
          </Button>
          <Button size="icon" variant="ghost" onClick={() => skip(10)}>
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        <span className="text-sm text-muted-foreground">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <div className="flex items-center gap-2">
          <Select value={playbackRate.toString()} onValueChange={setSpeed}>
            <SelectTrigger className="w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0.5">0.5x</SelectItem>
              <SelectItem value="0.75">0.75x</SelectItem>
              <SelectItem value="1">1x</SelectItem>
              <SelectItem value="1.25">1.25x</SelectItem>
              <SelectItem value="1.5">1.5x</SelectItem>
              <SelectItem value="2">2x</SelectItem>
            </SelectContent>
          </Select>

          <Button size="icon" variant="ghost" asChild>
            <a href={src} download={downloadFilename}>
              <Download className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>

      {/* Transcript */}
      {transcript && (
        <div className="mt-4 max-h-[300px] overflow-y-auto">
          {transcript.map((entry, i) => (
            <TranscriptLine
              key={i}
              entry={entry}
              isActive={isCurrentEntry(entry, currentTime)}
              onClick={() => seekTo(entry.start_time)}
              agentName={agentName}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

### Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Recording not available | Show "Recording unavailable" message |
| Transcript missing timestamps | Show transcript without click-to-seek |
| Large recording (>30min) | Lazy load waveform, stream audio |
| Mobile playback | Simplified controls, touch-friendly |
| Download blocked | Fallback to open in new tab |

---

## RQ-HIPAA-001: Healthcare Compliance

### Priority: HIGH (Market Expansion)
### Impact: Unlocks 47% of healthcare market

### User Stories

| ID | User Story | Priority |
|----|-----------|----------|
| US-HIPAA-01 | As a **healthcare provider**, I want HIPAA-compliant call handling | Must Have |
| US-HIPAA-02 | As a **healthcare provider**, I want to sign a BAA | Must Have |
| US-HIPAA-03 | As an **admin**, I want audit logs of all PHI access | Must Have |

### Technical Requirements

1. **Data Encryption**
   - All PHI encrypted at rest (Supabase handles this)
   - All PHI encrypted in transit (HTTPS enforced)
   - Recording storage in HIPAA-compliant bucket

2. **Access Controls**
   - Role-based access to PHI
   - Automatic session timeout (15 minutes)
   - MFA required for healthcare accounts

3. **Audit Logging**
   - Log all PHI access with user, timestamp, action
   - Log all data exports
   - 7-year retention of audit logs

4. **BAA Process**
   - Digital BAA signing during onboarding
   - Store signed BAA documents
   - Annual BAA renewal reminders

### Data Model Changes

```sql
CREATE TABLE hipaa_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    hipaa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    baa_signed_at TIMESTAMPTZ,
    baa_document_url TEXT,
    mfa_required BOOLEAN NOT NULL DEFAULT TRUE,
    session_timeout_minutes INTEGER NOT NULL DEFAULT 15,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE phi_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    user_id UUID NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for compliance queries
CREATE INDEX idx_phi_audit_log_business
ON phi_audit_log(business_id, created_at DESC);
```

---

## Implementation Roadmap

### Phase 1: Critical Compliance (Weeks 1-6)
1. **RQ-TCPA-001**: SMS Opt-Out Handling - 2 sprints
2. **RQ-GDPR-001**: Data Deletion Workflow - 3 sprints

### Phase 2: Revenue Enablement (Weeks 7-10)
3. **RQ-BILL-001**: Trial Period Support - 2 sprints
4. **RQ-BILL-002**: Entry-Level Pricing - 1 sprint

### Phase 3: Market Competitiveness (Weeks 11-16)
5. **RQ-INT-001**: Zapier Integration - 3 sprints
6. **RQ-INT-002**: HubSpot Integration - 2 sprints

### Phase 4: User Experience (Weeks 17-20)
7. **RQ-UX-001**: In-App Help System - 2 sprints
8. **RQ-UX-002**: Setup Completion Checklist - 1 sprint
9. **RQ-UX-003**: Recording Playback UI - 1 sprint
10. **RQ-HIPAA-001**: Healthcare Compliance - 3 sprints

---

## Summary: New Database Tables Required

| Table | Purpose | Priority |
|-------|---------|----------|
| `sms_opt_outs` | Track SMS opt-out preferences | P0 |
| `sms_opt_out_audit` | Compliance audit trail | P0 |
| `data_requests` | Track GDPR export/deletion requests | P0 |
| `deletion_audit_log` | Record data deletions | P0 |
| `trial_events` | Track trial lifecycle | P1 |
| `api_keys` | Zapier authentication | P1 |
| `webhook_subscriptions` | Zapier triggers | P1 |
| `crm_integrations` | HubSpot/Salesforce connections | P1 |
| `crm_sync_log` | Track CRM sync operations | P1 |
| `hipaa_settings` | Healthcare compliance settings | P1 |
| `phi_audit_log` | PHI access audit trail | P1 |

## Summary: New API Endpoints Required

| Endpoint | Purpose | Priority |
|----------|---------|----------|
| `POST /api/privacy/export` | Request data export | P0 |
| `POST /api/privacy/deletion` | Request account deletion | P0 |
| `GET /api/dashboard/sms/opt-outs` | View opt-out list | P0 |
| `GET /api/dashboard/trial` | Get trial status | P1 |
| `POST /api/v1/zapier/auth` | Zapier authentication | P1 |
| `GET /api/v1/zapier/triggers/calls` | Zapier call trigger | P1 |
| `POST /api/v1/zapier/hooks` | Zapier webhook subscription | P1 |
| `GET /api/integrations/hubspot/auth` | HubSpot OAuth | P1 |
| `POST /api/integrations/hubspot/sync` | HubSpot manual sync | P1 |

---

**Document Status**: Ready for Development Implementation
**Risk Assessment**: High priority items (TCPA, GDPR) carry significant legal/financial risk if delayed
**Recommended Action**: Begin Phase 1 immediately with dedicated compliance sprint
