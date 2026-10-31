-- Durable file storage in the database, used when no S3 bucket is configured
-- (hosts such as Render wipe the local disk on every deploy).
CREATE TABLE IF NOT EXISTS stored_files (
  file_key     TEXT PRIMARY KEY,
  content_type VARCHAR(120),
  content      BYTEA NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
