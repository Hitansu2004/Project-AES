# AES Service Application — Deep Cost Research
## Full Recurring + Hidden Cost Analysis  |  June 2026
### Assumption: 2,000 active users | 3 platforms (Web + Android + iOS) | 4 GCP environments

> **Note:** All USD-sourced prices are kept in **USD**. Multiply by the current live rate (1 USD = ₹95.64 as of 8 Jun 2026) to get INR. Pure INR amounts (MSG91, DLT registration, Razorpay on INR transactions, SOW quoted figures) are shown in ₹ as they are natively priced in INR.
> **All figures are estimates based on verified pricing pages. Always check official pages before signing anything.**

---

## EXECUTIVE SUMMARY — What You Are Missing

The original quotation (AES-Q-2026-003) states **₹40,000/year** for "cloud hosting". Based on deep research, the real annual recurring cost for the complete app at 2,000 active users across all 4 environments is approximately **$2,441–3,269 USD/year + ₹37,500–86,000 INR/year** — roughly 5-8× the quoted figure when converted at the current rate. Below is the complete breakdown of everything, including costs never mentioned in any document sent to the client.

---

## PART 1 — WHAT IS QUOTED IN THE DOCUMENTS vs REALITY

### The original quotation (Section 8 — Annual Recurring Costs) says:

| Line Item | Quoted in SOW/Quote | Reality (June 2026) | Gap |
|---|---|---|---|
| Cloud Hosting (server + DB + storage + CDN) | ₹40,000/year | ₹1,40,000–2,00,000/year (4 envs) | **5× understated** |
| Transactional SMS | ₹20,000–60,000/year | ₹18,000–54,000/year | Correct range |
| WhatsApp Business API | ₹15,000–40,000/year | ₹15,000–50,000/year (new 2026 rates) | Slightly understated |
| Transactional Email | ₹6,000–15,000/year | ₹0–15,000/year (if you switch away from SendGrid) | ⚠️ SendGrid free tier is GONE |
| DB Backups & Monitoring | ₹8,000–15,000/year | Included in Cloud SQL cost | Double-counted |
| Apple Developer | ₹8,400/year | ₹8,400/year ($99) | ✓ Correct |
| Google Play | ₹2,000 one-time | ₹2,100 one-time ($25) | ✓ Correct |
| Domain | ₹1,500–2,000/year | ₹1,500–2,000/year | ✓ Correct |
| SSL | Free (Let's Encrypt) | Free (Cloud Run/LB manages it) | ✓ Correct |

### The questionnaire answers (Section 3.3) revised the figure to ₹1,40,000–2,10,000/year — this is closer but still misses several items listed below.

---

## PART 2 — GOOGLE CLOUD PLATFORM (GCP) COSTS — FULL BREAKDOWN

### Architecture Deployed (per SOW)
- **Backend:** Spring Boot on Cloud Run (or GKE Autopilot)
- **Database:** PostgreSQL 15 on Cloud SQL
- **Cache:** Memorystore for Redis
- **Storage:** Cloud Storage (media, uploads)
- **CI/CD:** GitHub Actions → Cloud Build → Cloud Run deploy
- **Monitoring:** Cloud Monitoring + Cloud Logging
- **Secrets:** Google Secret Manager
- **Region:** asia-south1 (Mumbai) | DR: asia-south2 (Delhi)

---

### 2.1 Cloud SQL for PostgreSQL — THE BIGGEST COST DRIVER

> **No free tier. Cloud SQL always charges from minute 1.**

Cloud SQL for PostgreSQL Enterprise edition (asia-south1, June 2026):

**Option A — Minimum viable production (1 vCPU, 3.75 GB RAM):**

| Component | Rate | Hours/month | Cost/month | Cost/year |
|---|---|---|---|---|
| 1 vCPU (Enterprise) | $0.0413/vCPU-hr | 720 | $29.7 | $356 |
| 3.75 GB RAM | $0.0070/GB-hr | 720 | $18.9 | $227 |
| 50 GB SSD storage | $0.17/GB-month | — | $8.5 | $102 |
| Static IP (required) | $0.013/hr | 720 | $9.4 | $113 |
| Automated backups (30 GB) | $0.08/GB-month | — | $2.4 | $29 |
| **Total (no HA)** | | | **~$69/month** | **~$828/year** |
| **Total (with HA — 2× compute)** | | | **~$107/month** | **~$1,284/year** |

**Option B — Recommended production for 2,000 users (2 vCPU, 4 GB RAM):**

| Component | Cost/month | Cost/year |
|---|---|---|
| 2 vCPU | $59.5 | $714 |
| 4 GB RAM | $20.2 | $242 |
| 50 GB SSD | $8.5 | $102 |
| Static IP | $9.4 | $113 |
| Backups | $2.4 | $29 |
| **Total (no HA)** | **~$100/month** | **~$1,200/year** |
| **Total (with HA)** | **~$180/month** | **~$2,160/year** |

> ⚠️ **Critical:** The quotation's ₹40,000/year doesn't even cover the database alone. Cloud SQL for a minimum 1-vCPU instance WITHOUT HA costs **~$828/year**. With HA, it's **~$1,284/year**.

**What you should do:** For year 1 at 2,000 users, use db-custom-1-3840 (1vCPU, 3.75GB) **without HA**, and enable HA only when user base grows past 5,000. This saves ~$400–500/year.

---

### 2.2 Cloud Run — Backend + Frontend

Cloud Run pricing (asia-south1 = **Tier 1**, cheapest tier):

**Free tier per billing account per month:**
- 2,000,000 requests (free)
- 360,000 vCPU-seconds (free)
- 180,000 GB-seconds memory (free)

**For 2,000 active users (estimated 240,000 API calls/month):**

| Resource | Monthly usage | Free tier | Billed | Cost |
|---|---|---|---|---|
| Requests | 240,000 | 2,000,000 | 0 | $0 |
| vCPU-seconds (150ms avg, 1 vCPU) | 36,000 | 360,000 | 0 | $0 |
| Memory-seconds (512MB) | 18,000 | 180,000 | 0 | $0 |
| **Total backend Cloud Run** | | | | **~$0–2/month** |

> ✅ **Cloud Run is practically free at 2,000 users.** This is why Cloud Run was the right choice over GKE for this scale.

**Next.js frontend** (if deployed on Cloud Run instead of Cloud CDN/Firebase Hosting):
- Static assets can be served via Cloud Storage + CDN for near-zero cost
- If deploying Next.js as a server-side Cloud Run container: same free-tier estimates

---

### 2.3 Memorystore for Redis — OFTEN FORGOTTEN

Redis is used for session cache, rate limiting, and WebSocket presence. This is a **significant ongoing cost**.

**Memorystore for Redis (Basic Tier, asia-south1, 1 GB capacity):**

| Tier | Capacity | Rate | Monthly cost | Annual cost |
|---|---|---|---|---|
| Basic (no HA) | 1 GB | ~$0.049/GB-hr | **~$35/month** | **~$420/year** |
| Standard (with HA/failover) | 1 GB | ~$0.098/GB-hr | **~$70/month** | **~$840/year** |

> ⚠️ **This cost was NOT mentioned in the original quotation and is buried in the questionnaire answer.** Redis cannot be eliminated — it's core to JWT session handling, WebSocket presence, and rate limiting in the current codebase.

---

### 2.4 Cloud Storage (Media, Uploads, Backups)

| Use case | Estimated volume | Rate | Monthly cost |
|---|---|---|---|
| Standard storage (asia-south1) | 50 GB | $0.020/GB | $1.00 |
| Egress to internet (direct) | 5 GB | $0.12/GB | $0.60 |
| Egress via Cloud CDN (cached) | 10 GB | $0.04/GB | $0.40 |
| Operations (reads/writes) | 100,000 | $0.004/10K | $0.04 |
| **Total Cloud Storage** | | | **~$2/month** |

**Annual: ~$24/year** — this is low and correctly estimated.

---

### 2.5 Cloud Load Balancer — MAY OR MAY NOT BE NEEDED

> If you deploy on **Cloud Run with its built-in HTTPS endpoint** → NO load balancer needed. Cloud Run's built-in HTTPS is **FREE**.
> If you deploy on **Compute Engine VMs or GKE** → Load Balancer is required.

For Cloud Run deployment (which the SOW recommends): **$0/year for LB**.

If you ever need it:
| Component | Rate | Monthly cost |
|---|---|---|
| First 5 forwarding rules | $0.025/hr × 720 | $18/month |
| Data processing | $0.008/GiB | negligible at 2K users |

---

### 2.6 Cloud Monitoring + Logging

**Free tier per project:**
- 50 GB logs ingested/month → more than enough for 2,000 users
- Basic alerting metrics: free
- First 150 MB metric data: free

**After free tier:**
- Logs beyond 50 GB: $0.50/GB
- Custom metrics beyond 150 MB: $0.18/MB

**Estimated cost at 2,000 users: $0–6/month** (within free tier for most metrics)

---

### 2.7 Google Secret Manager

Used for storing DB passwords, API keys (Razorpay secret, MSG91 key, Gupshup key, etc.)

| Component | Rate | Est. usage | Monthly cost |
|---|---|---|---|
| Active secrets | $0.06/secret/month | 20 secrets | $1.20 |
| Access operations | $0.03/10,000 | 50,000 | $0.15 |
| **Total** | | | **~$1.35/month** |

**Annual: ~$16/year** — small but real. **Not mentioned in any document.**

---

### 2.8 Cloud DNS

| Component | Rate | Monthly cost |
|---|---|---|
| Managed zone | $0.20/zone/month | $0.20 |
| DNS queries | $0.40/1M (after 1B free) | $0 |
| **Total** | | **~$0.20/month** |

**Annual: ~$2.40/year** — negligible but worth knowing.

---

### 2.9 Cloud NAT (if using private Cloud SQL)

If Cloud SQL instances use private IP (recommended for security), Cloud Run needs a VPC connector + Cloud NAT to reach them:

| Component | Rate | Monthly cost |
|---|---|---|
| Cloud NAT gateway | $0.045/hr | $32.4/month |
| Data processed | $0.045/GB | negligible |

> **Alternative:** Use Cloud SQL Auth Proxy (free) from Cloud Run instead of Cloud NAT. **This avoids the $32.4/month NAT cost entirely.** Cloud SQL Auth Proxy is already supported in Spring Boot and is the recommended pattern for Cloud Run → Cloud SQL connectivity. **No document mentions this architectural decision, but it saves ~$389/year.**

---

### 2.10 FOUR ENVIRONMENTS — Full GCP Cost Matrix

Per the SOW and questionnaire answers, 4 separate GCP projects are required:

| Environment | Purpose | SQL tier | Redis | Cloud Run | Est. monthly (USD) |
|---|---|---|---|---|---|
| **Production** | Live customer-facing | db-custom-1-3840 (1vCPU, 3.75GB), no HA | 1GB Basic | Scale 0→N | **~$107–145/month** |
| **Staging / UAT** | Pre-release testing (mirrors prod config) | db-g1-small (shared core) | 1GB Basic | Always-on during UAT | **~$45–55/month** |
| **QA / Testing** | Feature test branch validation | db-g1-small | None (use in-memory) | On-demand | **~$10–14/month** |
| **Development** | Active coding, sandbox | db-g1-small | None | On-demand | **~$10–14/month** |
| **TOTAL (all 4 environments)** | | | | | **~$172–228/month** |

> **Annual GCP total (4 environments): ~$2,064–2,736/year**

> ⚠️ The original quotation quoted ₹40,000/year for "cloud hosting." Even the **cheapest** possible setup with 4 environments running 24/7 costs **~$2,064+/year**. The questionnaire answer of ₹1,40,000–2,10,000/year covers **only production** — the full 4-environment figure is approximately $2,064–2,736/year.

---

## PART 3 — APP STORE AND PLAY STORE COSTS

### 3.1 Apple Developer Program — Confirmed Correct

| Item | Quoted | Actual (June 2026) | Status |
|---|---|---|---|
| Apple Developer Program fee | ₹9500/year | **$99/year** (multiply by live rate for INR) | ✓ Approximately correct at old rate; recalculate at current rate |
| Renewal | Annual auto-renew | **Must renew or apps are REMOVED from App Store within 30 days** | ⚠️ Critical to monitor |
| Account type | Under Arial's company name | Organisation account (same $99) | ✓ |

> 🔴 **RISK:** If Arial misses the renewal, the iOS app is removed from the App Store automatically. This is an operational risk not highlighted anywhere in the documents.

### 3.2 Apple's Revenue Commission — NOT MENTIONED ANYWHERE

> This is a CRITICAL HIDDEN COST if users pay through the iOS app directly.

| Revenue tier | Apple's cut |
|---|---|
| Gross revenue < $1M/year (Small Business Program) | **15% of every in-app transaction** |
| Gross revenue ≥ $1M/year | **30% of every in-app transaction** |

**BUT: This only applies to payments made through Apple's In-App Purchase (IAP) system. Razorpay is a webview-based payment — it does NOT trigger Apple's IAP commission. The current design (Razorpay Checkout in a webview) is correct and avoids Apple's 15-30% cut entirely.**

> ⚠️ **You MUST NOT implement payment as a native in-app purchase via StoreKit.** Keep it as Razorpay webview/deep-link. If Apple ever detects you selling "digital services" through a non-IAP flow, they can reject app updates. Service-based apps (like booking an AC service technician) are generally allowed to use external payment gateways. Physical-service bookings are not subject to IAP requirement. **Keep it as is but be aware of the rule.**

### 3.3 Apple App Review Process

| Item | Detail |
|---|---|
| App Review timeline | 1–7 days (strict, unpredictable) |
| Rejection risk | High if: push notification permissions, location permissions, or in-app payments are not handled per Apple guidelines |
| Expedited review | Free request if there is a critical bug fix |
| TestFlight beta testing | Free, up to 10,000 external testers |

**Plan your Go-Live timeline to have at least 7–10 business days of buffer for App Store review delays.** The current SOW's Week 15 for App Store submission is tight.

### 3.4 Google Play Developer — Confirmed Correct

| Item | Quoted | Actual | Status |
|---|---|---|---|
| One-time registration | ₹2,400 | **$25** (multiply by live rate for INR) | Slightly understated at current rate |
| Play Store review | 1–3 days | **Accurate for new apps** | ✓ |
| Google's commission (in-app) | Not mentioned | **15% first ₹2Cr/year, then 30%** | Same caveat as Apple — Razorpay avoids this |

---

## PART 4 — MESSAGING COSTS (VERIFIED JUNE 2026)

### 4.1 SMS — MSG91 (Primary) + Twilio (in codebase as fallback)

> ⚠️ **Twilio is in pom.xml as a dependency but Twilio India SMS rates are 7–8× more expensive than MSG91. Confirm Twilio is ONLY used as a fallback or for voice OTP.**

**MSG91 SMS pricing (India OTP, June 2026):**

| Monthly volume | Rate/SMS | Monthly cost (10K SMS) | Annual |
|---|---|---|---|
| Up to 10,000 | ₹0.40–0.50 | ₹4,000–5,000 | ₹48,000–60,000 |
| 10,001–100,000 | ₹0.25–0.35 | ₹2,500–3,500 | ₹30,000–42,000 |

**Realistic for 2,000 users (5–10 SMS/user/month = 10,000–20,000 SMS/month):**
- **Monthly: ₹3,000–7,000 | Annual: ₹36,000–84,000**

> Plus 18% GST on the SMS bill.

**DLT Registration — MANDATORY IN INDIA — NOT MENTIONED IN ANY DOCUMENT:**

> 🔴 Every business sending SMS in India MUST register on the DLT (Distributed Ledger Technology) platform under TRAI regulations. Without DLT registration, SMS messages are blocked by telcos.

| DLT requirement | Cost | Timing |
|---|---|---|
| Entity registration (once) | ₹5,900 + GST = ₹6,962 | Before sending first SMS |
| Sender ID (Header) registration | ₹5,900 per header + GST | Per sender ID |
| Template registration | ₹0–5,900 depending on operator | Per template |
| **Estimated total DLT setup** | **₹15,000–25,000** | **One-time, Day 1** |

> **This cost does not appear anywhere in the quotation or SOW. Arial needs to budget for this before the first SMS is ever sent.**

---

### 4.2 WhatsApp Business API — Gupshup (Primary)

**Meta's India pricing effective January 1, 2026 (10% increase from previous year):**

| Message category | Meta base rate (India) | Gupshup markup | Total per message |
|---|---|---|---|
| Marketing | $0.0118 per message | +6% (Cloud API) | **~$0.0125** |
| Utility (booking confirmations, job updates) | $0.0014 per message | +$0.001 | **~$0.0024** |
| Authentication (OTP fallback via WhatsApp) | $0.0014 per message | +$0.001 | **~$0.0024** |
| Service (replies within 24hr window) | $0.00 | +$0.001 | **~$0.001** |

**For 2,000 users, estimated WhatsApp volume:**
- Booking confirmations + engineer ETA + job-complete alerts = ~3–5 utility messages per ticket
- If 500 tickets/month: 1,500–2,500 utility messages/month
- Cost at $0.0024 each = **~$3.6–6/month = ~$43–72/year**

> Much lower than the ₹15,000–40,000/year estimate in the documents. The documents assumed marketing messages. For transactional/utility messages, WhatsApp is cheap. **Only if Arial sends promotional messages (AMC renewal reminders, offers) does cost approach the higher estimate.**

---

### 4.3 Transactional Email — CRITICAL UPDATE: SendGrid Free Tier Is GONE

> 🔴 **SendGrid removed its permanent free tier on May 27, 2025.** New accounts only get a 60-day trial (100 emails/day). After that, paid plans start at **$19.95/month ($239/year)** for 50,000 emails.

| Provider | Free tier | Paid starting at | Best for |
|---|---|---|---|
| **SendGrid** *(current plan)* | 60-day trial only | $19.95/month | Large volume |
| **Amazon SES** *(recommended switch)* | 3,000/month first 12mo | **$0.10/1,000 emails** | Pay-per-use |
| **Brevo (Sendinblue)** | 300 emails/day FOREVER | $15/month | Free forever for light use |
| **Resend** | 3,000/month FOREVER | $20/month | Developer-friendly |

**For 2,000 users at 5 emails/user/month = 10,000 emails/month:**
- SendGrid paid: **$19.95/month = $239/year** (expensive)
- Amazon SES: **~$1/month = ~$12/year** (20× cheaper)
- Brevo free: **$0/year** if under 9,000 emails/month

> **Recommendation: Switch from SendGrid to Amazon SES immediately. For 2,000 users, Amazon SES costs ~$12/year vs SendGrid's $239/year. For 5,000 users, SES stays under $36/year.**

> Note: If staying on GCP ecosystem, you could also use **Mailgun** ($15/month) which has a 100 emails/day free tier (permanent).

---

## PART 5 — PAYMENT GATEWAY (RAZORPAY)

### 5.1 Transaction Fees — Cost to Arial per payment processed

| Payment method | Razorpay fee | GST on fee | Effective deduction per ₹1,000 |
|---|---|---|---|
| UPI, Debit/Credit Cards, Netbanking, Wallets | **2%** | 18% on fee | **₹23.60** |
| Credit Card via UPI | 2.15% | 18% on fee | **₹25.37** |
| EMI / Cardless EMI | 3% | 18% on fee | **₹35.40** |
| International cards | 3% | 18% on fee | **₹35.40** |

> **These fees are paid BY Arial, not by the customer.** Arial collects ₹1,000 from the customer but only receives ₹976.40 after Razorpay cuts (for standard UPI/card).

**Monthly estimate for 2,000 users:**
- If average transaction = ₹2,000 and 100 transactions/month:
- Total payments processed: ₹2,00,000/month
- Razorpay fee: 2% = ₹4,000 + 18% GST on fee = ₹720
- **Monthly Razorpay cost: ₹4,720 on ₹2L of transactions**
- **Annual: ₹56,640 on ₹24L of transactions**

> This is REAL money lost to the gateway and NOT mentioned in the SOW or quotation as a recurring cost to Arial. The documents say "2% + GST per transaction charged by Razorpay" but don't give Arial any estimate of the annual impact.

### 5.2 Razorpay Account Setup (One-Time)

| Item | Cost |
|---|---|
| Account activation | Free |
| KYC verification | Free |
| Bank account linking | Free |
| Razorpay Dashboard access | Free |
| **Total one-time setup** | **₹0** |

---

## PART 6 — GOOGLE MAPS PLATFORM

### 6.1 Maps SDK (Mobile — Android/iOS) — FREE

Good news: Maps SDK for Android and Maps SDK for iOS are billed under a single **"Maps SDK (India)" SKU** which has **zero charges per map load**. The engineer tracking map on mobile is effectively free.

| SKU | Billable event | India free threshold | Cost |
|---|---|---|---|
| Maps SDK (India) — Android + iOS | Map load | No threshold — always free | **$0.00** |
| Dynamic Maps (India) — Web JS API | Map load | 70,000 loads/month free | $2.10/1,000 after free |

**For 2,000 users on web, ~5 map loads/user/month = 10,000 map loads → well within free tier. Web maps are also free at this scale.**

### 6.2 Routes API / Directions API — POTENTIAL HIDDEN COST

> ⚠️ **If the app calculates live route/ETA from engineer's current location to the customer, this uses the Routes API — which is NOT free.**

| API | India rate | Estimated usage | Monthly cost |
|---|---|---|---|
| Routes API (Compute Routes) | ~$5–7/1,000 calls (India varies) | 20 engineers × 5 updates/job × 10 jobs/day = 30,000 calls/month | **$150–210/month** |
| Directions API (legacy) | ~$5/1,000 calls | Same as above | Similar |

> 🔴 **This could be a $1,800–2,520/year hidden cost** if not handled carefully.

**Mitigation strategies (implement these):**
1. **Cache routes:** Once a route is calculated, cache it for 10 minutes before re-calling the API
2. **Calculate only on engineer assignment, not continuously:** Calculate route when engineer accepts job, not every 30 seconds
3. **Use engineer's live GPS dot (free) instead of route overlay:** Just show the engineer's current lat/long on the map — no Routes API call needed
4. **Limit route recalculations:** Recalculate only if engineer deviates by >200 meters from cached route

With smart implementation, Routes API cost can be reduced to **~$60–120/year**.

---

## PART 7 — CI/CD AND DEVOPS TOOLING

### 7.1 GitHub Actions (New 2026 Pricing)

> **Pricing changed effective January 1, 2026 (reduced rates) and March 1, 2026 (new self-hosted runner charge).**

**GitHub-hosted runners (new rates from Jan 2026):**

| Plan | Included minutes/month | Extra minutes |
|---|---|---|
| Free personal account | 2,000 min/month | $0.008/min (Linux) |
| Team (Organization) | 3,000 min/month | $0.008/min (Linux) |
| Enterprise | 50,000 min/month | Custom |

**Estimated CI/CD usage for this project:**
- Pipeline per push: ~10–15 min (build → test → Docker → deploy)
- Deployments: ~3×/day across 4 environments = 12 runs × 12 min = 144 min/day = 4,320 min/month
- **2,000 free minutes covers about 13 days of deployments — exceeds free tier**

**Cost for Team plan (needed for Arial's GitHub organization):**
- Team plan: **$4/user/month × 2 developers = $8/month = $96/year**
- Included: 3,000 minutes
- Overage: (4,320 - 3,000) = 1,320 min/month × $0.008 = $10.56/month = $127/year
- **Total GitHub: ~$223/year**

> Not mentioned in any document.

**Self-hosted runner charge (from March 2026):** $0.002/minute in private repos. If running builds on a GCP VM you own as runner:
- 4,320 min/month × $0.002 = $8.64/month extra
- Total GitHub with self-hosted: ~$326/year

### 7.2 Terraform (Infrastructure as Code) — FREE

Terraform CLI is **open source and free**. HashiCorp Terraform (not Enterprise) is the right choice here.

| Option | Cost |
|---|---|
| Terraform CLI (open source) | **Free** |
| Terraform Cloud (remote state) — Free tier | **Free up to 500 applies/month** |
| Terraform Enterprise | $20/user/month |

**Recommendation:** Use Terraform CLI with **Google Cloud Storage backend for state** (free). This is more than enough for this project size. **No cost.**

### 7.3 Jenkins — NOT IN THE SOW

Jenkins is not mentioned in the SOW — GitHub Actions is. If you're using Jenkins as well:

| Item | Cost |
|---|---|
| Jenkins itself (open source) | Free |
| Server to run Jenkins on | e2-small on GCP = $15/month |
| **Annual if using Jenkins** | **~$180/year** (server cost only) |

> **Recommendation: Stick with GitHub Actions. Jenkins adds operational overhead with no clear benefit for a 2-person team. Don't add Jenkins.**

### 7.4 Kubernetes (GKE) vs Cloud Run

The SOW mentions "Cloud Run / GKE Autopilot" — these have very different cost profiles:

| Option | Monthly cost at 2,000 users | Annual |
|---|---|---|
| **Cloud Run** (recommended) | ~$2–5 compute | **~$24–60/year** |
| **GKE Autopilot** | Cluster management fee: $0.10/hr = $72/month + pod resources | **~$864+/year per cluster** |
| **GKE Standard** (3 e2-medium nodes minimum) | 3 × $28/node/month = $84/month + management | **~$1,008+/year per cluster** |

> **🔴 GKE is massively more expensive than Cloud Run for 2,000 users. GKE cluster management alone costs $72/month = $864/year per cluster.** With 4 environments, that's $3,456/year just for GKE management fees — before any pod compute costs.

> **Strong recommendation: Use Cloud Run for all environments. Switch to GKE only when you need it (>50,000 users, complex microservices, stateful workloads). Cloud Run is the right choice for this project.**

---

## PART 8 — PUSH NOTIFICATIONS (FCM / APNs)

### Firebase Cloud Messaging (FCM) — FREE ✓

| Detail | Status |
|---|---|
| FCM messages to Android | **Completely free, unlimited** |
| FCM messages to web | **Free** |
| APNs messages to iOS (via FCM or direct) | **Free** (APNs itself charges nothing) |
| Firebase Analytics | **Free** |
| Firebase Crashlytics | **Free** |

> ✅ **No cost here. All push notifications are genuinely free.**

**One caveat:** If you use **Firebase Cloud Functions** to trigger push notifications server-side:
- Cloud Functions: first 2M invocations/month free, then $0.40/1M
- At 2,000 users sending maybe 5 push notifications each per day = 300,000 invocations/month → stays free

---

## PART 9 — ITEMS NOT IN ANY DOCUMENT

These are real costs that are completely absent from the quotation, SOW, and questionnaire answers:

### 9.1 DLT Registration (Mandatory for India SMS)
- **₹15,000–25,000 one-time** (entity + header + templates)
- **Must be done before the first OTP is ever sent**
- Process takes 3–7 business days for approval
- Without this, every SMS sent is blocked by telcos

### 9.2 Google Workspace (Professional Email)
- Not required for the app itself, but Arial may want `info@arialengineering.com` style email for the service
- **$6/user/month per user**
- If Arial already has this: $0 additional

### 9.3 Razorpay KYC and GST Setup
- Razorpay requires Arial's GST number, PAN, and bank details
- **1–3 business days** for account activation
- **No cost**, but must be initiated well before go-live

### 9.4 App Store Connect Asset Preparation
- App Store requires: app icon (1024×1024), screenshots for all device sizes (iPhone 6.9", 6.7", 6.5", iPad), app preview videos (optional but recommended), privacy policy URL, support URL
- **No fee, but design time is required** — ~3–5 hours of work per platform
- **Not explicitly called out in SOW's ₹2,000 for "submission support"**

### 9.5 Google Maps API Key Security
- API keys for Maps must be restricted by package name (Android), bundle ID (iOS), and HTTP referrer (Web)
- Unrestricted API keys can be abused, generating unexpected bills
- **Estimated risk if left unrestricted: potentially thousands of dollars in API abuse**
- **Action required: Restrict all Maps API keys before go-live**

### 9.6 GCP Project Billing Budget Alerts
- Set up budget alerts in GCP Console to notify when spend exceeds 50%, 90%, 100% of budget
- **Free to set up, but if not done and a Cloud SQL instance is left running by mistake — it's $84+/month of unplanned cost**

### 9.7 India GST on Cloud Bills (18%)
- All GCP bills in India attract **18% GST** on top of the USD-based compute charges
- Arial can claim this as Input Tax Credit (ITC) if GST registered
- But cash outflow is 18% higher than the base GCP bill until ITC is credited
- Example: if GCP bill = $172/month × ₹95.64 = ₹16,450, GST at 18% adds ₹2,961 → total cash out = ₹19,411/month

### 9.8 Disaster Recovery (asia-south2 Delhi) — Mentioned in Questionnaire Answers
- DR was committed to in the questionnaire answers for 5,000+ customers
- A Cloud SQL read replica in asia-south2 = same cost as primary instance = another **~$69–100/month** added to the bill
- Cloud Storage multi-region: minimal additional cost
- **DR adds ~$828–1,200/year** — not included in current estimates
- **Recommendation: Defer DR until user base exceeds 2,000. It is not required for the build period.**

### 9.9 SendGrid Replacement (See Part 4.3)
- SendGrid free tier is gone. Switch to **Amazon SES** or **Brevo** before going live

---

## PART 10 — COMPLETE COST SUMMARY

### 10.1 One-Time / Setup Costs

| Item | Who pays | Estimated cost | Notes |
|---|---|---|---|
| Google Play Developer Account | Arial | **$25** | One-time forever |
| Apple Developer Program (first year) | Arial | **$99/year** | Annual renewal thereafter |
| DLT Registration (India SMS) | Arial | **₹15,000–25,000** | ⚠️ Missing from all docs; natively INR |
| Razorpay Account Setup | Arial | $0 | Free |
| App Store Connect setup + assets | Arial (design time) | $0 hard cost | Design effort only |
| Firebase project setup | Dev team | $0 | Free |
| GCP organization setup | Arial | $0 | Free |
| Domain registration | Arial | ₹1,500–2,000 | If not already owned; natively INR |
| **Total one-time (USD items)** | | **~$124** | |
| **Total one-time (INR items)** | | **₹16,500–27,000** | |

### 10.2 Annual Recurring Costs (2,000 active users, 4 environments, Year 1)

| Category | Line items | Annual cost | Currency | Mentioned in SOW? |
|---|---|---|---|---|
| **GCP — Production** | Cloud SQL + Redis + Cloud Run + Storage | **~$1,284–1,740** | USD | Understated (₹40K quoted) |
| **GCP — Staging + Dev + QA** | 3 smaller environments | **~$780–1,080** | USD | ❌ Not mentioned |
| **GCP — Shared** | Monitoring, Logging, Secret Manager, DNS | **~$20–100** | USD | ❌ Not mentioned |
| **SMS — MSG91** | OTPs + booking notifications + engineer alerts | **₹36,000–84,000** | INR | ✓ (range given) |
| **WhatsApp — Gupshup** | Utility messages only (booking/ETA/job alerts) | **~$43–72** | USD | ✓ (but doc overstated at ₹40K; accurate only if marketing msgs included) |
| **Email** | Amazon SES (recommended switch from SendGrid) | **~$12–36** | USD | ⚠️ SendGrid free tier gone |
| **Apple Developer** | App Store annual membership | **$99** | USD | ✓ |
| **GitHub (Team plan)** | CI/CD, private repos, org account | **~$223–326** | USD | ❌ Not mentioned |
| **Google Maps — Routes API** | Engineer ETA/routing (without caching) | **~$1,800–2,520** | USD | ❌ Not mentioned |
| **Google Maps — Routes API** | Engineer ETA/routing (with smart caching) | **~$60–120** | USD | ❌ Not mentioned |
| **Domain renewal** | .com renewal | **₹1,500–2,000** | INR | ✓ |
| **Razorpay fees** | 2.36% effective on all transactions | **Variable (₹23.60 per ₹1,000 collected)** | INR | Mentioned but not quantified |
| **GST on GCP bills (18%)** | Added to GCP bill in India; ITC claimable | **18% of GCP total** | — | ❌ Not mentioned |
| | | | | |
| **TOTAL USD ITEMS (excl. Maps routing)** | | **~$2,420–3,370/year** | USD | |
| **TOTAL INR ITEMS** | | **₹37,500–86,000/year** | INR | |

> **Conservative (good caching, low SMS volume): ~$2,420/year USD + ₹37,500 INR**
> **Realistic (moderate volume, Maps with caching): ~$2,800/year USD + ₹60,000 INR**
> **High (uncached Maps, high SMS/WhatsApp, DR active): ~$5,700/year USD + ₹86,000 INR**

---

### 10.3 Daily Cost Estimate (Production only, 2,000 active users)

> All USD amounts: multiply by live rate (currently 1 USD = ₹95.64) to get INR.

| Category | Daily cost (USD) | Notes |
|---|---|---|
| Cloud SQL ($69/month ÷ 30) | **~$2.30/day** | 1 vCPU, no HA |
| Redis Memorystore ($35/month ÷ 30) | **~$1.17/day** | 1GB Basic tier |
| Cloud Run (near zero at this scale) | **~$0.07/day** | |
| Cloud Storage + CDN ($2/month ÷ 30) | **~$0.07/day** | |
| SMS — MSG91 (₹4,500/month avg ÷ 30) | **₹150/day** | Natively INR |
| WhatsApp — Gupshup ($6/month ÷ 30) | **~$0.20/day** | Utility messages only |
| Email — Amazon SES ($1/month ÷ 30) | **~$0.03/day** | |
| Apple Developer ($99/year ÷ 365) | **~$0.27/day** | |
| GitHub Team ($18.56/month ÷ 30) | **~$0.62/day** | |
| **Sub-total USD/day** | **~$4.73/day** | |
| **Sub-total INR/day** | **₹150/day** | SMS only |
| **GCP 18% GST on USD items** | **18% of GCP portion** | Apply to (SQL + Redis + Run + Storage) |
| **Total production daily operational cost** | **~$4.73 USD + ₹150 INR per day** | |
| **Monthly equiv.** | **~$142 USD + ₹4,500 INR/month** | |

---

## PART 11 — WHAT YOU QUOTED vs WHAT IT ACTUALLY COSTS

| What was told to the client | What it actually costs | Difference |
|---|---|---|
| "₹40,000/year cloud hosting" | **~$2,064–2,736/year** (4 envs, USD) | **5–7× understated** |
| "₹8,400/year Apple Dev" | **$99/year** | Was calculated at ₹83.50/USD; at ₹95.64 it is higher |
| "₹2,000 one-time Play Store" | **$25** | Was calculated at ₹83.50/USD; at ₹95.64 it is higher |
| "₹6,000–15,000/year email" | **~$12/year** (Amazon SES) or **$239/year** (SendGrid paid) | SendGrid free tier is gone — must switch |
| "WhatsApp ₹15,000–40,000/year" | **~$43–72/year** (utility only) or **~$600–800/year** (if marketing msgs) | Very different depending on use case |
| SMS ₹20,000–60,000/year | ₹36,000–84,000/year (natively INR, MSG91) | Slightly understated |
| DLT registration | **₹0 (not mentioned)** | **₹15,000–25,000 one-time missing** |
| GitHub CI/CD | **$0 (not mentioned)** | **~$223–326/year missing** |
| Google Maps routing/ETA | **$0 (not mentioned)** | **$60–2,520/year depending on caching** |
| GST on cloud bills | **$0 (not mentioned)** | **18% on top of all GCP charges — cash outflow even with ITC** |

---

## PART 12 — RECOMMENDATIONS BEFORE TALKING TO CLIENT

### 12.1 Things to Fix Before Signing

1. **Do NOT quote ₹40,000/year for cloud hosting anymore.** The questionnaire answer updated it to ₹1,40,000–2,10,000/year (production only). With 4 environments, the real GCP bill is **~$2,064–2,736/year** before GST.

2. **Fix the SendGrid situation.** SendGrid's free tier is gone. Integrate Amazon SES (AWS) or Brevo immediately. Cost: ~$12/year (SES) vs $239/year (SendGrid paid).

3. **Budget for DLT registration NOW.** This is mandatory, takes 3–7 days, and costs ₹15,000–25,000 (pure INR, TRAI portal). It needs to be done at least 2 weeks before first SMS is sent.

4. **Implement Google Maps API key restrictions** before any beta/UAT testing. Unrestricted keys are a billing risk — could generate thousands of dollars in unexpected API abuse charges.

5. **Decide on Maps routing strategy.** If showing live engineer routes with ETA, implement caching aggressively. If only showing a dot on the map (no route line), no Routes API calls are needed → $0 cost.

6. **Use Cloud Run, NOT GKE.** GKE costs $864+/year per cluster just in management fees. Cloud Run costs ~$24–60/year at this scale.

7. **Use Cloud SQL Auth Proxy instead of Cloud NAT.** Saves ~$389/year per environment.

8. **Defer disaster recovery** (Delhi region) until after initial launch and user growth.

### 12.2 Things to Tell the Client (Revised Recurring Cost Estimate)

If Arial asks for a more accurate recurring cost estimate for Year 1 at 2,000 users:

**Revised table to share:**

| Category | Year 1 Estimate | Currency |
|---|---|---|
| Cloud Infrastructure (GCP — all 4 environments) | ~$2,064–2,736/year | USD |
| SMS (OTP + notifications, MSG91) | ₹36,000–84,000/year | INR |
| WhatsApp API (transactional utility messages) | ~$43–72/year | USD |
| Transactional Email (Amazon SES recommended) | ~$12–36/year | USD |
| Apple Developer Program | $99/year | USD |
| Google Play (one-time) | $25 | USD |
| Domain renewal | ₹1,500–2,000/year | INR |
| GitHub (Team plan for Arial's org) | ~$223–326/year | USD |
| **Total USD recurring** | **~$2,441–3,269/year** | **USD** |
| **Total INR recurring** | **₹37,500–86,000/year** | **INR** |

**Plus one-time INR costs: ₹15,000–25,000 (DLT registration) + ₹1,500–2,000 (domain if needed)**

**Plus Razorpay transaction fees: 2.36% of all payments processed** (Arial's revenue minus these fees = net settlement)

---

## PART 13 — WHAT'S IN THE CODEBASE TODAY vs WHAT'S NEEDED

| Component | Status in code | Cloud service needed | Cost |
|---|---|---|---|
| Spring Boot backend | ✅ Built | Cloud Run (asia-south1) | ~$24–60/year at 2K users |
| PostgreSQL 15 | ✅ Flyway migrations exist | Cloud SQL Enterprise (1vCPU no HA) | ~$828/year |
| Redis | ✅ Referenced in SOW | Memorystore Basic 1GB | ~$420/year |
| JWT auth | ✅ jjwt 0.12.3 | No cloud service | $0 |
| OTP via Twilio | ✅ In pom.xml | Twilio (expensive) or MSG91 (cheap, INR) | ₹36,000–84,000/year |
| FCM push | ✅ In SOW | Firebase (FREE) | $0 |
| WhatsApp via Gupshup | Planned | Gupshup account | ~$43–72/year (utility msgs) |
| Razorpay | Planned | Razorpay account | 2.36% per ₹ transaction (INR) |
| Google Maps SDK | Planned (mobile) | Maps SDK India | **$0 — FREE** |
| Google Maps Routes API | Planned (ETA) | Routes API | ~$60–2,520/year (cache aggressively) |
| Cloud Storage (media) | ✅ Referenced | Cloud Storage | ~$24/year |
| SendGrid email | Referenced | **SWITCH to Amazon SES** | ~$12–36/year (SES) |
| OpenAPI / Swagger | ✅ SpringDoc | No cloud service | $0 |
| Terraform (IaC) | Not in code yet | Terraform CLI + GCS backend | $0 |
| CI/CD | GitHub Actions planned | GitHub Team plan | ~$223–326/year |
| DLT registration | **Not in any plan** | TRAI/Jio/BSNL portal | **₹15,000–25,000 one-time (INR)** |

---

*Research compiled: June 8, 2026*
*Sources: Google Cloud official pricing (cloud.google.com), Apple Developer (developer.apple.com), GitHub Changelog (github.blog), MSG91 pricing (msg91.com), Gupshup Partner Portal, Razorpay Pricing (razorpay.com/pricing), Opsio Cloud India 2026, SendGrid (sendgrid.com), Meta WhatsApp Business Platform pricing*
*USD prices shown in USD — multiply by live rate (1 USD = ₹95.64 as of 8 Jun 2026) for INR. INR-native prices (MSG91, DLT, Razorpay on INR transactions, domain) shown in ₹.*
