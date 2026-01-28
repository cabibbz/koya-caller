# Koya Caller - Comprehensive Changes Documentation

**Date:** January 12, 2026
**Session:** Knowledge Sync Fix & Prompt Customization

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Root Cause Analysis](#root-cause-analysis)
3. [Code Changes](#code-changes)
4. [Database Column Fixes](#database-column-fixes)
5. [Retell API Endpoint Corrections](#retell-api-endpoint-corrections)
6. [New Features Added](#new-features-added)
7. [Full SQL Data Snapshot](#full-sql-data-snapshot)

---

## Executive Summary

This document covers all changes made to fix the knowledge sync flow between the Koya dashboard and Retell AI voice agents. The primary issues were:

1. **Inngest not configured** - Background job system had keys commented out, causing silent failures
2. **Wrong database column names** - Code referenced columns that didn't exist in the schema
3. **Wrong Retell API endpoints** - Using `/v2/` endpoints instead of correct `/get-agent/` and `/update-retell-llm/`
4. **Slow saves** - Synchronous Claude API calls blocking the UI
5. **FAQs not answered verbatim** - Claude was summarizing instead of including exact Q&A pairs

---

## Root Cause Analysis

### Primary Issue: Silent Inngest Failures

The `inngest.send()` function was being called to trigger prompt regeneration, but:
- `INNGEST_EVENT_KEY` was not set in `.env.local`
- The fallback mechanism existed but was awaiting the response, causing slow saves
- No error logging was visible to indicate failures

### Flow Before Fix:
```
Dashboard Save → inngest.send() → [SILENT FAILURE] → Nothing syncs
```

### Flow After Fix:
```
Dashboard Save → inngest.send() → Fallback triggers → process-queue API → Claude generates → Supabase saves → Retell syncs
```

---

## Code Changes

### 1. `lib/inngest/client.ts` - Fire-and-Forget Pattern

**Purpose:** Make saves instant by not awaiting regeneration

**Before:**
```typescript
// Was awaiting the fetch, causing slow saves
const response = await fetch(`${baseUrl}/api/claude/process-queue`, {...});
const result = await response.json();
```

**After:**
```typescript
// Fire-and-forget: Don't await, let it run in background
fetch(`${baseUrl}/api/claude/process-queue`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-internal-call": "true",
  },
  body: JSON.stringify({ businessId, triggeredBy }),
})
  .then(async (response) => {
    if (!response.ok) {
      console.error(`[Inngest Fallback] Process queue returned ${response.status}`);
    } else {
      const result = await response.json();
      if (result.success) {
        console.log(`[Inngest Fallback] Prompt regeneration completed successfully`);
      } else {
        console.error(`[Inngest Fallback] Regeneration failed:`, result.errors);
      }
    }
  })
  .catch((error) => {
    console.error("[Inngest Fallback] Direct processing failed:", error);
  });

// Return immediately - don't wait for regeneration
```

---

### 2. `app/api/claude/process-queue/route.ts` - Direct Business Processing

**Purpose:** Enable fallback mode when Inngest is not configured

**Key Addition - Direct Processing Mode:**
```typescript
// Check for direct business processing (fallback mode)
const directBusinessId = body.businessId;

if (directBusinessId) {
  console.log(`[Process Queue] Direct processing for business ${directBusinessId}`);
  const result = await processBusinessDirectly(supabase, directBusinessId, body.triggeredBy || "direct");
  return NextResponse.json({
    success: result.success,
    processed: result.success ? 1 : 0,
    errors: result.errors,
  });
}
```

**New Function Added:**
```typescript
async function processBusinessDirectly(
  supabase: SupabaseClient,
  businessId: string,
  triggeredBy: string
): Promise<{ success: boolean; errors?: string[] }> {
  // Full implementation that:
  // 1. Fetches business data with correct column names
  // 2. Calls Claude to generate prompts
  // 3. Saves to database
  // 4. Syncs to Retell
}
```

---

### 3. `lib/claude/meta-prompt.ts` - Verbatim FAQ Inclusion

**Purpose:** Ensure FAQs are included word-for-word in generated prompts

**Change in PROMPT_STRUCTURE:**
```typescript
5. # Frequently Asked Questions
   IMPORTANT: Include ALL FAQs from the additional_context VERBATIM in Q&A format.
   The AI should use these exact answers when callers ask these questions.
   Format each as:
   Q: [exact question]
   A: [exact answer]
```

**Token Limit Increase:**
```typescript
// Before
max_tokens: 1500

// After
max_tokens: 2500
```

---

### 4. `app/api/dashboard/prompt/route.ts` - NEW FILE

**Purpose:** Raw prompt editing API for full customization

**Endpoints:**

| Method | Purpose |
|--------|---------|
| GET | Read current prompt + all context (FAQs, services, knowledge) |
| PUT | Direct raw edit with optional Retell sync |
| POST | Regenerate prompt with options (sync, waitForResult) |

**GET Response Structure:**
```typescript
{
  prompt: string | null,
  promptSpanish: string | null,
  version: number,
  generatedAt: string | null,
  syncedAt: string | null,
  aiName: string,
  personality: string,
  greeting: string | null,
  retellAgentId: string | null,
  // Context data
  faqs: Array<{ question: string, answer: string }>,
  services: Array<{ name: string, description: string }>,
  knowledge: string | null,
  neverSay: string | null,
}
```

**PUT Request Body:**
```typescript
{
  prompt: string,           // Required
  promptSpanish?: string,   // Optional
  syncToRetell?: boolean,   // Optional - sync to Retell after save
}
```

**POST Request Body:**
```typescript
{
  syncToRetell?: boolean,   // Default: true
  waitForResult?: boolean,  // Default: false (async regeneration)
}
```

---

### 5. `app/api/inngest/route.ts` - TypeScript Fix

**Purpose:** Fix TypeScript error with Inngest wrapper

**Before:**
```typescript
export const { GET, POST, PUT } = serve({
  client: inngest,  // Wrapper doesn't satisfy full Inngest type
  functions,
});
```

**After:**
```typescript
export const { GET, POST, PUT } = serve({
  client: inngest._base,  // Use base client, not wrapper
  functions,
});
```

---

### 6. `lib/config/index.ts` - Retell URL Fix

**Before:**
```typescript
retell: {
  api: "https://api.retellai.com/v2",
}
```

**After:**
```typescript
retell: {
  api: "https://api.retellai.com",
}
```

---

## Database Column Fixes

The code was referencing columns that didn't match the actual Supabase schema.

### Businesses Table

| Code Used | Actual Column |
|-----------|---------------|
| `type` | `business_type` |
| `minutes_used` | `minutes_used_this_cycle` |
| `minutes_limit` | `minutes_included` |

### Knowledge Table

| Code Used | Actual Column |
|-----------|---------------|
| `additional_info` | `content` |

### Services Table

| Code Used | Actual Column |
|-----------|---------------|
| `price` | `price_cents` |
| `display_order` | `sort_order` |

### FAQs Table

| Issue | Fix |
|-------|-----|
| Filtering by `active = true` | Removed - column doesn't exist |

### Full Select Query Fix (process-queue):

**Before:**
```sql
SELECT
  id, name, type, phone, timezone,
  minutes_used, minutes_limit
FROM businesses
```

**After:**
```sql
SELECT
  id, name, business_type, phone, timezone,
  minutes_used_this_cycle, minutes_included
FROM businesses
```

---

## Retell API Endpoint Corrections

The code was using incorrect API endpoints for Retell AI.

### Agent Fetch

| Before | After |
|--------|-------|
| `GET /v2/agent/{id}` | `GET /get-agent/{id}` |

### LLM Update

| Before | After |
|--------|-------|
| `PATCH /v2/llm/{id}` | `PATCH /update-retell-llm/{id}` |

### Response Structure Change

**Before:**
```typescript
const llmId = agentData.llm_id;
```

**After:**
```typescript
const llmId = agentData.response_engine?.llm_id;
```

### Files Updated with Retell Fixes:
- `app/api/claude/process-queue/route.ts`
- `app/api/dashboard/prompt/route.ts`
- `lib/inngest/functions/prompt-regeneration.ts`
- `scripts/regenerate-and-sync.ts`
- `lib/config/index.ts`

---

## New Features Added

### 1. Instant Saves with Background Regeneration

- Dashboard saves now return immediately
- Prompt regeneration happens in background
- User sees instant feedback, sync happens async

### 2. Raw Prompt Editing API

New endpoint at `/api/dashboard/prompt` allows:
- Reading current generated prompt
- Direct editing of raw prompt text
- Manual regeneration with options
- Optional sync to Retell on save

### 3. Verbatim FAQ Inclusion

FAQs are now included exactly as entered:
```
Q: What is the price for this service?
A: The exact answer you typed in the dashboard
```

Instead of being summarized by Claude.

---

## Full SQL Data Snapshot

### Business Record

```sql
-- Table: businesses
-- ID: 8d79b6db-3ac6-4c79-b48d-2bac2049e1a7

{
  "id": "8d79b6db-3ac6-4c79-b48d-2bac2049e1a7",
  "user_id": "b5a83cd4-a353-4c71-ac5a-9f0cc38474eb",
  "name": "Workshop",
  "business_type": "Other",
  "phone": "+18054098582",
  "address": null,
  "city": null,
  "state": null,
  "zip": null,
  "website": "www.workshop.com",
  "description": "We sell Rocket League bot plugins for the game.",
  "timezone": "America/Los_Angeles",
  "minutes_used_this_cycle": 0,
  "minutes_included": 100,
  "billing_cycle_start": "2025-06-09T06:44:26.916655+00:00",
  "created_at": "2025-06-09T06:44:26.916655+00:00",
  "updated_at": "2026-01-12T08:04:57.765893+00:00"
}
```

### AI Configuration

```sql
-- Table: ai_config
-- Business ID: 8d79b6db-3ac6-4c79-b48d-2bac2049e1a7

{
  "id": "74eb8f61-e925-4af2-87e5-2d9f1cb02e0b",
  "business_id": "8d79b6db-3ac6-4c79-b48d-2bac2049e1a7",
  "ai_name": "Koya",
  "personality": "friendly",
  "greeting": null,
  "system_prompt": "[Generated prompt - version 8]",
  "system_prompt_spanish": null,
  "system_prompt_version": 8,
  "system_prompt_generated_at": "2026-01-12T08:05:08.413Z",
  "retell_agent_id": "agent_a42afc929376c54d66c010c58a",
  "retell_synced_at": "2026-01-12T08:05:17.949Z",
  "voice_id": "11labs-Myra",
  "language": "en-US",
  "created_at": "2025-06-09T06:44:26.916655+00:00",
  "updated_at": "2026-01-12T08:05:17.949254+00:00"
}
```

### Services (4 records)

```sql
-- Table: services
-- Business ID: 8d79b6db-3ac6-4c79-b48d-2bac2049e1a7

[
  {
    "id": "5d3f5ed6-dc89-4f79-b0a2-fc3ea94cfe1d",
    "business_id": "8d79b6db-3ac6-4c79-b48d-2bac2049e1a7",
    "name": "Nexto",
    "description": "Nexto is the best 1v1 bot in the game.",
    "duration_minutes": 60,
    "price_cents": 0,
    "sort_order": 0,
    "created_at": "2025-06-09T07:10:47.30093+00:00",
    "updated_at": "2025-06-09T07:10:47.30093+00:00"
  },
  {
    "id": "7023c74f-c7b7-480b-8b89-1e39d2bec970",
    "business_id": "8d79b6db-3ac6-4c79-b48d-2bac2049e1a7",
    "name": "Necto",
    "description": "Necto is the best 2v2/3v3 bot",
    "duration_minutes": 60,
    "price_cents": 0,
    "sort_order": 1,
    "created_at": "2025-06-09T07:10:47.30093+00:00",
    "updated_at": "2025-06-09T07:10:47.30093+00:00"
  },
  {
    "id": "35e16da7-bfe6-47a5-866e-eef6db42d2ff",
    "business_id": "8d79b6db-3ac6-4c79-b48d-2bac2049e1a7",
    "name": "Seer",
    "description": "Seer is the best defensive bot",
    "duration_minutes": 60,
    "price_cents": 0,
    "sort_order": 2,
    "created_at": "2025-06-09T07:10:47.30093+00:00",
    "updated_at": "2025-06-09T07:10:47.30093+00:00"
  },
  {
    "id": "b77e5741-b27a-4475-a3e7-7a8a5ca208f9",
    "business_id": "8d79b6db-3ac6-4c79-b48d-2bac2049e1a7",
    "name": "Element",
    "description": "The best offense bot",
    "duration_minutes": 60,
    "price_cents": 0,
    "sort_order": 3,
    "created_at": "2025-06-09T07:10:47.30093+00:00",
    "updated_at": "2025-06-09T07:10:47.30093+00:00"
  }
]
```

### FAQs (4 records)

```sql
-- Table: faqs
-- Business ID: 8d79b6db-3ac6-4c79-b48d-2bac2049e1a7

[
  {
    "id": "0a30d987-e22e-4dcf-be31-6f8a00b59fe9",
    "business_id": "8d79b6db-3ac6-4c79-b48d-2bac2049e1a7",
    "question": "How do I install the bots?",
    "answer": "You can install the bots by downloading the RLBot framework and placing the bot files in the bots folder.",
    "sort_order": 0,
    "created_at": "2025-06-09T07:11:27.588916+00:00",
    "updated_at": "2025-06-09T07:11:27.588916+00:00"
  },
  {
    "id": "8e31fa96-71a7-43a7-b355-5dfd2e45d0f0",
    "business_id": "8d79b6db-3ac6-4c79-b48d-2bac2049e1a7",
    "question": "Are the bots free?",
    "answer": "Yes, all our bots are completely free to use.",
    "sort_order": 1,
    "created_at": "2025-06-09T07:11:27.588916+00:00",
    "updated_at": "2025-06-09T07:11:27.588916+00:00"
  },
  {
    "id": "c1c7b93d-b2c7-4f97-bb84-74d5ecbdb0bc",
    "business_id": "8d79b6db-3ac6-4c79-b48d-2bac2049e1a7",
    "question": "what is the test?",
    "answer": "the test is this",
    "sort_order": 2,
    "created_at": "2026-01-12T07:52:06.649166+00:00",
    "updated_at": "2026-01-12T07:52:06.649166+00:00"
  },
  {
    "id": "a9fc2455-9b9b-437f-808b-01f06d7f500b",
    "business_id": "8d79b6db-3ac6-4c79-b48d-2bac2049e1a7",
    "question": "What is a good question?",
    "answer": "A good question is this",
    "sort_order": 3,
    "created_at": "2026-01-12T08:04:34.091567+00:00",
    "updated_at": "2026-01-12T08:04:34.091567+00:00"
  }
]
```

### Knowledge

```sql
-- Table: knowledge
-- Business ID: 8d79b6db-3ac6-4c79-b48d-2bac2049e1a7

{
  "id": "5c88ed97-edc5-4ed9-ab25-8fcaeb4d0f6d",
  "business_id": "8d79b6db-3ac6-4c79-b48d-2bac2049e1a7",
  "content": "We specialize in Rocket League AI bots. Our bots are designed to help players improve their skills by providing challenging AI opponents.",
  "never_say": null,
  "created_at": "2025-06-09T07:11:27.588916+00:00",
  "updated_at": "2025-06-09T07:11:27.588916+00:00"
}
```

### Business Hours (7 days - 24/7)

```sql
-- Table: business_hours
-- Business ID: 8d79b6db-3ac6-4c79-b48d-2bac2049e1a7

[
  {"day_of_week": 0, "open_time": "00:00", "close_time": "23:59", "is_closed": false},
  {"day_of_week": 1, "open_time": "00:00", "close_time": "23:59", "is_closed": false},
  {"day_of_week": 2, "open_time": "00:00", "close_time": "23:59", "is_closed": false},
  {"day_of_week": 3, "open_time": "00:00", "close_time": "23:59", "is_closed": false},
  {"day_of_week": 4, "open_time": "00:00", "close_time": "23:59", "is_closed": false},
  {"day_of_week": 5, "open_time": "00:00", "close_time": "23:59", "is_closed": false},
  {"day_of_week": 6, "open_time": "00:00", "close_time": "23:59", "is_closed": false}
]
```

### Retell Agent Info

```
Agent ID: agent_a42afc929376c54d66c010c58a
LLM ID: llm_6043315ef19be06edbd116f99a75
Voice: 11labs-Myra
Language: en-US
Last Synced: 2026-01-12T08:05:17.949Z
Prompt Version: 8
```

---

## Verification Steps

To verify the sync is working:

1. **Make a change in dashboard** (FAQ, service, knowledge, or business name)
2. **Check server logs** for:
   ```
   [Inngest Fallback] Queuing prompt regeneration for {businessId}
   [Process Queue] Direct processing for business {businessId}
   [Retell Sync] Successfully synced prompt to Retell
   ```
3. **Call the Retell agent** and ask about the changed information
4. **Check database** - `system_prompt_version` should increment, `retell_synced_at` should update

---

## Environment Variables Required

```env
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# Anthropic/Claude (Required for prompt generation)
ANTHROPIC_API_KEY=your_key

# Retell AI (Required for voice agents)
RETELL_API_KEY=your_key

# Optional - Inngest for background jobs
# If not set, fallback direct processing is used
INNGEST_EVENT_KEY=your_key
INNGEST_SIGNING_KEY=your_key
```

---

## Summary

All changes have been implemented and tested. The knowledge sync flow now works correctly:

1. Dashboard changes save instantly (fire-and-forget)
2. Prompt regeneration happens in background
3. FAQs are included verbatim in prompts
4. Retell agent is automatically synced
5. Business name changes are reflected in calls

The system now works without Inngest configuration by using a fallback direct processing mechanism.
