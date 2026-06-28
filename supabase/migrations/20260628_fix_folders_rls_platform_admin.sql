-- ============================================================
-- Fix folder RLS so Platform Admins (platform_role = 'super_admin')
-- can create / update / delete folders.
--
-- The original 007_folders.sql policies inlined a subquery against
-- organization_members only, which excludes platform admins (they are
-- not necessarily members of every org). This made folder creation
-- silently fail for the Platform Admin account.
--
-- This migration rewrites the policies to use the existing helper
-- functions is_org_member() / is_org_admin(), both of which already
-- short-circuit to TRUE for platform admins.
--
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── folders ────────────────────────────────────────────────
DROP POLICY IF EXISTS "org_members_can_view_folders"  ON public.folders;
DROP POLICY IF EXISTS "org_admins_can_insert_folders" ON public.folders;
DROP POLICY IF EXISTS "org_admins_can_update_folders" ON public.folders;
DROP POLICY IF EXISTS "org_admins_can_delete_folders" ON public.folders;

CREATE POLICY "org_members_can_view_folders"
  ON public.folders FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "org_admins_can_insert_folders"
  ON public.folders FOR INSERT
  WITH CHECK (public.is_org_admin(organization_id));

CREATE POLICY "org_admins_can_update_folders"
  ON public.folders FOR UPDATE
  USING (public.is_org_admin(organization_id));

CREATE POLICY "org_admins_can_delete_folders"
  ON public.folders FOR DELETE
  USING (public.is_org_admin(organization_id));

-- ── folder_user_access ─────────────────────────────────────
-- Same issue: admin policies joined organization_members directly,
-- excluding platform admins. Rewrite using is_org_admin().
DROP POLICY IF EXISTS "org_admins_can_view_all_folder_access" ON public.folder_user_access;
DROP POLICY IF EXISTS "org_admins_can_manage_folder_access"   ON public.folder_user_access;

CREATE POLICY "org_admins_can_view_all_folder_access"
  ON public.folder_user_access FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.folders f
      WHERE f.id = folder_user_access.folder_id
        AND public.is_org_admin(f.organization_id)
    )
  );

CREATE POLICY "org_admins_can_manage_folder_access"
  ON public.folder_user_access FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.folders f
      WHERE f.id = folder_user_access.folder_id
        AND public.is_org_admin(f.organization_id)
    )
  );
