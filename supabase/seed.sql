-- =====================================================================
-- MECHmetrIQ — seed data for local development
-- Category & Material Master starter set, matching the approved mockups.
-- =====================================================================

-- Processes
insert into master_items (type, name, default_unit, status) values
  ('process', 'CNC Machining', null, 'active'),
  ('process', 'Sheet Metal', null, 'active'),
  ('process', 'Laser Cutting', null, 'active'),
  ('process', '3D Printing', null, 'active'),
  ('process', 'Injection Moulding', null, 'active'),
  ('process', 'Casting', null, 'active');

-- Units
insert into master_items (type, name, status) values
  ('unit', 'kg', 'active'),
  ('unit', 'pcs', 'active'),
  ('unit', 'm', 'active'),
  ('unit', 'sheet', 'active');

-- Finishes
insert into master_items (type, name, status) values
  ('finish', 'As-machined', 'active'),
  ('finish', 'Anodised', 'active'),
  ('finish', 'Painted', 'active'),
  ('finish', 'Polished', 'active');

-- Top-level materials + grades (parent/child), matching the admin mockup
with alu as (
  insert into master_items (type, name, default_unit, applicable_processes, hsn_code, gst_rate, status)
  values ('material', 'Aluminium', 'kg', array['CNC Machining', 'Sheet Metal'], '7606', 18, 'active')
  returning id
), ss as (
  insert into master_items (type, name, default_unit, applicable_processes, hsn_code, gst_rate, status)
  values ('material', 'Stainless Steel', 'kg', array['CNC Machining', 'Casting'], '7222', 18, 'active')
  returning id
), abs_plastic as (
  insert into master_items (type, name, default_unit, applicable_processes, hsn_code, gst_rate, status)
  values ('material', 'ABS Plastic', 'kg', array['3D Printing', 'Injection Moulding'], '3903', 18, 'active')
  returning id
), ms as (
  insert into master_items (type, name, default_unit, applicable_processes, hsn_code, gst_rate, status)
  values ('material', 'Mild Steel', 'kg', array['CNC Machining', 'Sheet Metal'], '7208', 18, 'active')
  returning id
), ti as (
  insert into master_items (type, name, default_unit, applicable_processes, hsn_code, gst_rate, status)
  values ('material', 'Titanium', 'kg', array['CNC Machining'], '8108', 18, 'inactive')
  returning id
)
insert into master_items (type, name, parent_id, default_unit, applicable_processes, hsn_code, gst_rate, status)
select 'material', grade.name, grade.parent_id, 'kg', grade.processes, grade.hsn, 18, 'active'
from (values
  ('Al 6061-T6', (select id from alu), array['CNC Machining', 'Sheet Metal'], '7606'),
  ('Al 5052',    (select id from alu), array['Sheet Metal'], '7606'),
  ('SS 304',     (select id from ss),  array['CNC Machining', 'Casting'], '7222'),
  ('Ti Grade 5', (select id from ti),  array['CNC Machining'], '8108')
) as grade(name, parent_id, processes, hsn);

-- A starter coupon
insert into coupons (code, type, value, min_cart_value, expiry, usage_cap, status)
values ('WELCOME10', 'percent', 10, 5000, current_date + interval '90 days', 500, 'active');
