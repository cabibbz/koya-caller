# Koya Caller - Production Readiness Checklist

## Overview

This document outlines all remaining work items discovered during a deep code audit.

---

## 🔴 CRITICAL (Must Fix Before Production)

### 1. No Test Coverage
**Impact:** Extremely high refactoring risk, regressions can go undetected

- [ ] Set up Jest or Vitest testing framework
- [ ] Add unit tests for business logic (`lib/` directory)
- [ ] Add API route integration tests
- [ ] Add E2E tests for critical flows (onboarding, calls, payments)

### 2. ~~109 Console Statements in Production Code~~ ✅ FIXED
**Status:** Fixed January 23, 2025

All console statements removed from production code:
- [x] Replaced with structured logging (`logError`, `logWarning`, `logInfo` from `lib/logging`)
- [x] Error boundaries now use `Sentry.captureException`
- [x] Client components use proper UI error handling (toasts, state)
- [x] 0 console statements remain in app code (scripts/ excluded)

### 3. ~~Missing Demo Agent Configuration~~ ✅ FIXED
**Status:** Fixed January 23, 2025

- [x] Created demo Retell agent via API (Demo Koya - English)
- [x] Created Spanish demo agent (Demo Koya ES)
- [x] Set `RETELL_DEMO_AGENT_ID` environment variable
- [x] Demo call flow working on landing page

---

## 🟠 HIGH PRIORITY

### 4. SQL Injection Risk in Admin Search
**File:** `app/api/admin/search/route.ts`

```typescript
// Current (risky):
.or(`name.ilike.%${query}%`)

// Should be parameterized properly
```

- [ ] Sanitize and validate search query input
- [ ] Add maximum length check (e.g., 100 chars)
- [ ] Add rate limiting to search endpoint

### 5. Incomplete TODO Features

| Location | TODO | Priority |
|----------|------|----------|
| `lib/inngest/functions/calendar-refresh.ts:116` | Send email when re-auth needed | High |
| `app/api/admin/health/route.ts:169` | Implement calendar sync failure tracking | Medium |

- [ ] Implement calendar re-auth email notifications
- [ ] Add calendar sync failure tracking to health endpoint

### 6. Hardcoded URLs [RESOLVED]
**Previously hardcoded fallbacks have been centralized:**

All hardcoded URLs have been migrated to use the centralized config in `lib/config/index.ts`:
- `APP_CONFIG.urls` - Site, app, and production URLs
- `APP_CONFIG.contact` - Email addresses (general, support, legal, privacy, compliance)
- `APP_CONFIG.social` - Social media URLs
- `APP_CONFIG.phone` - Phone numbers

Helper functions available:
- `getBaseUrl()` - Client-aware base URL
- `getAppUrl()` - API/webhook URL
- `getProductionUrl()` - SEO/metadata URL
- `getDashboardUrl(path)` - Dashboard URLs
- `buildUrl(path)` / `buildAppUrl(path)` / `buildProductionUrl(path)` - URL builders

- [x] Create centralized config utility for URLs
- [x] Remove all hardcoded domain fallbacks (migrated to use config)
- [ ] Throw error if required env vars missing in production

### 7. ~~Missing Rate Limiting on Expensive APIs~~ ✅ FIXED
**Status:** Fixed January 23, 2025

Added dedicated AI rate limiters:
- `aiGenerationLimiter` (10 requests/min) for Claude API
- `imageGenerationLimiter` (5 requests/min) for DALL-E API

Protected endpoints:
- [x] `POST /api/admin/blog/generate` - `withAIGenerationRateLimit`
- [x] `POST /api/admin/blog/generate-image` - `withImageGenerationRateLimit`
- [x] `POST /api/dashboard/knowledge/scrape` - `withAIGenerationRateLimit`
- [x] `POST /api/dashboard/knowledge/suggest-faqs` - `withAIGenerationRateLimit`
- [x] `POST /api/dashboard/knowledge/test` - `withAIGenerationRateLimit`
- [x] `POST /api/claude/generate-prompt` - `withAIGenerationRateLimit` (CRITICAL - was unprotected!)

### 8. Inconsistent Authentication Patterns

- [ ] Create reusable auth middleware for admin routes
- [ ] Create reusable auth middleware for dashboard routes
- [ ] Audit all routes for proper business ownership checks

---

## 🟡 MEDIUM PRIORITY

### 9. Input Validation Improvements

**Admin Search:**
- [ ] Add max length validation
- [ ] Add special character filtering
- [ ] Validate UUID format for IDs

**Blog Generate:**
- [ ] Validate postId is valid UUID
- [ ] Add title length limits
- [ ] Sanitize user inputs

### 10. Mock Mode Code Review
**Risk:** Mock mode could activate in production if env vars missing

**Files with mock mode:**
- `app/api/demo/call/route.ts`
- `app/api/twilio/configure/route.ts`
- `app/api/twilio/provision/route.ts`
- `app/api/retell/agent/route.ts`
- `app/api/retell/voices/route.ts`

- [ ] Add production checks to prevent mock mode
- [ ] Log warnings when mock mode activates
- [ ] Consider removing mock mode for production build

### 11. Error Handling Standardization

- [ ] Create custom error classes
- [ ] Standardize error response format
- [ ] Add proper HTTP status codes
- [ ] Create error handling middleware

### 12. Database Query Optimization
**File:** `app/(marketing)/blog/[slug]/page.tsx`

- [ ] Batch multiple queries into single request
- [ ] Add database query caching (Redis or in-memory)
- [ ] Review all N+1 query patterns

### 13. Stripe Webhook Security

- [ ] Verify signature verification is working
- [ ] Add webhook event logging
- [ ] Test webhook replay protection

---

## 🟢 LOW PRIORITY

### 14. TypeScript Improvements
- [ ] Remove `as any` type assertions
- [ ] Add proper types for Supabase queries
- [ ] Enable stricter TypeScript settings

### 15. Security Headers
- [ ] Add CSP (Content Security Policy)
- [ ] Add X-Frame-Options
- [ ] Add X-Content-Type-Options
- [ ] Verify CORS configuration

### 16. Documentation
- [ ] Document API routes (OpenAPI/Swagger)
- [ ] Create error handling standards doc
- [ ] Document deployment process
- [ ] Document environment variables

### 17. Performance
- [ ] Add pagination to list endpoints
- [ ] Implement response caching
- [ ] Add gzip compression
- [ ] Review bundle size

---

## Quick Wins (Can Do Now)

1. **Remove console.log statements** - Search & replace
2. **Add max length to search** - Simple validation
3. **Set RETELL_DEMO_AGENT_ID** - Environment variable
4. **Add rate limiting** - Wrap existing routes

---

## Production Deployment Blockers

| Item | Status | Blocker? |
|------|--------|----------|
| Test coverage | ❌ None | Yes |
| Console statements | ✅ All removed | No |
| Demo agent | ✅ Configured | No |
| Rate limiting | ✅ Added to expensive APIs | No |
| Error handling | ⚠️ Inconsistent | Partial |
| Input validation | ⚠️ Incomplete | Partial |
| Auth consistency | ⚠️ Needs review | Partial |

---

## Recommended Order of Fixes

1. ~~Remove all `console.log` statements~~ ✅ DONE (Jan 23)
2. ~~Add rate limiting to expensive APIs~~ ✅ DONE (Jan 23)
3. ~~Configure demo agent~~ ✅ DONE (Jan 23)
4. Fix search input validation (30 min)
5. ~~Centralize URL configuration~~ ✅ DONE (Jan 23)
6. Set up basic test framework (2-3 hours)
7. Add critical path tests (4-6 hours)
8. Standardize error handling (2-3 hours)
9. Review auth patterns (2 hours)
10. Add security headers (1 hour)

**Completed:** 4 of 10 items
**Estimated Remaining:** 8-10 hours for production readiness

---

---

## Phase 3 Status (Added Jan 23, 2025)

### Outbound Calling - 90% Complete
- [x] Database schema (outbound_campaigns, outbound_call_queue, dnc_list)
- [x] Core library functions (initiateOutboundCall, checkDNC, processCallQueue)
- [x] Inngest background jobs (queue processing, reminder scheduling)
- [x] API routes (/api/outbound/initiate, /api/outbound/queue)
- [x] Call outcome recording and campaign stats
- [x] Consent verification for HIPAA businesses
- [ ] Dashboard UI for campaign management

### HIPAA Compliance - 80% Complete
- [x] Database schema (compliance_settings, phi_audit_log, patient_consents)
- [x] PHI detection with 14 category patterns
- [x] Audit logging (logPHIAccess, auditRecordingAccess)
- [x] Encryption utilities (AES-256-GCM, signed URLs)
- [x] Consent management functions
- [x] encryption_keys table migration
- [x] PHI detection integrated with call transcription
- [ ] Dashboard UI for HIPAA settings
- [ ] KMS integration for production keys

### Payment Collection - 95% Complete
- [x] Database schema (stripe_connect_accounts, payment_transactions)
- [x] Stripe Connect account creation and onboarding
- [x] Payment link generation
- [x] Deposit and balance collection
- [x] Refund processing
- [x] All webhook handlers (payments, transfers, payouts, refunds)
- [x] Appointment payment status updates
- [x] Email notifications for payment failures
- [ ] Dashboard UI for payment management

---

*Generated: January 2025*
*Last Updated: January 23, 2025*
