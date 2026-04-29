-- ============================================================
-- Fix: Allow org members to see each other's profiles
-- Without this, useMembers JOIN on profiles returns 0 rows
-- because PostgREST uses inner join semantics — if the profile
-- is inaccessible, the parent organization_members row is dropped.
-- ============================================================

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;

-- New policy: own profile OR platform admin OR same-org member
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    -- Always can see your own profile
    auth.uid() = id
    -- Platform admins see everything
    OR public.is_platform_admin()
    -- Can see profiles of people in the same organization
    OR EXISTS (
      SELECT 1
      FROM public.organization_members AS my_mem
      JOIN public.organization_members AS their_mem
        ON my_mem.organization_id = their_mem.organization_id
      WHERE my_mem.user_id  = auth.uid()
        AND their_mem.user_id = profiles.id
    )
  );
