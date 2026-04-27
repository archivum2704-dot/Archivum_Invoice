-- ============================================================
-- Archivum — Row Level Security Policies
-- 3-level hierarchy:
--   1. platform_role = 'super_admin' → bypasses all restrictions
--   2. org role = owner|admin        → sees all companies in their org
--   3. org role = member|viewer      → sees only companies in company_user_access
-- ============================================================

ALTER TABLE public.organizations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_user_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_tags     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log      ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper functions
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND platform_role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_org_member(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.is_platform_admin() OR EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_org_admin(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.is_platform_admin() OR EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.can_access_company(co_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT organization_id INTO v_org_id FROM public.companies WHERE id = co_id;

  -- Platform admin or org admin/owner can access any company
  IF public.is_org_admin(v_org_id) THEN
    RETURN TRUE;
  END IF;

  -- Members/viewers need an explicit entry in company_user_access
  RETURN EXISTS (
    SELECT 1 FROM public.company_user_access
    WHERE company_id = co_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Profiles
-- ============================================================
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id OR public.is_platform_admin()
  );

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- ============================================================
-- Organizations
-- ============================================================
CREATE POLICY "organizations_select" ON public.organizations
  FOR SELECT USING (public.is_org_member(id));

CREATE POLICY "organizations_insert" ON public.organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "organizations_update" ON public.organizations
  FOR UPDATE USING (public.is_org_admin(id));

CREATE POLICY "organizations_delete" ON public.organizations
  FOR DELETE USING (
    public.is_platform_admin() OR EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = id AND user_id = auth.uid() AND role = 'owner'
    )
  );

-- ============================================================
-- Organization members
-- ============================================================
CREATE POLICY "org_members_select" ON public.organization_members
  FOR SELECT USING (public.is_org_member(organization_id));

CREATE POLICY "org_members_insert" ON public.organization_members
  FOR INSERT WITH CHECK (
    public.is_org_admin(organization_id) OR NOT EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = organization_members.organization_id
    )
  );

CREATE POLICY "org_members_update" ON public.organization_members
  FOR UPDATE USING (public.is_org_admin(organization_id));

CREATE POLICY "org_members_delete" ON public.organization_members
  FOR DELETE USING (
    public.is_org_admin(organization_id) OR user_id = auth.uid()
  );

-- ============================================================
-- Companies
-- ============================================================
CREATE POLICY "companies_select" ON public.companies
  FOR SELECT USING (public.can_access_company(id));

CREATE POLICY "companies_insert" ON public.companies
  FOR INSERT WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "companies_update" ON public.companies
  FOR UPDATE USING (public.can_access_company(id));

CREATE POLICY "companies_delete" ON public.companies
  FOR DELETE USING (public.is_org_admin(organization_id));

-- ============================================================
-- Company user access
-- ============================================================
CREATE POLICY "company_access_select" ON public.company_user_access
  FOR SELECT USING (
    user_id = auth.uid() OR public.is_org_admin(organization_id)
  );

CREATE POLICY "company_access_insert" ON public.company_user_access
  FOR INSERT WITH CHECK (public.is_org_admin(organization_id));

CREATE POLICY "company_access_update" ON public.company_user_access
  FOR UPDATE USING (public.is_org_admin(organization_id));

CREATE POLICY "company_access_delete" ON public.company_user_access
  FOR DELETE USING (public.is_org_admin(organization_id));

-- ============================================================
-- Documents
-- ============================================================
CREATE POLICY "documents_select" ON public.documents
  FOR SELECT USING (
    public.is_org_admin(organization_id) OR
    (public.is_org_member(organization_id) AND public.can_access_company(company_id))
  );

CREATE POLICY "documents_insert" ON public.documents
  FOR INSERT WITH CHECK (
    public.is_org_admin(organization_id) OR
    (
      public.is_org_member(organization_id) AND
      EXISTS (
        SELECT 1 FROM public.company_user_access
        WHERE company_id = documents.company_id
          AND user_id = auth.uid()
          AND can_upload = TRUE
      )
    )
  );

CREATE POLICY "documents_update" ON public.documents
  FOR UPDATE USING (
    public.is_org_admin(organization_id) OR
    (
      public.is_org_member(organization_id) AND
      EXISTS (
        SELECT 1 FROM public.company_user_access
        WHERE company_id = documents.company_id
          AND user_id = auth.uid()
          AND can_edit = TRUE
      )
    )
  );

CREATE POLICY "documents_delete" ON public.documents
  FOR DELETE USING (
    public.is_org_admin(organization_id) OR
    (
      public.is_org_member(organization_id) AND
      EXISTS (
        SELECT 1 FROM public.company_user_access
        WHERE company_id = documents.company_id
          AND user_id = auth.uid()
          AND can_delete = TRUE
      )
    )
  );

-- ============================================================
-- Document items
-- ============================================================
CREATE POLICY "doc_items_select" ON public.document_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND public.is_org_member(d.organization_id)
    )
  );

CREATE POLICY "doc_items_insert" ON public.document_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND public.is_org_member(d.organization_id)
    )
  );

CREATE POLICY "doc_items_update" ON public.document_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND public.is_org_member(d.organization_id)
    )
  );

CREATE POLICY "doc_items_delete" ON public.document_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND public.is_org_admin(d.organization_id)
    )
  );

-- ============================================================
-- Tags
-- ============================================================
CREATE POLICY "tags_select" ON public.tags
  FOR SELECT USING (public.is_org_member(organization_id));

CREATE POLICY "tags_insert" ON public.tags
  FOR INSERT WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "tags_update" ON public.tags
  FOR UPDATE USING (public.is_org_admin(organization_id));

CREATE POLICY "tags_delete" ON public.tags
  FOR DELETE USING (public.is_org_admin(organization_id));

-- ============================================================
-- Document tags
-- ============================================================
CREATE POLICY "doc_tags_select" ON public.document_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND public.is_org_member(d.organization_id)
    )
  );

CREATE POLICY "doc_tags_insert" ON public.document_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND public.is_org_member(d.organization_id)
    )
  );

CREATE POLICY "doc_tags_delete" ON public.document_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND public.is_org_member(d.organization_id)
    )
  );

-- ============================================================
-- Activity log
-- ============================================================
CREATE POLICY "activity_select" ON public.activity_log
  FOR SELECT USING (public.is_org_member(organization_id));

CREATE POLICY "activity_insert" ON public.activity_log
  FOR INSERT WITH CHECK (public.is_org_member(organization_id));
