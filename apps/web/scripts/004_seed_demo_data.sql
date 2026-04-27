-- Seed demo data for testing
-- This script creates demo users, company, and sample documents

-- Create demo company
INSERT INTO public.organizations (id, name, slug, industry)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'Empresa Demo', 'empresa-demo', 'Tecnología')
ON CONFLICT (id) DO NOTHING;

-- Create demo admin user (will be created via auth in practice)
-- For now, we'll add it to profiles assuming the auth user exists
-- Email: admin@test.com
-- Password: Admin123!
-- This user ID would be created via Supabase Auth

-- Create demo company user (will be created via auth in practice)
-- Email: empresa@test.com
-- Password: Empresa123!

-- Add demo users to the organization as members
-- Admin user
INSERT INTO public.organization_members (organization_id, user_id, role)
SELECT '00000000-0000-0000-0000-000000000001'::uuid, id, 'owner'
FROM auth.users
WHERE email = 'admin@test.com'
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Company user
INSERT INTO public.organization_members (organization_id, user_id, role)
SELECT '00000000-0000-0000-0000-000000000001'::uuid, id, 'member'
FROM auth.users
WHERE email = 'empresa@test.com'
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Create sample company for demo
INSERT INTO public.companies (organization_id, name, cif, sector, city, address, phone, email, contact_person, total_invoiced)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Empresa Demo',
  'B12345678',
  'Servicios',
  'Madrid',
  'Calle Principal, 123',
  '+34 912 345 678',
  'info@empresademo.es',
  'Juan García',
  15000.00
)
ON CONFLICT DO NOTHING;

-- Get the company ID for document creation
WITH demo_company AS (
  SELECT id FROM public.companies 
  WHERE name = 'Empresa Demo' AND organization_id = '00000000-0000-0000-0000-000000000001'::uuid
  LIMIT 1
)

-- Create sample invoices
INSERT INTO public.documents (organization_id, company_id, document_number, document_type, date, due_date, status, total_amount, tax_amount, subtotal, description, created_by)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  demo_company.id,
  'FAC-001',
  'invoice',
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE - INTERVAL '15 days',
  'paid',
  2500.00,
  475.00,
  2025.00,
  'Servicios de consultoría mes 1',
  (SELECT id FROM auth.users WHERE email = 'admin@test.com' LIMIT 1)
FROM demo_company
ON CONFLICT DO NOTHING;

INSERT INTO public.documents (organization_id, company_id, document_number, document_type, date, due_date, status, total_amount, tax_amount, subtotal, description, created_by)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  demo_company.id,
  'FAC-002',
  'invoice',
  CURRENT_DATE - INTERVAL '20 days',
  CURRENT_DATE - INTERVAL '5 days',
  'sent',
  3750.00,
  712.50,
  3037.50,
  'Servicios de consultoría mes 2',
  (SELECT id FROM auth.users WHERE email = 'admin@test.com' LIMIT 1)
FROM demo_company
ON CONFLICT DO NOTHING;

INSERT INTO public.documents (organization_id, company_id, document_number, document_type, date, due_date, status, total_amount, tax_amount, subtotal, description, created_by)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  demo_company.id,
  'FAC-003',
  'invoice',
  CURRENT_DATE - INTERVAL '10 days',
  CURRENT_DATE + INTERVAL '5 days',
  'overdue',
  1500.00,
  285.00,
  1215.00,
  'Servicios adicionales',
  (SELECT id FROM auth.users WHERE email = 'admin@test.com' LIMIT 1)
FROM demo_company
ON CONFLICT DO NOTHING;

-- Create sample receipts
INSERT INTO public.documents (organization_id, company_id, document_number, document_type, date, due_date, status, total_amount, tax_amount, subtotal, description, created_by)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  demo_company.id,
  'REC-001',
  'receipt',
  CURRENT_DATE - INTERVAL '25 days',
  CURRENT_DATE - INTERVAL '10 days',
  'paid',
  500.00,
  95.00,
  405.00,
  'Recibo de pago adelantado',
  (SELECT id FROM auth.users WHERE email = 'admin@test.com' LIMIT 1)
FROM demo_company
ON CONFLICT DO NOTHING;

INSERT INTO public.documents (organization_id, company_id, document_number, document_type, date, due_date, status, total_amount, tax_amount, subtotal, description, created_by)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  demo_company.id,
  'REC-002',
  'receipt',
  CURRENT_DATE - INTERVAL '5 days',
  CURRENT_DATE,
  'paid',
  750.00,
  142.50,
  607.50,
  'Recibo de retención',
  (SELECT id FROM auth.users WHERE email = 'admin@test.com' LIMIT 1)
FROM demo_company
ON CONFLICT DO NOTHING;

-- Create sample delivery notes (albaranes)
INSERT INTO public.documents (organization_id, company_id, document_number, document_type, date, due_date, status, total_amount, tax_amount, subtotal, description, created_by)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  demo_company.id,
  'ALB-001',
  'report',
  CURRENT_DATE - INTERVAL '28 days',
  CURRENT_DATE - INTERVAL '12 days',
  'paid',
  1200.00,
  228.00,
  972.00,
  'Albarán de entrega lote 1',
  (SELECT id FROM auth.users WHERE email = 'admin@test.com' LIMIT 1)
FROM demo_company
ON CONFLICT DO NOTHING;

INSERT INTO public.documents (organization_id, company_id, document_number, document_type, date, due_date, status, total_amount, tax_amount, subtotal, description, created_by)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  demo_company.id,
  'ALB-002',
  'report',
  CURRENT_DATE - INTERVAL '8 days',
  CURRENT_DATE + INTERVAL '2 days',
  'sent',
  2000.00,
  380.00,
  1620.00,
  'Albarán de entrega lote 2',
  (SELECT id FROM auth.users WHERE email = 'admin@test.com' LIMIT 1)
FROM demo_company
ON CONFLICT DO NOTHING;
