# Google Maps Integration — Readiness Check & Setup Plan

> **Purpose:** You wanted Google Maps for two features:
> 1. **Customer side** — pick exact location during service request (autocomplete + map pin)
> 2. **Engineer side** — see driving directions from AES office (not engineer's location) to the customer
>
> Plus we need **distance from AES office to customer** to calculate the dynamic service charge.
>
> This document tells you exactly where we stand on your Google Cloud account and what needs to happen before I integrate.

---

## Current status of your Google Cloud account

I checked your `gcloud` CLI — here's the snapshot:

| Item                           | Status                                       |
| ------------------------------ | -------------------------------------------- |
| gcloud CLI installed           | ✅ Yes (version 569.0.0)                     |
| Logged-in account              | ✅ `parichhahitansu007@gmail.com`            |
| GCP project exists             | ✅ `project-dec0f94c-e91f-43ab-876` (My First Project) |
| Billing enabled on project     | ⚠️ **Not confirmed — see action below**       |
| Maps JavaScript API enabled    | ❌ Not enabled                               |
| Geocoding API enabled          | ❌ Not enabled                               |
| Distance Matrix API enabled    | ❌ Not enabled                               |
| Directions API enabled         | ❌ Not enabled                               |
| Places API enabled             | ❌ Not enabled                               |
| Maps API key created           | ❌ Not created                               |

So your gcloud login works, but **no Maps API is switched on yet**. That's normal — Google requires you to enable each API explicitly, and **billing must be linked to the project first** (Maps will not work without a billing account, even on the free tier).

---

## What needs to happen — 3-step setup (10 minutes)

### Step 1 — Link a billing account to the project

1. Go to https://console.cloud.google.com/billing
2. Sign in as `parichhahitansu007@gmail.com`
3. If you've never set this up, click "Create billing account" → add a credit/debit card
4. Link it to project `project-dec0f94c-e91f-43ab-876`

> **Don't worry about cost yet.** Google gives **$200/month free credit** on Maps APIs, which covers ~28,000 map loads, 40,000 geocoding calls, or 40,000 distance-matrix calls per month. For AES volumes this is more than enough — you'll likely pay ₹0/month for the first year.

### Step 2 — Enable the four APIs we need

Either do this in the console (https://console.cloud.google.com/apis/library) or paste these four commands once billing is linked:

```bash
gcloud services enable maps-backend.googleapis.com --project=project-dec0f94c-e91f-43ab-876
gcloud services enable geocoding-backend.googleapis.com --project=project-dec0f94c-e91f-43ab-876
gcloud services enable distance-matrix-backend.googleapis.com --project=project-dec0f94c-e91f-43ab-876
gcloud services enable directions-backend.googleapis.com --project=project-dec0f94c-e91f-43ab-876
gcloud services enable places-backend.googleapis.com --project=project-dec0f94c-e91f-43ab-876
```

What each one does:

| API                | Used for                                                      |
| ------------------ | ------------------------------------------------------------- |
| Maps JavaScript    | Renders the interactive map on the customer's service-request page |
| Places             | Autocomplete address suggestions as the customer types        |
| Geocoding          | Converts the picked address → latitude/longitude (stored in DB) |
| Distance Matrix    | Calculates km-distance from AES office → customer (for dynamic pricing) |
| Directions         | Shows the route + ETA on the engineer's mobile dashboard      |

### Step 3 — Create an API key (restricted)

1. Go to https://console.cloud.google.com/apis/credentials
2. Click "Create credentials" → "API key"
3. Copy the key (looks like `AIzaSy...`)
4. **Important — restrict the key** (otherwise anyone who finds it in your frontend code can spend your credits):
   - **Application restriction:** HTTP referrers → add `http://localhost:3000/*` (dev) and `https://your-domain.com/*` (prod) when you're live
   - **API restriction:** select only the 5 APIs above

5. Share the key with me. I'll add it to:
   - `aes-frontend/.env.local` as `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...` (used in browser)
   - `aes-backend/application.properties` as `app.google.maps-key=...` (used server-side for Distance Matrix, where the key stays secret)

> **Best practice:** create **two keys** — one for the browser (referrer-restricted, only Maps JS + Places) and one for the backend (IP-restricted, only Geocoding + Distance Matrix + Directions). I'll guide you through that when we get there.

---

## What I will build once the keys arrive

### On the customer service-request wizard
- Google Places autocomplete input (start typing address → suggestions appear)
- Interactive map preview where the customer can drag the pin to fine-tune
- "Use my current location" button (asks for GPS permission)
- Secondary contact number field (₹/text input — required if filled, else optional)
- We save: `lat`, `lng`, `formatted_address`, `landmark_note`, `secondary_phone` to the database

### On the pricing calculator (server-side)
- After address is locked, backend calls **Distance Matrix API** once:
  - Origin = AES Hyderabad office (lat/lng set in config)
  - Destination = customer's lat/lng
- Reads distance in km, computes service charge:
  ```
  base = (split=750, cassette=1500, ductable=2500, vrf=5000, ahu=5000)
  distance_extra = (≤10 → 0, 11–15 → 250, 16–25 → 750, >25 → 1250)
  total = base + distance_extra
  apply discount-coupon if present
  ```
- Result is shown to customer before payment, and stored on the ticket.

### On the engineer's mobile dashboard
- "View route" button on every assigned ticket
- Clicking it opens a Google Maps embed showing the route from AES office to customer
- "Open in Google Maps app" button → launches the customer's installed Google Maps app with turn-by-turn navigation (no API cost for this — it's just a `https://www.google.com/maps/dir/?...` URL)

### Backend DB changes (Flyway V12 migration)
New columns to add:
- `properties.lat` (DOUBLE)
- `properties.lng` (DOUBLE)
- `properties.google_place_id` (TEXT)
- `properties.formatted_address` (TEXT)
- `properties.landmark_note` (TEXT)
- `properties.secondary_phone` (TEXT)
- `service_tickets.distance_km` (DECIMAL)
- `service_tickets.distance_charge` (INT)
- `service_tickets.base_charge` (INT)
- `service_tickets.discount_code` (TEXT, nullable)
- `service_tickets.discount_pct` (INT, nullable)
- `service_tickets.final_charge` (INT)
- `service_tickets.payment_status` (ENUM: NOT_PAID / PENDING / PAID / REFUNDED)
- `service_tickets.payment_ref` (TEXT, nullable)
- `app_settings.aes_office_lat`, `aes_office_lng` (single-row config table)

---

## Estimated Maps API cost for AES

Google's pricing (2026, after $200/month free credit):

| API call type           | Free quota / month | Beyond that          |
| ----------------------- | ------------------ | -------------------- |
| Map load (Maps JS)      | 28,000             | $7 per 1,000 loads   |
| Places Autocomplete     | 11,000 sessions    | $17 per 1,000 sessions |
| Geocoding               | 40,000             | $5 per 1,000 calls   |
| Distance Matrix         | 40,000 elements    | $5 per 1,000 elements |
| Directions              | 40,000             | $5 per 1,000 calls   |

**Realistic AES forecast (100 tickets/day):**
- ~100 customer map loads × 30 = 3,000/month ✅ free
- ~100 Places autocomplete sessions × 30 = 3,000/month ✅ free
- ~100 geocoding + 100 distance-matrix = 6,000/month ✅ free
- Engineers viewing routes ~50/day × 30 = 1,500/month ✅ free

**Year-1 Maps cost: ₹0** (well within free tier).

If you grow to 500 tickets/day, expected cost is ~₹2,000–4,000/month.

---

## Action checklist for you

When you're ready, do these in order:

- [ ] **1.** Link a credit/debit card to billing on the project
- [ ] **2.** Run the 5 `gcloud services enable …` commands above (or click in console)
- [ ] **3.** Create the API key, restrict it to `localhost:3000/*` for now
- [ ] **4.** Send me the key (paste in chat — I'll add it to env files)

Then say "go" — I'll start building location autocomplete + distance pricing + engineer route view + payment flow as one connected feature.

---

*Last checked: 27 May 2026 · gcloud CLI v569.0.0 · GCP project `project-dec0f94c-e91f-43ab-876`*
