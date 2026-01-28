# Concept Scrutiny Report: Koya Caller

*Generated: 2026-01-20*
*Scrutinizer: Concept Scrutinizer Agent v1.0*

---

## Executive Summary

Koya Caller is a well-architected AI phone receptionist SaaS with a sophisticated dashboard, but it has **critical integration vulnerabilities** that could cause silent failures in production. The webhook signature bypass, fire-and-forget background jobs, and race conditions in booking could lead to missed calls, wrong billing, and double-bookings. The dashboard UI is excellent, but the backend integration layer needs hardening before this is production-safe.

---

## Project Understanding

**Problem Solved:** Small service businesses (salons, HVAC, dental offices) miss calls and lose bookings because they can't afford dedicated receptionists. Koya provides an AI agent that answers calls 24/7, books appointments, and handles common questions.

**Target Users:** Small business owners who:
- Receive 10-100 calls/day
- Offer appointment-based services
- Have simple booking needs (not complex multi-resource scheduling)
- Want to reduce missed calls without hiring staff

**Value Proposition:** "Never miss a call again — AI receptionist that books appointments, answers FAQs, and sounds human, for $99-397/month."

**Key Capabilities:**
1. AI-powered phone call handling via Retell.ai
2. Appointment booking with calendar integration
3. Customizable knowledge base (services, FAQs, business info)
4. Call analytics and transcripts
5. SMS confirmations and reminders

**Assumptions:**
- *Technical:* Retell.ai remains reliable and affordable; Twilio for telephony; Supabase scales adequately
- *User Behavior:* Business owners will populate knowledge base; callers will interact naturally with AI
- *Business:* $99-397/month price point sustainable; minute-based billing works for target market

---

## What's Working Well

### 1. Dashboard Architecture
The server-side rendering with React Query caching is well-implemented. Initial page loads are fast (parallel data fetching), and subsequent interactions feel snappy due to optimistic updates.

*Evidence:* `dashboard/page.tsx` fetches 7 data sources in parallel with `Promise.all()`, and React Query has sensible 1-minute stale time.

### 2. Multi-View Appointments
The calendar implementation (month/week/day views + list) is genuinely useful. Conflict detection on booking and reschedule prevents double-booking at the UI layer.

*Evidence:* `appointments-client.tsx` implements three calendar views with proper date math and visual slot rendering.

### 3. Call Details UX
The call details sheet with transcript, recording player, sentiment badge, and linked appointment is well-designed. Users can quickly understand what happened on each call.

*Evidence:* `calls-client.tsx` provides comprehensive call inspection without page navigation.

### 4. Security Basics
Rate limiting on dashboard routes (60 req/min), RLS policies for tenant isolation, and input sanitization on search queries show security awareness.

*Evidence:* `withDashboardRateLimit()` wrapper, `sanitizeSqlPattern()` for ILIKE injection prevention.

### 5. Prompt Engineering System
The Claude integration for generating business-specific prompts is sophisticated — industry enhancements, few-shot examples, sentiment detection, and personality-aware error messages.

*Evidence:* `/lib/claude/` contains meta-prompts, industry-specific templates, and caller context awareness.

---

## Critical Findings

### Finding 1: Webhook Signature Verification Bypass

- **Location:** `/app/api/retell/webhook/route.ts`
- **Issue:** A `WEBHOOK_SIGNATURE_BYPASS` flag disables Retell webhook signature verification. If accidentally left enabled in production, attackers can forge webhook payloads to manipulate call records, trigger fake bookings, or corrupt minutes usage.
- **Impact:** Complete compromise of call data integrity. Attackers could mark calls as "booked" without real calls, drain minutes allocations, or inject malicious data.
- **Evidence:** Code checks `WEBHOOK_SIGNATURE_BYPASS` before verifying signature. No environment-specific guard.
- **Recommendation:** Remove bypass entirely, or add explicit `NODE_ENV !== 'production'` guard with console warning. Add monitoring for signature verification failures.

---

### Finding 2: Fire-and-Forget Background Jobs

- **Location:** `/lib/inngest/client.ts`, fallback handling throughout
- **Issue:** When Inngest is not configured, background jobs (prompt regeneration, calendar sync, reminders) execute via fire-and-forget HTTP requests with no retry, no confirmation, and no error handling.
- **Impact:** Critical operations silently fail. Prompts don't regenerate after settings change. Appointment reminders don't send. Calendar tokens expire without refresh. Users have no visibility into failures.
- **Evidence:** Fallback code does `fetch('/api/...').catch(() => {})` — errors are swallowed.
- **Recommendation:** Implement a simple job queue table in Supabase with status tracking. Process via cron or on-demand. Surface failed jobs in admin dashboard.

---

### Finding 3: Race Condition in Concurrent Bookings

- **Location:** `/app/api/retell/webhook/route.ts`, appointment creation
- **Issue:** When two calls attempt to book the same slot simultaneously, the code uses upsert but doesn't prevent the race. Both could succeed, creating conflicting appointments or overwriting each other.
- **Impact:** Double-bookings in the database. Calendar sync may show one appointment while DB has another. Customer confusion and lost business.
- **Evidence:** Appointment upsert uses `retell_call_id` as conflict key, but two different calls booking same slot have different `retell_call_id` values — no conflict detected.
- **Recommendation:** Add database-level unique constraint on `(business_id, service_id, start_time)` for non-cancelled appointments. Use SELECT FOR UPDATE or advisory locks for booking operations.

---

### Finding 4: Silent Plan Allocation Failures

- **Location:** `/app/api/stripe/webhook/route.ts`
- **Issue:** When Stripe webhook processes a subscription, it looks up plan by `stripe_price_id`. If lookup fails, it silently defaults to 200 minutes. Business owner pays for 2000-minute plan but gets 200 minutes.
- **Impact:** Revenue loss (refund requests), customer churn, support burden. No audit trail of what went wrong.
- **Evidence:** Code has `?? { minutes_included: 200 }` fallback with no logging or alerting.
- **Recommendation:** Throw error on plan lookup failure to trigger Stripe retry. Add alert to admin when fallback used. Require manual verification before activating subscription with default minutes.

---

### Finding 5: Stale Dynamic Variables During Calls

- **Location:** `/lib/retell/index.ts`, `/app/api/retell/incoming/route.ts`
- **Issue:** Variables like `minutes_exhausted`, `after_hours`, and `services_list` are passed to Retell at call start and never updated. If a call runs long and crosses the after-hours boundary, or if minutes run out mid-call, the agent doesn't know.
- **Impact:** Agent gives incorrect information. "We're open until 5pm" said at 4:55pm when call runs until 5:10pm. Minutes exhausted mid-call but agent keeps booking.
- **Evidence:** `registerPhoneCall()` passes static `dynamic_variables` object. No mechanism for mid-call updates.
- **Recommendation:** Document this limitation clearly. For minutes exhaustion, add webhook to terminate calls when limit reached. For after-hours, consider shorter call timeouts near boundaries.

---

## Important Findings

### Finding 6: Admin Client Overuse

- **Location:** `/lib/supabase/server.ts`, used throughout
- **Issue:** The admin Supabase client (bypasses RLS) is used extensively instead of user-scoped clients. If any JWT is compromised, attacker has full database access.
- **Impact:** Single point of failure for data security. No defense in depth.
- **Evidence:** `createAdminClient()` called in many API routes where user-scoped client would suffice.
- **Recommendation:** Audit all admin client usage. Replace with user-scoped client where RLS policies exist. Reserve admin client for true system operations only.

---

### Finding 7: Call Record Orphaning

- **Location:** `/app/api/retell/incoming/route.ts`
- **Issue:** Call record is inserted into database BEFORE Retell registration. If Retell registration fails, orphaned call records exist with no corresponding Retell call.
- **Impact:** Polluted call history. Stats include calls that never happened. Confusing for debugging.
- **Evidence:** `createCall()` called before `retell.call.registerPhoneCall()`.
- **Recommendation:** Reverse order — register with Retell first, then create DB record on success. Or mark record as "pending" until Retell confirms.

---

### Finding 8: Recording URL Expiration

- **Location:** `/app/api/dashboard/calls/[id]/recording/route.ts`
- **Issue:** Call recordings are streamed from Retell URLs which likely have expiration times. No caching or permanent storage. Old calls lose recording access.
- **Impact:** Users can't review recordings from weeks/months ago. Compliance issues for businesses that need call records.
- **Evidence:** Recording URL fetched on-demand from Retell API. No local storage.
- **Recommendation:** Download and store recordings in Supabase Storage or S3 when call ends. Serve from permanent storage.

---

### Finding 9: No Query Timeouts

- **Location:** Throughout `/lib/db/`
- **Issue:** Database queries have no explicit timeouts. A slow query could hang an API request indefinitely, exhausting server resources.
- **Impact:** Cascading failures under load. Single slow query blocks request thread.
- **Evidence:** All Supabase queries are simple awaits with no timeout wrapper.
- **Recommendation:** Add timeout wrapper (e.g., `Promise.race` with timeout) to all database operations. Set reasonable limits (5-10 seconds for dashboard queries).

---

### Finding 10: Phone Number Enumeration

- **Location:** `/app/api/retell/incoming/route.ts`
- **Issue:** No rate limiting on incoming call phone number lookups. Attacker could enumerate all business phone numbers by making rapid lookup requests.
- **Impact:** Privacy breach. Competitors could discover all Koya customers.
- **Evidence:** Incoming call handler queries `phone_numbers` table with no rate limit.
- **Recommendation:** Add rate limiting per source IP. Consider adding CAPTCHA or verification for suspicious patterns.

---

### Finding 11: Calendar Sync Silent Failures

- **Location:** `/app/api/retell/webhook/route.ts`, calendar sync section
- **Issue:** When appointment is booked, calendar sync is attempted but failures are caught and ignored. Appointment exists in Koya but not in Google/Outlook calendar.
- **Impact:** Business owner's calendar doesn't show booking. They schedule something else. Customer shows up to conflict.
- **Evidence:** Calendar sync wrapped in try/catch with empty catch block or just console.log.
- **Recommendation:** Track sync status on appointment record. Retry failed syncs. Alert business owner when sync fails. Show sync status in dashboard.

---

### Finding 12: Concurrent Settings Updates

- **Location:** `/app/api/dashboard/settings/*`
- **Issue:** Settings updates have no optimistic locking. Two users (or two browser tabs) editing settings simultaneously will overwrite each other's changes.
- **Impact:** Lost configuration changes. "I saved that setting but it's gone."
- **Evidence:** PATCH endpoints do direct updates with no version checking.
- **Recommendation:** Add `updated_at` version checking. Return 409 Conflict if version mismatch. Let UI handle merge or retry.

---

## Minor Findings

- **SMS Template Special Characters:** Regex-based variable substitution in SMS templates could break on special regex characters in template text. Use string replacement instead.

- **Phone Number Format Validation:** Only validates `+1XXXXXXXXXX`. International expansion will require format updates.

- **Service List Truncation:** Large service lists passed to Retell as string may hit limits. Consider summarization for businesses with 50+ services.

- **Mock Mode UX:** When API keys not set, system returns mock data but UI doesn't clearly indicate demo mode. Users may think system is working.

- **Console Logging:** Production code has `console.log` statements. Should use structured logging with levels.

- **No Soft Deletes:** Deleted appointments and calls are permanently removed. No audit trail for compliance.

- **Timezone Handling:** Dashboard shows times but timezone handling is implicit. Could confuse users in different timezones than their business.

---

## Integration Health Summary

| Integration | Status | Notes |
|-------------|--------|-------|
| Retell ↔ Database | ⚠️ Warning | Webhook bypass risk, call record orphaning |
| Retell ↔ Twilio | ✅ Healthy | Clean handoff, proper phone registration |
| Claude ↔ Retell | ⚠️ Warning | Fire-and-forget regeneration, no confirmation |
| Stripe ↔ Database | ❌ Broken | Silent plan lookup failures, wrong minutes |
| Supabase ↔ Dashboard | ✅ Healthy | Good RLS, proper tenant isolation |
| Calendar ↔ Appointments | ⚠️ Warning | Silent sync failures, no retry |
| Inngest ↔ All | ❌ Broken | Fire-and-forget fallback, jobs lost |

---

## Logical Consistency Assessment

The project is **mostly coherent** with some concerning inconsistencies:

**Consistent:**
- Data flow from server components to client components is well-patterned
- API route structure follows clear conventions
- React Query usage is consistent across dashboard

**Inconsistent:**
- Error handling varies wildly — some routes throw, some return errors, some swallow silently
- Some operations use Inngest, others use direct API calls, others use fire-and-forget
- Admin client vs user client usage seems arbitrary rather than principled

**Mental Model Conflict:**
The system presents itself as reliable ("never miss a call") but the backend has multiple silent failure modes. The user's mental model is "it just works" but the engineering reality is "it works if nothing goes wrong."

---

## Questions for the Team

1. **What's the expected behavior when Retell is down?** Currently calls would fail. Is there a fallback (voicemail, forward to cell)?

2. **Is Inngest required for production?** The fallback mode has serious reliability issues. If Inngest is mandatory, it should be enforced at startup.

3. **What's the compliance requirement for call recordings?** Current implementation loses recordings over time. Need permanent storage?

4. **Are concurrent users expected?** Multiple people managing the same business account? Current implementation has race conditions.

5. **What's the target uptime SLA?** The integration issues suggest 99% might be achievable but 99.9% would require significant hardening.

6. **Is international expansion planned?** Phone number validation and timezone handling would need updates.

---

## Conclusion

**Overall Assessment:** Koya Caller has a solid foundation with excellent UI/UX, but the integration layer has critical reliability issues that could cause silent failures in production.

**Ratings:**
- Structural Health: **Concerning** — Good patterns but critical gaps in error handling
- Logic Coherence: **Mostly Coherent** — Consistent UI patterns, inconsistent backend handling
- User Experience: **Good** — Dashboard is well-designed and intuitive
- Sustainability: **Manageable** — Code is readable, but missing observability

**Path Forward:**

1. **Immediate (Before Launch):**
   - Remove webhook signature bypass or add production guard
   - Fix Stripe plan lookup to fail loudly, not silently
   - Replace fire-and-forget with proper job tracking

2. **Short-term (First Month):**
   - Add database-level booking conflict prevention
   - Implement recording permanent storage
   - Add query timeouts throughout
   - Audit and reduce admin client usage

3. **Medium-term (Quarter 1):**
   - Build observability dashboard for background jobs
   - Implement calendar sync retry with status tracking
   - Add optimistic locking for concurrent edits
   - Structured logging and alerting

The dashboard is production-ready. The integrations need hardening. Fix the critical findings and this becomes a solid product.
