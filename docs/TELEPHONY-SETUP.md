# Koya Caller - Telephony Setup Guide

## Overview

This document summarizes the correct configuration for Twilio + Retell AI phone integration.

## Architecture

```
Incoming Call Flow:
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Caller    │───▶│   Twilio    │───▶│  Webhook    │───▶│   Retell    │
│             │    │  (Phone)    │    │  (Your App) │    │  (AI Agent) │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                         │                   │                   │
                         │    1. POST        │   2. Register     │
                         │───────────────────▶   Phone Call      │
                         │                   │──────────────────▶│
                         │                   │   3. Return       │
                         │                   │◀──────────────────│
                         │   4. TwiML with   │      call_id      │
                         │◀──────────────────│                   │
                         │   <Dial><Sip>     │                   │
                         │                   │                   │
                         │   5. SIP INVITE   │                   │
                         │──────────────────────────────────────▶│
                         │                   │                   │
                         │   6. Audio Stream (RTP)               │
                         │◀─────────────────────────────────────▶│
```

## Critical Configuration

### 1. Twilio Phone Number Setup

The phone number must have:
- **Voice URL**: `https://your-domain.com/api/twilio/webhook`
- **Voice Method**: `POST`
- **Fallback URL**: `https://your-domain.com/api/twilio/fallback`

**IMPORTANT**: The phone number must NOT be associated with a SIP trunk.

```bash
# Set webhook
node scripts/set-webhook.js
```

### 2. SIP Trunk (NOT Required for Basic Setup)

Initially we tried using a SIP trunk, but this caused issues:

| Issue | Symptom |
|-------|---------|
| Phone on trunk | "User busy" errors |
| Wrong SIP domain | Calls ring but don't connect |
| Transfer mode disabled | No child calls created |

**Solution**: Remove the phone number from any SIP trunk and use direct SIP dialing.

### 3. Retell Integration

The webhook registers each call with Retell and returns TwiML that dials Retell's SIP endpoint:

```javascript
// Register call with Retell
const retellCall = await retellClient.call.registerPhoneCall({
  agent_id: aiConfig.retell_agent_id,
  from_number: toNumber,   // Your Twilio number
  to_number: fromNumber,   // Caller's number
  direction: "inbound",
});

// Return TwiML to connect via SIP
const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Sip>sip:${retellCall.call_id}@5t4n6j0wnrl.sip.livekit.cloud</Sip>
  </Dial>
</Response>`;
```

### 4. SIP Domain

The correct SIP domain for Retell (as of Jan 2025):
```
5t4n6j0wnrl.sip.livekit.cloud
```

This is Retell's LiveKit-based SIP infrastructure.

## Database Requirements

### Business Status
The business must have `subscription_status = 'active'` for calls to be processed:

```bash
node scripts/activate-business.js
```

### Required Tables
- `businesses` - Business info and subscription status
- `phone_numbers` - Maps Twilio numbers to businesses
- `ai_config` - Stores Retell agent ID
- `calls` - Call records

## Troubleshooting

### "User Busy" Error
1. Check if phone is on a SIP trunk → Remove it
2. Check SIP domain is correct → Use LiveKit domain
3. Check Retell API key is valid

### Calls Ring But Don't Connect
1. Verify Retell agent exists
2. Check call was registered (look for `retell_call_id` in database)
3. Verify SIP domain matches Retell's infrastructure

### No Child Calls in Twilio
1. TwiML might not be returning correctly
2. Check webhook is accessible
3. Check for errors in webhook logs

## Diagnostic Scripts

```bash
# Full setup check
node scripts/full-setup-check.js

# Check SIP trunk config
node scripts/check-sip-trunk.js

# Check recent Twilio calls
node scripts/check-twilio-calls.js

# Check call details with SIP attempts
node scripts/check-call-details.js

# Check recent Retell calls
node scripts/check-recent-calls.js

# Check database call records
node scripts/check-db-recent.js
```

## Environment Variables Required

```env
# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxx
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx

# Retell
RETELL_API_KEY=xxxxxxx

# App
NEXT_PUBLIC_APP_URL=https://your-ngrok-url.ngrok-free.dev

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxxxxx
```

## Key Findings Summary

| Issue | Root Cause | Solution |
|-------|------------|----------|
| Calls not reaching app | Webhook URL not set | Run `set-webhook.js` |
| "User busy" on call | Phone on SIP trunk | Remove phone from trunk |
| Calls ring forever | Wrong SIP domain | Use `5t4n6j0wnrl.sip.livekit.cloud` |
| Business not found | Status = "onboarding" | Set status to "active" |
| No Retell connection | SIP trunk interfering | Use direct SIP dial (no trunk) |

## Working Configuration Checklist

- [ ] Phone number has webhook URL set
- [ ] Phone number is NOT on a SIP trunk
- [ ] Business status is "active"
- [ ] Retell agent ID is in `ai_config` table
- [ ] SIP domain is `5t4n6j0wnrl.sip.livekit.cloud`
- [ ] ngrok is running and URL matches `.env.local`
- [ ] Next.js dev server is running

---

*Document created: January 2025*
*Based on troubleshooting session for RaeZan business*
