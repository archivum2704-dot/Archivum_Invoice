-- ============================================================
-- Archivum — Member management functions
-- ============================================================

-- Invite a user to an organization by email
CREATE OR REPLACE FUNCTION public.invite_member_by_email(
  p_org_id   uuid,
  p_email    text,
  p_role     org_role DEFAULT 'member'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       uuid;
  v_member_exists boolean;
BEGIN
  IF NOT is_org_admin(p_org_id) THEN
    RETURN json_build_object('success', false, 'error', 'not_authorized');
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = lower(trim(p_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'user_not_found');
  END IF;

  IF v_user_id = auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'cannot_add_self');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM organization_members
    WHERE organization_id = p_org_id AND user_id = v_user_id
  ) INTO v_member_exists;

  IF v_member_exists THEN
    RETURN json_build_object('success', false, 'error', 'already_member');
  END IF;

  INSERT INTO organization_members (organization_id, user_id, role, invited_by)
  VALUES (p_org_id, v_user_id, p_role, auth.uid());

  RETURN json_build_object('success', true);
END;
$$;

-- Update a member's role (cannot change owner)
CREATE OR REPLACE FUNCTION public.update_member_role(
  p_org_id   uuid,
  p_user_id  uuid,
  p_new_role org_role
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_role org_role;
BEGIN
  IF NOT is_org_admin(p_org_id) THEN
    RETURN json_build_object('success', false, 'error', 'not_authorized');
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
$$;

-- Remove a member and their company access
CREATE OR REPLACE FUNCTION public.remove_org_member(
  p_org_id   uuid,
  p_user_id  uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_role org_role;
BEGIN
  IF NOT is_org_admin(p_org_id) THEN
    RETURN json_build_object('success', false, 'error', 'not_authorized');
  END IF;

  SELECT role INTO v_target_role
  FROM organization_members
  WHERE organization_id = p_org_id AND user_id = p_user_id;

  IF v_target_role = 'owner' THEN
    RETURN json_build_object('success', false, 'error', 'cannot_remove_owner');
  END IF;

  DELETE FROM company_user_access
  WHERE organization_id = p_org_id AND user_id = p_user_id;

  DELETE FROM organization_members
  WHERE organization_id = p_org_id AND user_id = p_user_id;

  RETURN json_build_object('success', true);
END;
$$;
