-- Widen the allowed file types for the 'documents' storage bucket.
-- Previously only PDF and images were accepted; this adds the common
-- Office formats (Word, Excel, PowerPoint) plus CSV and plain text so
-- users can archive those documents directly.
--
-- NOTE: this only widens what the bucket accepts. Office files cannot be
-- previewed inline (only PDF/images are); the apps fall back to a download
-- action for them.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  -- Word
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  -- Excel
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  -- PowerPoint
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  -- CSV / text
  'text/csv',
  'text/plain'
]
WHERE id = 'documents';
