# Nylas Full Integration Plan

## Overview

Replace custom booking UI and add new dashboard features powered by Nylas v3 APIs.
All features use the existing `nylas` SDK (v8) and the business's connected Nylas grant.

---

## New Sidebar Tabs

| Tab | Route | Icon | Purpose |
|-----|-------|------|---------|
| Inbox | `/inbox` | `Mail` | Read/send email via Nylas Messages API |
| Connections | `/connections` | `Plug` | Nylas OAuth, manage connected accounts |

Existing tabs modified:
- **Appointments** (`/appointments`) — show Nylas calendar events alongside local appointments
- **Settings > Calendar** — link to Nylas scheduler config, embed `<NylasSchedulerEditor>`

---

## 1. Connections Page (`/connections`)

**Route:** `app/(dashboard)/connections/page.tsx` + `connections-client.tsx`

**Features:**
- Show connected account status (email, provider, grant status)
- "Connect Google" / "Connect Microsoft" buttons — triggers Nylas hosted OAuth
- Disconnect button
- Shows which Nylas features are active (calendar, email, scheduler)
- Lists calendars from connected account

**Backend:** Uses existing `/api/calendar/nylas/auth` (POST) and `/api/dashboard/settings/calendar` (DELETE).

**New API:** `GET /api/dashboard/connections` — returns grant info + calendar list.

---

## 2. Inbox Page (`/inbox`)

**Route:** `app/(dashboard)/inbox/page.tsx` + `inbox-client.tsx`

**Features:**
- List recent emails (Nylas Messages API)
- Read email content (HTML rendered)
- Compose/send email
- Reply to emails
- Mark read/unread
- Basic folder filtering (Inbox, Sent, Drafts)

**New APIs:**
- `GET /api/dashboard/inbox` — list messages (with pagination, folder filter)
- `GET /api/dashboard/inbox/[id]` — get single message
- `POST /api/dashboard/inbox/send` — send email
- `PUT /api/dashboard/inbox/[id]` — mark read/unread

**Backend:** All use `nylas.messages.*` and `nylas.drafts.*` via grant ID.

---

## 3. Scheduler Integration

**Approach:** Use `@nylas/react` `<NylasScheduling>` component for the public booking page, and `<NylasSchedulerEditor>` in settings for configuration.

**Changes:**
- Re-add `@nylas/react` dependency
- Replace `components/scheduler/booking-page.tsx` with Nylas `<NylasScheduling>` wrapper
- Add scheduler config management APIs
- Settings > Calendar tab gets "Configure Scheduler" section

**New APIs:**
- `GET /api/dashboard/scheduler/configs` — list scheduler configurations
- `POST /api/dashboard/scheduler/configs` — create config
- `PUT /api/dashboard/scheduler/configs/[id]` — update config
- `DELETE /api/dashboard/scheduler/configs/[id]` — delete config

---

## 4. Appointments Enhancement

**Existing page** at `/appointments` — add tab to show Nylas calendar events directly.

**Changes:**
- Add "Calendar Events" sub-tab that fetches events from Nylas
- Show synced events with indicator
- Link between local appointments and Nylas events

**New API:** `GET /api/dashboard/calendar/events` — proxy to Nylas events list.

---

## File Structure (new files)

```
app/(dashboard)/
  connections/
    page.tsx
    connections-client.tsx
  inbox/
    page.tsx
    inbox-client.tsx
    [id]/
      page.tsx

app/api/dashboard/
  connections/
    route.ts
  inbox/
    route.ts
    send/route.ts
    [id]/route.ts
  scheduler/
    configs/
      route.ts
      [id]/route.ts
  calendar/
    events/route.ts

lib/nylas/
  messages.ts          (new - email operations)
  scheduler.ts         (new - scheduler config CRUD)

components/dashboard/
  sidebar.tsx          (modified - add Inbox, Connections)
```

---

## Implementation Order

1. `lib/nylas/messages.ts` + `lib/nylas/scheduler.ts` — core Nylas wrappers
2. API routes — all backend endpoints
3. Connections page — OAuth management UI
4. Inbox page — email UI
5. Scheduler integration — public booking + settings editor
6. Appointments enhancement — calendar events view
7. Sidebar updates
