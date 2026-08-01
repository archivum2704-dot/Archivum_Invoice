-- Make the "viewer" role genuinely read-only.
--
-- Until now the write policies only consulted the per-company permission flags
-- (can_upload / can_edit / can_delete) and never the member's role, while the
-- UI granted can_upload = true whenever an admin ticked a company. A member
-- with the viewer role could therefore upload, edit and delete documents, and
-- create clients and tags — exactly what the role is meant to prevent. This
-- matters most for the external auditors (Hacienda, DIAN) the role exists for.
--
-- Viewers are now blocked at the database level, so the guarantee holds no
-- matter which client is talking to the API.

CREATE OR REPLACE FUNCTION public.is_org_viewer(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Platform admins are never restricted.
  IF public.is_platform_admin() THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND role = 'viewer'
  );
END;
$$;

-- ── documents ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS documents_insert ON public.documents;
CREATE POLICY documents_insert ON public.documents FOR INSERT
WITH CHECK (
  is_org_admin(organization_id)
  OR (
    is_org_member(organization_id)
    AND NOT is_org_viewer(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.company_user_access
      WHERE company_user_access.company_id = documents.company_id
        AND company_user_access.user_id = auth.uid()
        AND company_user_access.can_upload = true
    )
  )
);

DROP POLICY IF EXISTS documents_update ON public.documents;
CREATE POLICY documents_update ON public.documents FOR UPDATE
USING (
  is_org_admin(organization_id)
  OR (
    is_org_member(organization_id)
    AND NOT is_org_viewer(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.company_user_access
      WHERE company_user_access.company_id = documents.company_id
        AND company_user_access.user_id = auth.uid()
        AND company_user_access.can_edit = true
    )
  )
);

DROP POLICY IF EXISTS documents_delete ON public.documents;
CREATE POLICY documents_delete ON public.documents FOR DELETE
USING (
  is_org_admin(organization_id)
  OR (
    is_org_member(organization_id)
    AND NOT is_org_viewer(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.company_user_access
      WHERE company_user_access.company_id = documents.company_id
        AND company_user_access.user_id = auth.uid()
        AND company_user_access.can_delete = true
    )
  )
);

-- ── companies ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS companies_insert ON public.companies;
CREATE POLICY companies_insert ON public.companies FOR INSERT
WITH CHECK (is_org_member(organization_id) AND NOT is_org_viewer(organization_id));

DROP POLICY IF EXISTS companies_update ON public.companies;
CREATE POLICY companies_update ON public.companies FOR UPDATE
USING (can_access_company(id) AND NOT is_org_viewer(organization_id));

-- ── document_items ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS doc_items_insert ON public.document_items;
CREATE POLICY doc_items_insert ON public.document_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = document_items.document_id
      AND is_org_member(d.organization_id)
      AND NOT is_org_viewer(d.organization_id)
  )
);

DROP POLICY IF EXISTS doc_items_update ON public.document_items;
CREATE POLICY doc_items_update ON public.document_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = document_items.document_id
      AND is_org_member(d.organization_id)
      AND NOT is_org_viewer(d.organization_id)
  )
);

-- ── document_tags ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS doc_tags_insert ON public.document_tags;
CREATE POLICY doc_tags_insert ON public.document_tags FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = document_tags.document_id
      AND is_org_member(d.organization_id)
      AND NOT is_org_viewer(d.organization_id)
  )
);

DROP POLICY IF EXISTS doc_tags_delete ON public.document_tags;
CREATE POLICY doc_tags_delete ON public.document_tags FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = document_tags.document_id
      AND is_org_member(d.organization_id)
      AND NOT is_org_viewer(d.organization_id)
  )
);

-- ── tags ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS tags_insert ON public.tags;
CREATE POLICY tags_insert ON public.tags FOR INSERT
WITH CHECK (is_org_member(organization_id) AND NOT is_org_viewer(organization_id));

-- Existing viewers may already carry write flags granted by the old default.
-- Clear them so the role is read-only for everyone already in the system.
UPDATE public.company_user_access AS cua
SET can_upload = false, can_edit = false, can_delete = false
FROM public.organization_members AS om
WHERE om.user_id = cua.user_id
  AND om.organization_id = cua.organization_id
  AND om.role = 'viewer'
  AND (cua.can_upload OR cua.can_edit OR cua.can_delete);

UPDATE public.folder_user_access AS fua
SET can_upload = false, can_edit = false, can_delete = false
FROM public.folders AS f
JOIN public.organization_members AS om ON om.organization_id = f.organization_id
WHERE f.id = fua.folder_id
  AND om.user_id = fua.user_id
  AND om.role = 'viewer'
  AND (fua.can_upload OR fua.can_edit OR fua.can_delete);
