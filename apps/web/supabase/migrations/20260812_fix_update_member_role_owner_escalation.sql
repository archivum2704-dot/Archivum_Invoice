-- ============================================================
-- update_member_role(p_org_id, p_user_id, p_new_role) is exposed directly to
-- PostgREST and called from the client (users-view.tsx, equipo.tsx). It only
-- checked is_org_admin(p_org_id) — any org admin (not just the owner) could
-- call it directly, bypassing the app's UI entirely, with p_new_role:'owner'
-- to promote themselves or anyone else to owner. Same class of bug as the
-- one fixed in /api/members/create, but reachable through a completely
-- different path this migration is what actually closes.
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_member_role(p_org_id uuid, p_user_id uuid, p_new_role org_role)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_role org_role;
BEGIN
  IF NOT is_org_admin(p_org_id) THEN
    RETURN json_build_object('success', false, 'error', 'not_authorized');
  END IF;

  -- Only an owner (or a platform admin, via is_platform_admin() inside
  -- is_org_admin) may hand out the owner role.
  IF p_new_role = 'owner' AND NOT (
    public.is_platform_admin() OR EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = p_org_id AND user_id = auth.uid() AND role = 'owner'
    )
  ) THEN
    RETURN json_build_object('success', false, 'error', 'only_owner_can_grant_owner');
  END IF;

  SELECT role INTO v_current_role
  FROM organization_members
  WHERE organization_id = p_org_id AND user_id = p_user_id;

  IF v_current_role = 'owner' THEN
    RETURN json_build_object('success', false, 'error', 'cannot_change_owner');
  END IF;

  UPDATE organization_members
  SET role = p_new_role
  WHERE organization_id = p_org_id AND user_id = p_user_id;

  RETURN json_build_object('success', true);
END;
$function$
;
