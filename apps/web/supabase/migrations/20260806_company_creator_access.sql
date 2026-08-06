-- A member who creates a client must be able to see it.
--
-- companies_insert allows any non-viewer member to create a client, but
-- companies_select only shows a non-admin the clients they have an explicit
-- company_user_access row for. The two did not agree: a member could create a
-- client and then not see it anywhere — not in the invoice picker they created
-- it from, not in Empresas. The row was there; it was invisible to its author.
--
-- Granting the creator access closes the gap without loosening the policy for
-- everyone else, which is the point of client-scoped access in the first place.
-- Org admins already see every client, so for them this is a no-op row.
--
-- Apply via: Supabase Dashboard → SQL Editor → Run

CREATE OR REPLACE FUNCTION public.grant_company_creator_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Server-side inserts (service role) have no auth.uid() and need no grant.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.company_user_access
    (organization_id, user_id, company_id, can_upload, can_edit, can_delete, granted_by)
  VALUES
    (NEW.organization_id, auth.uid(), NEW.id, TRUE, TRUE, FALSE, auth.uid())
  ON CONFLICT (user_id, company_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS grant_company_creator_access ON public.companies;
CREATE TRIGGER grant_company_creator_access
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.grant_company_creator_access();
