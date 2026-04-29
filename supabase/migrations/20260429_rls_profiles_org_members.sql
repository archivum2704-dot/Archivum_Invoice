-- ============================================================
-- Allow org members to read profiles of other members in the
-- same organization. Needed for /usuarios to show names.
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- 1. Policy: members can read profiles of people in their org
CREATE POLICY "org_members_can_read_peer_profiles"
ON public.profiles
FOR SELECT
USING (
  id IN (
    SELECT om2.user_id
    FROM public.organization_members om1
    JOIN public.organization_members om2
      ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid()
  )
);

-- 2. Create 'documents' storage bucket (public: false = private)
--    Skip if already exists.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  26214400,  -- 25 MB
  ARRAY['application/pdf','image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies for the documents bucket
-- Allow authenticated users to upload to their org folder
CREATE POLICY "org_members_upload_documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

-- Allow authenticated users to read documents from their org
CREATE POLICY "org_members_read_documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);
