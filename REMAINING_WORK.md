# Koya Caller - Remaining Work Documentation

> **Last Updated:** January 18, 2025
> **Purpose:** Track all incomplete features, bugs, and technical debt
> **Usage:** Work through items 1-by-1 in new chat sessions, research implementation, test thoroughly

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

### 1. Notifications Disabled in Production

**File:** `app/api/twilio/status/route.ts` line 159

**Problem:** Missed call notifications are hardcoded as disabled with `return;`

**Current Code:**
```typescript
return; // Notifications disabled
```

**Impact:** Users will NOT receive alerts when calls are missed

**Fix Required:**
- Remove the early return
- Ensure notification logic is properly connected to email/SMS service
- Test with actual missed calls

**Related Files:**
- `lib/email/index.ts` - Email sending functions
- `lib/twilio/index.ts` - SMS sending functions
- `lib/inngest/functions/missed-call-alerts.ts` - Background job for alerts

---

### 2. Error Reporting Not Implemented

**File:** `app/error.tsx` line 21

**Problem:** No centralized error tracking for production issues

**Current Code:**
```typescript
// Error logged to error reporting service (implementation pending)
```

**Impact:** Production errors won't be tracked, debugging issues will be difficult

**Fix Required:**
- Choose error reporting service (Sentry recommended)
- Install SDK: `npm install @sentry/nextjs`
- Configure Sentry DSN in environment variables
- Wrap app with error boundary
- Add source maps for better stack traces

**Implementation Steps:**
1. Create Sentry account at https://sentry.io
2. Run `npx @sentry/wizard@latest -i nextjs`
3. Add `SENTRY_DSN` to `.env`
4. Update `app/error.tsx` to report errors
5. Test by throwing intentional error

---

### 3. TypeScript Suppressions (40+ instances)

**Problem:** Multiple `@ts-expect-error` and `@ts-ignore` comments suppressing type errors

**Files Affected:**
| File | Lines | Issue |
|------|-------|-------|
| `app/api/claude/process-queue/route.ts` | 261, 303, 329, 554 | Supabase type inference |
| `app/api/claude/generate-prompt/route.ts` | 288 | Supabase type inference |
| `app/api/retell/function/route.ts` | 705, 747, 785, 881, 1023 | Supabase type inference |
| `app/api/retell/agent/route.ts` | 124, 236, 355, 426 | Supabase type inference |
| `app/api/twilio/configure/route.ts` | 85, 149 | Supabase type inference |

**Root Cause:** Supabase generated types don't match actual database schema after migrations

**Fix Required:**
1. Regenerate Supabase types: `npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/supabase-generated.ts`
2. Or manually update `types/supabase.ts` to match current schema
3. Remove all `@ts-expect-error` comments
4. Run `npx tsc --noEmit` to verify

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

### 7. Calendar Integration - One Way Only

**Current State:**
- Koya can CREATE events in Google/Outlook calendars
- Koya CANNOT read existing events to check conflicts
- No sync FROM calendar TO Koya

**Files:**
- `lib/calendar/google.ts`
- `lib/calendar/outlook.ts`
- `app/api/calendar/google/callback/route.ts`
- `app/api/calendar/outlook/callback/route.ts`

**Missing Features:**
1. Read user's existing calendar events
2. Check for conflicts before booking
3. Sync cancelled appointments from calendar
4. Handle calendar event updates

**Implementation Steps:**
1. Request additional OAuth scopes (calendar.readonly)
2. Add `getEvents()` function to calendar clients
3. Check conflicts in `book_appointment` function
4. Add webhook/polling for calendar changes

---

### 8. Appointment Reminders Not Implemented

**Current State:**
- Database columns exist: `reminder_sent_1hr`, `reminder_sent_24hr` (migration 20250113000001)
- No active code sending reminders

**Files Needed:**
- `lib/inngest/functions/appointment-reminders.ts` (may exist but not scheduled)

**Implementation Steps:**
1. Create Inngest cron job running every 15 minutes
2. Query appointments where:
   - `scheduled_at` is within 24 hours AND `reminder_sent_24hr` is false
   - `scheduled_at` is within 1 hour AND `reminder_sent_1hr` is false
3. Send SMS/email reminder
4. Update reminder flags
5. Test with real appointments

**Cron Schedule:**
```typescript
{ cron: "*/15 * * * *" }  // Every 15 minutes
```

---

### 9. Spanish Retell Agent Not Created

**File:** `app/api/retell/agent/route.ts`

**Problem:** Code references `retell_agent_id_spanish` but never creates it

**Current Behavior:**
- English agent created with `createAgent()`
- Spanish greeting prepared but no separate Spanish agent
- Callers selecting Spanish may get English responses

**Fix Required:**
```typescript
// After creating English agent, create Spanish agent if enabled
if (spanishEnabled && greetingSpanish && systemPromptSpanish) {
  const spanishAgent = await createAgent({
    ...params,
    voiceId: voiceIdSpanish || voiceId,
    greeting: greetingSpanish,
    systemPrompt: systemPromptSpanish,
    language: "es",
  });

  // Store Spanish agent ID
  await supabase
    .from("ai_config")
    .update({ retell_agent_id_spanish: spanishAgent.agent_id })
    .eq("business_id", businessId);
}
```

**Testing:**
1. Enable Spanish in onboarding
2. Verify Spanish agent created in Retell dashboard
3. Make test call selecting Spanish
4. Verify Spanish responses

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

### 17. Console.log in Production Code

**Problem:** Debug logs may expose sensitive data

**Fix:** Search and replace all `console.log` with proper logging:
```bash
grep -rn "console.log" --include="*.ts" --include="*.tsx" | grep -v node_modules
```

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

# Error Reporting (after implementing)
SENTRY_DSN=
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
- [ ] Spanish language support (selector works, agent not created)
- [ ] Calendar sync (one-way only)
- [ ] Appointment reminders (schema only)
- [ ] Error reporting (pending)
- [ ] Advanced analytics (basic metrics only)

### Not Implemented
- [ ] Real-time call transcription UI
- [ ] Recording playback in dashboard
- [ ] Webhook retry logic
- [ ] Two-way calendar sync
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
| 1 | Enable notifications | ⬜ Not Started | | |
| 2 | Error reporting | ⬜ Not Started | | |
| 3 | TypeScript fixes | ⬜ Not Started | | |
| 4 | Mock mode handling | ⬜ Not Started | | |
| 5 | Spanish support | ⬜ Not Started | | |
| 6 | Stripe error handling | ⬜ Not Started | | |
| 7 | Calendar two-way sync | ⬜ Not Started | | |
| 8 | Appointment reminders | ⬜ Not Started | | |
| 9 | Spanish Retell agent | ⬜ Not Started | | |
| 10 | Admin analytics | ⬜ Not Started | | |
| 11 | Onboarding validation | ⬜ Not Started | | |
| 12 | Voice preview errors | ⬜ Not Started | | |
| 13 | Rate limit fallback | ⬜ Not Started | | |
| 14 | Input validation | ⬜ Not Started | | |

---

## Notes

- Start each new chat session by reading this document
- Research implementation thoroughly before coding
- Test each fix in isolation before moving to next
- Update Progress Tracking section after each completion
- Commit changes after each successful fix

---

*Document created: January 18, 2025*
*Last updated: January 18, 2025*
