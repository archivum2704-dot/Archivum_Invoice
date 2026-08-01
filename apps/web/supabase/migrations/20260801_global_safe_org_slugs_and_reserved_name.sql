-- Multi-tenant hardening for a global rollout.
--
-- 1) Organisation slugs are UNIQUE platform-wide, but the onboarding RPC wrote
--    the requested slug verbatim. Two unrelated accounts picking the same
--    company name collided and the second one could not create its
--    organisation at all. Suffix the slug until it is free instead.
-- 2) "Archivum" is reserved for the platform owner. Enforced in a trigger so it
--    applies to web, mobile and any API path alike.

CREATE OR REPLACE FUNCTION public.create_organization_with_owner(org_name text, org_slug text, owner_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_org_id UUID;
  base_slug  TEXT;
  candidate  TEXT;
  n          INT := 0;
BEGIN
  base_slug := btrim(regexp_replace(lower(coalesce(NULLIF(btrim(org_slug), ''), org_name, 'org')), '[^a-z0-9]+', '-', 'g'), '-');
  IF base_slug IS NULL OR base_slug = '' THEN
    base_slug := 'org';
  END IF;

  candidate := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.organizations o WHERE o.slug = candidate) LOOP
    n := n + 1;
    IF n <= 50 THEN
      candidate := base_slug || '-' || n::text;
    ELSE
      candidate := base_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    END IF;
  END LOOP;

  INSERT INTO public.organizations (name, slug)
  VALUES (org_name, candidate)
  RETURNING id INTO new_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, owner_id, 'owner');

  UPDATE public.profiles
     SET current_org_id = new_org_id
   WHERE id = owner_id;

  RETURN new_org_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_reserved_org_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF lower(btrim(coalesce(NEW.name, ''))) = 'archivum' THEN
    -- auth.uid() is NULL for trusted service-role / back-office writes.
    IF v_uid IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = v_uid AND p.platform_role = 'super_admin'
    ) THEN
      RAISE EXCEPTION 'El nombre "Archivum" está reservado. Elige otro nombre para tu empresa.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_reserved_org_name ON public.organizations;
CREATE TRIGGER trg_reserved_org_name
  BEFORE INSERT OR UPDATE OF name ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_reserved_org_name();
