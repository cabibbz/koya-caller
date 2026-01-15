# Koya Caller - Comprehensive Testing Checklist

## Automated Test Results (January 14, 2026)

| Category | Passed | Failed | Warnings |
|----------|--------|--------|----------|
| Database Schema | 81 | 0 | 1 |
| API Endpoints | 10 | 0 | 0 |
| Retell Integration | 2 | 0 | 0 |
| Environment | 2 | 0 | 0 |

---

## Manual Testing Checklist

### 1. Landing Page (`/`)

#### Visual Tests
- [ ] Page loads without blur/missing content
- [ ] Navigation bar is visible and functional
- [ ] Hero section displays correctly with Koya mascot
- [ ] Live stats section shows numbers
- [ ] Demo section is functional
- [ ] How It Works section displays steps
- [ ] Comparison section is readable
- [ ] Testimonials section shows reviews
- [ ] Pricing section shows all 3 plans
- [ ] FAQ section accordion works
- [ ] Footer displays correctly

#### Functional Tests
- [ ] "Try Demo" button works
- [ ] "Get Started" buttons navigate to signup
- [ ] Pricing "Start Free Trial" buttons work
- [ ] FAQ accordion expands/collapses
- [ ] Mobile responsive (test on phone or resize browser)

---

### 2. Authentication

#### Sign Up (`/signup`)
- [ ] Form displays correctly
- [ ] Email validation works
- [ ] Password requirements shown
- [ ] Sign up creates account
- [ ] Verification email sent (check email)
- [ ] Google OAuth works (if configured)

#### Sign In (`/login`)
- [ ] Form displays correctly
- [ ] Email/password login works
- [ ] "Forgot Password" link works
- [ ] Redirects to dashboard after login
- [ ] Session persists on page refresh

#### Sign Out
- [ ] Sign out button in dashboard works
- [ ] Redirects to login page
- [ ] Cannot access dashboard after logout

---

### 3. Onboarding (`/onboarding`)

#### Step 1: Business Info
- [ ] Business name field works
- [ ] Industry dropdown works
- [ ] Timezone selection works
- [ ] "Next" button enables after filling fields

#### Step 2: Business Hours
- [ ] Can set hours for each day
- [ ] Can mark days as closed
- [ ] Hours persist when navigating back/forward

#### Step 3: Services
- [ ] Can add services
- [ ] Can edit service name/duration/price
- [ ] Can delete services
- [ ] Can reorder services (drag and drop)

#### Step 4: FAQs
- [ ] Can add FAQ items
- [ ] Can edit question/answer
- [ ] Can delete FAQs
- [ ] Can reorder FAQs

#### Step 5: Call Handling
- [ ] Transfer number input works
- [ ] After-hours settings work
- [ ] Max call duration slider works

#### Step 6: AI Personality
- [ ] AI name input works
- [ ] Personality selector works
- [ ] Greeting input works
- [ ] Voice selection works
- [ ] Voice preview plays audio

#### Step 7: Phone Number
- [ ] Phone number selection/search works
- [ ] Can provision a new number
- [ ] Number displays correctly

#### Completion
- [ ] "Complete Setup" creates Retell agent
- [ ] Redirects to dashboard
- [ ] All data saved correctly

---

### 4. Dashboard (`/dashboard`)

#### Overview Tab
- [ ] Stats cards display (calls, minutes, appointments)
- [ ] Recent calls list loads
- [ ] Quick actions work

#### Calls Tab (`/calls`)
- [ ] Calls list loads
- [ ] Can filter by date range
- [ ] Can filter by outcome
- [ ] Can search by phone number
- [ ] Call detail modal opens
- [ ] Transcript displays
- [ ] Recording playback works
- [ ] Can flag/unflag calls
- [ ] Can add notes to calls

#### Appointments Tab (`/appointments`)
- [ ] Appointments list loads
- [ ] Can filter by date range
- [ ] Can filter by status
- [ ] Calendar view works
- [ ] Can confirm appointments
- [ ] Can cancel appointments
- [ ] Can reschedule (if implemented)

---

### 5. Settings (`/settings`)

#### Call Handling Tab
- [ ] Transfer number input saves
- [ ] Backup transfer number input saves
- [ ] Transfer toggles work (on request, emergency, upset)
- [ ] Transfer keywords input saves
- [ ] After-hours toggle works
- [ ] After-hours can book toggle works
- [ ] **Max call duration slider saves** ✓ Fixed
- [ ] **Call recording toggle saves** ✓ Fixed
- [ ] Save button shows success toast

#### Call Features Tab (Retell Advanced)
- [ ] Voicemail detection toggle works
- [ ] Voicemail message textarea saves
- [ ] Voicemail timeout input saves
- [ ] Silence handling settings save
  - [ ] Reminder trigger time
  - [ ] Reminder max count
  - [ ] End call after silence
- [ ] DTMF toggle works
- [ ] DTMF settings save (digit limit, termination key, timeout)
- [ ] Denoising mode selector works
- [ ] Save button shows success toast

#### Voice & Personality Tab
- [ ] Voice gender filter works
- [ ] Voice cards display
- [ ] Voice preview plays audio
- [ ] Voice selection saves
- [ ] AI name input saves
- [ ] Personality dropdown saves
- [ ] Greeting textarea saves
- [ ] Fallback voices selector works
- [ ] Save button shows success toast

#### Language Tab
- [ ] Spanish toggle works
- [ ] Language mode selector works
- [ ] Spanish greeting textarea shows when enabled
- [ ] Save button shows success toast

#### Calendar Tab
- [ ] Google Calendar connect button works
- [ ] Outlook Calendar connect button works
- [ ] Connected calendar shows status
- [ ] Can disconnect calendar
- [ ] Sync status displays

#### Notifications Tab
- [ ] Email notification toggles work
- [ ] SMS notification toggles work
- [ ] Notification email input saves
- [ ] Save button shows success toast

#### Phone & Billing Tab
- [ ] Current phone number displays
- [ ] Phone number status shows
- [ ] Current plan displays
- [ ] Usage stats display (minutes used/remaining)
- [ ] Upgrade/downgrade buttons work
- [ ] Billing history loads

#### Advanced AI Tab
- [ ] Industry enhancements toggle works
- [ ] Few-shot examples toggle works
- [ ] Sentiment detection level selector works
- [ ] Caller context toggle works
- [ ] Tone intensity slider works
- [ ] Personality-aware errors toggle works
- [ ] Boosted keywords input saves
- [ ] Custom summary prompt textarea saves
- [ ] Analysis model selector works
- [ ] PII redaction toggle works
- [ ] PII categories checkboxes work
- [ ] Save button shows success toast

---

### 6. Upselling Features

#### Upsells (`/upsells` or Settings)
- [ ] Upsells list loads
- [ ] Can create new upsell
- [ ] Source service dropdown works
- [ ] Target service dropdown works
- [ ] Discount input works
- [ ] Pitch message textarea works
- [ ] Can edit existing upsell
- [ ] Can delete upsell
- [ ] Active toggle works

#### Bundles
- [ ] Bundles list loads
- [ ] Can create bundle
- [ ] Can add services to bundle
- [ ] Discount input works
- [ ] Can edit/delete bundle

#### Packages
- [ ] Packages list loads
- [ ] Can create package
- [ ] Session count input works
- [ ] Validity days input works
- [ ] Can edit/delete package

#### Memberships
- [ ] Memberships list loads
- [ ] Can create membership
- [ ] Billing period selector works
- [ ] Benefits textarea works
- [ ] Can edit/delete membership

---

### 7. API Webhooks

#### Retell Webhook (`/api/retell/webhook`)
- [ ] Receives call.started events
- [ ] Receives call.ended events
- [ ] Creates call records in database
- [ ] Extracts call analysis data
- [ ] Updates caller profile

#### Twilio Webhook (`/api/twilio/voice`)
- [ ] Receives incoming calls
- [ ] Routes to correct Retell agent
- [ ] Handles after-hours correctly
- [ ] Returns proper TwiML

#### Stripe Webhook (`/api/stripe/webhook`)
- [ ] Handles checkout.session.completed
- [ ] Handles subscription.updated
- [ ] Handles subscription.deleted
- [ ] Updates business subscription status

---

### 8. Phone Call Testing (Requires Actual Calls)

#### Basic Call Flow
- [ ] Call your Koya number
- [ ] AI answers with greeting
- [ ] AI understands questions
- [ ] AI provides appropriate responses
- [ ] Call ends gracefully

#### Appointment Booking
- [ ] Request appointment
- [ ] AI offers available times
- [ ] Confirm appointment
- [ ] Receive confirmation SMS
- [ ] Appointment appears in dashboard

#### Transfer Scenarios
- [ ] Say "transfer me" - call transfers
- [ ] Report emergency - call transfers
- [ ] Express frustration - call transfers (if enabled)

#### After-Hours
- [ ] Call outside business hours
- [ ] AI uses after-hours greeting
- [ ] Booking works (if enabled)
- [ ] Message-only mode works (if enabled)

#### Advanced Features
- [ ] Voicemail detection works (call a voicemail)
- [ ] DTMF input recognized (press digits)
- [ ] Silence handling prompts work (stay silent)
- [ ] Background noise filtered

---

## Known Issues / Fixes Applied

| Issue | Status | Fix |
|-------|--------|-----|
| Landing page blur | ✅ Fixed | Removed backdrop-filter from .glass classes |
| Settings not saving | ✅ Fixed | Changed to adminClient to bypass RLS |
| Retell PII config error | ✅ Fixed | Removed null value, omit field instead |
| Missing DB columns | ✅ Fixed | Migrations applied |

---

## Quick Commands

```bash
# Run automated tests
node scripts/test-all-features.js

# Test Retell features
node scripts/test-retell-features.js

# Check database state
node scripts/apply-migrations-direct.js

# Start dev server
npm run dev

# Run type check
npm run type-check

# Run tests
npm test
```
