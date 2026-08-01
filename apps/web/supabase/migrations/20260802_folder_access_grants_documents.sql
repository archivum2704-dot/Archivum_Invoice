-- Make folder permissions actually govern documents.
--
-- Document visibility was decided solely by client access, so granting someone
-- a folder ("Hacienda_2026") gave them nothing: the folder appeared in the
-- list, but every document inside it stayed invisible. The per-folder
-- "puede subir / editar / eliminar" checkboxes were dead for the same reason.
--
-- Access is now additive — a document is reachable through its client OR
-- through its folder — which is what assigning a single folder to an external
-- auditor is meant to do. Viewers stay read-only regardless.

CREATE OR REPLACE FUNCTION public.can_access_folder(fo_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  IF fo_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT organization_id INTO v_org_id FROM public.folders WHERE id = fo_id;
  IF v_org_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Platform admin or org admin/owner reaches every folder
  IF public.is_org_admin(v_org_id) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.folder_user_access
    WHERE folder_id = fo_id AND user_id = auth.uid()
  );
END;
$$;

-- ── Read ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS documents_select ON public.documents;
CREATE POLICY documents_select ON public.documents FOR SELECT
USING (
  is_org_admin(organization_id)
  OR (
    is_org_member(organization_id)
    AND (can_access_company(company_id) OR can_access_folder(folder_id))
  )
);

-- ── Write ────────────────────────────────────────────────────────────────────
-- Each permission is satisfied by the client grant or the folder grant, so the
-- checkboxes in both panels mean the same thing.

DROP POLICY IF EXISTS documents_insert ON public.documents;
CREATE POLICY documents_insert ON public.documents FOR INSERT
WITH CHECK (
  is_org_admin(organization_id)
  OR (
    is_org_member(organization_id)
    AND NOT is_org_viewer(organization_id)
    AND (
      EXISTS (
        SELECT 1 FROM public.company_user_access
        WHERE company_user_access.company_id = documents.company_id
          AND company_user_access.user_id = auth.uid()
          AND company_user_access.can_upload = true
      )
      OR EXISTS (
        SELECT 1 FROM public.folder_user_access
        WHERE folder_user_access.folder_id = documents.folder_id
          AND folder_user_access.user_id = auth.uid()
          AND folder_user_access.can_upload = true
      )
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
    AND (
      EXISTS (
        SELECT 1 FROM public.company_user_access
        WHERE company_user_access.company_id = documents.company_id
          AND company_user_access.user_id = auth.uid()
          AND company_user_access.can_edit = true
      )
      OR EXISTS (
        SELECT 1 FROM public.folder_user_access
        WHERE folder_user_access.folder_id = documents.folder_id
          AND folder_user_access.user_id = auth.uid()
          AND folder_user_access.can_edit = true
      )
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
    AND (
      EXISTS (
        SELECT 1 FROM public.company_user_access
        WHERE company_user_access.company_id = documents.company_id
          AND company_user_access.user_id = auth.uid()
          AND company_user_access.can_delete = true
      )
      OR EXISTS (
        SELECT 1 FROM public.folder_user_access
        WHERE folder_user_access.folder_id = documents.folder_id
          AND folder_user_access.user_id = auth.uid()
          AND folder_user_access.can_delete = true
      )
    )
  )
);
