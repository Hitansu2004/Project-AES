<!--
════════════════════════════════════════════════════════════════════
  PROMPT FOR CLAUDE (copy everything between the dashed lines below
  and paste it to Claude when you want the Word document)
════════════════════════════════════════════════════════════════════

You are a professional technical writer. I will give you a Markdown
document that describes every workflow condition of a customer portal
built for Arial Engineering Services — an HVAC (air-conditioning)
company that installs, repairs and maintains AC units for homes and
businesses across India.

Please convert this document into a beautifully formatted Word
document with the following rules:

1.  COVER PAGE — Company name "Arial Engineering Services", subtitle
    "Customer Portal — Workflow & Process Flow Document", today's date,
    and a note "Confidential — Internal Use Only". Use navy blue as the
    primary accent colour throughout.

2.  TABLE OF CONTENTS — Auto-generated, linked.

3.  EACH CONDITION starts on a NEW PAGE. The condition number and
    title are a Heading 2 (navy, bold). Use a shaded box (light blue
    background) for the one-sentence "What this covers" summary.

4.  FLOW DIAGRAMS — Reproduce every ASCII diagram inside a monospace
    code block (Courier New, 10 pt, light grey background). Do NOT
    convert them to SmartArt or Word shapes — keep them exactly as
    shown so they are legible and printable.

5.  ROLE LEGEND — Place a small colour-coded table on the second page
    (after the intro) showing each role, their short code, and their
    responsibility. Use the colours:
       OPS = navy, CRM = teal, ENG = orange,
       SM = purple, ADM = dark red, CUST = green

6.  TYPOGRAPHY — Body text: Calibri 11 pt. Headings: Calibri bold.
    Line spacing: 1.15. Margins: 2.5 cm all sides.

7.  QUICK CHEAT-SHEET at the end — format as a clean 2-column table
    with alternating row shading.

8.  Do NOT add extra explanatory text that is not already in the
    document. Keep it faithful to the source.

Here is the source document:
════════════════════════════════════════════════════════════════════
-->

---

# Arial Engineering Services
## Customer Portal — Workflow & Process Flow Document

**Version:** 1.0  
**Status:** Internal — Confidential  
**Prepared for:** AES Management & Product Team

---

## About This Document

This document describes every workflow condition in the Arial Engineering Services Customer Portal — from the moment a customer raises a request to the moment their case is fully resolved. It covers service tickets, new AC installations, engineer dispatch, parts approval, escalations, and billing.

**How to read it:** Each condition (C1–C24) is a self-contained scenario. Read them in order for the full picture, or jump directly to the condition relevant to you.

---

## Role Reference

| Code | Full Role | Who They Are |
|------|-----------|--------------|
| **CUST** | Customer | The end-user who raises requests via the app |
| **OPS** | Ops Manager | First point of contact for all incoming requests. Assigns and monitors all work. |
| **CRM** | CRM Agent (L1) | Level-1 support. Owns the ticket, dispatches engineers, and approves small spends. |
| **ENG** | Site Engineer | Field technician who physically visits the customer site. |
| **SM** | Service Manager (L2) | Senior escalation point. Handles complex cases, approves mid-range spends. |
| **ADM** | Admin (L3) | Business owner / management. Approves high-value spend. Monitors critical issues. |

---

## The Big Picture

Every request — whether a service ticket, a new installation, or a scheduled AMC visit — flows through the same master tree:

```
CUSTOMER ACTION
   │
   ├── Service Ticket ──┐
   ├── New Installation ─┼──► OPS MANAGER (triage inbox)
   └── AMC Visit Due   ──┘         │
                              ┌────┴────────┬────────────────────┐
                              │             │                    │
                              ▼             ▼                    ▼
                        Direct assign  Invite (busy day)   Bypass to SM
                          to CRM          to CRM            (rare, P1)
                              │             │                    │
                              ▼             ▼                    ▼
                        CRM accepts?   CRM accepts?        SM accepts
                        ├─ ✓ owns it  ├─ ✓ owns it              │
                        └─ ✗ bounce   └─ ✗ bounce           handles it
                              │             │
                              └──────┬──────┘
                                     ▼
                             CRM evaluates ticket
                                     │
                      ┌──────────────┼─────────────────┐
                      │              │                  │
                      ▼              ▼                  ▼
               Phone resolve    Onsite needed    Beyond skill /
               (rare)                            dispute
                      │              │                  │
                      ▼              ▼                  ▼
                  RESOLVED    Dispatch Engineer   Escalate to SM
                                     │
                               ENG accepts?
                               ├─ ✓ → EN_ROUTE → ON_SITE → IN_PROGRESS
                               └─ ✗ → CRM picks another
                                     │
                         ┌───────────┼──────────────┐
                         │           │              │
                         ▼           ▼              ▼
                     Fix onsite  Needs part    ENG stuck
                         │           │              │
                         ▼           ▼              ▼
                     RESOLVED   Part Request    SM joins
                         │      (approval)
                         ▼
                   Customer rates
                   ├─ 4-5 ★ → CLOSED
                   └─ 1-2 ★ → REOPENED
```

---

<!-- ═══════════════════════════════════ PAGE BREAK ════════════════════════════════════ -->

---

## C1 · Service Ticket — P1 AMC (Priority 1, Fully Covered)

**What this covers:** An existing customer with an active Annual Maintenance Contract (AMC) raises a service request. This is the highest-priority ticket with a 4-hour SLA. There is no cost to the customer.

```
CUSTOMER taps "Service Request"
   │
   ├── Selects AC unit (AMC active on that unit)
   ├── Picks problem type + preferred slot + optional photos
   └── Submits
          │
          ▼
Ticket CREATED — Status: NEW · Priority: P1 · Owner: unassigned
          │
          ▼ 🔔 OPS Manager (Meera) sees new card in triage inbox
          │
OPS reviews ticket
   └── Picks CRM Lakshmi (lightest workload) → clicks "Assign"
          │
          ▼
Assignment Offer sent to CRM Lakshmi ⏱ 15-minute accept window
          │
   🔔 Lakshmi receives banner + notification
          │
          ├─ ✓ Lakshmi ACCEPTS within 15 min
          │       └── Status → ACKNOWLEDGED · Owner = Lakshmi
          │       └── Continue to C7 (normal handling) or C8 (escalation)
          │
          └─ ✗ Lakshmi DECLINES or timer expires
                  └── Offer status → EXPIRED
                  └── Ticket returns to OPS inbox with red flag
                  └── OPS picks another CRM (see C9)
```

---

<!-- ═══════════════════════════════════ PAGE BREAK ════════════════════════════════════ -->

---

## C2 · Service Ticket — P2 Warranty (Priority 2, Under Warranty)

**What this covers:** A customer whose AC unit is within the manufacturer warranty period raises a service request. Labour is free; manufacturing defects are covered. SLA is 8 hours.

```
Workflow is identical to C1, with two differences:

   Priority = P2     (8-hour SLA instead of 4-hour)
   Cost to customer = ₹0 for labour / defect repair
                      (external damage billed separately, with quote)

OPS → CRM Assignment Offer → Accept / Decline → C7 or C8
(Same steps as C1)
```

---

<!-- ═══════════════════════════════════ PAGE BREAK ════════════════════════════════════ -->

---

## C3 · Service Ticket — P3 Paid Service (Estimate Required)

**What this covers:** A customer out of AMC/warranty raises a paid service ticket. The engineer must diagnose first and provide an estimate that the customer must approve before any work is billed.

```
CUSTOMER submits ticket (P3 - Paid) → OPS triage → CRM accepts
          │
          ▼
CRM dispatches Engineer (see C12)
          │
          ▼
ENG visits site → DIAGNOSES the problem
          │
          ▼
ENG drafts ESTIMATE (₹ amount + description of work)
          │
   Internal approval by cost band:
          ├─ ₹0 – 500     → Auto-approved (visit charge only)
          ├─ ₹500 – 5,000 → CRM approves internally (1 click)
          ├─ ₹5,000 – 50k → Service Manager approves
          └─ Above ₹50k   → Admin approves
          │
          ▼
Estimate sent to CUSTOMER — Status: WAITING_CUSTOMER_APPROVAL
          │
   🔔 Customer sees quote viewer with Accept / Reject buttons
          │
          ├─ ✓ CUSTOMER ACCEPTS
          │       └── ENG proceeds with repair
          │       └── Status → RESOLVED (see C12 tail)
          │
          └─ ✗ CUSTOMER REJECTS
                  └── Status → CANCELLED
                  └── Visit charge (₹299) is invoiced
```

---

<!-- ═══════════════════════════════════ PAGE BREAK ════════════════════════════════════ -->

---

## C4 · New Customer — First AC Installation

**What this covers:** A brand-new customer signs up and requests an AC installation. This triggers a multi-step journey: site survey → quote → approval → installation.

```
NEW CUSTOMER signs up via OTP
   │
   └── Completes 5-step Installation Wizard:
          Step 1 — AC type (Split / Central / VRF)
          Step 2 — Brand preference
          Step 3 — Number of rooms / units
          Step 4 — Preferred slot
          Step 5 — Address & property details
          │
          ▼
Installation Request CREATED — Status: NEW · Owner: unassigned
          │
   🔔 OPS Manager sees it in /ops Install Inbox
          │
OPS assigns to CRM (same offer flow as C1)
          │
          ▼
CRM ACCEPTS → Status: CONFIRMED
   └── CRM calls customer to confirm details
   └── Books SITE SURVEY slot
          │
          ▼
ENGINEER visits site
   └── Takes measurements + photos
   └── Status → SITE_VISITED
          │
          ▼
CRM / Designer builds QUOTE (see C21)
          │
   Internal approval:
          ├─ Total ≤ ₹2 Lakh → Service Manager approves
          └─ Total > ₹2 Lakh → Admin approves (see C23)
          │
          ▼
Status → QUOTE_SENT
   🔔 Customer receives quote viewer
          │
   Customer decision (see C22):
          ├─ ✓ Accept    → Status: QUOTE_ACCEPTED → Schedule install
          ├─ ⟲ Negotiate → CRM revises quote → loop back
          └─ ✗ Reject    → Status: CANCELLED
          │
          ▼ (if accepted)
OPS picks lead Engineer + crew → Dispatch offer (see C12)
          │
          ▼
Status: INSTALLATION_SCHEDULED → IN_PROGRESS → COMPLETED
          │
ENG uploads: commissioning photos + warranty card
          │
System AUTO-CREATES:
   └── AC unit records linked to customer's property
   └── Warranty entry starts from today
          │
   🔔 Customer sees handover summary + AMC sign-up offer
```

---

<!-- ═══════════════════════════════════ PAGE BREAK ════════════════════════════════════ -->

---

## C5 · Existing Customer — Additional Installation

**What this covers:** A returning customer who already has a property on file requests another AC installation (e.g., a new room or additional unit).

```
Same as C4, with two short-circuits:

   1. Property is pre-selected — no new address entry needed.

   2. If customer has an ACTIVE AMC:
         └── 5% loyalty discount is auto-applied to the quote.

All other steps (site survey → quote → approval → install) are identical to C4.
```

---

<!-- ═══════════════════════════════════ PAGE BREAK ════════════════════════════════════ -->

---

## C6 · Scheduled AMC Visit (System-Initiated, No Customer Action)

**What this covers:** Quarterly / scheduled maintenance visits that are part of the customer's AMC contract. These are generated automatically by the system — the customer does not need to raise a ticket.

```
Automated job runs daily at 7:00 AM
   │
   └── Finds all AMC visits scheduled for TODAY or TOMORROW
          │
          ▼
Each visit appears on OPS Manager's calendar view
          │
OPS dispatches an Engineer for each visit (see C12 dispatch)
          │
          ▼
ENGINEER ACCEPTS → arrives at site → performs maintenance
   └── Follows AMC checklist
   └── Takes before/after photos
   └── Marks job COMPLETED
          │
          ▼
System updates: amc_contract.visits_completed + 1
          │
   🔔 Customer receives "AMC visit completed" notification
   🔔 Customer is prompted to rate the service
```

---

<!-- ═══════════════════════════════════ PAGE BREAK ════════════════════════════════════ -->

---

## C7 · CRM Accepts and CAN Handle the Ticket (Normal Happy Path)

**What this covers:** CRM owns the ticket, evaluates it, and dispatches an onsite engineer to fix the problem.

```
CRM (owner) opens ticket
   │
   └── Calls customer → confirms problem + preferred arrival time
          │
          ▼
CRM opens "Engineer Picker" panel
   └── System filters by:
          Locality match (engineer near customer area)
          Skill match (e.g., VRF-certified for VRF units)
          Available slot today
   └── CRM selects Engineer Rajesh
          │
          ▼
DISPATCH OFFER sent to Rajesh ⏱ 10-minute accept window
          │
   🔔 Rajesh's dashboard shows offer banner
          │
          ├─ ✓ Rajesh ACCEPTS
          │       └── Status → ASSIGNED · engineer_id = Rajesh
          │       └── Continue to C12 (field job journey)
          │
          └─ ✗ Rajesh DECLINES or timer expires
                  └── CRM picks another available engineer
                  └── If no engineer free today:
                         CRM reschedules with customer and apologises
```

---

<!-- ═══════════════════════════════════ PAGE BREAK ════════════════════════════════════ -->

---

## C8 · CRM Accepts but CANNOT Solve (Escalation to Service Manager)

**What this covers:** CRM takes ownership of a ticket but realises it is beyond their capability or has a sensitive dimension (VIP customer, legal concern, specialist equipment). They escalate to a Service Manager (L2).

```
CRM opens ticket → identifies complexity:
   Examples:
      • VRF chiller system requiring specialist certification
      • Hospital ICU environment — safety-critical
      • Customer threatening legal action / to cancel AMC contract
      • Technical scope clearly outside CRM training
          │
          ▼
CRM clicks "Escalate to L2" → enters reason
          │
          ▼
Escalation Trigger T3 (supervisor-initiated) fires
          │
Ticket moves to SERVICE MANAGER inbox
   └── Status: ACKNOWLEDGED · Level: 2 · Owner: Service Manager Suresh
          │
   🔔 Service Manager Suresh notified
   🔔 CRM Lakshmi gets confirmation (stays as watcher)
   🔔 Customer sees: "Your case is now with our Service Manager Suresh"
          │
          ▼
SM Suresh takes over
   └── Dispatches a Senior Engineer (see C12) OR handles personally
```

---

<!-- ═══════════════════════════════════ PAGE BREAK ════════════════════════════════════ -->

---

## C9 · CRM Declines the Offer or 15-Minute Timer Expires

**What this covers:** When the CRM agent declines the assignment or doesn't respond in time, OPS must re-route the ticket.

```
Assignment Offer status flips to DECLINED or EXPIRED
          │
          ▼
Ticket returns to OPS inbox with a red warning flag
          │
OPS reviews the decline reason (if provided)
          │
          ├─ Option A — Try a different CRM
          │       └── New offer sent (same flow as C1)
          │
          ├─ Option B — Invite a busy CRM to take extra work
          │       └── See C10 (Invite mode)
          │
          └─ Option C — Bypass CRM, push directly to Service Manager
                  └── See C11 (Bypass to L2)
```

---

<!-- ═══════════════════════════════════ PAGE BREAK ════════════════════════════════════ -->

---

## C10 · Both CRMs Are Busy — OPS Invites Extra Work

**What this covers:** A new high-priority ticket arrives but all CRM agents are already at capacity. OPS can "invite" an overloaded CRM to take on an extra ticket — the CRM has the right to accept or decline.

```
OPS opens dashboard at 11:00 AM
   │
   └── New P1 ticket arrives
   └── All CRM agents show RED workload (more than 6 active tickets each)
          │
          ▼
OPS selects CRM Lakshmi → clicks "Invite to take extra"
   └── Adds note: "This customer is a VIP — please squeeze in"
          │
          ▼
Assignment Offer (type = INVITE) sent to Lakshmi
          │
   🔔 Lakshmi receives full-width "Help wanted" banner with Accept / Decline
          │
          ├─ ✓ Lakshmi ACCEPTS
          │       └── Ticket joins her active list
          │       └── Continue from C7 (normal handling)
          │
          └─ ✗ Lakshmi DECLINES (with reason)
                  OPS re-decides:
                  ├─ Try CRM Ravi instead
                  ├─ Push to Service Manager (C11)
                  └─ Defer (if priority and time allow)
```

---

<!-- ═══════════════════════════════════ PAGE BREAK ════════════════════════════════════ -->

---

## C11 · OPS Bypasses CRM — Direct to Service Manager (Rare)

**What this covers:** In rare situations (all CRMs offline, or a specialist case), OPS skips the CRM layer entirely and sends the ticket straight to the Service Manager.

```
OPS identifies a ticket where:
   • Both CRMs are offline / off-shift, OR
   • Case is clearly specialist (ICU unit, data centre, VIP enterprise)
          │
          ▼
OPS clicks "Bypass to L2" on the ticket
          │
          ▼
Offer goes directly to the on-shift Service Manager
          │
SM ACCEPTS → Status: ACKNOWLEDGED · Level: 2 · Owner: Suresh
          │
SM dispatches a Senior Engineer directly
   └── Skips the CRM layer entirely for this ticket
          │
   🔔 Customer sees: "Service Manager Suresh is personally handling your case"
```

---

<!-- ═══════════════════════════════════ PAGE BREAK ════════════════════════════════════ -->

---

## C12 · Engineer Dispatch & Onsite Job (Field Worker Journey)

**What this covers:** The complete journey from the moment a dispatch offer is sent to the engineer, through to job resolution onsite.

```
DISPATCH OFFER sent to Engineer ⏱ 10-minute accept window
          │
ENG sees offer on /engineer mobile dashboard
          │
          ├─ ✓ ENG ACCEPTS
          │       │
          │       ▼
          │   Status → ASSIGNED
          │   ENG sets or confirms ETA
          │       │
          │   🔔 Customer sees: "Engineer Rajesh assigned. ETA 2:15 PM"
          │       │
          │   ┌───┴────────────────────────────────────────┐
          │   │           ENG STATUS JOURNEY               │
          │   │  ENG taps "EN_ROUTE"  → customer sees live │
          │   │  ENG taps "ON_SITE"   → on-site clock starts│
          │   │  ENG taps "DIAGNOSING"                     │
          │   └───┬────────────────────────────────────────┘
          │       │
          │       ├─ FIX SUCCESSFUL ONSITE
          │       │       └── ENG fills resolution notes + photos
          │       │       └── ENG taps "RESOLVED"
          │       │       └── Status → RESOLVED
          │       │       └── 🔔 Customer notified → asked to rate
          │       │       └── Continue to C18 (rating)
          │       │
          │       ├─ NEEDS A SPARE PART
          │       │       └── Continue to C13 (Part Request)
          │       │
          │       └─ ENGINEER STUCK / NEEDS HELP
          │               └── Continue to C14 (Escalation T2)
          │
          └─ ✗ ENG DECLINES or timer expires
                  └── Returns to CRM → CRM picks another engineer
```

---

<!-- ═══════════════════════════════════ PAGE BREAK ════════════════════════════════════ -->

---

## C13 · Spare Part Request (With Budget Approval Bands)

**What this covers:** The engineer identifies a missing or failed part that must be procured before the job can be completed. Every spend must go through an approval band before anything is ordered.

```
ENG onsite identifies faulty part (e.g. capacitor, drain pump, relay)
          │
          ▼
ENG opens "Raise Part Request" form
   └── Fills: part name · quantity · urgency level · vendor estimate (₹)
   └── Adds notes (e.g. "Coil corrosion — Pune stock available")
   └── Submits
          │
          ▼
Part Request CREATED — Status: PENDING_APPROVAL
Service Ticket status → WAITING_PART
          │
   🔔 Customer sees: "Waiting for a spare part — ETA will be shared shortly"
          │
APPROVAL ROUTING by estimated cost:
          │
          ├─ ₹0 – 5,000        → CRM approves (1-click in /crm dashboard)
          ├─ ₹5,000 – 50,000   → Service Manager approves
          └─ Above ₹50,000     → Admin approves
          │
          ├─ ✓ APPROVED
          │       └── Status → APPROVED → procurement places order
          │       └── Status: ORDERED → DELIVERED → INSTALLED
          │       └── ENG returns to site → resumes from IN_PROGRESS
          │       └── ENG RESOLVES (see C12)
          │
          └─ ✗ REJECTED
                  └── ENG informed with reason
                  └── Options:
                         ├─ Try an alternative part (re-submit)
                         └─ ENG fires "Need Help" (see C14)
```

---

<!-- ═══════════════════════════════════ PAGE BREAK ════════════════════════════════════ -->

---

## C14 · Engineer "Need Help" — T2 Escalation (Engineer-Initiated)

**What this covers:** The engineer is blocked onsite and cannot continue without senior support. This escalation is initiated by the engineer, not the customer.

```
ENG encounters a blocker onsite:
   Examples:
      • Problem is beyond engineer's certification (e.g. chiller system)
      • Customer is hostile or threatening
      • Safety concern — refrigerant leak, electrical hazard
      • Equipment is outside the scope of the service contract
          │
          ▼
ENG taps "Need Help" in the app
   └── Selects reason from list
   └── Optionally adds photo + note
          │
          ▼
   🔔 Owner CRM notified immediately
   🔔 On-shift Service Manager notified immediately
          │
          ▼
SM opens ticket → sees "Take Over" button
          │
SM DECIDES:
          ├─ Send a SENIOR ENGINEER
          │       └── Reassign engineer slot (see C7 picker)
          │
          ├─ Handle PERSONALLY
          │       └── SM drives to site OR calls customer directly
          │
          └─ CANCEL & RESCHEDULE with a longer time slot
          │
   🔔 Customer sees: "A senior technician is being arranged for you"
```

---

<!-- ═══════════════════════════════════ PAGE BREAK ════════════════════════════════════ -->

---

## C15 · Engineer Cannot Attend (Sick / Vehicle Breakdown)

**What this covers:** An assigned engineer becomes unavailable before they reach the site. The system must reroute to another available engineer.

```
ENG opens his assigned job → taps "Cannot Attend"
   └── Enters reason (sick / vehicle issue / emergency)
          │
          ▼
System updates ticket:
   └── engineer_id → NULL
   └── Status reverts to ACKNOWLEDGED
          │
   🔔 Owner CRM alerted immediately
   🔔 OPS Manager alerted (to rebalance the day's roster)
          │
          ▼
CRM opens Engineer Picker → selects next available engineer
          │
          ├─ ✓ Engineer found
          │       └── New dispatch offer sent → continue C12
          │
          └─ ✗ No engineer available today
                  └── CRM reschedules with customer
                  └── CRM apologises and offers next available slot
```

---

<!-- ═══════════════════════════════════ PAGE BREAK ════════════════════════════════════ -->

---

## C16 · Customer Escalates — T1 (Customer-Initiated)

**What this covers:** The customer is unhappy with how their ticket is being handled and presses "Escalate" in the app. They get one escalation per ticket per 24 hours.

```
CUSTOMER opens their ticket → taps "Escalate"
          │
          ▼
Reason picker appears:
   └── Slow response · Wrong diagnosis · Engineer was rude · Other
          │
          ▼
Status → ESCALATED_BY_CUSTOMER
Escalation reason saved to ticket
          │
Ticket moves to TOP of OPS inbox with RED flag
          │
   🔔 Owner CRM notified
   🔔 OPS Manager notified
          │
          ▼
OPS reviews the complaint — three options:
          │
          ├─ Option A — Reassign to a DIFFERENT CRM
          │       └── New assignment offer (same as C1)
          │
          ├─ Option B — Push to SERVICE MANAGER (T3)
          │       └── Status → Level 2
          │
          └─ Option C — OPS calls customer PERSONALLY to resolve
          │
Whatever path is chosen:
   └── Ticket gets a fresh owner with a committed ETA
          │
   🔔 Customer sees: "Your concern has been escalated.
                      [Name] will call you within X minutes."

Note: Maximum 1 escalation per ticket per 24-hour window.
```

---

<!-- ═══════════════════════════════════ PAGE BREAK ════════════════════════════════════ -->

---

## C17 · SLA Breach — Automatic Escalation Ladder (T4)

**What this covers:** If no human acts on a ticket in time, the system automatically escalates through four stages. This protects customers from falling through the cracks.

```
⏱ Escalation engine checks every 30 seconds.

┌──────────────────────────────────────────────────────────────┐
│  STAGE A — Offer Expiry (15 minutes after ticket creation)   │
│                                                              │
│  Condition: Ticket still NEW · No human has accepted         │
│  Action:    AssignmentOffer → EXPIRED                        │
│             Ticket bounces back to OPS inbox (red flag)      │
│             Customer: no visible change yet                  │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  STAGE B — No Owner 30 Minutes After Creation                │
│                                                              │
│  Condition: Still no CRM owner 30 min after creation         │
│  Action:    Auto-escalate to Service Manager inbox           │
│             Status: ACKNOWLEDGED · Level: 2                  │
│  🔔 Customer: "Connecting you to a senior team member"       │
│  🔔 All on-shift Service Managers notified                   │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  STAGE C — Final SLA Deadline Breached                       │
│                                                              │
│  P1 AMC = 4 hours · P2 Warranty = 8 hours · P3 Paid = 24h  │
│                                                              │
│  Action:    Admin sees "Needs Attention" card on dashboard   │
│             Ticket ownership does NOT change (team stays)    │
│  🔔 Customer: "We apologise for the delay. Our management    │
│               is now monitoring your case."                  │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  STAGE D — 2× Final SLA Exceeded                             │
│                                                              │
│  Action:    Admin dashboard shows CRITICAL banner            │
│             No further automatic action — humans must act    │
└──────────────────────────────────────────────────────────────┘

Important: Admin does NOT take over ownership automatically.
           They monitor. The responsible team remains accountable.
```

---

<!-- ═══════════════════════════════════ PAGE BREAK ════════════════════════════════════ -->

---

## C18 · Customer Rating — CSAT & Auto-Reopen

**What this covers:** After a job is resolved, the customer is invited to rate. Low ratings automatically reopen the ticket.

```
Engineer marks job RESOLVED
          │
   🔔 Customer receives "Rate your experience" prompt
          │
          ├─ ★★★★★ or ★★★★  (4–5 stars)
          │       └── Status → CLOSED
          │       └── CRM agent earns credit · KPI updated
          │
          ├─ ★★★  (3 stars)
          │       └── Status → CLOSED (flagged as "Watch")
          │       └── CRM team reviews at end of day
          │
          ├─ ★★ or ★  (1–2 stars)
          │       └── Status → REOPENED (same ticket, new activity)
          │       └── Status → IN_PROGRESS · Owner = original CRM
          │       └── OPS Manager receives red flag
          │       └── CRM must call customer within 30 minutes
          │
          └─ No rating in 48 hours
                  └── Auto-CLOSED with default 4-star rating applied
```

---

<!-- ═══════════════════════════════════ PAGE BREAK ════════════════════════════════════ -->

---

## C19 · Customer Reschedules a Visit

**What this covers:** The customer changes their mind about the visit time after a ticket has been raised and an engineer may already be assigned.

```
CUSTOMER opens ticket → taps "Reschedule" → selects a new slot
          │
System checks engineer status:
          │
          ├─ Engineer already EN_ROUTE
          │       └── BLOCKED — customer cannot reschedule now
          │       └── Prompt: "Please call your engineer directly to rearrange"
          │
          └─ New slot is in the future / engineer not yet dispatched
                  │
                  ▼
          Reschedule request created
                  │
          🔔 Owner CRM notified
                  │
          CRM reviews and decides:
                  │
                  ├─ ✓ CRM ACCEPTS reschedule
                  │       └── New slot saved
                  │       └── Engineer's calendar updated
                  │
                  └─ ✗ CRM DECLINES (engineer not available that slot)
                          └── CRM calls customer to agree on another time
```

---

<!-- ═══════════════════════════════════ PAGE BREAK ════════════════════════════════════ -->

---

## C20 · CRM Ends Shift Mid-Day (Handoff)

**What this covers:** A CRM agent leaves for the day mid-shift. All their open tickets must be handed to another agent without affecting the customer experience.

```
CRM toggles "End Shift" in their account
          │
          ▼
All open tickets owned by this CRM → tagged PENDING_REASSIGNMENT
          │
          ▼
Each ticket appears as a card in OPS Manager's inbox
          │
OPS re-offers each ticket (Assign or Invite — same as C1 / C10)
          │
New CRM accepts → Owner field updated on the ticket
          │
Customer impact:
   └── No visible change UNLESS the reassignment causes a slot change
   └── 🔔 Customer notified ONLY if their scheduled visit time changes
```

---

<!-- ═══════════════════════════════════ PAGE BREAK ════════════════════════════════════ -->

---

## C21 · Quote Preparation (Installation Projects)

**What this covers:** After the site survey, a CRM agent or designer builds a detailed quote for the installation and submits it for internal approval before sending it to the customer.

```
After SITE_VISITED status is confirmed:
          │
          ▼
CRM / Designer opens Quote Builder
   └── Adds line items:
          Equipment (brand, model, qty, unit price)
          Labour charges
          Any applicable discounts
          GST calculation
          Margin %
   └── Previews total
          │
          ▼
CRM clicks "Submit for Approval" — Status: PENDING_APPROVAL
          │
Approval routing by total quote value:
          │
          ├─ Total ≤ ₹2,00,000  → Service Manager approval queue
          └─ Total > ₹2,00,000  → Admin approval queue (see C23)
          │
          ▼
Approver reviews: line items + margin % side-by-side
          │
          ├─ ✓ APPROVED
          │       └── Status → APPROVED
          │       └── CRM clicks "Send to Customer"
          │
          └─ ✗ REJECTED INTERNALLY
                  └── Status → REJECTED_INTERNAL
                  └── Returns to CRM with reviewer notes
                  └── CRM revises and resubmits (loop)
```

---

<!-- ═══════════════════════════════════ PAGE BREAK ════════════════════════════════════ -->

---

## C22 · Customer Decision on Quote

**What this covers:** The customer reviews the quote and either accepts, negotiates, or rejects it.

```
🔔 Customer receives quote viewer link via notification
          │
          ▼
Customer opens quote — sees:
   └── Equipment photos · Specifications · Pricing breakdown
   └── Total amount · EMI option (if available)
   └── Quote valid-until date
          │
Three response options:
          │
          ├─ ✓ ACCEPT
          │       └── Status → CUSTOMER_ACCEPTED
          │       └── Installation moves to QUOTE_ACCEPTED
          │       └── OPS schedules the installation (see C4 tail)
          │
          ├─ ⟲ NEGOTIATE
          │       └── Customer enters: text note + suggested change
          │       └── Ticket returns to CRM
          │       └── CRM revises (creates new quote version)
          │       └── Loop back to C21 for re-approval
          │
          └─ ✗ REJECT
                  └── Status → CUSTOMER_REJECTED
                  └── Installation → CANCELLED
                  └── CRM may call customer to understand reason
                      (post-mortem opportunity to recover the sale)
```

---

<!-- ═══════════════════════════════════ PAGE BREAK ════════════════════════════════════ -->

---

## C23 · High-Budget Installation — Admin Sign-Off

**What this covers:** When a quote exceeds ₹2 Lakhs, it requires Admin (management) approval before it can be sent to the customer. The Service Manager may also review first.

```
Quote total > ₹2,00,000
          │
          ▼
Optional: Service Manager does a first-pass review
          │
          ▼
Routed to ADMIN approval queue
          │
Admin sees full details:
   └── Complete Bill of Materials (BOM)
   └── Margin percentage
   └── Customer profile (history, loyalty, AMC status)
          │
          ├─ ✓ ADMIN APPROVES
          │       └── Continue as C21 tail → Send to Customer
          │
          ├─ ⟲ SEND BACK WITH EDITS
          │       └── Admin adds notes / revised margin target
          │       └── CRM revises quote → resubmits
          │
          └─ ✗ ADMIN REJECTS
                  └── CRM is informed with reason
                  └── CRM negotiates a reduced scope with customer
                      (e.g. fewer units, different brand tier)
```

---

<!-- ═══════════════════════════════════ PAGE BREAK ════════════════════════════════════ -->

---

## C24 · Any Spend Bumped Up the Approval Bands

**What this covers:** The same approval band logic applies to every monetary decision in the system — parts, scope changes, extra labour, or full quotes. Nothing is spent without approval.

```
Engineer / CRM proposes a spend
(Part order, scope change, extra labour charge, or quote)
          │
          ▼
System checks amount against approval bands:
          │
          ├─ Within CRM band (≤ ₹5,000 for parts / ≤ ₹2L for quotes)
          │       └── CRM approves with 1 click
          │
          ├─ Within SM band (₹5k–₹50k parts / ₹2L quote)
          │       └── Service Manager approves
          │
          └─ Above all bands
                  └── Admin approves
          │
          ▼
⛔ IMPORTANT: The system BLOCKS the "Order" or "Proceed" action
              until the appropriate approval is received.
              No spend can be initiated without it.
```

---

<!-- ═══════════════════════════════════ PAGE BREAK ════════════════════════════════════ -->

---

## Quick Reference Cheat-Sheet

| Question | Answer |
|---|---|
| Who is the FIRST staff member to see every new request? | **OPS Manager** — in the `/ops` triage inbox |
| Can a ticket skip OPS entirely? | Only via auto SLA breach after 30 min unattended → goes to Service Manager |
| Who picks the engineer for a job? | **CRM** for normal cases · **SM** for escalated cases · **OPS** for AMC visits |
| Does the engineer have to accept a dispatch? | Yes — 10-minute accept window |
| Does the CRM have to accept a ticket assignment? | Yes — 15-minute accept window |
| Who approves money? | CRM ≤ ₹5k · SM ≤ ₹50k (parts) / ≤ ₹2L (quotes) · Admin above those |
| Who can the customer escalate to? | One tap in the app — routes to OPS (T1). OPS decides if it goes to L2. |
| When does Admin take ownership of a stuck ticket? | **Never automatically.** Admin monitors and humans intervene. |
| What if all CRMs are unavailable? | OPS re-offers (C9), invites an overloaded CRM (C10), or bypasses to SM (C11) |
| What if the engineer can't attend? | "Cannot Attend" → CRM re-dispatches to next available engineer (C15) |
| What if the customer wants to change the visit time? | Reschedule flow (C19) — blocked if engineer is already en route |
| What if a spare part is needed? | Part Request with budget approval band (C13) |
| What triggers an automatic escalation? | SLA breach ladder (C17): 15 min → 30 min → final SLA → 2× final SLA |
| What happens on a 1–2 star rating? | Ticket automatically REOPENS. CRM must call within 30 minutes. (C18) |

---

*End of Document — Arial Engineering Services · Customer Portal Workflow · v1.0*
