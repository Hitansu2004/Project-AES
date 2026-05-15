# AES Customer Portal — Demo Guide

This guide is your "cheat sheet" while presenting the live demo. It tells
you, at a glance, *who is in what state*, *what to click*, and the exact
storyline to walk through every screen of the app.

> Companion files: [`DEMO_CREDENTIALS.md`](./DEMO_CREDENTIALS.md) (logins),
> [`aes-content-catalog.txt`](./aes-content-catalog.txt) (product / image
> reference), Flyway migration `V4__demo_reset.sql` (the seed itself).

---

## 1. The cast at a glance

### Customers (5)

| # | Name              | Phone           | Property                 | State                                                                                  |
|---|-------------------|-----------------|--------------------------|----------------------------------------------------------------------------------------|
| 1 | **Aarav Reddy**    | +91 9123 456789 | Villa #42 · Jubilee Hills | "Happy, loyal" — 4 ACs, AMC active, 2 closed tickets, AMC visit in 5 days, 1 quote pending |
| 2 | **Priya Sharma**   | +91 9223 456789 | Apartment 12B · Kondapur  | "Brand-new customer" — 0 ACs, just submitted INSTALL REQUEST 1 day ago (PENDING)        |
| 3 | **Karan Patel**    | +91 9323 456789 | iSprout Office · Hitech City | **🎯 LIVE-ESCALATION TARGET** — OPEN ticket P3 created 30 min ago, sitting at L1 (Ravi) |
| 4 | **Sneha Iyer**     | +91 9423 456789 | Adarsha Hospital · Madhapur | "Already-escalated" — IN_PROGRESS ticket P3 at L2 (Suresh), drain pump on order        |
| 5 | **Vikram Singh**   | +91 9523 456789 | Tabla Restaurant · Banjara Hills | "Power user" — VRF installed 2 weeks ago, AMC active, 1 closed ticket, 1 OPEN P1 ticket |

### Staff (5)

| Role               | Name           | Phone           | Inbox state on demo start                            |
|--------------------|----------------|-----------------|------------------------------------------------------|
| L1 — CRM Agent     | **Ravi Kumar**  | +91 9000 011111 | 1 unread: AES-2026-1102 (Karan)                       |
| L1 — CRM Agent     | **Lakshmi Nair**| +91 9000 022222 | 1 unread: AES-2026-1105 (Vikram)                      |
| L2 — Service Mgr   | **Suresh Babu** | +91 9000 033333 | 1 unread: AES-2026-1103 (Sneha — ICU escalation)      |
| L2 — Service Mgr   | **Deepa Iyer**  | +91 9000 044444 | **Empty** — receives the live escalation in step 5    |
| L3 — Admin / Mgmt  | **Anand Rao**   | +91 9000 055555 | Daily KPI digest                                      |

> All staff log in with phone + password. Customers log in with phone +
> OTP (use the universal bypass code `000000` so you don't need an SMS gateway).

---

## 2. The 6 service tickets you will see

| Ticket           | Customer | AC          | Priority    | Status        | Level | Assigned to   | Demo purpose                              |
|------------------|----------|-------------|-------------|---------------|-------|----------------|-------------------------------------------|
| AES-2026-1100    | Aarav    | Master Bed  | P1 AMC      | CLOSED · 5★   | L1    | Suresh         | History card on dashboard                 |
| AES-2026-1101    | Aarav    | Living Cass | P1 AMC      | CLOSED · 4★   | L2    | Suresh         | "Resolved with escalation" timeline       |
| **AES-2026-1102**| **Karan** | Workspace 1 | P3 PAID    | **OPEN**      | **L1**| **Ravi**       | **🎯 manually escalate live → L2**        |
| AES-2026-1103    | Sneha    | ICU duct    | P3 PAID     | IN_PROGRESS   | L2    | Suresh         | "Already at L2" UX, part order pending    |
| AES-2026-1104    | Vikram   | Cassette    | P2 WARRANTY | CLOSED · 5★   | L1    | Lakshmi        | History card                              |
| **AES-2026-1105**| Vikram   | VRF outdoor | P1 AMC     | OPEN          | L1    | Lakshmi        | Second open ticket (variety)               |

## 3. The 4 installation requests

| Request          | Customer | Equipment                     | Status         |
|------------------|----------|-------------------------------|----------------|
| INS-2026-2101    | Priya    | Daikin 1.5T 5★ Split          | **PENDING**    |
| INS-2026-2102    | Karan    | Hitachi 2.5T 5★ Cassette      | CONFIRMED      |
| INS-2026-2103    | Vikram   | Mitsubishi VRF + Cassette     | COMPLETED      |
| INS-2026-2104    | Aarav    | Mitsubishi 1.0T 5★ Split      | QUOTE_SENT     |

## 4. The 2 AMC contracts

| Contract         | Customer | Visits done | Next visit               |
|------------------|----------|-------------|--------------------------|
| AMC-2025-0001    | Aarav    | 2 / 4       | in 5 days  (morning)     |
| AMC-2026-0007    | Vikram   | 0 / 4       | in 76 days (afternoon)   |

---

## 5. Demo script — 6 acts (≈ 8 minutes)

Below is the recommended click-through. Open two browsers / tabs side-by-side:
**LEFT** = Customer phone view, **RIGHT** = Staff dashboard.

### Act 1 — "Brand-new customer raising a request" (Priya — 90 s)

1. **LEFT** Login as Priya (`+91 9223 456789` · OTP `000000`).
2. Land on dashboard — show the empty state with one notification badge.
3. Tap **Services → New Installation**.
4. Walk through the 5-step wizard:
   * Step 1 — pick **Residential**.
   * Step 2 — pick **Split AC** (notice the AES product photo).
   * Step 3 — pick **Daikin → 1.5T → 5★** (the rich model grid loads).
     Highlight: photos, prices, MRP/offer/EMI, brand logo, "Inverter" + "% OFF" badges.
   * Step 4 — Apartment 12B is auto-selected; add a Master Bedroom 180 sq.ft.
   * Step 5 — pick a date and slot, hit Submit.
5. Show the **Success** screen with the request number.

### Act 2 — "CRM agent picks up the request" (Ravi — 60 s)

1. **RIGHT** Login as Ravi (`+91 9000 011111` · `password123`).
2. Open `/crm` — the CRM dashboard already shows Priya's INS-2026-2101 in
   the inbox along with Karan's older confirmed request.
3. Open Priya's request → confirm → choose a site-visit slot.

### Act 3 — "Power user" (Vikram — 60 s)

Optional context-setter — login as Vikram and tour:
* Multiple ACs, VRF prominently shown
* AMC contract card with progress + next visit
* Closed ticket with 5★ history
* Open AES-2026-1105 ticket card (still awaiting acknowledgement)

### Act 4 — 🎯 **The live escalation** (Karan ↔ Ravi ↔ Suresh ↔ Deepa — 3 min)

This is the headline act. Two browser tabs.

1. **LEFT** Login as Karan (`+91 9323 456789` · OTP `000000`).
2. Open his ticket **AES-2026-1102** → show timeline (Raised + Auto-assigned to Ravi).
3. **RIGHT** As Ravi (CRM dashboard) — show the new ticket sitting in his
   "Awaiting acknowledgement" lane. **Do NOT acknowledge.**
4. **LEFT** From Karan's ticket detail, tap **Escalate** → choose "Manual
   escalation — L1 not responding". Submit.
5. Watch the WebSocket live update flip the ticket card on Ravi's screen
   instantly. The customer sees a new "Escalated to L2" timeline entry.
6. **RIGHT** Logout Ravi → login as **Deepa** (`+91 9000 044444`).
7. Deepa's inbox shows the freshly escalated ticket as an unread
   notification (the bell badge shows `1`).
8. Open the ticket — Deepa acknowledges, marks IN_PROGRESS, optionally
   resolves. The live update again flips on Karan's screen.

### Act 5 — "Already-escalated state" (Sneha ↔ Suresh — 60 s)

1. **LEFT** Login as Sneha (`+91 9423 456789`).
2. Show her notification feed — one read + one unread (escalation).
3. Open **AES-2026-1103** — full timeline already populated:
   `Raised → Acknowledged → Manually Escalated → On-site → Note added`.
4. **RIGHT** Switch to **Suresh** (`+91 9000 033333`) → he sees the same
   ticket on his L2 board with the linked part request highlighted.

### Act 6 — "Admin overview" (Anand — 30 s)

1. **RIGHT** Logout Suresh → login as Anand (`+91 9000 055555`).
2. Open `/admin` — the escalation dashboard.
3. KPIs live: **6** active tickets · **1** at L2 · **2** awaiting L1 ack ·
   **1** closed today.
4. The 3-column kanban shows AES-2026-1102 (or its escalated state),
   AES-2026-1103, AES-2026-1105 in their respective lanes.

---

## 6. Resetting between demos

The seed lives in a Flyway migration. To re-run it, drop the schema and
let Flyway re-create on the next backend boot:

```bash
psql -U aes_user -d aes_db -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
# then start the backend — V1, V2, V3, V4 will all replay
mvn -DskipTests spring-boot:run -f aes-backend/pom.xml
```

If you only want to reset transactional rows without dropping the whole
schema (faster), copy the `TRUNCATE … RESTART IDENTITY CASCADE` block
from `V4__demo_reset.sql` and run it manually, then re-execute the rest
of the file.

---

## 7. What "good" looks like during the demo

* Ticket SLA timers tick down in real time (WebSocket).
* Notification bell increments without a page refresh.
* Brand & Model cards on the install wizard render with photos + prices.
* Switching staff accounts shows different inboxes (no cross-leakage).
* The customer always sees their own ticket move through L1 → L2 → resolved.

If any of those misbehave during a demo, the most common fix is to
reset the data via section 6 above.
