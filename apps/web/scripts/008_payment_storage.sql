-- ============================================================
-- 008_payment_storage.sql
-- Payment methods on documents + storage tracking on orgs
-- ============================================================

-- 1. Payment method column on documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT NULL;

-- 2. Storage tracking columns on organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS storage_limit_bytes BIGINT NOT NULL DEFAULT 1073741824,  -- 1 GB
  ADD COLUMN IF NOT EXISTS storage_used_bytes  BIGINT NOT NULL DEFAULT 0;

-- 3. Backfill: recalculate storage_used_bytes from existing documents
UPDATE organizations o
SET storage_used_bytes = COALESCE((
  SELECT SUM(d.file_size)
  FROM documents d
  WHERE d.organization_id = o.id AND d.file_size IS NOT NULL
), 0);

-- 4. Function to keep storage_used_bytes in sync automatically
CREATE OR REPLACE FUNCTION public.track_document_storage()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.file_size IS NOT NULL THEN
    UPDATE organizations
      SET storage_used_bytes = storage_used_bytes + NEW.file_size
      WHERE id = NEW.organization_id;

  ELSIF TG_OP = 'DELETE' AND OLD.file_size IS NOT NULL THEN
    UPDATE organizations
      SET storage_used_bytes = GREATEST(0, storage_used_bytes - OLD.file_size)
      WHERE id = OLD.organization_id;

  ELSIF TG_OP = 'UPDATE' AND OLD.file_size IS DISTINCT FROM NEW.file_size THEN
    UPDATE organizations
      SET storage_used_bytes = GREATEST(
        0,
        storage_used_bytes
          - COALESCE(OLD.file_size, 0)
          + COALESCE(NEW.file_size, 0)
      )
      WHERE id = NEW.organization_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_track_document_storage ON documents;
CREATE TRIGGER trg_track_document_storage
  AFTER INSERT OR UPDATE OR DELETE ON documents
  FOR EACH ROW EXECUTE FUNCTION public.track_document_storage();
