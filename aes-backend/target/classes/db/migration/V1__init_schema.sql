-- ============================================================
-- AES Customer Portal — V1 Initial Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS & AUTH
-- ============================================================

CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number        VARCHAR(15) NOT NULL UNIQUE,
    name                VARCHAR(100),
    email               VARCHAR(150),
    role                VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER',
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE otp_tokens (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number        VARCHAR(15) NOT NULL,
    otp_code            VARCHAR(6) NOT NULL,
    expires_at          TIMESTAMPTZ NOT NULL,
    is_used             BOOLEAN NOT NULL DEFAULT FALSE,
    attempt_count       INT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE refresh_tokens (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token               VARCHAR(512) NOT NULL UNIQUE,
    expires_at          TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PROPERTIES & AC ASSETS
-- ============================================================

CREATE TABLE properties (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label               VARCHAR(100) NOT NULL,
    address_line1       VARCHAR(200) NOT NULL,
    address_line2       VARCHAR(200),
    city                VARCHAR(100) NOT NULL DEFAULT 'Hyderabad',
    pincode             VARCHAR(10),
    property_type       VARCHAR(20) NOT NULL DEFAULT 'RESIDENTIAL',
    is_primary          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ac_units (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id         UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    customer_id         UUID NOT NULL REFERENCES users(id),
    room_label          VARCHAR(100) NOT NULL,
    ac_type             VARCHAR(20) NOT NULL,
    brand               VARCHAR(50) NOT NULL,
    model_number        VARCHAR(100),
    tonnage             DECIMAL(3,1) NOT NULL,
    energy_star_rating  INT,
    installation_date   DATE,
    warranty_expiry     DATE,
    amc_contract_id     UUID,
    warranty_status     VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
    service_status      VARCHAR(20) NOT NULL DEFAULT 'P3_PAID',
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AMC CONTRACTS
-- ============================================================

CREATE TABLE amc_contracts (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id         UUID NOT NULL REFERENCES users(id),
    property_id         UUID NOT NULL REFERENCES properties(id),
    contract_number     VARCHAR(50) NOT NULL UNIQUE,
    start_date          DATE NOT NULL,
    end_date            DATE NOT NULL,
    visits_per_year     INT NOT NULL DEFAULT 4,
    visits_completed    INT NOT NULL DEFAULT 0,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_engineer_id UUID REFERENCES users(id),
    contract_value      DECIMAL(10,2),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK from ac_units to amc_contracts
ALTER TABLE ac_units ADD CONSTRAINT fk_ac_units_amc
    FOREIGN KEY (amc_contract_id) REFERENCES amc_contracts(id);

CREATE TABLE amc_visits (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id         UUID NOT NULL REFERENCES amc_contracts(id),
    visit_number        INT NOT NULL,
    scheduled_date      DATE,
    scheduled_time_slot VARCHAR(20),
    actual_visit_date   TIMESTAMPTZ,
    engineer_id         UUID REFERENCES users(id),
    status              VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INSTALLATION REQUESTS
-- ============================================================

CREATE TABLE installation_requests (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_number      VARCHAR(20) NOT NULL UNIQUE,
    customer_id         UUID NOT NULL REFERENCES users(id),
    property_id         UUID REFERENCES properties(id),
    property_address    TEXT,
    ac_type             VARCHAR(20) NOT NULL,
    brand               VARCHAR(50),
    model_number        VARCHAR(100),
    tonnage             DECIMAL(3,1),
    energy_rating       INT,
    rooms_json          JSONB,
    scheduled_date      DATE,
    scheduled_slot      VARCHAR(20),
    status              VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    assigned_engineer_id UUID REFERENCES users(id),
    estimated_cost      DECIMAL(10,2),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SERVICE TICKETS — CORE TABLE
-- ============================================================

CREATE TABLE service_tickets (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_number       VARCHAR(20) NOT NULL UNIQUE,
    customer_id         UUID NOT NULL REFERENCES users(id),
    property_id         UUID NOT NULL REFERENCES properties(id),
    ac_unit_id          UUID NOT NULL REFERENCES ac_units(id),
    priority            VARCHAR(5) NOT NULL,
    service_type        VARCHAR(20) NOT NULL,
    problem_category    VARCHAR(30) NOT NULL,
    error_code          VARCHAR(10),
    problem_description TEXT,
    photos_json         JSONB,
    scheduled_date      DATE,
    scheduled_slot      VARCHAR(20),

    -- Current assignment
    current_level       INT NOT NULL DEFAULT 1,
    current_assignee_id UUID REFERENCES users(id),
    assigned_at         TIMESTAMPTZ,

    -- Status
    status              VARCHAR(20) NOT NULL DEFAULT 'OPEN',

    -- SLA tracking
    sla_deadline_l1     TIMESTAMPTZ,
    sla_deadline_l2     TIMESTAMPTZ,
    sla_deadline_final  TIMESTAMPTZ,
    acknowledged_at     TIMESTAMPTZ,
    resolved_at         TIMESTAMPTZ,
    closed_at           TIMESTAMPTZ,

    -- Charges (P3 only)
    estimated_charge    DECIMAL(10,2),
    final_charge        DECIMAL(10,2),
    charge_accepted     BOOLEAN,

    -- Rating
    customer_rating     INT,
    customer_feedback   TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TICKET ESCALATION HISTORY
-- ============================================================

CREATE TABLE ticket_escalation_log (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id           UUID NOT NULL REFERENCES service_tickets(id),
    from_level          INT NOT NULL,
    to_level            INT NOT NULL,
    from_user_id        UUID REFERENCES users(id),
    reason              VARCHAR(200) NOT NULL,
    escalation_type     VARCHAR(10) NOT NULL,
    escalated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TICKET ACTIVITY TIMELINE
-- ============================================================

CREATE TABLE ticket_activities (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id           UUID NOT NULL REFERENCES service_tickets(id),
    user_id             UUID REFERENCES users(id),
    activity_type       VARCHAR(30) NOT NULL,
    description         TEXT NOT NULL,
    metadata_json       JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PART REQUESTS
-- ============================================================

CREATE TABLE part_requests (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id           UUID NOT NULL REFERENCES service_tickets(id),
    requested_by        UUID NOT NULL REFERENCES users(id),
    part_name           VARCHAR(200) NOT NULL,
    quantity            INT NOT NULL DEFAULT 1,
    urgency             VARCHAR(10) NOT NULL DEFAULT 'NORMAL',
    notes               TEXT,
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    approved_by         UUID REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS LOG
-- ============================================================

CREATE TABLE notifications (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id),
    title               VARCHAR(200) NOT NULL,
    body                TEXT NOT NULL,
    type                VARCHAR(30) NOT NULL,
    reference_id        UUID,
    reference_type      VARCHAR(20),
    is_read             BOOLEAN NOT NULL DEFAULT FALSE,
    sent_sms            BOOLEAN NOT NULL DEFAULT FALSE,
    sent_push           BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES (critical for performance)
-- ============================================================

CREATE INDEX idx_service_tickets_customer         ON service_tickets(customer_id);
CREATE INDEX idx_service_tickets_status           ON service_tickets(status);
CREATE INDEX idx_service_tickets_current_level    ON service_tickets(current_level);
CREATE INDEX idx_service_tickets_assignee         ON service_tickets(current_assignee_id);
CREATE INDEX idx_service_tickets_sla_l1           ON service_tickets(sla_deadline_l1) WHERE status = 'OPEN';
CREATE INDEX idx_service_tickets_priority         ON service_tickets(priority);
CREATE INDEX idx_ticket_activities_ticket         ON ticket_activities(ticket_id);
CREATE INDEX idx_escalation_log_ticket            ON ticket_escalation_log(ticket_id);
CREATE INDEX idx_otp_phone                        ON otp_tokens(phone_number, is_used);
CREATE INDEX idx_notifications_user_unread        ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_ac_units_customer                ON ac_units(customer_id);
CREATE INDEX idx_ac_units_property                ON ac_units(property_id);

-- ============================================================
-- SEQUENCES for ticket/request numbering
-- ============================================================

CREATE SEQUENCE ticket_seq START 1;
CREATE SEQUENCE installation_req_seq START 1;
