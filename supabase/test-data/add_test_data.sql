-- Kueppers rental desk: TEST DATA for trying the app
-- Adds 16 owners, 18 properties, 20 units, 20 renters, 16 tenancies and 18 maintenance entries.
-- Run once in Supabase: SQL Editor → New query → paste → Run. Running it again changes nothing.
-- Remove it all later with remove_test_data.sql. Every test record's notes start with "TEST DATA".
-- Dates are relative to the day you run it, so "moving soon" and "agreement ending" scenarios work.
--
-- Records go to the first active admin. If an active property manager exists, owners 9–16 and
-- renters 5 and 11–15 go to that manager instead, so you can test the admin "Viewing" filter.

do $$
declare
  v_admin uuid;
  v_mgr uuid;
begin
  if to_regclass('public.profiles') is not null then
    select id into v_admin from public.profiles where role = 'admin' and active order by created_at limit 1;
    select id into v_mgr from public.profiles where role = 'manager' and active order by created_at limit 1;
  end if;
  if v_admin is null then
    select id into v_admin from auth.users order by created_at limit 1;
  end if;
  if v_admin is null then
    raise exception 'No user found. Create your login first.';
  end if;
  v_mgr := coalesce(v_mgr, v_admin);


  -- owners
  insert into public.owners (id, user_id, name, phone, email, contact_pref, notes) values
    ('7e570000-0000-4000-8000-000000000101', v_admin, 'Margaret MacLeod', '902-555-0101', 'margaret.macleod@example.com', 'Phone', 'TEST DATA. Prefers a call before showings.'),
    ('7e570000-0000-4000-8000-000000000102', v_admin, 'Harbour Holdings Ltd', '902-555-0102', 'office@harbourholdings.example', 'Email', 'TEST DATA. Owns two downtown buildings.'),
    ('7e570000-0000-4000-8000-000000000103', v_admin, 'Donald & Ruth Gallant', '902-555-0103', null, 'Text', 'TEST DATA. No email. Text only.'),
    ('7e570000-0000-4000-8000-000000000104', v_admin, 'Island Shore Properties', '902-555-0104', 'leasing@islandshore.example', 'Email', 'TEST DATA.'),
    ('7e570000-0000-4000-8000-000000000105', v_admin, 'Peter Arsenault', '902-555-0105', 'p.arsenault@example.com', 'Phone', 'TEST DATA. Agreement lapsed; renewal pending.'),
    ('7e570000-0000-4000-8000-000000000106', v_admin, 'Fatima Rahman', '902-555-0106', 'fatima.r@example.com', 'Email', 'TEST DATA. Basement suite in her own home.'),
    ('7e570000-0000-4000-8000-000000000107', v_admin, 'Kevin O''Brien', '902-555-0107', null, 'Text', 'TEST DATA.'),
    ('7e570000-0000-4000-8000-000000000108', v_admin, 'Charlotte Bernard', '902-555-0108', 'c.bernard@example.com', 'Phone', 'TEST DATA.'),
    ('7e570000-0000-4000-8000-000000000109', v_mgr, 'Red Sands Rentals Inc', '902-555-0109', 'hello@redsands.example', 'Email', 'TEST DATA. Rural and small-town units.'),
    ('7e570000-0000-4000-8000-000000000110', v_mgr, 'Liam Doiron', '902-555-0110', 'liam.doiron@example.com', 'Phone', 'TEST DATA.'),
    ('7e570000-0000-4000-8000-000000000111', v_mgr, 'Grace MacDonald', '902-555-0111', 'grace.mac@example.com', 'Email', 'TEST DATA. High-end condo.'),
    ('7e570000-0000-4000-8000-000000000112', v_mgr, 'Wei Zhang', '902-555-0112', 'wei.zhang@example.com', 'Text', 'TEST DATA.'),
    ('7e570000-0000-4000-8000-000000000113', v_mgr, 'Brian Campbell', '902-555-0113', 'brian.c@example.com', 'Phone', 'TEST DATA.'),
    ('7e570000-0000-4000-8000-000000000114', v_mgr, 'Sophie Gaudet', '902-555-0114', 'sophie.gaudet@example.com', 'Email', 'TEST DATA. House not yet split into units.'),
    ('7e570000-0000-4000-8000-000000000115', v_mgr, 'Ahmed Hassan', '902-555-0115', 'ahmed.h@example.com', 'Phone', 'TEST DATA. Seasonal cottage owner.'),
    ('7e570000-0000-4000-8000-000000000116', v_mgr, 'Northside Investments', '902-555-0116', 'info@northside.example', 'Email', 'TEST DATA. New client: no properties added yet.')
  on conflict (id) do nothing;

  -- properties
  insert into public.properties (id, user_id, owner_id, address, area, postal, type, agreement_start, agreement_end, fee_type, fee_value, notes) values
    ('7e570000-0000-4000-8000-000000000201', v_admin, '7e570000-0000-4000-8000-000000000101', '18 Water St', 'Charlottetown – Downtown', 'C1A 1A1', 'Duplex', current_date + -330, current_date + 40, '% of rent', 8, 'TEST DATA'),
    ('7e570000-0000-4000-8000-000000000202', v_admin, '7e570000-0000-4000-8000-000000000102', '240 Grafton St', 'Charlottetown – Downtown', 'C1A 1L5', 'Apartment building', current_date + -300, current_date + 400, '% of rent', 7, 'TEST DATA'),
    ('7e570000-0000-4000-8000-000000000203', v_admin, '7e570000-0000-4000-8000-000000000103', '12 Pine Dr', 'Stratford', 'C1B 1T2', 'House', current_date + -100, current_date + 200, 'Flat monthly', 150, 'TEST DATA'),
    ('7e570000-0000-4000-8000-000000000204', v_admin, '7e570000-0000-4000-8000-000000000104', '88 Brackley Point Rd', 'Charlottetown – Sherwood', 'C1E 1Z3', 'Apartment building', current_date + -345, current_date + 20, '% of rent', 8, 'TEST DATA'),
    ('7e570000-0000-4000-8000-000000000205', v_admin, '7e570000-0000-4000-8000-000000000105', '5 Beach Grove Rd', 'Charlottetown – West Royalty', 'C1E 1L1', 'Townhouse', current_date + -375, current_date + -10, '% of rent', 8, 'TEST DATA'),
    ('7e570000-0000-4000-8000-000000000206', v_admin, '7e570000-0000-4000-8000-000000000106', '301 University Ave', 'Charlottetown – Parkdale', 'C1A 4M8', 'Basement suite', null, null, null, null, 'TEST DATA'),
    ('7e570000-0000-4000-8000-000000000207', v_admin, '7e570000-0000-4000-8000-000000000107', '44 Granville St', 'Summerside', 'C1N 2Z5', 'House', current_date + -60, current_date + 305, '% of rent', 9, 'TEST DATA'),
    ('7e570000-0000-4000-8000-000000000208', v_admin, '7e570000-0000-4000-8000-000000000108', '9 Water St E', 'Summerside', 'C1N 1A6', 'Duplex', current_date + -200, current_date + 165, '% of rent', 8, 'TEST DATA'),
    ('7e570000-0000-4000-8000-000000000209', v_mgr, '7e570000-0000-4000-8000-000000000109', '150 Main St', 'Montague', 'C0A 1R0', 'Apartment building', current_date + -500, current_date + 230, 'Flat monthly', 120, 'TEST DATA'),
    ('7e570000-0000-4000-8000-000000000210', v_mgr, '7e570000-0000-4000-8000-000000000110', '27 Broadway St', 'Kensington', 'C0B 1M0', 'House', current_date + -30, current_date + 335, '% of rent', 8, 'TEST DATA'),
    ('7e570000-0000-4000-8000-000000000211', v_mgr, '7e570000-0000-4000-8000-000000000111', '73 Mason Rd', 'Stratford', 'C1B 2G2', 'Condo', current_date + -90, current_date + 640, '% of rent', 10, 'TEST DATA'),
    ('7e570000-0000-4000-8000-000000000212', v_mgr, '7e570000-0000-4000-8000-000000000112', '15 Hillsborough St', 'Charlottetown – Hillsborough Park', 'C1A 4W4', 'Duplex', current_date + -700, current_date + 30, '% of rent', 8, 'TEST DATA'),
    ('7e570000-0000-4000-8000-000000000213', v_mgr, '7e570000-0000-4000-8000-000000000113', '3 Harbourview Dr', 'Cornwall', 'C0A 1H0', 'House', current_date + -15, current_date + 350, '% of rent', 8, 'TEST DATA'),
    ('7e570000-0000-4000-8000-000000000214', v_mgr, '7e570000-0000-4000-8000-000000000114', '61 Church St', 'Souris', 'C0A 2B0', 'House', current_date + -5, current_date + 360, '% of rent', 8, 'TEST DATA'),
    ('7e570000-0000-4000-8000-000000000215', v_mgr, '7e570000-0000-4000-8000-000000000115', '19 Gulf Shore Rd', 'North Rustico', 'C0A 1X0', 'Other', current_date + -40, current_date + 140, 'Flat monthly', 200, 'TEST DATA'),
    ('7e570000-0000-4000-8000-000000000216', v_admin, '7e570000-0000-4000-8000-000000000102', '255 Grafton St', 'Charlottetown – Downtown', 'C1A 1L6', 'Apartment building', current_date + -300, current_date + 400, '% of rent', 7, 'TEST DATA'),
    ('7e570000-0000-4000-8000-000000000217', v_mgr, '7e570000-0000-4000-8000-000000000109', '8 Pond Rd', 'West Prince (Alberton/O''Leary/Tignish)', 'C0B 1B0', 'House', current_date + -500, current_date + 230, 'Flat monthly', 120, 'TEST DATA'),
    ('7e570000-0000-4000-8000-000000000218', v_admin, '7e570000-0000-4000-8000-000000000104', '402 Malpeque Rd', 'Charlottetown – East Royalty', 'C1E 1Y8', 'Townhouse', current_date + -345, current_date + 20, '% of rent', 8, 'TEST DATA')
  on conflict (id) do nothing;

  -- units
  insert into public.units (id, user_id, property_id, label, rent, beds, baths, status, pets, parking, utilities, available_date, notes) values
    ('7e570000-0000-4000-8000-000000000301', v_admin, '7e570000-0000-4000-8000-000000000201', 'Unit A', 1450, 2, 1, 'Rented', true, true, 'Water', null, 'TEST DATA. Current tenant since last year.'),
    ('7e570000-0000-4000-8000-000000000302', v_admin, '7e570000-0000-4000-8000-000000000201', 'Unit B', 1400, 2, 1, 'Vacant', false, true, 'Water', current_date + 5, 'TEST DATA. Freshly painted after the last move-out.'),
    ('7e570000-0000-4000-8000-000000000303', v_admin, '7e570000-0000-4000-8000-000000000202', 'Apt 101', 1250, 1, 1, 'Listed', false, true, 'Heat, water', current_date + 10, 'TEST DATA. Ground floor.'),
    ('7e570000-0000-4000-8000-000000000304', v_admin, '7e570000-0000-4000-8000-000000000202', 'Apt 205', 1650, 2, 1.5, 'Rented', true, true, 'Heat, water', null, 'TEST DATA.'),
    ('7e570000-0000-4000-8000-000000000305', v_admin, '7e570000-0000-4000-8000-000000000202', 'Apt 310', 2100, 3, 2, 'Listed', true, true, 'Heat, water, electricity', current_date + 45, 'TEST DATA. Top floor, harbour view.'),
    ('7e570000-0000-4000-8000-000000000306', v_admin, '7e570000-0000-4000-8000-000000000203', 'Whole house', 1950, 3, 1.5, 'Vacant', true, true, null, current_date + -3, 'TEST DATA. Available now. Fenced yard.'),
    ('7e570000-0000-4000-8000-000000000307', v_admin, '7e570000-0000-4000-8000-000000000204', 'Unit 1', 1100, 0, 1, 'Listed', false, false, 'All included', current_date + 0, 'TEST DATA. Bachelor (0 bedrooms).'),
    ('7e570000-0000-4000-8000-000000000308', v_admin, '7e570000-0000-4000-8000-000000000204', 'Unit 2', 1350, 1, 1, 'Rented', false, true, 'Heat', null, 'TEST DATA.'),
    ('7e570000-0000-4000-8000-000000000309', v_admin, '7e570000-0000-4000-8000-000000000205', 'Whole townhouse', 1800, 3, 2.5, 'Not available', true, true, null, null, 'TEST DATA. Kitchen renovation until spring.'),
    ('7e570000-0000-4000-8000-000000000310', v_admin, '7e570000-0000-4000-8000-000000000206', 'Basement', 950, 1, 1, 'Vacant', false, false, 'All included', current_date + 14, 'TEST DATA. Separate entrance. Owner lives upstairs.'),
    ('7e570000-0000-4000-8000-000000000311', v_admin, '7e570000-0000-4000-8000-000000000207', 'Whole house', 1600, 3, 1, 'Listed', true, true, null, current_date + 30, 'TEST DATA.'),
    ('7e570000-0000-4000-8000-000000000312', v_admin, '7e570000-0000-4000-8000-000000000208', 'Upstairs', 1300, 2, 1, 'Rented', true, false, 'Water', null, 'TEST DATA.'),
    ('7e570000-0000-4000-8000-000000000313', v_admin, '7e570000-0000-4000-8000-000000000208', 'Downstairs', 1250, 2, 1, 'Vacant', true, true, 'Water', current_date + 60, 'TEST DATA. Floors being redone after a difficult tenancy.'),
    ('7e570000-0000-4000-8000-000000000314', v_mgr, '7e570000-0000-4000-8000-000000000209', 'Apt 3', 1050, 1, 1, 'Listed', false, true, 'Heat, water', current_date + 7, 'TEST DATA.'),
    ('7e570000-0000-4000-8000-000000000315', v_mgr, '7e570000-0000-4000-8000-000000000210', 'Whole house', 1500, 4, 2, 'Vacant', true, true, null, current_date + 20, 'TEST DATA. Big lot, close to school.'),
    ('7e570000-0000-4000-8000-000000000316', v_mgr, '7e570000-0000-4000-8000-000000000211', 'Unit 204', 2400, 2, 2, 'Listed', false, true, 'Heat, water', current_date + 15, 'TEST DATA. Luxury condo, underground parking.'),
    ('7e570000-0000-4000-8000-000000000317', v_mgr, '7e570000-0000-4000-8000-000000000212', 'Unit A', 1550, 2, 1, 'Rented', false, true, 'Water', null, 'TEST DATA.'),
    ('7e570000-0000-4000-8000-000000000318', v_mgr, '7e570000-0000-4000-8000-000000000213', 'Whole house', 2600, 4, 2.5, 'Listed', true, true, null, current_date + 90, 'TEST DATA. Waterfront.'),
    ('7e570000-0000-4000-8000-000000000319', v_admin, '7e570000-0000-4000-8000-000000000216', 'Apt 402', 1700, 2, 1, 'Rented', true, true, 'Heat', null, 'TEST DATA.'),
    ('7e570000-0000-4000-8000-000000000320', v_admin, '7e570000-0000-4000-8000-000000000218', 'Townhouse', 1750, 3, 1.5, 'Listed', true, true, null, current_date + 21, 'TEST DATA. End unit.')
  on conflict (id) do nothing;

  -- renters
  insert into public.renters (id, user_id, name, phone, email, budget, beds, move_in, areas, pets, parking, source, status, consent, consent_date, notes) values
    ('7e570000-0000-4000-8000-000000000401', v_admin, 'Jordan Lee', '902-555-0201', 'jordan.lee@example.com', 1500, 2, current_date + -400, array['Charlottetown – Downtown'], true, true, 'Kijiji', 'Placed', true, current_date - 3, 'TEST DATA. Current tenant. One cat.'),
    ('7e570000-0000-4000-8000-000000000402', v_admin, 'Amira Haddad', '902-555-0202', 'amira.h@example.com', 1700, 2, current_date + -200, array['Charlottetown – Downtown'], true, true, 'Referral', 'Placed', true, current_date - 3, 'TEST DATA. Current tenant.'),
    ('7e570000-0000-4000-8000-000000000403', v_admin, 'Ben Murphy', '902-555-0203', null, 1400, 1, current_date + -90, '{}'::text[], false, true, 'Walk-in', 'Placed', true, current_date - 3, 'TEST DATA. Moved from Summerside to Sherwood.'),
    ('7e570000-0000-4000-8000-000000000404', v_admin, 'Chloe Doucette', '902-555-0204', 'chloe.d@example.com', 1350, 2, current_date + -30, array['Summerside'], true, false, 'Facebook Marketplace', 'Placed', true, current_date - 3, 'TEST DATA. Moved in last month.'),
    ('7e570000-0000-4000-8000-000000000405', v_mgr, 'Daniel Kim', '902-555-0205', 'daniel.kim@example.com', 1600, 2, current_date + -700, array['Charlottetown – Hillsborough Park'], false, true, 'Rentals.ca', 'Placed', true, current_date - 3, 'TEST DATA. Long-term tenant.'),
    ('7e570000-0000-4000-8000-000000000406', v_admin, 'Emma Gallant', '902-555-0206', 'emma.g@example.com', 1750, 2, current_date + -15, array['Charlottetown – Downtown'], true, true, 'Lawn sign', 'Placed', true, current_date - 3, 'TEST DATA. Just moved in.'),
    ('7e570000-0000-4000-8000-000000000407', v_admin, 'Sam Patel', '902-555-0207', 'sam.patel@example.com', 1500, 2, current_date + 10, array['Charlottetown – Downtown', 'Charlottetown – Brighton'], false, true, 'Phone call', 'Looking', true, current_date - 3, 'TEST DATA. Should match 18 Water St Unit B.'),
    ('7e570000-0000-4000-8000-000000000408', v_admin, 'Riley Chen', '902-555-0208', 'riley.chen@example.com', 1700, 2, current_date + 25, array['Stratford'], true, true, 'Kijiji', 'Looking', true, current_date - 3, 'TEST DATA. Wants Stratford only.'),
    ('7e570000-0000-4000-8000-000000000409', v_admin, 'Olivia Martin', '902-555-0209', 'olivia.m@example.com', 2000, 3, current_date + 5, array['Stratford', 'Cornwall'], true, true, 'Referral', 'Looking', true, current_date - 3, 'TEST DATA. Family of four moving from Halifax. Two dogs.'),
    ('7e570000-0000-4000-8000-000000000410', v_admin, 'Noah Arsenault', '902-555-0210', null, 1100, 1, current_date + 7, '{}'::text[], false, false, 'Walk-in', 'Looking', true, current_date - 3, 'TEST DATA. Any area. Moving in a week.'),
    ('7e570000-0000-4000-8000-000000000411', v_mgr, 'Ava Thompson', '902-555-0211', 'ava.t@example.com', 1000, 1, current_date + 40, array['Summerside'], false, false, 'Facebook Marketplace', 'Looking', true, current_date - 3, 'TEST DATA. No match expected: nothing that cheap in Summerside.'),
    ('7e570000-0000-4000-8000-000000000412', v_mgr, 'Liam Bernard', '902-555-0212', 'liam.b@example.com', 1650, 2, current_date + 60, array['Summerside'], true, true, 'Kijiji', 'Looking', true, current_date - 3, 'TEST DATA. Has a dog.'),
    ('7e570000-0000-4000-8000-000000000413', v_mgr, 'Mia Robichaud', '902-555-0213', 'mia.r@example.com', 900, 1, current_date + 20, array['Charlottetown – Parkdale', 'Charlottetown – Downtown'], false, false, 'Phone call', 'Looking', true, current_date - 3, 'TEST DATA. Budget just under the Parkdale basement: try a 10% budget stretch.'),
    ('7e570000-0000-4000-8000-000000000414', v_mgr, 'Ethan Singh', '902-555-0214', 'ethan.singh@example.com', 2600, 4, current_date + 90, array['Cornwall', 'Stratford'], true, true, 'Referral', 'Looking', true, current_date - 3, 'TEST DATA. Relocating for work in spring.'),
    ('7e570000-0000-4000-8000-000000000415', v_mgr, 'Isabella Wong', '902-555-0215', null, 1300, 2, current_date + 30, array['Montague'], false, true, 'Website form', 'Looking', false, null, 'TEST DATA. No consent recorded yet: should show a warning.'),
    ('7e570000-0000-4000-8000-000000000416', v_admin, 'Lucas Gaudet', null, null, 1500, null, null, '{}'::text[], false, false, null, 'Looking', true, current_date - 3, 'TEST DATA. Only name and budget known.'),
    ('7e570000-0000-4000-8000-000000000417', v_admin, 'Zoe MacLean', '902-555-0217', 'zoe.m@example.com', 1800, 3, current_date + 21, array['Charlottetown – East Royalty', 'Charlottetown – Sherwood'], true, true, 'Rentals.ca', 'Looking', true, current_date - 3, 'TEST DATA. Rented with us before: good history.'),
    ('7e570000-0000-4000-8000-000000000418', v_admin, 'Henry Clarke', '902-555-0218', 'henry.c@example.com', 1400, 2, null, '{}'::text[], false, true, 'Referral', 'Inactive', true, current_date - 3, 'TEST DATA. Moved to Ontario.'),
    ('7e570000-0000-4000-8000-000000000419', v_admin, 'Lily Pineau', '902-555-0219', 'lily.p@example.com', 1300, 2, null, '{}'::text[], true, false, 'Kijiji', 'Inactive', true, current_date - 3, 'TEST DATA. Two past tenancies with problems.'),
    ('7e570000-0000-4000-8000-000000000420', v_admin, 'Jack Doiron', '902-555-0220', 'jack.d@example.com', 1400, 2, current_date + 30, '{}'::text[], false, true, 'Phone call', 'Looking', true, current_date - 3, 'TEST DATA. Looking again after two tenancies with us.')
  on conflict (id) do nothing;

  -- tenancies (rental history; a blank move-out means they live there now)
  insert into public.tenancies (id, user_id, unit_id, renter_id, unit_snapshot, move_in, move_out, rent, deposit, would_rent_again, payment_notes, notes) values
    ('7e570000-0000-4000-8000-000000000501', v_admin, '7e570000-0000-4000-8000-000000000301', '7e570000-0000-4000-8000-000000000401', '18 Water St · Unit A', current_date + -400, null, 1450, 725, null, null, null),
    ('7e570000-0000-4000-8000-000000000502', v_admin, '7e570000-0000-4000-8000-000000000304', '7e570000-0000-4000-8000-000000000402', '240 Grafton St · Apt 205', current_date + -200, null, 1650, 825, null, null, null),
    ('7e570000-0000-4000-8000-000000000503', v_admin, '7e570000-0000-4000-8000-000000000308', '7e570000-0000-4000-8000-000000000403', '88 Brackley Point Rd · Unit 2', current_date + -90, null, 1350, 675, null, null, null),
    ('7e570000-0000-4000-8000-000000000504', v_admin, '7e570000-0000-4000-8000-000000000312', '7e570000-0000-4000-8000-000000000404', '9 Water St E · Upstairs', current_date + -30, null, 1300, 650, null, null, null),
    ('7e570000-0000-4000-8000-000000000505', v_mgr, '7e570000-0000-4000-8000-000000000317', '7e570000-0000-4000-8000-000000000405', '15 Hillsborough St · Unit A', current_date + -700, null, 1500, 750, null, null, 'Rent raised from 1,450 last year (within the IRAC limit).'),
    ('7e570000-0000-4000-8000-000000000506', v_admin, '7e570000-0000-4000-8000-000000000319', '7e570000-0000-4000-8000-000000000406', '255 Grafton St · Apt 402', current_date + -15, null, 1700, 850, null, null, null),
    ('7e570000-0000-4000-8000-000000000507', v_admin, '7e570000-0000-4000-8000-000000000303', '7e570000-0000-4000-8000-000000000401', '240 Grafton St · Apt 101', current_date + -1100, current_date + -401, 1150, 575, 'Yes', 'Always paid on the 1st.', 'Moved to a bigger unit with us.'),
    ('7e570000-0000-4000-8000-000000000508', v_admin, '7e570000-0000-4000-8000-000000000302', '7e570000-0000-4000-8000-000000000418', '18 Water St · Unit B', current_date + -900, current_date + -20, 1350, 675, 'Yes', 'Paid on time all 29 months.', 'Left the unit spotless. Full deposit returned.'),
    ('7e570000-0000-4000-8000-000000000509', v_admin, '7e570000-0000-4000-8000-000000000313', '7e570000-0000-4000-8000-000000000419', '9 Water St E · Downstairs', current_date + -500, current_date + -70, 1200, 600, 'No', 'Late 5 times; two NSF cheques.', 'Wall damage in the living room; deposit kept.'),
    ('7e570000-0000-4000-8000-000000000510', v_admin, '7e570000-0000-4000-8000-000000000309', '7e570000-0000-4000-8000-000000000419', '5 Beach Grove Rd · Whole townhouse', current_date + -1200, current_date + -520, 1700, 850, 'Maybe', 'Late twice.', 'Minor wear.'),
    ('7e570000-0000-4000-8000-000000000511', v_admin, '7e570000-0000-4000-8000-000000000306', '7e570000-0000-4000-8000-000000000420', '12 Pine Dr · Whole house', current_date + -1500, current_date + -800, 1800, 900, 'Maybe', 'Late twice in the first year, then on time.', null),
    ('7e570000-0000-4000-8000-000000000512', v_admin, '7e570000-0000-4000-8000-000000000310', '7e570000-0000-4000-8000-000000000420', '301 University Ave · Basement', current_date + -780, current_date + -200, 925, 460, 'Yes', 'On time.', 'Very tidy.'),
    ('7e570000-0000-4000-8000-000000000513', v_admin, '7e570000-0000-4000-8000-000000000305', '7e570000-0000-4000-8000-000000000417', '240 Grafton St · Apt 310', current_date + -1000, current_date + -300, 2000, 1000, 'Yes', 'On time every month.', 'Great communication.'),
    ('7e570000-0000-4000-8000-000000000514', v_admin, '7e570000-0000-4000-8000-000000000312', '7e570000-0000-4000-8000-000000000403', '9 Water St E · Upstairs', current_date + -800, current_date + -100, 1250, 625, 'Yes', 'On time.', null),
    ('7e570000-0000-4000-8000-000000000515', v_mgr, '7e570000-0000-4000-8000-000000000317', '7e570000-0000-4000-8000-000000000418', '15 Hillsborough St · Unit A', current_date + -1600, current_date + -910, 1200, 600, 'Yes', 'On time.', null),
    ('7e570000-0000-4000-8000-000000000516', v_mgr, '7e570000-0000-4000-8000-000000000315', '7e570000-0000-4000-8000-000000000410', '27 Broadway St · Whole house', current_date + -600, current_date + -60, 1400, 700, 'Yes', 'On time.', 'Moved for a smaller place.')
  on conflict (id) do nothing;

  -- maintenance
  insert into public.maintenance (id, user_id, unit_id, date, description, vendor, cost) values
    ('7e570000-0000-4000-8000-000000000601', v_admin, '7e570000-0000-4000-8000-000000000302', current_date + -18, 'Repainted after move-out', 'Island Painting', 650),
    ('7e570000-0000-4000-8000-000000000602', v_admin, '7e570000-0000-4000-8000-000000000302', current_date + -12, 'Deep clean', 'Sparkle Cleaning', 220),
    ('7e570000-0000-4000-8000-000000000603', v_admin, '7e570000-0000-4000-8000-000000000301', current_date + -45, 'Furnace serviced', 'Island Heating', 180),
    ('7e570000-0000-4000-8000-000000000604', v_admin, '7e570000-0000-4000-8000-000000000304', current_date + -60, 'Dishwasher replaced', 'Appliance Depot', 780),
    ('7e570000-0000-4000-8000-000000000605', v_admin, '7e570000-0000-4000-8000-000000000306', current_date + -5, 'Locks changed', 'Charlottetown Lock & Key', 140),
    ('7e570000-0000-4000-8000-000000000606', v_admin, '7e570000-0000-4000-8000-000000000309', current_date + -20, 'Kitchen demolition (renovation)', 'MacKinnon Contracting', 4200),
    ('7e570000-0000-4000-8000-000000000607', v_admin, '7e570000-0000-4000-8000-000000000313', current_date + -65, 'Patched and repainted living room wall', 'Island Painting', 900),
    ('7e570000-0000-4000-8000-000000000608', v_admin, '7e570000-0000-4000-8000-000000000313', current_date + -10, 'Floor refinishing started', 'Red Clay Flooring', 1850),
    ('7e570000-0000-4000-8000-000000000609', v_admin, '7e570000-0000-4000-8000-000000000312', current_date + -120, 'Smoke detectors replaced', 'Safety First PEI', 95),
    ('7e570000-0000-4000-8000-000000000610', v_admin, '7e570000-0000-4000-8000-000000000308', current_date + -200, 'Bathroom fan replaced', 'Bright Electric', 160),
    ('7e570000-0000-4000-8000-000000000611', v_mgr, '7e570000-0000-4000-8000-000000000317', current_date + -30, 'Gutter cleaning', 'Island Exteriors', 120),
    ('7e570000-0000-4000-8000-000000000612', v_admin, '7e570000-0000-4000-8000-000000000319', current_date + -14, 'Move-in inspection', null, null),
    ('7e570000-0000-4000-8000-000000000613', v_admin, '7e570000-0000-4000-8000-000000000305', current_date + -280, 'Window seal repair', 'Clear View Glass', 340),
    ('7e570000-0000-4000-8000-000000000614', v_admin, '7e570000-0000-4000-8000-000000000310', current_date + -190, 'Dehumidifier installed', 'Appliance Depot', 310),
    ('7e570000-0000-4000-8000-000000000615', v_mgr, '7e570000-0000-4000-8000-000000000315', current_date + -50, 'Lawn and yard clean-up', 'Green Gables Landscaping', 260),
    ('7e570000-0000-4000-8000-000000000616', v_mgr, '7e570000-0000-4000-8000-000000000316', current_date + -75, 'Heat pump serviced', 'Island Heating', 210),
    ('7e570000-0000-4000-8000-000000000617', v_mgr, '7e570000-0000-4000-8000-000000000318', current_date + -25, 'Dock inspection', 'Harbour Marine', 150),
    ('7e570000-0000-4000-8000-000000000618', v_admin, '7e570000-0000-4000-8000-000000000303', current_date + -8, 'Snow tyres for shared snowblower', 'Kensington Hardware', 90)
  on conflict (id) do nothing;

  raise notice 'Test data added for admin % (manager %).', v_admin, v_mgr;
end $$;
