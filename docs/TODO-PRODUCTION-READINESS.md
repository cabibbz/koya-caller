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

### 2. 109 Console Statements in Production Code
**Impact:** Performance degradation, information exposure, noisy logs

**Files with most console statements:**
- `lib/onboarding/actions.ts` - 56 statements
- `lib/twilio/index.ts` - multiple mock mode logs
- `lib/email/index.ts` - 5 statements
- `app/api/retell/incoming/route.ts` - 3 statements

**Action:**
- [ ] Remove all `console.log` statements
- [ ] Replace necessary error logging with structured logger (e.g., Pino, Winston)
- [ ] Set up error tracking service (Sentry, LogRocket)

### 3. Missing Demo Agent Configuration
**File:** `lib/retell/index.ts:375`
```typescript
// TODO: Create a dedicated demo agent with demo prompt
```

- [ ] Create demo Retell agent for landing page
- [ ] Set `RETELL_DEMO_AGENT_ID` environment variable
- [ ] Test demo call flow on landing page

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

### 6. Hardcoded URLs
**Files with hardcoded fallbacks:**
- `app/api/twilio/webhook/route.ts:26` → `https://koyacaller.com`
- `lib/retell/index.ts:85` → `https://koya-caller.com`
- `app/api/retell/incoming/route.ts:25` → `https://koyacaller.com`

- [ ] Create centralized config utility for URLs
- [ ] Remove all hardcoded domain fallbacks
- [ ] Throw error if required env vars missing in production

### 7. Missing Rate Limiting on Expensive APIs
**Unprotected expensive endpoints:**
- `POST /api/admin/blog/generate` (Claude API - $$)
- `POST /api/admin/blog/generate-image` (DALL-E API - $$)
- `POST /api/dashboard/knowledge/scrape` (Claude API - $$)

- [ ] Add rate limiting middleware to these routes
- [ ] Consider adding cost tracking/alerts

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
| Console statements | ❌ 109 found | Yes |
| Demo agent | ❌ Not configured | Yes |
| Rate limiting | ❌ Missing on expensive APIs | Yes |
| Error handling | ⚠️ Inconsistent | Partial |
| Input validation | ⚠️ Incomplete | Partial |
| Auth consistency | ⚠️ Needs review | Partial |

---

## Recommended Order of Fixes

1. Remove all `console.log` statements (1-2 hours)
2. Add rate limiting to expensive APIs (1 hour)
3. Configure demo agent (30 min)
4. Fix search input validation (30 min)
5. Centralize URL configuration (1 hour)
6. Set up basic test framework (2-3 hours)
7. Add critical path tests (4-6 hours)
8. Standardize error handling (2-3 hours)
9. Review auth patterns (2 hours)
10. Add security headers (1 hour)

**Estimated Total:** 15-20 hours for production readiness

---

*Generated: January 2025*
