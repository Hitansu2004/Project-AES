# Payment Integration Options for AES Customer Portal

> **Purpose of this document:** You asked whether we can build our own UPI/PhonePe link, or whether we need a proper payment gateway. This file walks through every realistic option, with India-2026 pricing, pros and cons, and a final recommendation. Read this end-to-end, decide which one you want, and I'll integrate it.

---

## TL;DR — The recommendation in one line

> **Use Razorpay (or Cashfree as a close second).** Building your own "UPI link" is not a viable option for amounts that can go up to ₹10 lakhs because you cannot confirm payment, cannot refund, cannot reconcile, and cannot legally collect on someone else's behalf. A payment gateway is essential — and Razorpay/Cashfree are the cheapest, most reliable options for a business of your size.

---

## 1. Why you cannot just use a "PhonePe / GPay / UPI link"

You raised this question — let me address it directly.

A UPI deep-link (`upi://pay?pa=...`) **opens** PhonePe / GPay / Paytm on the customer's phone and pre-fills the amount. That works for collecting money — but here is what it **cannot** do, and why this matters for AES:

| What you need                                              | UPI link only? | Why it matters for AES                            |
| ---------------------------------------------------------- | -------------- | ------------------------------------------------- |
| Confirm payment was actually received (server-side)        | ❌ No          | Customer says "paid"; you have no proof           |
| Auto-trigger ticket creation after successful payment      | ❌ No          | Manual reconciliation = chaos                     |
| Refund a customer (e.g. cancelled quote)                   | ❌ No          | Must do bank transfer manually each time          |
| Reconcile 100 payments per day against bookings            | ❌ No          | Accounting nightmare                              |
| Take card payments / EMI (for big installs of ₹2L+)       | ❌ No          | Lose customers who don't have ₹2L UPI limit       |
| Take NetBanking                                            | ❌ No          | Same as above                                     |
| Generate GST-compliant tax invoices automatically          | ❌ No          | Manual invoicing                                  |
| Settlement to your business bank account                   | ⚠️ Personal    | Personal UPI ≠ business account — IT risk         |
| RBI compliance for collecting on behalf of customers       | ❌ No          | Illegal at scale (Payment Aggregator licence)     |

**Verdict:** UPI links are fine for a chai shop. For AES, where one transaction can be ₹10 lakhs and you need automated workflow, you need a payment gateway.

---

## 2. The Six Real Options

### Option A — Razorpay (Recommended ⭐)

**What it is:** India's #1 payment gateway. Used by Swiggy, Zomato, Cred, Acko, etc. RBI-licensed Payment Aggregator.

**Pricing (2026):**
| Method                  | Fee                  |
| ----------------------- | -------------------- |
| UPI                     | **0 %** (FREE)       |
| RuPay debit card        | **0 %** (FREE)       |
| Domestic credit card    | 2 % + GST            |
| Domestic debit card     | 2 % + GST            |
| NetBanking              | 2 % + GST            |
| Wallets (Paytm, Mobikwik, Freecharge) | 2 % + GST |
| International cards     | 3 % + GST            |
| EMI (No-cost EMI)       | 3–4 % + GST          |

**Setup:** ₹0 setup fee · ₹0 annual fee
**Settlement:** T+2 working days (T+1 on premium plan)
**KYC:** PAN + GST + cancelled cheque + business proof → live in 2–3 days
**Max transaction:** ₹10 lakhs (UPI) · No limit on cards/NetBanking
**Refunds:** Free, instant via API
**API quality:** Excellent — well-documented, easy webhooks, sandbox
**Dashboard:** Best-in-class — refunds, payouts, settlements, GST reports

**Pros:**
- ✅ UPI is FREE — your highest-volume payment method costs you nothing
- ✅ Best developer documentation in India
- ✅ Built-in invoice generation (with GST)
- ✅ Subscription / auto-debit support (useful for AMC renewals)
- ✅ Supports payment links you can send via WhatsApp/SMS
- ✅ Refund API works first time, every time

**Cons:**
- ⚠️ Credit card fee (2%) eats into margin on big installations
- ⚠️ Settlement is T+2 (your money sits with them for 2 days)
- ⚠️ Customer support is via email/chat — no dedicated account manager unless you do ₹50L+/month

**When to choose:** This is the default choice for 95 % of Indian SMBs. Choose Razorpay unless you have a very specific reason not to.

---

### Option B — Cashfree Payments (Recommended runner-up)

**What it is:** RBI-licensed PA. Strong competitor to Razorpay. Used by Cred, Tata 1mg, Xiaomi India.

**Pricing (2026):**
| Method                  | Fee                  |
| ----------------------- | -------------------- |
| UPI                     | **0 %** (FREE)       |
| RuPay debit             | **0 %** (FREE)       |
| Domestic credit/debit   | 1.75 % + GST         |
| NetBanking              | 1.90 % + GST         |
| Wallets                 | 1.90 % + GST         |
| EMI                     | 2.75 % + GST         |

**Setup:** ₹0 · **Annual:** ₹0
**Settlement:** T+1 working day (faster than Razorpay)
**KYC:** Same as Razorpay, 2–3 days
**Max transaction:** ₹10 lakhs (UPI) · No limit on cards
**Refunds:** Free, instant via API

**Pros:**
- ✅ Slightly cheaper than Razorpay for cards / netbanking
- ✅ T+1 settlement = faster cash flow
- ✅ Strong payout features (useful for paying engineers / vendors)
- ✅ Better support for international cards if you ever sell abroad

**Cons:**
- ⚠️ Dashboard is less polished than Razorpay
- ⚠️ Documentation is good but not as developer-friendly
- ⚠️ Slightly smaller ecosystem of plugins / integrations

**When to choose:** If saving 0.25 % on cards matters, or if T+1 settlement is important.

---

### Option C — PayU India

**What it is:** Older, large player. Owned by Naspers/Prosus.

**Pricing (2026):**
| Method                  | Fee                  |
| ----------------------- | -------------------- |
| UPI                     | **0 %**              |
| Cards (domestic)        | 2 % + GST            |
| NetBanking              | 1.9 % + GST          |
| EMI                     | 2.25 % + GST         |

**Setup:** ₹0 · **Annual:** ₹0
**Settlement:** T+2

**Pros:**
- ✅ Established player, won't disappear
- ✅ Good corporate-banking integrations

**Cons:**
- ⚠️ Slower KYC (5–7 days)
- ⚠️ Older API / documentation — harder to integrate
- ⚠️ Customer support is weaker than Razorpay/Cashfree

**When to choose:** Only if your bank specifically prefers PayU.

---

### Option D — PhonePe Business / PhonePe Payment Gateway

**What it is:** PhonePe's PG product (different from PhonePe Switch).

**Pricing (2026):**
| Method                  | Fee                  |
| ----------------------- | -------------------- |
| UPI (via PhonePe app)   | **0 %**              |
| UPI (other apps)        | 0.75 % + GST         |
| Cards                   | 1.99 % + GST         |
| NetBanking              | 1.99 % + GST         |

**Setup:** ₹0 · **Annual:** ₹0
**Settlement:** T+1

**Pros:**
- ✅ Strong brand recognition — customers trust PhonePe
- ✅ Best conversion rate on PhonePe UPI checkouts
- ✅ T+1 settlement

**Cons:**
- ⚠️ Charges UPI from non-PhonePe apps (GPay, Paytm) — most of your customers
- ⚠️ Documentation is improving but still behind Razorpay
- ⚠️ Smaller payment-method coverage

**When to choose:** Only if 70 %+ of your customers are PhonePe users (unlikely to be measurable upfront).

---

### Option E — Stripe India

**What it is:** Global gateway. Powerful but Indian operations are still limited.

**Pricing:**
| Method                  | Fee                  |
| ----------------------- | -------------------- |
| Domestic cards          | 2 % + GST            |
| International cards     | 3.5 % + GST          |
| UPI                     | Not natively supported well in India |

**Pros:**
- ✅ Best APIs in the world

**Cons:**
- ❌ UPI support in India is patchy
- ❌ Overkill for an Indian-only business
- ❌ More expensive than Indian gateways

**When to choose:** Only if you are billing US/EU customers too. Skip for AES.

---

### Option F — Instamojo

**What it is:** Lightweight gateway popular with freelancers and tiny businesses.

**Pricing:** ~2 % flat + ₹3 per transaction (high for the ₹10L install scenario — you'd pay ₹20,000+ per transaction)

**Cons:** Not suitable for high-ticket transactions. Skip.

---

## 3. Cost Comparison — Real AES Numbers

Let's run the math on three real scenarios for your business:

### Scenario 1: Small service ticket (₹1,250 — Split AC, 11–15 km)

| Gateway       | If paid by UPI | If paid by Credit Card |
| ------------- | -------------- | ---------------------- |
| **Razorpay**  | ₹0             | ₹25 + GST = ₹29.50     |
| **Cashfree**  | ₹0             | ₹21.88 + GST = ₹25.82  |
| **PayU**      | ₹0             | ₹25 + GST = ₹29.50     |

### Scenario 2: Medium install (₹85,000 — Split AC residential)

| Gateway       | If paid by UPI* | If paid by NetBanking | If paid by Card |
| ------------- | --------------- | --------------------- | --------------- |
| **Razorpay**  | ₹0              | ₹1,700 + GST = ₹2,006 | ₹1,700 + GST = ₹2,006 |
| **Cashfree**  | ₹0              | ₹1,615 + GST = ₹1,906 | ₹1,488 + GST = ₹1,755 |

> *UPI has a ₹1L/day limit per account, so a ₹85k UPI payment works but customer may hit limits

### Scenario 3: Large install (₹8,50,000 — VRF system for a restaurant)

UPI won't work (₹10L theoretical limit but most banks cap at ₹1L/day). So customer will pay by NetBanking, RTGS, or split across cards.

| Gateway       | NetBanking      | EMI 12-months         |
| ------------- | --------------- | --------------------- |
| **Razorpay**  | ₹17,000 + GST = ₹20,060 | ₹25,500 + GST = ₹30,090 |
| **Cashfree**  | ₹16,150 + GST = ₹19,057 | ₹23,375 + GST = ₹27,583 |

> **For big-ticket installs we should also offer a "Pay by bank transfer (RTGS)" option** where the customer transfers directly to your business account and uploads a screenshot. This avoids the ₹17–20k gateway cut entirely on really large amounts. We can build this as a manual-verification flow alongside Razorpay.

---

## 4. Feature Comparison Matrix

| Feature                          | Razorpay | Cashfree | PayU | PhonePe | Stripe | Instamojo |
| -------------------------------- | -------- | -------- | ---- | ------- | ------ | --------- |
| RBI-licensed PA                  | ✅       | ✅       | ✅   | ✅      | ✅     | ⚠️ Limited |
| UPI free                         | ✅       | ✅       | ✅   | ⚠️      | ❌     | ❌        |
| Settlement T+1 or faster         | ⚠️ T+2  | ✅ T+1   | ⚠️ T+2 | ✅ T+1 | ✅ T+2 | ⚠️ T+3   |
| Refund API                       | ✅       | ✅       | ✅   | ✅      | ✅     | ⚠️        |
| Webhook reliability              | ✅✅     | ✅       | ⚠️   | ⚠️      | ✅✅   | ⚠️        |
| Sandbox / test mode              | ✅✅     | ✅       | ⚠️   | ⚠️      | ✅✅   | ⚠️        |
| GST invoice generation           | ✅       | ✅       | ✅   | ⚠️      | ❌     | ⚠️        |
| Subscriptions (for AMC renewals) | ✅       | ✅       | ⚠️   | ❌      | ✅✅   | ❌        |
| Payment links (send via WhatsApp)| ✅       | ✅       | ✅   | ✅      | ⚠️     | ✅        |
| Discount-coupon support          | ✅       | ✅       | ⚠️   | ⚠️      | ✅     | ⚠️        |
| Documentation quality (1–5)      | 5        | 4        | 3    | 3       | 5      | 3         |
| Dashboard quality (1–5)          | 5        | 4        | 3    | 4       | 5      | 3         |
| Onboarding speed (days)          | 2–3      | 2–3      | 5–7  | 3–5     | 5–7    | 1–2       |

---

## 5. What we recommend for AES (final pick)

### **Primary: Razorpay**

Reasons:
1. UPI is free → the bulk of your service tickets (₹500–₹2,500 range) cost you ₹0 to collect.
2. Refund API is rock-solid → important because customers will reject quotes / cancel visits.
3. Subscription support → can later add AMC auto-renewals (recurring payment) without changing gateway.
4. Payment links → "send a payment link via WhatsApp" feature is built-in, useful for offline channels.
5. Built-in discount coupon engine → fits perfectly with your "admin creates 5/10/12 % coupon" requirement.

### **Plus: Manual Bank Transfer fallback for large installs (> ₹2 L)**

For high-ticket transactions, offer a second option:
- "Pay via bank transfer (RTGS/NEFT)" → shows your account details
- Customer transfers directly, uploads UTR / screenshot
- Backend marks payment as "pending verification"
- Accounts team marks it verified in admin dashboard
- Saves you ~₹15–20k in gateway fees on each big transaction

This is a 2-day extra feature on top of Razorpay integration.

---

## 6. Total Cost Estimate (Year 1)

Assume your customer mix is:
- 80 small tickets per month (avg ₹1,500, paid by UPI) = **₹0 fees**
- 15 medium tickets per month (avg ₹8,000, 60 % UPI / 40 % card) = ₹770/month
- 5 installs per month (avg ₹1.2 L, 50 % UPI / 30 % NB / 20 % EMI) = **₹7,200/month**

**Estimated annual gateway cost: ₹95,000 – ₹1,10,000**
**Plus zero one-time / setup / annual fees from Razorpay.**

This is far cheaper than the staff cost of manual reconciliation.

---

## 7. What I need from you to integrate

When you say "go", I will need:

1. **A Razorpay account** (you sign up at razorpay.com — takes 5 minutes)
2. **KYC documents** — PAN, GST cert, cancelled cheque of your business account (you upload directly to Razorpay)
3. **Test API keys** from the Razorpay dashboard (Test Mode) — share these and I integrate
4. **Live API keys** later, once KYC is approved (typically 2–3 working days)

I will build:
- A `/payment/checkout/[ticketId]` page that opens Razorpay checkout
- A backend `/api/v1/payments/initiate` and `/api/v1/payments/webhook` endpoint
- The discount-coupon admin tab (create/list/expire coupons)
- The "resume from checkout" flow (so if a customer refreshes, they land back at payment step)
- The manual bank-transfer fallback flow for amounts > ₹2 L

All in **6–8 working days** once you give the green light + test API keys.

---

## 8. Decision matrix — please pick one

| Choice                                                  | What it means                                          |
| ------------------------------------------------------- | ------------------------------------------------------ |
| ☐ Razorpay only                                         | Simplest. Best for 95 % of cases. 6 days of work.      |
| ☐ Razorpay + Manual bank-transfer for > ₹2 L           | Recommended. Saves money on big installs. 8 days.      |
| ☐ Cashfree only                                         | Slightly cheaper card fees. Same complexity. 6 days.   |
| ☐ Razorpay + EMI options exposed at checkout            | Adds No-Cost EMI for installs. +1 day. Higher fees.    |
| ☐ Something else (please name it)                       | We'll evaluate.                                        |

Tell me your pick, share Razorpay/Cashfree test API keys when you've signed up, and I'll start the integration the same day.

---

*Document prepared 27 May 2026 · Pricing accurate as of Q2 2026 · For internal AES planning only*
