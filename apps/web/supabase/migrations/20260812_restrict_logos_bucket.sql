-- ============================================================
-- The "logos" bucket (20260712_invoice_issuer_logo.sql) was created
-- public with no file_size_limit and no allowed_mime_types — every
-- restriction lived only in /api/organizations/logo/route.ts
-- (png/jpeg/webp, 2MB). That is app-level defense only: since the
-- bucket is public, anything ever written to it without going through
-- that route (a future code path, a manual write with the service-role
-- key) would be served back as-is with its original content-type, and
-- an SVG can carry a <script> tag — stored XSS off our own domain.
--
-- This applies the same limits at the bucket itself, matching what the
-- route already enforces, as defense in depth rather than a behavior
-- change: legitimate uploads (png/jpeg/webp, ≤2MB) are unaffected.
-- ============================================================

UPDATE storage.buckets
SET file_size_limit = 2097152, -- 2 MB, matches MAX_LOGO_BYTES in the route
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']
WHERE id = 'logos';
