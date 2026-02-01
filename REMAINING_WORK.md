# Koya Caller - Remaining Work Documentation

> **Last Updated:** January 23, 2025
> **Purpose:** Track all incomplete features, bugs, and technical debt
> **Usage:** Work through items 1-by-1 in new chat sessions, research implementation, test thoroughly

---

## 🚀 Quick Start for New Chat Sessions

**Project:** AI phone receptionist SaaS for small businesses (salons, dental, HVAC, etc.)
**Stack:** Next.js 14, Supabase, Retell.ai (voice), Twilio (SMS), Stripe, Claude AI

### Current State (Jan 23, 2025)
- ✅ **Core features complete** - Calls, appointments, payments, calendar sync
- ✅ **Phase 3 backend done** - Outbound calls, HIPAA, Stripe Connect (90%+)
- ✅ **Production polish done** - Rate limiting, logging, demo agent, URL config
- ✅ **Test suite** (851 tests)
- ✅ **Dashboard UIs complete** - Campaigns, HIPAA, Payments

### Key Files to Know
- `lib/config/index.ts` - Centralized URLs and config
- `lib/logging/index.ts` - Use `logError`, `logWarning`, `logInfo`
- `lib/rate-limit/` - Rate limiting middleware
- `lib/outbound/index.ts` - Outbound calling functions
- `lib/hipaa/` - HIPAA compliance (audit, encryption, consent)
- `lib/stripe/connect.ts` - Stripe Connect payments

### What to Work On Next
1. **Webhook retry logic** - Store failed webhooks for replay
2. **Fallback SMS provider** - Add backup for Twilio
3. **RLS policies verification** - Verify all tables have proper policies
4. **Supabase types regeneration** - Regenerate types from current schema

---

## Table of Contents

1. [Critical Issues](#critical-issues)
2. [High Priority Features](#high-priority-features)
3. [Medium Priority Features](#medium-priority-features)
4. [Low Priority / Technical Debt](#low-priority--technical-debt)
5. [Environment Variables Reference](#environment-variables-reference)
6. [Feature Completeness Checklist](#feature-completeness-checklist)
7. [Testing Checklist](#testing-checklist)

---

## Critical Issues

### 1. ~~Notifications Disabled in Production~~ ✅ FIXED

**Status:** Fixed on January 18, 2025 (commit ec6fc05)

**Original Problem:** The description was misleading. The actual issues were:
1. Inngest function queried non-existent columns (`sms_missed_call` instead of `sms_missed`, `email_missed_call` instead of `email_missed`)
2. Missing `email_missed` column and feature entirely

**Fix Applied:**
- Fixed Inngest function column names in `lib/inngest/functions/missed-call-alerts.ts`
- Added `email_missed` column via migration `20250118000001_add_email_missed.sql`
- Added email missed call toggle to Settings UI
- Updated Twilio status route to support both SMS and email notifications
- Updated TypeScript types

**Files Changed:**
- `lib/inngest/functions/missed-call-alerts.ts` - Fixed column name queries
- `app/api/twilio/status/route.ts` - Added email notification support
- `app/(dashboard)/settings/settings-client.tsx` - Added UI toggle
- `app/api/dashboard/settings/notifications/route.ts` - Handle emailMissed field
- `types/index.ts`, `types/supabase.ts` - Added email_missed type
- `supabase/full_schema.sql` - Added email_missed column
- `supabase/migrations/20250118000001_add_email_missed.sql` - Migration

---

### 2. ~~Error Reporting Not Implemented~~ ✅ FIXED

**Status:** Fixed on January 18, 2025

**Fix Applied:**
- Installed `@sentry/nextjs` SDK
- Created Sentry configuration files for client, server, and edge runtimes
- Updated `next.config.js` to integrate Sentry with source map upload support
- Updated `lib/logging/index.ts` to automatically report errors to Sentry
- Updated `app/error.tsx` to capture errors in Sentry
- Updated `app/global-error.tsx` to capture critical errors in Sentry
- Updated CSP headers to allow Sentry connections

**Files Created:**
- `sentry.client.config.ts` - Client-side Sentry configuration
- `sentry.server.config.ts` - Server-side Sentry configuration
- `sentry.edge.config.ts` - Edge runtime Sentry configuration

**Files Modified:**
- `next.config.js` - Added withSentryConfig wrapper and CSP updates
- `lib/logging/index.ts` - logError and logErrorWithMeta now report to Sentry
- `app/error.tsx` - Reports errors to Sentry with error boundary context
- `app/global-error.tsx` - Reports critical errors to Sentry

**Environment Variables Required:**
```env
# Required for Sentry to work
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
SENTRY_DSN=your-sentry-dsn

# Optional: for source map uploads
SENTRY_AUTH_TOKEN=your-auth-token
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project

# Optional: enable in development
SENTRY_ENABLED=true
```

**Setup Instructions:**
1. Create Sentry account at https://sentry.io
2. Create a new Next.js project in Sentry
3. Copy the DSN and add to environment variables
4. Deploy - errors will automatically be reported

---

### 3. ~~TypeScript Suppressions (40+ instances)~~ ✅ FIXED

**Status:** Fixed on January 18, 2025

**Original Problem:** Multiple `@ts-expect-error` and `@ts-ignore` comments suppressing type errors due to Supabase type inference failures.

**Fix Applied:**
- Added missing table types to `types/supabase.ts`: `admin_audit_logs`, `announcements`, `system_logs`
- Added missing RPC function types: `increment_caller_count`, `increment_usage_minutes`, `update_caller_profile`
- Added missing `businesses` columns: `phone_number`, `twilio_phone_sid`
- Replaced all `@ts-expect-error` and `@ts-ignore` comments with targeted `(supabase.from() as any)` type assertions
- TypeScript now compiles cleanly with `npx tsc --noEmit`

**Files Modified:**
- `types/supabase.ts` - Added 162 lines of missing type definitions
- `app/api/claude/process-queue/route.ts` - Removed 4 suppressions
- `app/api/claude/generate-prompt/route.ts` - Removed 1 suppression
- `app/api/retell/function/route.ts` - Removed 5 suppressions
- `app/api/retell/agent/route.ts` - Removed 4 suppressions
- `app/api/twilio/configure/route.ts` - Removed 2 suppressions
- `lib/claude/caller-context.ts` - Removed 2 suppressions

**Technical Notes:**
The Supabase client has known type inference issues when Database types don't perfectly match its expectations. The `(supabase.from() as any)` pattern is cleaner than `@ts-expect-error` because it:
1. Explicitly marks where type assertions happen
2. Allows the rest of the chain to remain type-safe
3. Doesn't suppress unrelated errors

---

## High Priority Features

### 4. Mock Mode Throughout System

**Problem:** When API keys are not configured, system returns fake data instead of failing clearly

**Affected Systems:**

#### Retell.ai Mock Mode
- **Files:** `lib/retell/index.ts` lines 74, 120-121, 320-321, 359, 436
- **Behavior:** Returns `agent_mock_${Date.now()}`, `llm_mock_${Date.now()}`
- **Fix:** Add clear error messages or UI indication when in mock mode

#### Twilio Mock Mode
- **Files:** `lib/twilio/index.ts` lines 85, 274-317
- **Behavior:** Returns `SM${Date.now()}mock`, `PN${Date.now()}mock`
- **Fix:** Prevent onboarding completion without real phone number

#### Claude API Mock Mode
- **Files:** `lib/claude/index.ts` lines 220-255, 511-513
- **Behavior:** Generates generic mock prompts
- **Fix:** Show warning in dashboard when using mock prompts

#### Demo Call Mock Mode
- **File:** `app/api/demo/call/route.ts` lines 56, 259-263
- **Behavior:** Returns `mock: true` without working call
- **Fix:** Disable demo button when Retell not configured

**Overall Fix Strategy:**
1. Add `MOCK_MODE_ENABLED` environment variable
2. Show clear UI indicators when in mock mode
3. Prevent production deployment without required env vars
4. Add health check endpoint that verifies all integrations

---

### 5. Spanish Language Support Incomplete

**Current State:**
- Language selector works in onboarding (`components/onboarding/step6-language.tsx`)
- Spanish greeting fields exist in knowledge base
- `language_mode: auto | ask | spanish_default` option exists

**What's Missing:**
- UI not translated to Spanish
- Spanish Retell agent not created (see #9)
- Auto-detection logic unclear
- Spanish voice providers not fully tested

**Files to Update:**
- All components in `components/` need i18n
- `lib/retell/index.ts` - Spanish agent creation
- `app/api/retell/agent/route.ts` - Spanish agent handling

**Implementation Steps:**
1. Choose i18n library (next-intl or react-i18next)
2. Extract all UI strings to translation files
3. Create Spanish translations
4. Test language switching
5. Test Spanish voice calls end-to-end

---

### 6. Stripe Webhook Silent Failures

**File:** `app/api/stripe/webhook/route.ts` lines 22-26, 45-55

**Problem:** Plan lookup failures return `null` with no logging

**Current Code:**
```typescript
if (!plan) {
  return null;  // Silent failure!
}
```

**Fix Required:**
```typescript
if (!plan) {
  logError("Stripe Webhook", `Plan not found for price ID: ${priceId}`);
  // Consider: Send alert to admin
  return null;
}
```

**Additional Improvements:**
- Add retry logic for transient failures
- Store failed webhook events for replay
- Add admin notification for critical failures

---

### 7. ~~Calendar Integration - One Way Only~~ ✅ FIXED

**Status:** Fixed on January 19, 2025

**Original Problem:** Calendar was one-way only - Koya could create events but couldn't read or sync changes

**Fix Applied:**
- Calendar clients already had `getEvents()` methods implemented (Google: lines 323-352, Outlook: lines 379-408)
- Conflict checking was already implemented in booking flow using `getFreeBusy()`
- Added `getCalendarEvents()` helper function to calendar module for easier access
- Added `deleteCalendarEvent()` helper function for removing events
- Created Inngest job `syncExternalCalendars` that runs every 15 minutes to detect:
  - Cancelled events in external calendars → auto-cancel Koya appointments
  - Rescheduled events → update Koya appointment times
- Added calendar event deletion when appointments are cancelled from dashboard
- Added event types `calendar/sync.business` and `calendar/sync.check` to Inngest

**Files Created:**
- `lib/inngest/functions/calendar-sync.ts` - Two-way sync Inngest functions

**Files Modified:**
- `lib/calendar/index.ts` - Added `getCalendarEvents()` and `deleteCalendarEvent()` helpers
- `lib/inngest/index.ts` - Export new sync functions
- `lib/inngest/client.ts` - Added calendar sync event types
- `app/api/dashboard/appointments/[id]/route.ts` - Delete calendar event on cancel

---

### 8. ~~Appointment Reminders Not Implemented~~ ✅ FIXED

**Status:** Fixed on January 19, 2025

**Original Problem:** Documentation was outdated - reminders were actually already implemented!

**What Was Already Working:**
- `lib/inngest/functions/appointment-reminders.ts` already has:
  - `checkAppointmentReminders` - Cron job running every 15 minutes
  - `sendAppointmentReminderEvent` - Individual reminder sender with retries
- Database columns `reminder_1hr_sent_at` and `reminder_24hr_sent_at` exist (migration 20250113000001)

**Fixes Applied:**
- Fixed column naming inconsistency: `reminder_1h_sent_at` → `reminder_1hr_sent_at` in full_schema.sql
- Added 'both' option to `sms_customer_reminder` constraint (migration 20250119000001)
- Updated `ReminderSetting` type to include 'both'
- Added "Both (1hr & 24hr)" option to Settings UI

**Files Modified:**
- `supabase/full_schema.sql` - Fixed column names, added 'both' constraint
- `supabase/migrations/20250119000001_reminder_both_option.sql` - New migration
- `types/index.ts` - Added 'both' to ReminderSetting type
- `app/(dashboard)/settings/settings-client.tsx` - Added 'both' UI option

---

### 9. ~~Spanish Retell Agent Not Created~~ ✅ FIXED

**Status:** Fixed on January 19, 2025

**Original Problem:** Code referenced `retell_agent_id_spanish` but never created it

**Fix Applied:**
- Added Spanish-only agent creation when Spanish is enabled
- Agent created with `language: "es"` using Spanish greeting and system prompt
- Updated `AgentCreateParams.language` type to include "es"
- Added Spanish-specific backchannel words ("ajá", "sí", "vale", "entiendo", "claro")
- Incoming calls route to Spanish agent when `language_mode === "spanish_default"`
- Dynamic variables use Spanish greeting for Spanish agent calls

**Files Modified:**
- `app/api/retell/agent/route.ts` - Create separate Spanish agent when enabled
- `app/api/retell/incoming/route.ts` - Route to Spanish agent based on language_mode
- `lib/retell/index.ts` - Added "es" language configuration
- `lib/retell/types.ts` - Added "es" to language type union

**Behavior:**
- `spanish_default` mode → Uses dedicated Spanish agent
- `auto` or `ask` modes → Uses multilingual agent (handles both languages)

---

## Medium Priority Features

### 10. Admin Analytics Shallow

**Current State:** Basic MRR, ARPU, customer counts in `app/api/admin/financials/route.ts`

**Missing Metrics:**
- Churn prediction scores
- Feature adoption rates
- Customer health scores
- Call success rates by business
- Revenue per customer segment
- Cohort analysis

**Files:**
- `app/api/admin/health/route.ts` - Basic health metrics
- `app/api/admin/financials/route.ts` - Financial metrics
- `app/(admin)/admin/reports/page.tsx` - Reports UI

**Implementation Priority:**
1. Add call success rate tracking
2. Add churn risk indicators (already partially done)
3. Add customer lifetime value calculation
4. Create admin dashboard widgets

---

### 11. Onboarding Can Be Skipped

**File:** `app/api/onboarding/complete/route.ts` line 35

**Problem:** Users can complete onboarding without testing their voice agent

**Current Flow:**
1. Business info ✓
2. Services/FAQs ✓
3. Calendar ✓
4. Voice selection ✓
5. Test call ← CAN BE SKIPPED
6. Complete ✓

**Fix Options:**
1. Remove skip button on test step
2. Require at least one successful test call
3. Show warning but allow skip
4. Track if user skipped for follow-up

---

### 12. Voice Preview Silent Failures

**File:** `app/api/voices/preview/route.ts` line 48

**Problem:** Generic catch block, errors not clearly communicated

**Fix:**
```typescript
} catch (error) {
  logError("Voice Preview", error);
  return NextResponse.json(
    { error: "Failed to generate voice preview. Please try again." },
    { status: 500 }
  );
}
```

---

### 13. Rate Limiting Fails Open

**File:** `lib/rate-limit/middleware.ts`

**Problem:** If Redis is unavailable, requests are NOT rate limited

**Current Behavior:** Silently allows all requests when Redis fails

**Fix Options:**
1. Fail closed (deny all requests when Redis down)
2. Use in-memory fallback with degraded limits
3. Add monitoring/alerting for Redis failures

---

### 14. Input Validation Missing in Retell Functions

**File:** `app/api/retell/function/route.ts`

**Problem:** Date, time, phone from Retell AI not validated

**Current Code:**
```typescript
if (!date || !time || !customer_name || !customer_phone || !service) {
  // Only checks presence, not format
}
```

**Fix Required:**
```typescript
// Validate date format (YYYY-MM-DD)
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
if (!dateRegex.test(date)) {
  return { success: false, message: "Invalid date format" };
}

// Validate time format (HH:MM)
const timeRegex = /^\d{2}:\d{2}$/;
if (!timeRegex.test(time)) {
  return { success: false, message: "Invalid time format" };
}

// Validate phone (E.164 format)
const phoneRegex = /^\+?[1-9]\d{1,14}$/;
if (!phoneRegex.test(customer_phone.replace(/\D/g, ''))) {
  return { success: false, message: "Invalid phone number" };
}
```

---

## Low Priority / Technical Debt

### 15. Supabase Types Need Regeneration

**Problem:** Types in `types/supabase.ts` may not match current database schema

**Fix:**
```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/supabase.ts
```

---

### 16. Inconsistent Error Response Formats

**Problem:** Some routes return `{ error: "..." }`, others return `{ message: "..." }`

**Standard Format:**
```typescript
// Error response
{ error: string, code?: string, details?: object }

// Success response
{ data: object, message?: string }
```

---

### 17. ~~Console.log in Production Code~~ ✅ FIXED

**Status:** Fixed January 23, 2025

All console statements replaced with structured logging:
- Server: `logError`, `logWarning`, `logInfo` from `lib/logging`
- Client error boundaries: `Sentry.captureException`
- Client components: Removed redundant logging (UI handles errors)

---

### 18. RLS Policies May Be Missing

**Check Required:** Verify all tables have Row Level Security policies

**Tables to Check:**
- businesses
- calls
- appointments
- services
- faqs
- knowledge
- ai_config
- call_settings
- calendar_integrations
- phone_numbers

---

### 19. Webhook Retry Logic Missing

**Problem:** Failed webhooks (Stripe, Retell, Twilio) not retried

**Implementation:**
1. Store failed webhook events in database
2. Create retry job with exponential backoff
3. Alert admin after N failures

---

### 20. No Fallback SMS Provider

**Problem:** If Twilio is down, no SMS can be sent

**Options:**
- Add secondary provider (Vonage, AWS SNS)
- Queue SMS for retry when Twilio recovers

---

## Environment Variables Reference

### Required for App to Function

```env
# Supabase (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI Services (REQUIRED)
RETELL_API_KEY=
ANTHROPIC_API_KEY=

# Payments (REQUIRED)
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Phone (REQUIRED)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
```

### Required for Full Functionality

```env
# Rate Limiting
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Email
RESEND_API_KEY=

# Calendar - Google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Calendar - Outlook
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_TENANT_ID=

# Background Jobs
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# Demo
RETELL_DEMO_AGENT_ID=

# Error Reporting (Sentry)
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_DSN=
SENTRY_AUTH_TOKEN=          # Optional: for source map uploads
SENTRY_ORG=                 # Optional: for source map uploads
SENTRY_PROJECT=             # Optional: for source map uploads
```

---

## Feature Completeness Checklist

### Core Features
- [x] Voice calls via Retell
- [x] Phone provisioning via Twilio
- [x] Payments via Stripe
- [x] Calendar OAuth (Google/Outlook)
- [x] AI prompts via Claude
- [x] Dashboard analytics (basic)
- [x] Appointment booking
- [x] Knowledge base management
- [x] SMS notifications
- [x] Admin panel

### Partial Implementation
- [x] Spanish language support (i18n with next-intl, EN/ES translations)
- [x] Calendar sync (two-way sync implemented)
- [x] Appointment reminders (fully implemented with 'both' option)
- [x] Error reporting (Sentry integrated)
- [x] Advanced analytics (call success rates, churn risk, CLV, feature adoption)

### Not Implemented
- [ ] Real-time call transcription UI
- [ ] Recording playback in dashboard
- [ ] Webhook retry logic
- [ ] Automated failover

---

## Testing Checklist

### Before Each Deployment

- [ ] TypeScript compiles without errors: `npx tsc --noEmit`
- [ ] All env vars set in production
- [ ] Test a complete onboarding flow
- [ ] Test a voice call end-to-end
- [ ] Test appointment booking
- [ ] Test Stripe payment flow
- [ ] Verify webhooks receiving events

### Per-Feature Testing

| Feature | Test Case | Expected Result |
|---------|-----------|-----------------|
| Missed call notification | Miss a call | Email/SMS received |
| Appointment reminder | Book for 1hr away | SMS received |
| Spanish agent | Select Spanish | Spanish responses |
| Calendar sync | Book appointment | Event in Google/Outlook |
| Rate limiting | Spam API | 429 after limit |

---

## Progress Tracking

Use this section to track completion:

| # | Item | Status | Date | Notes |
|---|------|--------|------|-------|
| 1 | Enable notifications | ✅ Complete | Jan 18, 2025 | Fixed column names, added email_missed |
| 2 | Error reporting | ✅ Complete | Jan 18, 2025 | Sentry SDK integrated |
| 3 | TypeScript fixes | ✅ Complete | Jan 18, 2025 | Added types, replaced suppressions |
| 4 | Mock mode handling | ✅ Complete | Jan 19, 2025 | Integration status banner, console warnings |
| 5 | Spanish support | ✅ Complete | Jan 23, 2025 | i18n setup with next-intl, EN/ES translations |
| 6 | Stripe error handling | ✅ Complete | Jan 19, 2025 | Error logging for plan lookup failures |
| 7 | Calendar two-way sync | ✅ Complete | Jan 19, 2025 | Inngest sync job, delete on cancel |
| 8 | Appointment reminders | ✅ Complete | Jan 19, 2025 | Already implemented, added 'both' option |
| 9 | Spanish Retell agent | ✅ Complete | Jan 19, 2025 | Separate agent, language routing |
| 10 | Admin analytics | ✅ Complete | Jan 23, 2025 | Added call success rates, churn risk scoring, CLV, feature adoption |
| 11 | Onboarding validation | ✅ Complete | Jan 23, 2025 | Test call validation with skip tracking |
| 12 | Voice preview errors | ✅ Complete | Jan 23, 2025 | Proper error logging, timeout handling, error codes |
| 13 | Rate limit fallback | ✅ Complete | Jan 23, 2025 | In-memory fallback with degraded limits, MAX_STORE_SIZE |
| 14 | Input validation | ✅ Complete | Jan 23, 2025 | Zod schemas for all Retell functions |

---

## Phase 3 Features (Added Jan 23, 2025)

| # | Item | Status | Date | Notes |
|---|------|--------|------|-------|
| P3-1 | TypeScript schema fixes | ✅ Complete | Jan 23, 2025 | Fixed outbound/campaigns column names |
| P3-2 | Rate limiting for AI APIs | ✅ Complete | Jan 23, 2025 | Added aiGenerationLimiter, imageGenerationLimiter |
| P3-3 | Payout failure notifications | ✅ Complete | Jan 23, 2025 | sendPayoutFailedEmail added |
| P3-4 | URL centralization | ✅ Complete | Jan 23, 2025 | lib/config helpers, 20+ files updated |
| P3-5 | Demo agent setup | ✅ Complete | Jan 23, 2025 | Created via Retell API (EN + ES) |
| P3-6 | HIPAA table name fix | ✅ Complete | Jan 23, 2025 | phi_audit_log consistency |
| P3-7 | encryption_keys migration | ✅ Complete | Jan 23, 2025 | New migration created |
| P3-8 | Consent verification | ✅ Complete | Jan 23, 2025 | Added to outbound calls |
| P3-9 | Stripe webhook handlers | ✅ Complete | Jan 23, 2025 | All events handled |
| P3-10 | Outbound call outcomes | ✅ Complete | Jan 23, 2025 | recordOutboundCallOutcome added |
| P3-11 | Appointment payment updates | ✅ Complete | Jan 23, 2025 | Payment status on appointments |
| P3-12 | Console cleanup | ✅ Complete | Jan 23, 2025 | 0 console.* in production code |
| P3-13 | Dashboard UI - Campaigns | ✅ Complete | Jan 23, 2025 | List with stats, detail view, edit page |
| P3-14 | Dashboard UI - HIPAA | ✅ Complete | Jan 23, 2025 | /settings/hipaa with compliance toggle, audit log, BAA |
| P3-15 | Dashboard UI - Payments | ✅ Complete | Jan 23, 2025 | /settings/payments with Stripe Connect, revenue, history |
| P3-16 | Test suite | ✅ Complete | Jan 23, 2025 | 851 tests passing (was 0) |

---

## Notes

- Start each new chat session by reading this document
- Research implementation thoroughly before coding
- Test each fix in isolation before moving to next
- Update Progress Tracking section after each completion
- Commit changes after each successful fix

---

*Document created: January 18, 2025*
*Last updated: January 23, 2025 - Completed test suite (851 tests), Dashboard UIs, i18n, admin analytics, input validation*
