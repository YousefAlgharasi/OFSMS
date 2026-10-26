-- OFSMS Migration 025 - Agents confirm receipt manually (no fingerprint image).
-- A confirmation is a biometric_receipts row without a fingerprint_key.
ALTER TABLE biometric_receipts ALTER COLUMN fingerprint_key DROP NOT NULL;
