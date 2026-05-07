-- ============================================================
-- 007_folders.sql
-- Folder system for the document library
-- ============================================================

-- 1. Folders table
CREATE TABLE IF NOT EXISTS folders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  parent_id       UUID REFERENCES folders(id) ON DELETE CASCADE,  -- NULL = root
  name            TEXT NOT NULL,
  color           TEXT DEFAULT NULL,  -- optional accent color (hex or tailwind key)
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT folders_name_nonempty CHECK (char_length(trim(name)) > 0)
);

-- 2. Add folder_id to documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS folders_org_idx      ON folders(organization_id);
CREATE INDEX IF NOT EXISTS folders_parent_idx   ON folders(parent_id);
CREATE INDEX IF NOT EXISTS documents_folder_idx ON documents(folder_id);

-- 4. updated_at trigger for folders (reuses the existing set_updated_at() function)
CREATE TRIGGER set_updated_at_folders
  BEFORE UPDATE ON folders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. RLS
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- Members can view all folders in their org
CREATE POLICY "org_members_can_view_folders"
  ON folders FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Admins/owners can create folders
CREATE POLICY "org_admins_can_insert_folders"
  ON folders FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Admins/owners can update folders
CREATE POLICY "org_admins_can_update_folders"
  ON folders FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Admins/owners can delete folders
CREATE POLICY "org_admins_can_delete_folders"
  ON folders FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- 6. Per-folder access control table
--    When a member (not admin/owner) is restricted to specific folders,
--    rows are inserted here. Absence of rows = full access (for admins).
CREATE TABLE IF NOT EXISTS folder_user_access (
  folder_id  UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  can_upload BOOLEAN NOT NULL DEFAULT true,
  can_edit   BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  PRIMARY KEY (folder_id, user_id)
);

CREATE INDEX IF NOT EXISTS folder_access_user_idx ON folder_user_access(user_id);

ALTER TABLE folder_user_access ENABLE ROW LEVEL SECURITY;

-- Members can see their own access grants
CREATE POLICY "users_can_view_own_folder_access"
  ON folder_user_access FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all access grants in their org
CREATE POLICY "org_admins_can_view_all_folder_access"
  ON folder_user_access FOR SELECT
  USING (
    folder_id IN (
      SELECT f.id FROM folders f
      JOIN organization_members om ON om.organization_id = f.organization_id
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

-- Admins can manage access grants
CREATE POLICY "org_admins_can_manage_folder_access"
  ON folder_user_access FOR ALL
  USING (
    folder_id IN (
      SELECT f.id FROM folders f
      JOIN organization_members om ON om.organization_id = f.organization_id
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );
