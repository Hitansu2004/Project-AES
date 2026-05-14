-- ============================================================
-- AES Customer Portal — V2 Seed Data
-- ============================================================

-- Initial users
INSERT INTO users (id, phone_number, name, email, role) VALUES
  ('11111111-0000-0000-0000-000000000001', '+919876543210', 'Mahesh Reddy', 'mahesh@example.com', 'CUSTOMER'),
  ('22222222-0000-0000-0000-000000000001', '+919876543220', 'Priya Sharma', 'priya@example.com', 'CUSTOMER'),
  ('33333333-0000-0000-0000-000000000001', '+919800000001', 'Ravi Kumar', 'ravi.crm@aes.com', 'CRM_AGENT'),
  ('44444444-0000-0000-0000-000000000001', '+919800000002', 'Suresh Babu', 'suresh.mgr@aes.com', 'SERVICE_MANAGER'),
  ('55555555-0000-0000-0000-000000000001', '+919800000003', 'Anand Rao', 'anand.admin@aes.com', 'ADMIN');

-- Initial property for Mahesh
INSERT INTO properties (id, customer_id, label, address_line1, city, pincode, property_type, is_primary)
VALUES ('aaaa0000-0000-0000-0000-000000000001',
        '11111111-0000-0000-0000-000000000001',
        'Villa #42',
        'Plot 42, Road No. 10, Jubilee Hills',
        'Hyderabad', '500033', 'RESIDENTIAL', TRUE);

-- Initial AMC contract for Mahesh's property
INSERT INTO amc_contracts (id, customer_id, property_id, contract_number, start_date, end_date, visits_per_year, visits_completed, is_active, contract_value)
VALUES ('cccc0000-0000-0000-0000-000000000001',
        '11111111-0000-0000-0000-000000000001',
        'aaaa0000-0000-0000-0000-000000000001',
        'AMC-2024-0042',
        '2024-01-01', '2024-12-31', 4, 1, TRUE, 12000.00);

-- Initial AC units for Mahesh's villa
INSERT INTO ac_units (id, property_id, customer_id, room_label, ac_type, brand, model_number, tonnage, warranty_status, service_status, amc_contract_id)
VALUES
  ('bbbb0001-0000-0000-0000-000000000001', 'aaaa0000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001',
   'Master Bedroom', 'SPLIT', 'Daikin', 'FTKF35TV', 1.5, 'IN_WARRANTY', 'P2_WARRANTY', NULL),
  ('bbbb0002-0000-0000-0000-000000000001', 'aaaa0000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001',
   'Living Room', 'CENTRAL', 'Carrier', '2TDUCTED', 2.0, 'IN_WARRANTY', 'P1_AMC', 'cccc0000-0000-0000-0000-000000000001'),
  ('bbbb0003-0000-0000-0000-000000000001', 'aaaa0000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001',
   'Guest Room 1', 'SPLIT', 'LG', 'LS-Q12YNZA', 1.0, 'EXPIRED', 'P3_PAID', NULL),
  ('bbbb0004-0000-0000-0000-000000000001', 'aaaa0000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001',
   'Guest Room 2', 'SPLIT', 'LG', 'LS-Q12YNZA', 1.0, 'IN_WARRANTY', 'P1_AMC', 'cccc0000-0000-0000-0000-000000000001'),
  ('bbbb0005-0000-0000-0000-000000000001', 'aaaa0000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001',
   'Study Room', 'WINDOW', 'Voltas', 'WM-150H', 1.5, 'EXPIRED', 'P3_PAID', NULL);

-- Initial AMC visits
INSERT INTO amc_visits (id, contract_id, visit_number, scheduled_date, scheduled_time_slot, status)
VALUES
  ('dddd0001-0000-0000-0000-000000000001', 'cccc0000-0000-0000-0000-000000000001', 1, '2024-03-15', 'MORNING', 'COMPLETED'),
  ('dddd0002-0000-0000-0000-000000000001', 'cccc0000-0000-0000-0000-000000000001', 2, '2024-06-15', 'AFTERNOON', 'SCHEDULED'),
  ('dddd0003-0000-0000-0000-000000000001', 'cccc0000-0000-0000-0000-000000000001', 3, '2024-09-15', 'MORNING', 'SCHEDULED'),
  ('dddd0004-0000-0000-0000-000000000001', 'cccc0000-0000-0000-0000-000000000001', 4, '2024-11-15', 'MORNING', 'SCHEDULED');
