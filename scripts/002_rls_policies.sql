-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Helper function to check organization membership
CREATE OR REPLACE FUNCTION public.is_org_member(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is org admin or owner
CREATE OR REPLACE FUNCTION public.is_org_admin(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id 
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles policies
CREATE POLICY "profiles_select_own" ON public.profiles 
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.profiles 
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles 
  FOR UPDATE USING (auth.uid() = id);

-- Organizations policies
CREATE POLICY "organizations_select_member" ON public.organizations 
  FOR SELECT USING (public.is_org_member(id));

CREATE POLICY "organizations_insert_authenticated" ON public.organizations 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "organizations_update_admin" ON public.organizations 
  FOR UPDATE USING (public.is_org_admin(id));

CREATE POLICY "organizations_delete_owner" ON public.organizations 
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = id AND user_id = auth.uid() AND role = 'owner'
    )
  );

-- Organization members policies
CREATE POLICY "org_members_select_member" ON public.organization_members 
  FOR SELECT USING (public.is_org_member(organization_id));

CREATE POLICY "org_members_insert_admin" ON public.organization_members 
  FOR INSERT WITH CHECK (public.is_org_admin(organization_id) OR NOT EXISTS (
    SELECT 1 FROM public.organization_members WHERE organization_id = organization_members.organization_id
  ));

CREATE POLICY "org_members_update_admin" ON public.organization_members 
  FOR UPDATE USING (public.is_org_admin(organization_id));

CREATE POLICY "org_members_delete_admin" ON public.organization_members 
  FOR DELETE USING (public.is_org_admin(organization_id) OR user_id = auth.uid());

-- Companies policies
CREATE POLICY "companies_select_member" ON public.companies 
  FOR SELECT USING (public.is_org_member(organization_id));

CREATE POLICY "companies_insert_member" ON public.companies 
  FOR INSERT WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "companies_update_member" ON public.companies 
  FOR UPDATE USING (public.is_org_member(organization_id));

CREATE POLICY "companies_delete_admin" ON public.companies 
  FOR DELETE USING (public.is_org_admin(organization_id));

-- Documents policies
CREATE POLICY "documents_select_member" ON public.documents 
  FOR SELECT USING (public.is_org_member(organization_id));

CREATE POLICY "documents_insert_member" ON public.documents 
  FOR INSERT WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "documents_update_member" ON public.documents 
  FOR UPDATE USING (public.is_org_member(organization_id));

CREATE POLICY "documents_delete_admin" ON public.documents 
  FOR DELETE USING (public.is_org_admin(organization_id));

-- Document items policies
CREATE POLICY "doc_items_select" ON public.document_items 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.documents WHERE id = document_id AND public.is_org_member(organization_id))
  );

CREATE POLICY "doc_items_insert" ON public.document_items 
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.documents WHERE id = document_id AND public.is_org_member(organization_id))
  );

CREATE POLICY "doc_items_update" ON public.document_items 
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.documents WHERE id = document_id AND public.is_org_member(organization_id))
  );

CREATE POLICY "doc_items_delete" ON public.document_items 
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.documents WHERE id = document_id AND public.is_org_admin(organization_id))
  );

-- Tags policies
CREATE POLICY "tags_select_member" ON public.tags 
  FOR SELECT USING (public.is_org_member(organization_id));

CREATE POLICY "tags_insert_member" ON public.tags 
  FOR INSERT WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "tags_update_admin" ON public.tags 
  FOR UPDATE USING (public.is_org_admin(organization_id));

CREATE POLICY "tags_delete_admin" ON public.tags 
  FOR DELETE USING (public.is_org_admin(organization_id));

-- Document tags policies
CREATE POLICY "doc_tags_select" ON public.document_tags 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.documents WHERE id = document_id AND public.is_org_member(organization_id))
  );

CREATE POLICY "doc_tags_insert" ON public.document_tags 
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.documents WHERE id = document_id AND public.is_org_member(organization_id))
  );

CREATE POLICY "doc_tags_delete" ON public.document_tags 
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.documents WHERE id = document_id AND public.is_org_member(organization_id))
  );

-- Activity log policies
CREATE POLICY "activity_select_member" ON public.activity_log 
  FOR SELECT USING (public.is_org_member(organization_id));

CREATE POLICY "activity_insert_member" ON public.activity_log 
  FOR INSERT WITH CHECK (public.is_org_member(organization_id));
