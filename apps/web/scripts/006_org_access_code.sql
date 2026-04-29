-- ============================================================
-- Add access_code to organizations
-- Used by gestores to identify their company at login
-- ============================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS access_code TEXT UNIQUE;

-- Generate a 6-char uppercase code for every existing org
UPDATE public.organizations
SET access_code = upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6))
WHERE access_code IS NULL;

-- Make it required for future orgs
ALTER TABLE public.organizations
  ALTER COLUMN access_code SET NOT NULL;

-- Auto-generate access_code when creating a new org
CREATE OR REPLACE FUNCTION public.generate_org_access_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.access_code IS NULL THEN
    NEW.access_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_org_access_code ON public.organizations;
CREATE TRIGGER set_org_access_code
  BEFORE INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.generate_org_access_code();
