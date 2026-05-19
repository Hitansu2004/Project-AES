# AES Customer Portal — Demo Credentials

> **Heads-up:** these are demo logins seeded by Flyway migration
> `V4__demo_reset.sql` and refreshed by `V10__phase3to7_demo.sql`.
> They only exist in your local / staging DB — never push real secrets to git.

> **Unified login:** every account — customer, ops manager, CRM agent,
> engineer, service manager, admin — signs in the same way: enter your
> 10-digit phone, tap **Send OTP**, type **`000000`**, done. There is no
> password field anywhere. The `users.password_hash` column was dropped in
> migration `V11__drop_password_hash.sql`.

---

## Customers (login by phone + OTP)

Customers log in via the OTP flow on `/login`.
While `app.demo-mode=true` (default in `application-dev.properties`) the
universal bypass code **`000000`** always works — no SMS gateway needed.

| #  | Display name              | Phone (10-digit form) | OTP                  | Has data                              |
|----|---------------------------|-----------------------|----------------------|---------------------------------------|
| 1  | Aarav Reddy               | **`9123456789`**      | `000000` (bypass)    | 1 property · 5 tickets · 2 installs   |
| 2  | Priya Sharma              | **`9223456789`**      | `000000` (bypass)    | 1 property · 0 tickets · 1 install    |
| 3  | Karan Patel               | **`9323456789`**      | `000000` (bypass)    | 1 property · 2 tickets · 1 install    |
| 4  | Sneha Iyer                | **`9423456789`**      | `000000` (bypass)    | 1 property · 4 tickets · 0 installs   |
| 5  | Vikram Singh              | **`9523456789`**      | `000000` (bypass)    | 1 property · 3 tickets · 2 installs   |

### How the customer login works

1. Open `/login` → enter the **10-digit phone** (e.g. `9123456789`).
2. Tap **Send OTP**.
3. Enter `000000` → **Verify**.
4. You land on `/dashboard` (customer home).

---

## Staff (login by phone + OTP — same flow as customers)

There's no longer a separate staff tab. Staff sign in at `/login` exactly
the way customers do — enter the 10-digit phone, tap **Send OTP**, then
type **`000000`** (demo bypass). The JWT that comes back already carries
the staff role, so they're redirected to their own dashboard automatically.

| Role               | Display name     | Phone               | Branch     | On-shift | Default dashboard | What they do                                                                                  |
|--------------------|------------------|---------------------|------------|----------|-------------------|-----------------------------------------------------------------------------------------------|
| OPS_MANAGER        | **Meera Nair**   | **+91 90000 66666** | Hyderabad  | ✅        | `/ops`            | Triages every new ticket / install. Assigns CRM owners and watches workload across the floor. |
| CRM_AGENT (L1)     | **Ravi Kumar**   | **+91 90000 11111** | Hyderabad  | ✅        | `/crm`            | Accepts/declines offers, talks to customer, dispatches engineers, drafts quotes, raises parts.|
| CRM_AGENT (L1)     | **Lakshmi Nair** | **+91 90000 22222** | Hyderabad  | ⛔ off    | `/crm`            | Currently off-shift — useful for testing the shift toggle and auto-handoff.                   |
| SERVICE_MANAGER L2 | **Suresh Babu**  | **+91 90000 33333** | Hyderabad  | ✅        | `/admin`          | Approves mid-band quotes, reviews part orders, takes Stage-C escalations.                     |
| SERVICE_MANAGER L2 | **Deepa Iyer**   | **+91 90000 44444** | Hyderabad  | ✅        | `/admin`          | Second L2 — receives live escalations during the demo (Stage-B → Stage-C jump).               |
| ADMIN (L3)         | **Anand Rao**    | **+91 90000 55555** | Hyderabad  | ✅        | `/admin`          | High-band quote approval, KPI dashboard, last-resort escalations.                             |
| SITE_ENGINEER      | **Rajesh Verma** | **+91 90000 77777** | Hyderabad  | ✅        | `/engineer`       | Mobile-first dispatch dashboard. Accept job → en-route → on-site → in-progress → resolved.    |
| SITE_ENGINEER      | **Imran Khan**   | **+91 90000 88888** | Hyderabad  | ✅        | `/engineer`       | Second engineer for testing parallel dispatch + workload balancing.                           |
| SITE_ENGINEER      | **Sandeep Rao**  | **+91 90000 99999** | Hyderabad  | ✅        | `/engineer`       | Third engineer — try **"Cannot attend"** / **"Need help"** flows here.                        |

> **Demo tip:** the easiest way to switch roles during a demo is to log
> out, type the next staff phone number, and use `000000`. You're in the
> new role's dashboard in under five seconds.

### Demo personas at a glance

```
                       ┌──────────────────────┐
                       │     OPS_MANAGER      │  Meera Nair          /ops
                       │   (triage inbox)     │  +91 90000 66666
                       └──────────┬───────────┘
                                  │ assigns to
                                  ▼
                       ┌──────────────────────┐
                       │     CRM_AGENT (L1)   │  Ravi, Lakshmi       /crm
                       │  owns the customer    │  +91 90000 11111 / 22222
                       └──┬──────────────┬────┘
                          │ dispatches   │ escalates
                          ▼              ▼
            ┌─────────────────────┐  ┌────────────────────────┐
            │   SITE_ENGINEER     │  │  SERVICE_MANAGER (L2)  │
            │ Rajesh / Imran /    │  │     Suresh / Deepa     │
            │      Sandeep        │  │   approves & assists   │
            │  /engineer          │  │       /admin           │
            └─────────────────────┘  └───────────┬────────────┘
                                                 │ escalates
                                                 ▼
                                       ┌────────────────────┐
                                       │     ADMIN (L3)     │  Anand Rao
                                       │   /admin (KPIs)    │  +91 90000 55555
                                       └────────────────────┘
```

---

## Routes you'll use during the demo

| Route                                | Audience                          | Notes                                                          |
|--------------------------------------|-----------------------------------|----------------------------------------------------------------|
| `/login`                             | Everyone                          | Single phone-+-OTP flow for customers **and** staff            |
| `/dashboard`                         | Customer                          | Hero counters, projects, recent tickets, AMC banner            |
| `/services`                          | Customer                          | Choose **Installation** vs **Service request**                 |
| `/services/installation`             | Customer                          | New AC installation wizard                                     |
| `/services/products`                 | Customer                          | Product catalogue                                              |
| `/services/ticket`                   | Customer                          | 4-step service ticket wizard with inline AC-unit add           |
| `/services/amc`                      | Customer                          | AMC contracts                                                  |
| `/installations`                     | Customer                          | List of customer's installation requests                       |
| `/installations/[requestNumber]`     | Customer                          | Installation detail (e.g. `/installations/INS-2026-2201`)      |
| `/tickets`                           | Customer / Staff                  | Ticket list                                                    |
| `/tickets/[ticketNumber]`            | Customer / Staff                  | Ticket detail (e.g. `/tickets/AES-2026-1202`)                  |
| `/notifications`                     | Both                              | Deep-links to the right detail page now                        |
| `/account`                           | Customer                          | Profile · Properties (+ AC units) · AMC                        |
| `/ops`                               | OPS_MANAGER                       | Triage inbox · workload · engineer board                       |
| `/crm`                               | CRM_AGENT                         | Offer inbox · my tickets · dispatch · approvals · quotes       |
| `/engineer`                          | SITE_ENGINEER                     | Mobile-first dispatch dashboard                                |
| `/admin`                             | ADMIN · SERVICE_MANAGER           | KPIs · escalations · quote queue · part queue                  |

---

## API base URL

| Environment | URL                     |
|-------------|-------------------------|
| Local dev   | `http://localhost:8080` |

Swagger UI: `http://localhost:8080/swagger-ui.html`.

See [`DEMO_GUIDE.md`](./DEMO_GUIDE.md) for the recommended end-to-end click-through.
