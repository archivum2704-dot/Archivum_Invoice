-- ============================================================
-- Company logo on invoices
--
-- Adds:
--   • invoices.issuer_logo_url — frozen snapshot of the org logo
--     at issue time (consistent with the other issuer_* fields).
--   • storage bucket "logos" (public) for organization logo files,
--     writable only by admins of the owning organization.
-- ============================================================

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS issuer_logo_url TEXT;

-- ── Storage bucket ──────────────────────────────────────────
-- Public so <img> tags and PDF generation can load the logo by
-- URL directly, without signed URLs. Files are stored under:
-- <organization_id>/logo.<ext>
--
-- No SELECT policy: the bucket's public flag already lets anyone
-- fetch an object by its public URL, bypassing RLS for that specific
-- download path. A SELECT policy on storage.objects would instead
-- only add the ability to *list* every file in the bucket (i.e. every
-- org's logo path), which the app never needs and Supabase's linter
-- flags as an unnecessary listing exposure — so it's intentionally
-- omitted here. Only admin-scoped writes are policed.
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "logos_public_read" ON storage.objects;

DROP POLICY IF EXISTS "logos_admin_insert" ON storage.objects;
CREATE POLICY "logos_admin_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND public.is_org_admin(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "logos_admin_update" ON storage.objects;
CREATE POLICY "logos_admin_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'logos'
    AND public.is_org_admin(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "logos_admin_delete" ON storage.objects;
CREATE POLICY "logos_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'logos'
    AND public.is_org_admin(((storage.foldername(name))[1])::uuid)
  );
