# AES Customer Portal — Demo Credentials

> **Heads-up:** these are demo logins seeded by Flyway migration
> `V4__demo_reset.sql`. They only exist in your local / staging DB —
> never push real secrets to git.

## Customers (login by phone + OTP)

Customers use the OTP flow on `/login`.
While `app.demo-mode=true` (default in `application-dev.properties`),
the OTP is also returned in the API response *and* the universal bypass
code **`000000`** always works — so you don't need an SMS gateway.

| #  | Display name              | Phone                | OTP                  |
|----|---------------------------|----------------------|----------------------|
| 1  | User 1 — Aarav Reddy       | **+91 91234 56789**  | `000000` (bypass)    |
| 2  | User 2 — Priya Sharma      | **+91 92234 56789**  | `000000` (bypass)    |
| 3  | User 3 — Karan Patel       | **+91 93234 56789**  | `000000` (bypass)    |
| 4  | User 4 — Sneha Iyer        | **+91 94234 56789**  | `000000` (bypass)    |
| 5  | User 5 — Vikram Singh      | **+91 95234 56789**  | `000000` (bypass)    |

> ℹ️  The phone numbers are the digits you supplied (`123456789`,
> `223456789`, …) prefixed with a leading `9` so they pass the Indian
> mobile-number validation (`^\+91[6-9]\d{9}$`).

### How the customer login works on the UI

1. Open the app → **Login**.
2. Enter the **10-digit phone** (e.g. `9123456789` for User 1).
3. Tap **Send OTP**.
4. Enter `000000` → **Verify**.
5. You land on the customer dashboard.

---

## Staff (login by phone + password)

All staff log in on the **/login → Staff** tab. Same password for everyone:

```
password123
```

| Role               | Display name   | Phone               | Demo focus                                    |
|--------------------|----------------|---------------------|-----------------------------------------------|
| L1 — CRM Agent     | **Ravi Kumar**  | **+91 90000 11111** | Owns AES-2026-1102 (Karan's open ticket).     |
| L1 — CRM Agent     | **Lakshmi Nair**| **+91 90000 22222** | Owns AES-2026-1105 (Vikram's open ticket).    |
| L2 — Service Mgr   | **Suresh Babu** | **+91 90000 33333** | Owns AES-2026-1103 (Sneha — ICU escalation).  |
| L2 — Service Mgr   | **Deepa Iyer**  | **+91 90000 44444** | Empty inbox — receives the **live escalation** during the demo. |
| L3 — Admin / Mgmt  | **Anand Rao**   | **+91 90000 55555** | KPI / escalation dashboard at `/admin`.       |

> The BCrypt hash for `password123` (`$2a$12$n6ENFiPC2ZFGvdMWaR7PKeZAsITBfHPvyfcKDoFQWZ9mVMgm80akO`)
> is the same one V3 used for the original Mahesh / Suresh / Anand seeds —
> we re-use it here so the existing Spring Security setup keeps working.

---

## API base URL

| Environment | URL                     |
|-------------|-------------------------|
| Local dev   | `http://localhost:8080` |

Swagger UI lives at `http://localhost:8080/swagger-ui.html` if you want
to drive the demo through the raw API.

---

## Routes you'll use during the demo

| Route                                | Audience          |
|--------------------------------------|-------------------|
| `/login`                             | Both              |
| `/dashboard`                         | Customer          |
| `/services` · `/services/installation` · `/services/products` · `/services/ticket` · `/services/amc` | Customer          |
| `/tickets` · `/tickets/<ticket-no>`  | Customer / Staff  |
| `/notifications`                     | Both              |
| `/crm`                               | CRM_AGENT (L1)    |
| `/admin`                             | ADMIN (L3) / SERVICE_MANAGER (L2) |
| `/account`                           | Customer          |

See [`DEMO_GUIDE.md`](./DEMO_GUIDE.md) for the recommended click-through.
