-- OFSMS Migration 026 - Quran reports are free text written by the agent.
-- The agent describes what the orphan memorized (no fixed juz steps) and the
-- supervisor decides approve / reject, so the numeric juz becomes optional
-- (kept for reports submitted before this change).
ALTER TABLE quran_reports ALTER COLUMN juz_memorized DROP NOT NULL;
ALTER TABLE quran_reports ADD COLUMN IF NOT EXISTS memorized_text TEXT;
ALTER TABLE quran_reports ADD COLUMN IF NOT EXISTS agent_notes   TEXT;
