-- ============================================================
-- Archivum — Core Schema
-- Enum values in English; UI labels handled via i18n
-- ============================================================

-- Document lifecycle types
CREATE TYPE document_type AS ENUM (
  'order',            -- Purchase/sale order
  'receipt',          -- Receipt
  'delivery_note',    -- Delivery note (albarán)
  'invoice_issued',   -- Issued invoice
  'invoice_received', -- Received invoice
  'quote',            -- Quote/estimate
  'contract',         -- Contract
  'payroll',          -- Payroll
  'tax',              -- Tax document
  'other'
);

CREATE TYPE document_status AS ENUM (
  'draft',
  'pending',
  'paid',
  'overdue',
  'cancelled'
);

CREATE TYPE org_role AS ENUM ('owner', 'admin', 'member', 'viewer');

CREATE TYPE platform_role AS ENUM ('super_admin', 'user');

-- ============================================================
-- Organizations (tenants)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.organizations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  slug         TEXT UNIQUE NOT NULL,
  cif          TEXT,
  address      TEXT,
  city         TEXT,
  postal_code  TEXT,
  country      TEXT DEFAULT 'Spain',
  phone        TEXT,
  email        TEXT,
  logo_url     TEXT,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- User profiles
-- platform_role = 'super_admin' → sees everything (Platform Admin)
-- platform_role = 'user'        → scoped to their organizations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email          TEXT NOT NULL,
  first_name     TEXT,
  last_name      TEXT,
  avatar_url     TEXT,
  platform_role  platform_role NOT NULL DEFAULT 'user',
  current_org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Organization memberships
-- role = owner|admin  → Company Super User (sees all companies in org)
-- role = member|viewer → restricted user (access via company_user_access)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.organization_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role            org_role NOT NULL DEFAULT 'member',
  invited_by      UUID REFERENCES public.profiles(id),
  joined_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- ============================================================
-- Companies within an organization
-- parent_company_id supports sub-company hierarchy
-- ============================================================
CREATE TABLE IF NOT EXISTS public.companies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  parent_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  cif               TEXT,
  sector            TEXT,
  address           TEXT,
  city              TEXT,
  postal_code       TEXT,
  country           TEXT DEFAULT 'Spain',
  phone             TEXT,
  email             TEXT,
  contact_person    TEXT,
  notes             TEXT,
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Sub-company user access
-- Grants member/viewer users access to specific companies.
-- owner/admin org members bypass this table entirely.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.company_user_access (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  can_upload      BOOLEAN DEFAULT TRUE,
  can_edit        BOOLEAN DEFAULT FALSE,
  can_delete      BOOLEAN DEFAULT FALSE,
  granted_by      UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

-- ============================================================
-- Documents
-- parent_document_id tracks the flow: order → receipt → delivery_note → invoice
-- ============================================================
CREATE TABLE IF NOT EXISTS public.documents (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  company_id         UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  uploaded_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  parent_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,

  document_number    TEXT,
  document_type      document_type NOT NULL DEFAULT 'other',
  status             document_status DEFAULT 'pending',

  subtotal           DECIMAL(12,2),
  tax_rate           DECIMAL(5,2) DEFAULT 21.00,
  tax_amount         DECIMAL(12,2),
  total              DECIMAL(12,2),
  currency           TEXT DEFAULT 'EUR',

  issue_date         DATE,
  due_date           DATE,
  payment_date       DATE,

  file_url           TEXT,
  file_name          TEXT,
  file_size          INTEGER,
  file_type          TEXT,

  description        TEXT,
  notes              TEXT,

  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Document line items
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity    DECIMAL(10,2) DEFAULT 1,
  unit_price  DECIMAL(12,2) NOT NULL,
  tax_rate    DECIMAL(5,2) DEFAULT 21.00,
  subtotal    DECIMAL(12,2),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Tags
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  color           TEXT DEFAULT '#3b82f6',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

CREATE TABLE IF NOT EXISTS public.document_tags (
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  tag_id      UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (document_id, tag_id)
);

-- ============================================================
-- Activity log (audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.activity_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  document_id     UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  action          TEXT NOT NULL,
  resource_type   TEXT,
  details         JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_documents_org        ON public.documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_company    ON public.documents(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_parent     ON public.documents(parent_document_id);
CREATE INDEX IF NOT EXISTS idx_documents_type       ON public.documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_status     ON public.documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_issue_date ON public.documents(issue_date);
CREATE INDEX IF NOT EXISTS idx_companies_org        ON public.companies(organization_id);
CREATE INDEX IF NOT EXISTS idx_companies_parent     ON public.companies(parent_company_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user     ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org      ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_company_access_user  ON public.company_user_access(user_id);
CREATE INDEX IF NOT EXISTS idx_company_access_co    ON public.company_user_access(company_id);
CREATE INDEX IF NOT EXISTS idx_activity_org         ON public.activity_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_doc         ON public.activity_log(document_id);
CREATE INDEX IF NOT EXISTS idx_profiles_platform    ON public.profiles(platform_role);
