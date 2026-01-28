# Auth Middleware Refactoring Progress

## Overview

Refactoring all dashboard API routes to use the centralized `withAuth` middleware from `@/lib/api/auth-middleware.ts`. This eliminates duplicated auth/business lookup code across 65+ routes.

## The Pattern

### Before (Duplicated in every route - 15-25 lines each)
```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { withDashboardRateLimit } from "@/lib/rate-limit/middleware";

async function handler(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const business = await getBusinessByUserId(user.id);
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }
  // ... business logic
  return NextResponse.json({ success: true, data: ... });
}
export const GET = withDashboardRateLimit(handler);
```

### After (Clean, DRY pattern)
```typescript
import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { logError } from "@/lib/logging";

async function handleGet(
  request: NextRequest,
  { business, supabase, user }: BusinessAuthContext
) {
  try {
    // Business logic only - auth already handled
    return success({ data });
  } catch (error) {
    logError("Route Name", error);
    return errors.internalError("Error message");
  }
}

export const GET = withAuth(handleGet);
```

## Available Error Helpers

From `@/lib/api/auth-middleware.ts` (re-exports from `@/lib/api/responses.ts`):

- `errors.badRequest(message)` - 400
- `errors.unauthorized(message)` - 401
- `errors.forbidden(message)` - 403
- `errors.notFound(resource)` - 404
- `errors.methodNotAllowed(allowed[])` - 405
- `errors.conflict(message)` - 409
- `errors.validationError(message, details)` - 422
- `errors.rateLimited(retryAfter)` - 429
- `errors.internalError(message)` - 500
- `errors.serviceUnavailable(service)` - 503
- `errors.quotaExceeded(resource)` - 402
- `errors.featureDisabled(feature)` - 403
- `errors.externalServiceError(service, details)` - 502
- `errors.paymentFailed(message)` - 402

## Completed Routes (67)

- [x] `app/api/dashboard/calls/route.ts`
- [x] `app/api/dashboard/contacts/route.ts`
- [x] `app/api/dashboard/appointments/route.ts`
- [x] `app/api/dashboard/stats/route.ts`
- [x] `app/api/dashboard/agents/route.ts`
- [x] `app/api/dashboard/settings/route.ts`
- [x] `app/api/dashboard/knowledge/faqs/route.ts`
- [x] `app/api/dashboard/campaigns/route.ts`
- [x] `app/api/dashboard/phone-numbers/route.ts`
- [x] `app/api/dashboard/search/route.ts`
- [x] `app/api/dashboard/dnc/route.ts`
- [x] `app/api/dashboard/settings/voice/route.ts`
- [x] `app/api/dashboard/settings/notifications/route.ts`
- [x] `app/api/dashboard/knowledge/services/route.ts`
- [x] `app/api/dashboard/prompt/route.ts`
- [x] `app/api/dashboard/calls/[id]/route.ts`
- [x] `app/api/dashboard/appointments/[id]/route.ts`
- [x] `app/api/dashboard/contacts/[id]/route.ts`
- [x] `app/api/dashboard/campaigns/[id]/route.ts`
- [x] `app/api/dashboard/calls/[id]/recording/route.ts`
- [x] `app/api/dashboard/calls/export/route.ts`
- [x] `app/api/dashboard/calls/sync/route.ts`
- [x] `app/api/dashboard/appointments/export/route.ts`
- [x] `app/api/dashboard/contacts/export/route.ts`
- [x] `app/api/dashboard/campaigns/[id]/process/route.ts`
- [x] `app/api/dashboard/campaigns/[id]/debug/route.ts`
- [x] `app/api/dashboard/settings/advanced-ai/route.ts`
- [x] `app/api/dashboard/settings/api-keys/route.ts`
- [x] `app/api/dashboard/settings/availability/route.ts`
- [x] `app/api/dashboard/settings/calendar/route.ts`
- [x] `app/api/dashboard/settings/api-keys/[id]/route.ts`
- [x] `app/api/dashboard/settings/call-features/route.ts`
- [x] `app/api/dashboard/settings/call-handling/route.ts`
- [x] `app/api/dashboard/settings/compliance/route.ts`
- [x] `app/api/dashboard/settings/api-keys/[id]/stats/route.ts`
- [x] `app/api/dashboard/settings/availability/blocked-dates/route.ts`
- [x] `app/api/dashboard/settings/availability/services/route.ts`
- [x] `app/api/dashboard/settings/compliance/baa/route.ts`
- [x] `app/api/dashboard/settings/compliance/baa/download/route.ts`
- [x] `app/api/dashboard/settings/compliance/template/route.ts`
- [x] `app/api/dashboard/settings/crm/route.ts`
- [x] `app/api/dashboard/settings/crm/sync/route.ts`
- [x] `app/api/dashboard/settings/dnc/route.ts`
- [x] `app/api/dashboard/settings/language/route.ts`
- [x] `app/api/dashboard/settings/offers/route.ts`
- [x] `app/api/dashboard/settings/outbound/route.ts`
- [x] `app/api/dashboard/settings/payments/route.ts`
- [x] `app/api/dashboard/settings/sms-templates/route.ts`
- [x] `app/api/dashboard/settings/webhooks/route.ts`
- [x] `app/api/dashboard/settings/webhooks/[id]/route.ts`
- [x] `app/api/dashboard/settings/webhooks/[id]/deliveries/[deliveryId]/retry/route.ts`
- [x] `app/api/dashboard/knowledge/additional/route.ts`
- [x] `app/api/dashboard/knowledge/bundles/route.ts`
- [x] `app/api/dashboard/knowledge/business/route.ts`
- [x] `app/api/dashboard/knowledge/export/route.ts`
- [x] `app/api/dashboard/knowledge/import/route.ts`
- [x] `app/api/dashboard/knowledge/regenerate/route.ts`
- [x] `app/api/dashboard/knowledge/memberships/route.ts`
- [x] `app/api/dashboard/knowledge/packages/route.ts`
- [x] `app/api/dashboard/knowledge/upsells/route.ts`
- [x] `app/api/dashboard/compliance/audit/route.ts`
- [x] `app/api/dashboard/compliance/consent/route.ts`
- [x] `app/api/dashboard/integrations/status/route.ts`
- [x] `app/api/dashboard/payments/history/route.ts`
- [x] `app/api/dashboard/payments/summary/route.ts`
- [x] `app/api/dashboard/payments/payout-schedule/route.ts`
- [x] `app/api/dashboard/trial/route.ts`

## Skipped Routes (Special Rate Limiting)

These routes use `withAIGenerationRateLimit` (10 requests/minute per user) instead of standard dashboard rate limiting. They handle auth internally and were intentionally not refactored to preserve their specialized rate limiting behavior:

- [~] `app/api/dashboard/knowledge/scrape/route.ts` - AI-powered website scraping
- [~] `app/api/dashboard/knowledge/suggest-faqs/route.ts` - AI-powered FAQ generation
- [~] `app/api/dashboard/knowledge/test/route.ts` - AI-powered knowledge testing

## Refactoring Complete

All dashboard API routes have been refactored to use the centralized `withAuth` middleware pattern, with the exception of 3 routes that use specialized AI generation rate limiting.

## Key Files

- **Auth Middleware**: `lib/api/auth-middleware.ts`
- **Response Helpers**: `lib/api/responses.ts`
- **Test Infrastructure**: `tests/utils/mock-supabase.ts`, `tests/utils/api-helpers.ts`, `tests/utils/test-factories.ts`
- **Example Test**: `tests/api/dashboard-calls.test.ts`

## Testing After Refactoring

Run TypeScript compilation check:
```bash
npx tsc --noEmit --skipLibCheck
```

## Notes

1. Routes with dynamic segments `[id]` need to handle the `params` argument
2. Some routes use `createAdminClient()` for elevated permissions - keep this pattern
3. Routes that do manual rate limiting should switch to relying on `withAuth` which handles it
4. Always import `logError` from `@/lib/logging` for error handling
5. Use `eslint-disable` comments for Supabase type inference issues where needed

## Context for Continuation

The `withAuth` middleware:
- Handles authentication (returns 401 if not authenticated)
- Looks up the user's business (returns 404 if not found)
- Provides `BusinessAuthContext` with `{ user, business, supabase }` to handlers
- Includes built-in rate limiting

The refactoring goal is to eliminate ~1500+ lines of duplicated auth code across all dashboard routes while standardizing the API response format.
