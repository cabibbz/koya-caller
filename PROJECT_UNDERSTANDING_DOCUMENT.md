# PROJECT UNDERSTANDING DOCUMENT (PUD)
## Koya Caller - AI Phone Receptionist Platform

> **Document Version:** 1.1.0
> **Created:** 2026-01-20
> **Last Updated:** 2026-01-20
> **Agent:** Master Project-Understanding Agent
> **Status:** Git History Integrated
> **Repository:** https://github.com/cabibbz/koya-caller

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Component-Level Breakdown](#3-component-level-breakdown)
4. [Execution Model](#4-execution-model)
5. [Historical Evolution](#5-historical-evolution)
6. [Commit Intelligence Layer](#6-commit-intelligence-layer)
7. [Risk & Fragility Map](#7-risk--fragility-map)
8. [Implicit Rules & Tribal Knowledge](#8-implicit-rules--tribal-knowledge)
9. [Current State of Truth](#9-current-state-of-truth)
10. [Future Direction Signals](#10-future-direction-signals)

---

## 1. Project Overview

### What This Project Is

**Koya Caller** is an AI-powered phone receptionist SaaS platform designed for small businesses. It provides:

- **24/7 AI Voice Agent**: Natural conversational AI that answers phone calls using Retell.ai
- **Appointment Booking**: Automated scheduling integrated with Google Calendar and Outlook
- **Multi-Language Support**: English and Spanish language capabilities
- **Call Analytics**: Transcripts, recordings, sentiment detection, and outcome tracking
- **SMS Notifications**: Automated confirmations, reminders, and alerts via Twilio
- **Knowledge Base**: Trainable AI with business-specific information (FAQs, services, policies)
- **Subscription Billing**: Three-tier SaaS pricing ($99/$197/$397/month) via Stripe

**Target Market:** Small service businesses (salons, spas, dental offices, HVAC, plumbers, etc.) that need professional phone answering without hiring staff.

### What This Project Is NOT

- **NOT a general-purpose chatbot** - Specifically designed for phone call handling
- **NOT a call center solution** - Single-business focus, not multi-tenant call routing
- **NOT a CRM** - Limited customer data management, focused on call outcomes
- **NOT an IVR system** - Conversational AI, not menu-driven phone trees
- **NOT white-label ready** - Single-brand deployment (Koya)

### Intended Use Cases

1. **After-hours call handling** - AI answers when business is closed
2. **Overflow call handling** - AI answers when staff is busy
3. **Appointment booking** - Customers can schedule directly via phone
4. **FAQ answering** - AI trained on business-specific questions
5. **Message taking** - Captures caller info for callback
6. **Call screening** - Filters urgent vs routine calls

### Non-Goals

- Real-time human handoff during calls (transfer only, not blend)
- Outbound calling campaigns
- Multi-business phone tree routing
- Customer relationship management
- Payment processing during calls
- Complex workflow automation

---

## 2. High-Level Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              KOYA CALLER SYSTEM                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │   BROWSER   │    │   PHONE     │    │  CALENDAR   │    │   STRIPE    │ │
│  │   (React)   │    │  (Twilio)   │    │(Google/MSFT)│    │  (Payments) │ │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘ │
│         │                  │                  │                  │         │
│         ▼                  ▼                  ▼                  ▼         │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                     NEXT.JS 14 (App Router)                          │ │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │ │
│  │  │  Frontend  │  │ API Routes │  │ Middleware │  │  Webhooks  │     │ │
│  │  │  (React)   │  │  (96 APIs) │  │ (Auth/Sec) │  │(Retell/etc)│     │ │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘     │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│         │                  │                  │                  │         │
│         ▼                  ▼                  ▼                  ▼         │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                        INTEGRATION LAYER                              │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │ │
│  │  │ Retell   │  │ Claude   │  │ Twilio   │  │ Stripe   │  │ Resend │ │ │
│  │  │ (Voice)  │  │ (Prompts)│  │ (SMS)    │  │ (Pay)    │  │ (Email)│ │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └────────┘ │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│         │                                                                  │
│         ▼                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                    DATA & BACKGROUND LAYER                            │ │
│  │  ┌──────────────────────┐        ┌──────────────────────┐            │ │
│  │  │      SUPABASE        │        │       INNGEST        │            │ │
│  │  │  (PostgreSQL + Auth) │        │  (Background Jobs)   │            │ │
│  │  │  - RLS Policies      │        │  - Reminders         │            │ │
│  │  │  - 26 Tables         │        │  - Calendar Sync     │            │ │
│  │  │  - JWT Auth          │        │  - Usage Alerts      │            │ │
│  │  └──────────────────────┘        └──────────────────────┘            │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Major Subsystems

| Subsystem | Purpose | Key Technologies |
|-----------|---------|------------------|
| **Frontend** | Dashboard, onboarding, marketing | Next.js 14, React 18, Tailwind CSS |
| **API Layer** | Business logic, integrations | Next.js API Routes, Zod validation |
| **Voice AI** | Phone conversations | Retell.ai (WebRTC + PSTN) |
| **LLM Processing** | Prompt generation, enhancement | Anthropic Claude (claude-sonnet-4-5-20250929) |
| **Telephony** | SMS, phone provisioning | Twilio |
| **Payments** | Subscriptions, billing | Stripe |
| **Calendar** | Appointment sync | Google Calendar, Microsoft Graph |
| **Database** | Persistence, auth | Supabase (PostgreSQL) |
| **Background Jobs** | Async processing | Inngest |
| **Email** | Notifications | Resend |
| **Observability** | Error tracking | Sentry |

### Data Flow

```
INBOUND CALL FLOW:
Phone → Twilio → Retell.ai → AI Agent ↔ Custom Functions (booking/transfer)
                    ↓
              Webhook → Next.js API → Supabase (call record)
                    ↓
              Inngest → SMS/Email notifications

DASHBOARD FLOW:
Browser → Next.js → API Routes → Supabase (with RLS)
                ↓
          React Query (caching) → UI Components
```

### Control Flow

1. **Authentication**: Supabase Auth → JWT → Middleware validation → RLS policies
2. **API Requests**: Request → Rate limit check → Auth check → Validation → Handler → Response
3. **Webhooks**: Provider → Signature verification → Event processing → Database update → Side effects

### Trust Boundaries

| Boundary | Trust Level | Protection |
|----------|-------------|------------|
| Browser ↔ Server | Untrusted | JWT auth, CSRF, input validation |
| Webhooks ↔ Server | Verified | HMAC signature verification |
| Server ↔ Supabase | Trusted | Service role key, RLS |
| Server ↔ External APIs | Trusted | API keys in env vars |

### Privilege Boundaries

- **Anonymous**: Marketing pages, demo calls only
- **Authenticated User**: Own business data only (tenant isolation)
- **Admin**: All data, system configuration, audit logs
- **Service Role**: Full database access (server-side only)

---

## 3. Component-Level Breakdown

### 3.1 Frontend Application (`app/`)

#### Route Groups

| Group | Purpose | Key Pages |
|-------|---------|-----------|
| `(marketing)/` | Public pages | Landing, pricing, blog, about |
| `(auth)/` | Authentication | Login, signup, password reset |
| `(onboarding)/` | New user setup | 9-step wizard |
| `(dashboard)/` | Main app | Calls, appointments, settings, stats |
| `(admin)/` | Admin panel | Customers, analytics, content |
| `api/` | API endpoints | 96 routes across 16 modules |

#### Key Data Structures

- **Business Context**: Loaded via React Query, cached client-side
- **Form State**: React Hook Form with Zod validation
- **Toast Notifications**: Custom hook with queue management
- **Drag & Drop**: @dnd-kit for sortable lists (services, FAQs)

#### Invariants

- All dashboard routes require authentication
- Business data scoped to `tenant_id` from JWT
- Forms validate before submission
- API errors display via toast notifications

#### Failure Modes

- Network failure → Cached data shown, retry prompts
- Auth expiry → Redirect to login with return URL
- Validation error → Inline field errors
- Server error → Toast notification with generic message

### 3.2 Voice AI System (`lib/retell/`)

#### Purpose

Core integration with Retell.ai for voice conversations.

**Files:**
- `index.ts` (930+ lines) - Main client, agent CRUD, call management
- `functions.ts` - Custom tools (book appointment, transfer call, etc.)
- `types.ts` - TypeScript interfaces for Retell SDK

#### Key Functions

| Function | Purpose | Mock Behavior |
|----------|---------|---------------|
| `createAgent()` | Create Retell agent with voice | Returns mock agent ID |
| `createRetellLLM()` | Create LLM with system prompt | Returns mock LLM ID |
| `createWebCall()` | Browser-based demo call | Returns mock call object |
| `registerPhoneCall()` | Register inbound PSTN call | Returns mock response |

#### Inputs/Outputs

**Agent Creation:**
- Input: Business data, AI config, system prompt
- Output: `{ agent_id, llm_id, voice_id, language }`

**Webhook Events:**
- Input: Call events (started, ended, analyzed)
- Output: Database updates, SMS triggers

#### Invariants

- One English agent + optional Spanish agent per business
- System prompt regenerated on knowledge base changes
- Voice ID must be valid Retell voice
- Webhook signatures must be verified

#### Failure Modes

- No API key → Mock mode (voice calls don't work)
- Invalid voice ID → Falls back to default voice
- Webhook timeout → Event lost, no retry
- LLM creation fails → Agent creation fails

### 3.3 Prompt Generation (`lib/claude/`)

#### Purpose

Generate and enhance AI system prompts using Claude.

**Files:**
- `index.ts` - Main prompt generation logic
- `caller-context.ts` - Repeat caller recognition
- `industry-enhancements.ts` - Industry-specific improvements

#### Key Features

- **Industry Templates**: Pre-built prompts for salons, HVAC, dental, etc.
- **Few-Shot Examples**: Example conversations for better responses
- **Sentiment Detection**: Detect caller frustration/satisfaction
- **Caller Context**: Recognize returning callers, VIP treatment
- **Upsell Logic**: Cross-sell services during calls

#### Failure Modes

- No API key → Generic mock prompts
- Claude API error → Uses cached/default prompt
- Token limit exceeded → Prompt truncation

### 3.4 Database Layer (`lib/db/`)

#### Purpose

Database operations with proper typing and error handling.

**Key Patterns:**
- Service role client for admin operations
- User client for tenant-scoped operations
- Atomic increments for usage tracking
- Soft deletes where applicable

#### Core Tables (26 total)

| Table | Purpose | RLS |
|-------|---------|-----|
| `businesses` | Business profiles, subscriptions | Yes |
| `calls` | Call records, transcripts | Yes |
| `appointments` | Scheduled appointments | Yes |
| `services` | Bookable services | Yes |
| `faqs` | FAQ entries | Yes |
| `knowledge` | Business knowledge base | Yes |
| `ai_config` | Voice/personality settings | Yes |
| `call_settings` | Call routing rules | Yes |
| `notification_settings` | Alert preferences | Yes |
| `calendar_integrations` | OAuth tokens | Yes |
| `phone_numbers` | Twilio numbers | Yes |

### 3.5 Background Jobs (`lib/inngest/`)

#### Purpose

Async task processing for operations that shouldn't block requests.

**Functions (8 total):**

| Function | Trigger | Purpose |
|----------|---------|---------|
| `checkAppointmentReminders` | Cron (15min) | Send upcoming reminders |
| `sendAppointmentReminderEvent` | Event | Individual reminder |
| `syncExternalCalendars` | Cron (15min) | Two-way calendar sync |
| `processPromptRegeneration` | Event | Regenerate AI prompts |
| `sendMissedCallAlerts` | Event | SMS/email for missed calls |
| `sendUsageAlerts` | Event | Minute usage warnings |
| `sendWeeklyReports` | Cron (weekly) | Usage summaries |
| `publishScheduledBlogPost` | Cron (hourly) | Auto-publish blogs |

### 3.6 Authentication (`lib/auth/`)

#### Purpose

Supabase-based authentication with tenant isolation.

**Key Mechanisms:**
- Email/password authentication
- JWT tokens with `tenant_id` in `app_metadata`
- Middleware session refresh
- Row-Level Security (RLS) policies

#### Invariants

- `tenant_id` immutable after signup
- RLS enforced on all user-facing queries
- Admin routes require explicit role check
- Sessions refresh automatically

### 3.7 API Middleware (`lib/api/`)

#### Purpose

Standardized request handling across all API routes.

**Features:**
- Rate limiting (Upstash Redis)
- Input validation (Zod schemas)
- Error formatting
- Response helpers
- CORS headers

---

## 4. Execution Model

### Startup Flow

```
1. Next.js server starts
2. Environment variables validated (lib/config)
3. Supabase clients initialized
4. Inngest functions registered
5. Middleware configured
6. Routes available
```

### Runtime Lifecycle

**Request Processing:**
```
Request → middleware.ts
  → Auth check (JWT validation)
  → Security headers applied
  → Route matched
  → API handler executed
  → Response returned
```

**Background Job Processing:**
```
Event triggered → Inngest receives
  → Function matched
  → Execution with retries
  → Side effects (DB, SMS, email)
  → Completion logged
```

### Shutdown Behavior

- Vercel: Graceful shutdown with request draining
- Local: Immediate termination (dev mode)
- Background jobs: Complete current step, retry later

### Threading/Async Model

- **Next.js**: Single-threaded per request (Node.js event loop)
- **API Routes**: Async handlers with Promise-based operations
- **React**: Client-side event loop, React Query for async state
- **Inngest**: Separate execution environment, parallel job processing

### State Transitions

**Business Lifecycle:**
```
Created → Onboarding → Active → [Paused] → [Cancelled]
                ↓
         Step 1..9 completion
```

**Call Lifecycle:**
```
Initiated → In Progress → Ended → Analyzed
     ↓           ↓           ↓
   Missed   Transferred   [Booked/Info/Message]
```

**Appointment Lifecycle:**
```
Created → Confirmed → [Reminder Sent] → Completed
              ↓                              ↓
         Cancelled                      No Show
```

---

## 5. Historical Evolution

### Project Timeline (Inferred from Migrations)

| Date | Major Changes |
|------|---------------|
| Dec 19, 2024 | Initial core tables, business templates |
| Dec 20-22, 2024 | Phone columns, extended tables |
| Dec 27, 2024 | Admin functions, demo leads |
| Dec 29, 2024 | Site settings, multi-location prep, blog system |
| Jan 9, 2025 | Calls and settings fixes |
| Jan 10, 2025 | Enhanced prompt system (sentiment, few-shot, caller context) |
| Jan 11-12, 2025 | Upsells, bundles, packages, memberships |
| Jan 13, 2025 | Appointment reminders, atomic increments |
| Jan 14, 2025 | Retell advanced features, responsiveness settings |
| Jan 15, 2025 | Voice controls (temperature, speed, volume) |
| Jan 16, 2025 | Cleanup duplicate volume column |
| Jan 18, 2025 | Email missed call notifications |
| Jan 19, 2025 | Reminder "both" option, SMS templates |

### Architectural Shifts

1. **Prompt System Evolution**: Started with simple prompts → Enhanced with industry templates, few-shot examples, sentiment detection, caller context
2. **Upselling Addition**: Basic booking → Added upsells, bundles, packages, memberships for revenue optimization
3. **Notification Expansion**: SMS only → Added email notifications, customizable templates
4. **Calendar Enhancement**: One-way sync → Two-way sync with conflict detection

### Why Earlier Approaches Were Replaced

- **TypeScript suppressions** → Replaced with proper type assertions after SDK type issues identified
- **Single notification channel** → Expanded to multi-channel (SMS + email) based on user feedback
- **Fixed prompts** → Dynamic generation needed for personalization

### Legacy vs Actively Evolving

| Area | Status |
|------|--------|
| Core voice integration | Stable, actively maintained |
| Prompt generation | Actively evolving |
| Upselling features | Recently added, evolving |
| Calendar integration | Recently enhanced |
| Admin panel | Functional but basic |
| Blog system | Partially implemented |
| Multi-location | Prepared but not active |

---

## 6. Commit Intelligence Layer

### Git Repository Statistics

| Metric | Value |
|--------|-------|
| **Repository** | github.com/cabibbz/koya-caller |
| **Total Commits** | 71 on master branch |
| **Development Period** | January 10-20, 2026 (10 days) |
| **Contributors** | 2 (cabibbz/michaelc1208, Claude Opus 4.5) |
| **Current Commit** | c9d74b5e36c6e4963b551c1b0a11ee1ebfb8dbe6 |
| **Language** | TypeScript 88.8%, PLpgSQL 5.6%, JavaScript 5.3% |

### Commit Timeline & Major Features

#### Jan 20, 2026 (Latest)
- **Dashboard Redesign**: Modern Bento grid layout with animated counters
- **Stats Page**: New `/stats` route with data-dense analytics view
- **Recharts Integration**: Enhanced data visualization

#### Jan 18-19, 2026 (Critical Infrastructure)
- **Sentry Integration**: Centralized error tracking (client/server/edge)
- **Performance Optimization**: Dashboard load time reduced from ~15+ seconds to ~2-3 seconds (parallelized DB queries)
- **Spanish Support**: Full i18n with next-intl, dedicated Spanish Retell agent
- **Settings Sync Fix**: Settings now sync to Retell immediately instead of queueing

#### Jan 15-17, 2026 (Feature Sprint)
- SMS template customization with variable substitution
- Voice controls (temperature, speed, volume, delay)
- Two-way calendar sync with external calendars
- Appointment reminders (SMS + email options)
- Custom transfer schedules with day-by-day editor
- Recording proxy for CORS audio playback

#### Jan 15-16, 2026 (Security & Quality)
- **SQL Injection Fix**: Fixed vulnerability in admin search
- **Console Cleanup**: Removed 109+ console.log statements
- **ESLint Fixes**: Resolved 127 warnings across 59 files
- **Rate Limiting**: Added to expensive API endpoints

#### Jan 10-14, 2026 (Foundation)
- Initial project setup
- Core tables and migrations
- Retell.ai integration
- Basic dashboard and onboarding

### Development Velocity

- **71 commits in 10 days** = ~7 commits/day average
- **Rapid iteration**: Multiple features per day
- **AI-assisted development**: Claude Opus 4.5 co-authored commits

### Design Philosophy (Proven by Commits)

1. **Feature Flags Over Conditionals**: Config-driven feature enablement
2. **Graceful Degradation**: Mock modes when services unavailable
3. **Type Safety**: Strong TypeScript with Zod validation
4. **Tenant Isolation**: RLS-enforced data separation
5. **Async by Default**: Background jobs for non-critical operations

### "If This Code Looks Weird, Here's Why"

| Pattern | Reason |
|---------|--------|
| `(supabase.from() as any)` | Supabase SDK type inference limitations |
| Mock agent IDs (`agent_mock_...`) | Development without Retell API key |
| Duplicate reminder column names | Migration naming inconsistency (fixed) |
| Spanish agent separate from main | Retell language limitations per agent |
| Voice fallback arrays | Retell voice availability varies |

---

## 7. Risk & Fragility Map

### Most Brittle Areas

| Area | Risk | Mitigation |
|------|------|------------|
| Retell webhook handling | Single point of call data capture | Add retry logic (TODO) |
| Prompt regeneration | Can break AI responses | Queue-based with rollback |
| Calendar OAuth tokens | Token expiry breaks sync | Background refresh job |
| Stripe webhook | Payment sync failures | Error logging (recently added) |

### Most Dangerous Assumptions

1. **Retell webhooks always arrive** - No dead letter queue
2. **Calendar tokens refresh automatically** - Inngest job handles this
3. **SMS always delivers** - No delivery tracking beyond Twilio status
4. **Users complete onboarding** - Skip button exists, no enforcement

### Areas Likely to Break on Refactor

- `types/index.ts` - 700+ lines, many dependencies
- `lib/retell/index.ts` - 930+ lines, complex state
- `app/api/retell/function/route.ts` - Multiple function handlers
- Migration order - Must run in sequence

### Security-Sensitive Zones

| Zone | Sensitivity | Protection |
|------|-------------|------------|
| `lib/auth/` | High | JWT validation, RLS |
| `app/api/*/webhook/` | High | HMAC verification |
| `lib/supabase/middleware.ts` | High | Session management |
| `lib/db/` | Medium | Service role access |
| Calendar OAuth tokens | High | Encrypted storage |

### Performance Hotspots

- **Prompt generation** - Claude API calls (seconds)
- **Calendar sync** - OAuth + API calls (seconds)
- **Dashboard stats** - Aggregate queries (optimize with indexes)
- **Call transcript parsing** - Large JSON processing

---

## 8. Implicit Rules & Tribal Knowledge

### Rules NOT Documented But Enforced By Code

1. **One business per user** - `user_id` unique in `businesses`
2. **Tenant ID immutable** - Set once in `app_metadata`, never changed
3. **Agent regeneration triggers** - Any knowledge base change queues prompt regen
4. **Spanish requires separate agent** - Retell limitation, not business choice
5. **Reminders check every 15 minutes** - Fixed cron, not configurable

### "Do Not Touch Unless You Understand X"

| File | Understanding Required |
|------|------------------------|
| `middleware.ts` | Auth flow, route protection logic |
| `lib/retell/functions.ts` | Retell function API, response format |
| `supabase/full_schema.sql` | Complete schema, constraints, RLS |
| `lib/claude/index.ts` | Prompt structure, token limits |

### Ordering Dependencies

1. **Migrations**: Must run in timestamp order
2. **Agent creation**: LLM first, then agent
3. **Onboarding**: Steps 1-8 before phone provisioning
4. **Calendar sync**: OAuth complete before sync starts

### Hidden Coupling

- `AIConfig.retell_agent_id` ↔ Retell API state
- `CalendarIntegration.access_token` ↔ OAuth provider state
- `Business.stripe_subscription_id` ↔ Stripe subscription state
- `PhoneNumber.twilio_sid` ↔ Twilio phone resource

---

## 9. Current State of Truth

### What Is Authoritative Now

| Domain | Source of Truth |
|--------|-----------------|
| Business data | Supabase `businesses` table |
| Call records | Supabase `calls` table |
| AI configuration | Supabase `ai_config` + Retell agent |
| Subscriptions | Stripe + Supabase sync |
| Phone numbers | Twilio + Supabase sync |
| Calendar events | External calendar + Supabase appointments |

### What Is Deprecated But Still Present

| Item | Status | Notes |
|------|--------|-------|
| `multi_location` tables | Prepared but unused | Schema exists, no UI |
| `blog_clusters` | Partially implemented | Schema exists, limited use |
| Some TypeScript `any` types | Intentional | SDK compatibility |

### What Is Half-Migrated or Transitional

| Feature | Current State |
|---------|---------------|
| Spanish support | Agent works, UI not translated |
| Real-time transcription | Data captured, no live display |
| Recording playback | URLs stored, no player UI |
| Webhook retries | Logging added, no retry queue |
| Admin analytics | Basic metrics, no advanced |

---

## 10. Future Direction Signals

### Hints from Code Structure

1. **Multi-location support**: Schema exists (`business_locations` table), awaiting UI
2. **Advanced analytics**: Admin routes exist, metrics incomplete
3. **Webhook resilience**: Error logging added, retry logic next
4. **Recording playback**: URLs captured, player component needed
5. **Full i18n**: next-intl configured, translations incomplete

### TODOs That Actually Matter

From `REMAINING_WORK.md`:

| Priority | Item | Impact |
|----------|------|--------|
| High | Mock mode indicators | User confusion prevention |
| High | Input validation in Retell functions | Data integrity |
| Medium | Admin analytics expansion | Business insights |
| Medium | Onboarding skip prevention | Quality assurance |
| Medium | Rate limit fallback | Resilience |
| Low | Voice preview error handling | UX improvement |
| Low | Webhook retry logic | Data reliability |

### Patterns Suggesting Upcoming Work

1. **Inngest expansion**: More background jobs likely (webhook retries, analytics)
2. **UI polish**: Dashboard components need mobile optimization
3. **Testing expansion**: Only 4 test files, more coverage needed
4. **Documentation**: Internal docs sparse, API docs needed

---

## Appendix A: File Statistics

```
Total Files: 469
TypeScript/TSX: 341 files
Total Lines of Code: ~86,411
API Routes: 96
Components: 97
Database Migrations: 26
Inngest Functions: 8
Test Files: 4
```

## Appendix B: Key File Locations

| Purpose | Location |
|---------|----------|
| Main types | `types/index.ts` |
| Supabase types | `types/supabase.ts` |
| Config | `lib/config/index.ts` |
| Auth actions | `lib/auth/actions.ts` |
| Retell integration | `lib/retell/index.ts` |
| Claude prompts | `lib/claude/index.ts` |
| Database helpers | `lib/db/` |
| Inngest functions | `lib/inngest/functions/` |
| Full schema | `supabase/full_schema.sql` |
| Remaining work | `REMAINING_WORK.md` |

## Appendix C: Environment Variables

### Required
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
RETELL_API_KEY
ANTHROPIC_API_KEY
STRIPE_SECRET_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
```

### Optional (Feature-Dependent)
```
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
RESEND_API_KEY
INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY
SENTRY_DSN, SENTRY_AUTH_TOKEN
UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
```

---

## Document Maintenance

This document should be updated when:
- Major features are added
- Architecture changes occur
- New integrations are added
- Critical bugs are discovered
- Performance issues are identified
- Security vulnerabilities are found

**Update Protocol:**
1. Load this document at session start
2. Verify against current codebase
3. Amend sections as needed
4. Never delete historical information (mark as obsolete)
5. Version changes in header

---

*Generated by Master Project-Understanding Agent*
*This document is the canonical source of truth for the Koya Caller project.*
