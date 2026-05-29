-- ============================================================
-- V12  Warranty · Location · Dynamic Pricing · Mock Payments
--      · Discount Coupons · Ticket Drafts · AMC Upgrade Requests
-- ============================================================
-- Implements the feature set agreed in PAYMENT_OPTIONS.md and
-- GOOGLE_MAPS_SETUP.md:
--   • 1-year manufacturer warranty on every AC bought via AES
--   • Customers pick exact location (Google Maps) on every ticket
--   • Service charge = (AC-type base + distance band) – coupon
--   • Customer MUST pay before the ticket is created
--   • Admin can create discount coupons (5/10/12/etc. %)
--   • Wizard is resumable (draft saved server-side until paid)
--   • "Upgrade to AMC" request once warranty has expired
-- ============================================================

-- ─── 1. Property: location + secondary contact ───────────────
ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS latitude          DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS longitude         DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS formatted_address TEXT,
    ADD COLUMN IF NOT EXISTS landmark          VARCHAR(200),
    ADD COLUMN IF NOT EXISTS google_place_id   VARCHAR(150),
    ADD COLUMN IF NOT EXISTS secondary_phone   VARCHAR(15);

-- ─── 2. AC unit: explicit warranty fields ────────────────────
-- warranty_expiry already exists from V1.  Add metadata so we can
-- show "expires in N days" and know whether the unit was sold by AES.
ALTER TABLE ac_units
    ADD COLUMN IF NOT EXISTS purchased_from_aes BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS warranty_start_date DATE,
    ADD COLUMN IF NOT EXISTS warranty_months     INT NOT NULL DEFAULT 12,
    ADD COLUMN IF NOT EXISTS purchase_invoice_no VARCHAR(50),
    ADD COLUMN IF NOT EXISTS sold_price          INT;

-- Back-fill: every existing AC unit with an installation_date is
-- treated as AES-installed with a 12-month warranty.  This means
-- the demo data lights up the new UI without manual editing.
UPDATE ac_units
   SET purchased_from_aes = TRUE,
       warranty_start_date = installation_date,
       warranty_expiry     = (installation_date + INTERVAL '12 months')::date
 WHERE installation_date IS NOT NULL
   AND warranty_start_date IS NULL;

-- ─── 3. Service ticket: location, pricing, payment ──────────
ALTER TABLE service_tickets
    -- visit-specific location (in case customer picks a different
    -- spot than the property pin, e.g. office vs registered address)
    ADD COLUMN IF NOT EXISTS service_address TEXT,
    ADD COLUMN IF NOT EXISTS service_lat     DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS service_lng     DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS landmark        VARCHAR(200),
    ADD COLUMN IF NOT EXISTS secondary_phone VARCHAR(15),

    -- pricing breakdown (only filled for P3 paid; NULL for AMC/Warranty)
    ADD COLUMN IF NOT EXISTS distance_km     NUMERIC(6,2),
    ADD COLUMN IF NOT EXISTS base_charge     INT,
    ADD COLUMN IF NOT EXISTS distance_charge INT,
    ADD COLUMN IF NOT EXISTS discount_code   VARCHAR(20),
    ADD COLUMN IF NOT EXISTS discount_pct    INT,
    ADD COLUMN IF NOT EXISTS discount_amount INT,
    ADD COLUMN IF NOT EXISTS total_charge    INT,

    -- payment state machine
    ADD COLUMN IF NOT EXISTS payment_status  VARCHAR(20) NOT NULL DEFAULT 'NOT_REQUIRED',
    ADD COLUMN IF NOT EXISTS payment_method  VARCHAR(20),
    ADD COLUMN IF NOT EXISTS payment_ref     VARCHAR(100),
    ADD COLUMN IF NOT EXISTS paid_at         TIMESTAMPTZ;

-- payment_status values:
--   NOT_REQUIRED   AMC / Warranty tickets
--   PENDING        P3 created from a paid draft, awaiting payment confirmation
--   PAID           Payment captured; ticket eligible for ops triage
--   REFUNDED       Customer cancelled, money returned

-- ─── 4. Discount coupons (admin-created) ─────────────────────
CREATE TABLE IF NOT EXISTS discount_coupons (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code            VARCHAR(30) NOT NULL UNIQUE,
    description     VARCHAR(200),
    discount_pct    INT  NOT NULL CHECK (discount_pct BETWEEN 1 AND 100),
    max_uses        INT,            -- NULL = unlimited
    times_used      INT  NOT NULL DEFAULT 0,
    valid_from      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until     TIMESTAMPTZ,
    applies_to      VARCHAR(15) NOT NULL DEFAULT 'TICKET',  -- TICKET / INSTALL / BOTH
    min_amount      INT  NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupons_code_active
    ON discount_coupons(code) WHERE is_active = TRUE;

-- ─── 5. Payment transactions (mock + real gateway audit log) ─
CREATE TABLE IF NOT EXISTS payment_transactions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id         UUID NOT NULL REFERENCES users(id),
    draft_id            UUID,                       -- nullable FK added below
    ticket_id           UUID REFERENCES service_tickets(id),
    amount              INT  NOT NULL,
    currency            VARCHAR(3) NOT NULL DEFAULT 'INR',
    status              VARCHAR(20) NOT NULL DEFAULT 'INITIATED',
            -- INITIATED -> PROCESSING -> SUCCESS / FAILED / REFUNDED
    method              VARCHAR(20),                -- MOCK_UPI / MOCK_CARD / UPI / CARD / NETBANKING
    gateway             VARCHAR(20) NOT NULL DEFAULT 'MOCK',  -- MOCK / RAZORPAY / CASHFREE
    gateway_order_id    VARCHAR(100),
    gateway_payment_id  VARCHAR(100),
    failure_reason      VARCHAR(200),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_customer  ON payment_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status    ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payments_ticket    ON payment_transactions(ticket_id);

-- ─── 6. Service-ticket drafts (resume on refresh) ────────────
CREATE TABLE IF NOT EXISTS ticket_drafts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payload_json    JSONB NOT NULL,         -- full wizard state
    step            VARCHAR(20) NOT NULL DEFAULT 'priority',
    payment_id      UUID REFERENCES payment_transactions(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX IF NOT EXISTS idx_drafts_customer ON ticket_drafts(customer_id);
CREATE INDEX IF NOT EXISTS idx_drafts_expires  ON ticket_drafts(expires_at);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_payments_draft'
    ) THEN
        ALTER TABLE payment_transactions
            ADD CONSTRAINT fk_payments_draft
            FOREIGN KEY (draft_id) REFERENCES ticket_drafts(id) ON DELETE SET NULL;
    END IF;
END$$;

-- ─── 7. AMC Upgrade Requests (after warranty has expired) ────
CREATE TABLE IF NOT EXISTS amc_upgrade_requests (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_number      VARCHAR(20) NOT NULL UNIQUE,
    customer_id         UUID NOT NULL REFERENCES users(id),
    property_id         UUID REFERENCES properties(id),
    ac_unit_id          UUID REFERENCES ac_units(id),
    status              VARCHAR(20) NOT NULL DEFAULT 'NEW',
            -- NEW -> CONTACTED -> QUOTED -> CONVERTED / CANCELLED
    preferred_plan      VARCHAR(20),    -- BASIC / PREMIUM / FULL — informational
    notes               TEXT,
    assigned_crm_id     UUID REFERENCES users(id),
    assigned_at         TIMESTAMPTZ,
    contacted_at        TIMESTAMPTZ,
    converted_amc_id    UUID REFERENCES amc_contracts(id),
    converted_at        TIMESTAMPTZ,
    cancelled_at        TIMESTAMPTZ,
    cancellation_reason VARCHAR(200),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_amcup_customer ON amc_upgrade_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_amcup_status   ON amc_upgrade_requests(status);
CREATE INDEX IF NOT EXISTS idx_amcup_assigned ON amc_upgrade_requests(assigned_crm_id);

CREATE SEQUENCE IF NOT EXISTS amc_upgrade_seq START 1001;

-- ─── 8. Demo seed: locations + AC office-distance ranges ─────
-- Pin existing demo properties around Hyderabad so the distance
-- calculator returns realistic numbers without calling Google.
-- AES office (config default): 17.4156, 78.4347 (Banjara Hills).

UPDATE properties SET
       latitude = 17.4399,  longitude = 78.4983,        -- Banjara Hills ~8km
       formatted_address = COALESCE(formatted_address,
            'Plot 12, Road 36, Jubilee Hills, Hyderabad 500033')
 WHERE id IN (SELECT id FROM properties ORDER BY created_at LIMIT 1);

UPDATE properties SET
       latitude = 17.4486,  longitude = 78.3908,        -- Gachibowli ~13km
       formatted_address = COALESCE(formatted_address,
            'Tower B, DLF Cyber City, Gachibowli, Hyderabad 500032')
 WHERE id IN (SELECT id FROM properties ORDER BY created_at OFFSET 1 LIMIT 1);

UPDATE properties SET
       latitude = 17.3850,  longitude = 78.4867,        -- Charminar ~10km
       formatted_address = COALESCE(formatted_address,
            'House 4-7-12, Charminar, Hyderabad 500002')
 WHERE id IN (SELECT id FROM properties ORDER BY created_at OFFSET 2 LIMIT 1);

UPDATE properties SET
       latitude = 17.4849,  longitude = 78.5421,        -- Uppal ~17km
       formatted_address = COALESCE(formatted_address,
            'Flat 302, Sai Residency, Uppal, Hyderabad 500039')
 WHERE id IN (SELECT id FROM properties ORDER BY created_at OFFSET 3 LIMIT 1);

UPDATE properties SET
       latitude = 17.2403,  longitude = 78.4294,        -- Shamshabad ~28km
       formatted_address = COALESCE(formatted_address,
            'Door 22, Airport Road, Shamshabad, Hyderabad 501218')
 WHERE id IN (SELECT id FROM properties ORDER BY created_at OFFSET 4 LIMIT 1);

-- Anything else left blank gets a sensible default close to the office.
UPDATE properties
   SET latitude  = 17.4156,
       longitude = 78.4347,
       formatted_address = COALESCE(formatted_address,
            address_line1 || ', ' || city)
 WHERE latitude IS NULL;

-- ─── 9. Demo seed: a few coupons admin can hand out ──────────
INSERT INTO discount_coupons (code, description, discount_pct, max_uses, applies_to)
     VALUES ('WELCOME5',   'New-customer welcome — 5% off any service', 5,  500,  'TICKET'),
            ('AMC10',      'AMC member loyalty — 10% off',            10,  NULL, 'BOTH'),
            ('FESTIVE12',  'Festive season — 12% off any service',    12,  200,  'TICKET'),
            ('SUMMER15',   'Summer special — 15% off',                15,  100,  'TICKET'),
            ('VIP20',      'Manager-approved VIP discount — 20%',     20,  NULL, 'BOTH')
ON CONFLICT (code) DO NOTHING;

-- ─── 10. Demo seed: dummy AMC-upgrade request so Ops sees it ─
INSERT INTO amc_upgrade_requests
       (request_number, customer_id, property_id, ac_unit_id, preferred_plan,
        notes, status, created_at)
SELECT 'AMCUP-2026-' || lpad(nextval('amc_upgrade_seq')::text, 4, '0'),
       u.id, p.id, ac.id, 'PREMIUM',
       'Auto-seeded demo upgrade request — customer reached out after warranty lapsed.',
       'NEW', NOW()
  FROM users u
  JOIN properties p ON p.customer_id = u.id
  JOIN ac_units   ac ON ac.property_id = p.id
 WHERE u.role = 'CUSTOMER'
   AND ac.warranty_expiry < CURRENT_DATE
 ORDER BY u.created_at
 LIMIT 1;
