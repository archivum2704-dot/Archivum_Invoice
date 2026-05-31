-- ============================================================
-- 010_storage_documents.sql
-- Storage bucket "documents" + RLS policies
-- Files are stored under: <organization_id>/<timestamp>_<filename>
-- Both web (subir-view) and mobile (subir.tsx) upload here.
-- ============================================================

-- 1. Create the private bucket (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS policies on storage.objects scoped to the user's organizations
--    The first path segment must be an org the user is a member of.

DROP POLICY IF EXISTS "documents_select_own_org" ON storage.objects;
CREATE POLICY "documents_select_own_org"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "documents_insert_own_org" ON storage.objects;
CREATE POLICY "documents_insert_own_org"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "documents_update_own_org" ON storage.objects;
CREATE POLICY "documents_update_own_org"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "documents_delete_own_org" ON storage.objects;
CREATE POLICY "documents_delete_own_org"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );
