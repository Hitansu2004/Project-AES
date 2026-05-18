# AES Customer Portal — Flow Map (simple, arrow-based)

> A companion to `PLAN.md`. Same logic, just drawn as step-by-step arrows and decision trees so anyone (designer, dev, AES stakeholder) can read it in two minutes.
>
> Legend:
> `→` = next step  `├─` `└─` = branch  `✓` = success path  `✗` = failure / decline  `⏱` = time-trigger  `🔔` = notification fires
>
> Roles (short):  **CUST**=Customer  **OPS**=Ops Manager (new)  **CRM**=CRM Agent (L1)  **ENG**=Site Engineer (new)  **SM**=Service Manager (L2)  **ADM**=Admin (L3)

---

## TABLE OF CONDITIONS

| #   | Condition                                                              |
| --- | ---------------------------------------------------------------------- |
| C1  | Existing customer raises a Service Ticket (P1 AMC)                     |
| C2  | Existing customer raises a Service Ticket (P2 Warranty)                |
| C3  | Existing customer raises a Service Ticket (P3 Paid — needs estimate)   |
| C4  | New customer wants a new Installation                                  |
| C5  | Existing customer wants an additional Installation                     |
| C6  | Scheduled AMC visit (no ticket — calendar-driven)                      |
| C7  | CRM accepts ticket and can solve it (normal happy path)                |
| C8  | CRM accepts but CANNOT solve → needs to escalate to SM                 |
| C9  | CRM declines the offer / 15-min timeout                                |
| C10 | Both CRMs are busy → OPS invites a CRM to take extra work              |
| C11 | OPS bypasses CRM and pushes straight to SM (rare)                      |
| C12 | Engineer accepts dispatch → completes job onsite                       |
| C13 | Engineer needs a spare part (Part Request + budget approval)           |
| C14 | Engineer is stuck → fires "Need Help" (T2 escalation)                  |
| C15 | Engineer can't attend (sick / vehicle issue)                           |
| C16 | Customer is unhappy → presses "Escalate" (T1)                          |
| C17 | SLA breach — auto-escalation ladder (T4)                               |
| C18 | Customer rates 1–2 stars → Re-open                                     |
| C19 | Customer reschedules a visit                                           |
| C20 | CRM ends shift mid-day → handoff                                       |
| C21 | Quote prep + approval (installation)                                   |
| C22 | Customer accepts / rejects / negotiates quote                          |
| C23 | High-budget installation → Admin sign-off                              |
| C24 | Same flow if pricing exceeds CRM/SM band → bumped up                   |

---

## THE BIG PICTURE (one tree for everything)

```
CUSTOMER ACTION
   ↓
[ Service Ticket ] ─┐
[ Installation   ] ─┼──→ OPS MANAGER (triage inbox)
[ AMC visit due  ] ─┘         ↓
                      ┌───────┴────────┬────────────────────┐
                      ↓                ↓                    ↓
                Direct assign     Invite (busy day)     Bypass to SM
                  to CRM             to CRM             (rare, P1 only)
                      ↓                ↓                    ↓
                CRM accepts?      CRM accepts?         SM accepts
                ├ ✓ → owns it    ├ ✓ → owns it             ↓
                └ ✗ → bounce     └ ✗ → bounce          handle directly
                      ↓                ↓
                CRM evaluates the ticket
                      ↓
              ┌───────┴────────┬────────────────┐
              ↓                ↓                ↓
        Can solve via      Needs onsite      Beyond skill /
        phone (rare)       engineer          customer dispute
              ↓                ↓                ↓
         Resolve         Dispatch ENG      Escalate to SM (T3)
                              ↓
                        ENG accepts?
                        ├ ✓ → EN_ROUTE → ON_SITE → IN_PROGRESS
                        └ ✗ → back to CRM, pick another
                              ↓
                  ┌───────────┼──────────────┐
                  ↓           ↓              ↓
              Fix onsite   Needs part   Stuck → "Need Help"
                  ↓           ↓              ↓
              RESOLVED   Part Request   SM joins / replaces ENG
                  ↓           ↓              ↓
            CUST notified  Approval band  …
                  ↓        (CRM/SM/ADM)
            CUST rates       ↓
            ├ 4-5⭐ → CLOSED  Part ordered → delivered
            └ 1-2⭐ → REOPEN     → ENG resumes → RESOLVED
```

Everything below is a zoom-in on one branch of this tree.

---

## C1 · Service Ticket — P1 AMC (covered, fast lane)

```
CUST taps "Service Request"
   → picks AC unit (AMC active)
   → picks problem + slot + photos
   → SUBMITS
   ↓
Ticket created  status=NEW  priority=P1  owner=NULL
   ↓
🔔 OPS Manager (Meera) gets a card in /ops triage inbox
   ↓
OPS reviews → picks CRM Lakshmi (low load) → "Assign"
   ↓
AssignmentOffer created  ⏱ 15-min accept window
🔔 CRM Lakshmi gets banner + toast
   ↓
   ├─ ✓ CRM accepts within 15 min
   │     → status=ACKNOWLEDGED  owner=Lakshmi
   │     → continue to C7 / C8
   │
   └─ ✗ CRM declines OR timer expires
         → offer EXPIRED
         → ticket bounces back to OPS inbox (red flag)
         → OPS picks another CRM  (see C9)
```

---

## C2 · Service Ticket — P2 Warranty

```
Same as C1, but priority=P2, final SLA = 8h
(No customer charge. Internal workflow identical.)
```

---

## C3 · Service Ticket — P3 Paid (customer must approve estimate)

```
CUST submits ticket  →  OPS triage  →  CRM accept
   ↓
CRM dispatches ENG (see C12)
   ↓
ENG diagnoses onsite
   ↓
ENG drafts ESTIMATE (₹ amount + reason)
   ↓
   ├─ ₹ ≤ 500     → auto-approved (visit charge only)
   ├─ ₹ 500–5k    → CRM approves internally
   ├─ ₹ 5k–50k    → SM approves internally
   └─ ₹ > 50k     → ADMIN approves internally
   ↓
Estimate "SENT" to CUST  → status=WAITING_CUSTOMER_APPROVAL
🔔 CUST sees Quote/Estimate viewer with Accept / Reject buttons
   ↓
   ├─ ✓ CUST Accepts → ENG proceeds → RESOLVED (see C12 tail)
   └─ ✗ CUST Rejects → status=CANCELLED  +  visit charge invoiced
```

---

## C4 · New Customer — First Installation

```
CUST signs up (OTP)
   → walks the 5-step install wizard (type/brand/rooms/slot)
   → SUBMITS
   ↓
InstallationRequest created  status=NEW  owner=NULL
   ↓
🔔 OPS Manager sees in /ops Install Inbox
   ↓
OPS assigns to CRM (or invites — same as C1)
   ↓
CRM accepts  → status=CONFIRMED  → calls CUST  → books Site Survey
   ↓
ENG visits site → measurements + photos → status=SITE_VISITED
   ↓
CRM (or Designer) drafts QUOTE      → see C21
   ↓
SM (or ADMIN if > ₹2L) approves     → status=QUOTE_SENT
🔔 CUST gets quote viewer
   ↓
CUST decision                       → see C22
   ├─ ✓ Accept    → status=QUOTE_ACCEPTED → OPS schedules install
   ├─ ⟲ Negotiate → CRM revises → re-approve → re-send
   └─ ✗ Reject    → status=CANCELLED
   ↓
OPS picks lead ENG + crew → ENG accepts (see C12 dispatch)
   ↓
status=INSTALLATION_SCHEDULED → IN_PROGRESS → COMPLETED
   ↓
ENG uploads commissioning photos + warranty card
   ↓
System AUTO-CREATES ac_unit rows + property record
   ↓
🔔 CUST sees handover card  +  AMC sign-up offer
```

---

## C5 · Existing Customer — Additional Installation

```
Same as C4, with two short-circuits:
   • Property is pre-selected (no new address)
   • If CUST has active AMC → 5% loyalty discount auto-applied on quote
```

---

## C6 · Scheduled AMC Visit (system-initiated, no ticket)

```
Cron job runs daily 7 AM
   → finds AMC visits with scheduled_date = today / tomorrow
   ↓
Each visit appears on OPS calendar
   ↓
OPS dispatches ENG for each visit (see C12 dispatch sub-flow)
   ↓
ENG accepts → arrives → performs maintenance
   ↓
ENG marks COMPLETED with checklist + photos
   ↓
amc_contract.visits_completed += 1
🔔 CUST gets "AMC visit done" notification + asked to rate
```

---

## C7 · CRM Accepts and CAN Solve (happy path — onsite fix needed)

```
CRM (owner) opens ticket
   ↓
CRM calls CUST → confirms problem + slot + ETA
   ↓
CRM opens "Engineer Picker" modal
   → filters: locality match, skill match, free slot today
   → picks ENG Rajesh
   ↓
DISPATCH OFFERED to Rajesh  ⏱ 10-min accept window
🔔 Rajesh's /engineer dashboard shows offer banner
   ↓
   ├─ ✓ Rajesh accepts → status=ASSIGNED  engineer_id=Rajesh
   │      → continue to C12
   │
   └─ ✗ Rajesh declines / timer expires
          → CRM picks another ENG
          → if no ENG free today → CRM reschedules with CUST
```

---

## C8 · CRM Accepts but CANNOT Solve (must escalate)

```
CRM opens ticket → realises it's complex (e.g. VRF chiller, hospital ICU,
                  customer threatening to cancel AMC, legal angle)
   ↓
CRM clicks "Escalate to L2"  with reason
   ↓
Trigger T3 (supervisor-initiated escalation)
   ↓
Ticket moves to SM inbox  status=ACKNOWLEDGED  owner=Suresh
   ↓
🔔 SM Suresh + CRM both get a confirmation
🔔 CUST sees: "Your case is now with our Service Manager Suresh"
   ↓
SM takes over → dispatches a SENIOR ENG OR handles personally (C12)
```

---

## C9 · CRM Declines / 15-min Timeout

```
AssignmentOffer status flips to DECLINED or EXPIRED
   ↓
Ticket goes back to OPS inbox with red flag
   ↓
OPS sees decline reason (if any)
   ↓
   ├─ Try next CRM (Invite mode — see C10)
   ├─ Bypass to SM (see C11)
   └─ Hold + call CUST personally (last resort)
```

---

## C10 · Both CRMs Are Busy — OPS Invites Extra Work

```
OPS opens /ops dashboard at 11 AM
   ↓
New P1 ticket arrives → both CRMs show RED workload (>6 active each)
   ↓
OPS picks Lakshmi → clicks "Invite to take extra"
   → adds note: "Aarav is a VIP, please squeeze in"
   ↓
AssignmentOffer (type=CRM_OWNER, mode=INVITE) created
🔔 Lakshmi gets a full-width "Help wanted" banner with Accept / Decline
   ↓
   ├─ ✓ Lakshmi accepts → ticket joins her active list
   │      → normal C7 from here
   │
   └─ ✗ Lakshmi declines (with reason)
          → OPS re-decides:
              ├─ Try Ravi instead
              ├─ Push to SM
              └─ Defer (if priority allows)
```

---

## C11 · OPS Bypasses Straight to SM (P1 only, ENG already booked)

```
OPS sees P1 ticket for which:
   • Both CRMs offline
   • OR specialist case (ICU, data centre)
   ↓
OPS clicks "Bypass to L2"
   ↓
Offer goes to next on-shift SM
   ↓
SM accepts → status=ACKNOWLEDGED  level=2  owner=Suresh
   ↓
SM dispatches senior ENG directly (skipping the CRM layer)
🔔 CUST sees: "Service Manager Suresh is handling your case"
```

---

## C12 · Engineer Dispatch & Onsite Job (the field worker journey)

```
DISPATCH OFFERED to ENG  ⏱ 10 min
   ↓
ENG sees in /engineer mobile dashboard
   ↓
   ├─ ✓ Accepts
   │      → status=ASSIGNED
   │      → ENG commits ETA (auto-derived from slot OR picks one)
   │      🔔 CUST sees: "Engineer Rajesh assigned. ETA 2:15 PM"
   │      ↓
   │   ENG taps "EN_ROUTE"     → CUST sees live status
   │   ENG taps "ON_SITE"      → on-site clock starts
   │   ENG taps "DIAGNOSING"
   │      ↓
   │      ├─ Fix onsite
   │      │     → ENG fills resolution notes + photos
   │      │     → ENG taps "RESOLVED"
   │      │     → status=RESOLVED
   │      │     🔔 CUST notified → asked to rate (see C18)
   │      │
   │      ├─ Needs part → C13
   │      │
   │      └─ Stuck → C14
   │
   └─ ✗ Declines / timer expires → back to CRM (see C7 tail)
```

---

## C13 · Part Request (with budget approval bands)

```
ENG onsite identifies missing part (e.g. capacitor, drain pump)
   ↓
ENG opens "Raise Part Request" form
   → part name, qty, urgency, vendor estimate (₹)
   → submits
   ↓
PartRequest created  status=PENDING_APPROVAL
ServiceTicket status flips to WAITING_PART
🔔 CUST sees: "Waiting for spare part — ETA shared shortly"
   ↓
Approval routing by cost:
   ├─ ≤ ₹5k    → CRM approves   (1-click on /crm)
   ├─ ₹5k–50k  → SM approves    (queue on /admin)
   └─ > ₹50k   → ADMIN approves (queue on /admin → admin-only band)
   ↓
   ├─ ✓ Approved → status=APPROVED → procurement places order
   │      ↓
   │   status=ORDERED  → DELIVERED → INSTALLED
   │      ↓
   │   ENG returns to site → resumes from IN_PROGRESS
   │      ↓
   │   ENG RESOLVES (see C12)
   │
   └─ ✗ Rejected → ENG informed → either alternative part OR
                  ENG escalates "Need Help" (C14)
```

---

## C14 · Engineer "Need Help" (T2 — engineer-initiated escalation)

```
ENG onsite hits a blocker:
   • Beyond his skill (e.g. junior ENG sent to a chiller)
   • Customer dispute / hostile
   • Safety concern (electrical / refrigerant leak)
   • Equipment beyond contract scope
   ↓
ENG taps "Need Help"  → picks reason  → optional photo / note
   ↓
🔔 Owner CRM gets notification
🔔 On-shift SM gets notification
   ↓
SM opens ticket on /admin → "Take Over" button
   ↓
SM decides:
   ├─ Send a SENIOR ENG → reassign engineer slot (see C7 picker)
   ├─ Handle personally (drive to site OR call CUST)
   └─ Cancel and reschedule with longer slot
   ↓
🔔 CUST sees: "A senior technician is being arranged"
```

---

## C15 · Engineer Can't Attend (sick / vehicle)

```
ENG opens his assigned job → taps "Cannot Attend" + reason
   ↓
status reverts: engineer_id=NULL  ticket back to ACKNOWLEDGED
🔔 Owner CRM gets alert
🔔 OPS Manager gets alert (so day's roster can be rebalanced)
   ↓
CRM picks another ENG (see C7 picker)
   ├─ ✓ Found → new dispatch offer → C12
   └─ ✗ No one free today → CRM reschedules with CUST + apologises
```

---

## C16 · Customer Escalates (T1 — customer-initiated)

```
CUST opens ticket → taps "Escalate"
   ↓
Reason picker:
   • Slow response  • Wrong diagnosis  • Engineer rude  • Other
   ↓
status flips → ESCALATED_BY_CUSTOMER
escalation_reason saved
   ↓
Ticket reappears at top of OPS inbox with RED flag
🔔 Owner CRM + OPS Manager both notified
   ↓
OPS reviews — three options:
   ├─ Reassign to different CRM   (offer flow as C1)
   ├─ Push to SM (T3 supervisor)  (status becomes L2)
   └─ Call CUST personally to defuse
   ↓
Whatever path → ticket gets a fresh owner with fresh ETA
🔔 CUST sees: "Your concern has been escalated. [Name] will call you within X min"

Rate-limit: 1 customer escalation per ticket per 24 h
```

---

## C17 · SLA Breach — Auto Ladder (T4)

```
⏱ Engine runs every 30s.

Stage A — Offer expiry (after 15 min from creation)
   Ticket still NEW OR no human accepted
      → AssignmentOffer EXPIRED
      → Ticket bounces back to OPS inbox (silent for CUST)
      → OPS gets red flag

Stage B — Still no owner 30 min after creation
   → Auto-escalate to SM inbox  status=ACKNOWLEDGED level=2
   🔔 CUST: "Connecting you to a senior team member for faster help"
   🔔 All on-shift SMs notified

Stage C — Final SLA breach (P1 4h, P2 8h, P3 24h)
   → ADMIN gets a "Needs Attention" card
   → Ticket OWNERSHIP DOES NOT MOVE (the team stays)
   🔔 CUST: "We apologise for the delay. Our management is now monitoring."

Stage D — 2× Final SLA exceeded
   → Admin dashboard CRITICAL banner
   → No further auto action (humans must intervene)
```

> The big change vs today: **L3 admin no longer becomes owner on breach.** They monitor. This keeps the team accountable instead of dumping every late ticket on management.

---

## C18 · Customer Rating (CSAT + auto-reopen)

```
ENG RESOLVED → CUST gets prompt "Rate your experience"
   ↓
   ├─ ★★★★★  or ★★★★    → status=CLOSED  →  CRM gets credit, KPI updated
   │
   ├─ ★★★   → status=CLOSED but flagged "Watch"
   │
   ├─ ★★    OR ★ → status=REOPENED
   │      → Same ticket reopens with new sub-activity
   │      → status=IN_PROGRESS  owner=original CRM
   │      → OPS Manager gets red flag
   │      → CRM must call CUST within 30 min
   │
   └─ No rating in 48h → auto-CLOSED (default 4★)
```

---

## C19 · Customer Reschedules

```
CUST opens ticket → taps "Reschedule" → picks new slot
   ↓
System checks ENG state:
   ├─ ENG already EN_ROUTE → BLOCKED → prompt: "Please call your engineer"
   │
   └─ Slot is later than now → request created
            ↓
         🔔 Owner CRM notified
         CRM accepts OR declines (because ENG's calendar moves)
            ├─ ✓ Accept → new slot saved, ENG calendar updated
            └─ ✗ Decline → CRM calls CUST to agree another slot
```

---

## C20 · CRM Ends Shift Mid-Day

```
CRM toggles "End Shift" in /account
   ↓
All her open tickets get tagged "PENDING_REASSIGNMENT"
   ↓
Each appears in OPS inbox as a small card
   ↓
OPS re-offers each (Assign or Invite — see C1/C10)
   ↓
No CUST-facing change — just owner field flips when re-accepted
🔔 CUST notified ONLY IF reassignment causes a slot change
```

---

## C21 · Quote Preparation (installation)

```
After SITE_VISITED:
   ↓
CRM / Designer opens Quote Builder
   → adds line items (equipment, brand, qty, unit price)
   → adds labour line items
   → discount? GST? margin?
   → preview total
   ↓
CRM clicks "Submit for Approval"   status=PENDING_APPROVAL
   ↓
Approval routing:
   ├─ Total ≤ ₹2L  → SM approval queue
   └─ Total > ₹2L  → ADMIN approval queue (see C23)
   ↓
Approver sees side-by-side: line items + margin %
   ├─ ✓ Approve   → status=APPROVED → CRM clicks "Send to Customer"
   └─ ✗ Reject    → status=REJECTED_INTERNAL → bounces to CRM with notes
                    → CRM revises → resubmit
```

---

## C22 · Customer Decision on Quote

```
🔔 CUST receives quote viewer link
   ↓
CUST opens — sees: equipment photos, prices, total, EMI option, valid-until date
   ↓
Three buttons:
   ├─ ✓ Accept     → status=CUSTOMER_ACCEPTED
   │                  → install moves to QUOTE_ACCEPTED
   │                  → OPS schedules install (see C4 tail)
   │
   ├─ ⟲ Negotiate  → text box + suggested change
   │                  → ticket back to CRM
   │                  → CRM revises (new quote version) → loop C21
   │
   └─ ✗ Reject     → status=CUSTOMER_REJECTED
                      → install status=CANCELLED
                      → CRM may call CUST to recover (post-mortem)
```

---

## C23 · High-Budget Installation — Admin Sign-off

```
Quote total > ₹2L
   ↓
After SM review (optional first-pass), routed to ADMIN
   ↓
ADMIN sees full BOM + margin + customer profile
   ↓
   ├─ ✓ Approve → as C21 tail (Send to Customer)
   ├─ ⟲ Send back with edits → CRM revises
   └─ ✗ Reject → CRM informed → CRM negotiates scope-down with CUST
```

---

## C24 · Any Spend Bumped Up the Bands

```
Pattern is the same everywhere:
   ENG / CRM proposes a spend (part, scope-change, extra labour)
   ↓
   ≤ band threshold (CRM)  → CRM approves
   ≤ band threshold (SM)   → SM approves
   > all bands             → ADMIN approves
   ↓
   No spend happens before approval — system blocks the "Order" action.
```

---

## QUICK CHEAT-SHEET (one-line answers)

| Question | Answer |
|---|---|
| Who is the FIRST staff member to see every new request? | **OPS Manager** (Meera) — in `/ops` triage inbox |
| Can a ticket skip OPS? | Only by AUTO SLA breach after 30 min unattended → goes to SM |
| Who picks the engineer? | **CRM** for normal cases, **SM** for escalated cases, **OPS** for AMC visits |
| Does engineer have to accept dispatch? | Yes — 10-min offer window |
| Does CRM have to accept assignment? | Yes — 15-min offer window |
| Who approves money? | CRM ≤ ₹5k, SM ≤ ₹50k (parts) / ≤ ₹2L (quotes), ADMIN above |
| Who can the CUSTOMER escalate to? | One button, system routes to OPS (T1) — OPS decides L2 push |
| When does ADMIN take ownership of a stuck ticket? | **Never automatically.** Admin monitors. Humans intervene. |
| What if CRM is unavailable? | OPS re-offers (C9), invites overload (C10), or bypasses to SM (C11) |
| What if engineer is unavailable? | "Cannot Attend" → CRM re-dispatches (C15) |
| What if customer wants to change slot? | Reschedule flow (C19) — blocked if engineer is already EN_ROUTE |
| What if part needed? | C13 — Part Request with budget approval band |

---

## NEXT STEP

Read this top-to-bottom (it's all the conditions). Once you say **"flow looks right"**, I will:
1. Lock the design.
2. Begin **Phase 1** of `PLAN.md` Section 12 (backend foundation: new roles, status=NEW on create, V7 migration, new SLA ladder).
3. Demo each phase to you before moving to the next.
