/**
 * quran.repository.js — OFSMS Quran Database Access Layer
 *
 * Centralises all SQL queries for the Quran module (reports and thresholds).
 * No business logic lives here — only raw data access.
 *
 * All functions return raw rows from the database.
 */

const { query } = require('../../config/db');

// ══════════════════════════════════════════════════════════════════════════════
// Quran Reports Queries
// ══════════════════════════════════════════════════════════════════════════════

// ── Check if a report already exists for the orphan/month/year ────────────────
const findExistingReport = async (orphanId, month, year) => {
  const { rows } = await query(
    'SELECT id FROM quran_reports WHERE orphan_id = $1 AND month = $2 AND year = $3',
    [orphanId, month, year]
  );
  return rows[0] || null;
};

// ── Fetch orphan details (used for agent verification and age calculation) ──────
const findOrphanById = async (id) => {
  const { rows } = await query(
    'SELECT id, full_name, date_of_birth, agent_id FROM orphans WHERE id = $1',
    [id]
  );
  return rows[0] || null;
};

// ── Fetch the Quran threshold for a given age ─────────────────────────────────
const findThresholdForAge = async (ageYears) => {
  const { rows } = await query(
    `SELECT min_juz_per_month FROM quran_thresholds
     WHERE age_min <= $1 AND age_max >= $1
     LIMIT 1`,
    [ageYears]
  );
  return rows[0] || null;
};

// ── Insert or update a Quran report ───────────────────────────────────────────
const upsertReport = async (orphanId, agentId, month, year, memorizedText, agentNotes) => {
  const { rows } = await query(
    `INSERT INTO quran_reports
       (orphan_id, agent_id, month, year, memorized_text, agent_notes, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending')
     ON CONFLICT (orphan_id, month, year)
     DO UPDATE SET memorized_text = EXCLUDED.memorized_text,
                   agent_notes = EXCLUDED.agent_notes,
                   juz_memorized = NULL,
                   status = 'pending',
                   submitted_at = NOW()
     RETURNING *`,
    [orphanId, agentId, month, year, memorizedText, agentNotes || null]
  );
  return rows[0];
};

// ── Fetch all pending reports (Supervisor Queue) ──────────────────────────────
const findPendingReports = async () => {
  const { rows } = await query(
    `SELECT
       qr.id, qr.month, qr.year, qr.juz_memorized, qr.memorized_text, qr.agent_notes,
       qr.status, qr.submitted_at,
       o.full_name AS orphan_name, o.date_of_birth,
       g.name_ar  AS governorate_ar,
       u.full_name AS agent_name,
       qt.min_juz_per_month AS threshold
     FROM quran_reports qr
     JOIN orphans      o  ON o.id  = qr.orphan_id
     JOIN governorates g  ON g.id  = o.governorate_id
     JOIN users        u  ON u.id  = qr.agent_id
     LEFT JOIN quran_thresholds qt
       ON qt.age_min <= DATE_PART('year', AGE(o.date_of_birth))
      AND qt.age_max >= DATE_PART('year', AGE(o.date_of_birth))
     WHERE qr.status = 'pending'
     ORDER BY qr.submitted_at ASC`
  );
  return rows;
};

// ── Fetch reports submitted by a specific agent ───────────────────────────────
const findReportsByAgent = async (agentId) => {
  const { rows } = await query(
    `SELECT
       qr.id, qr.month, qr.year, qr.juz_memorized, qr.memorized_text, qr.agent_notes,
       qr.status, qr.submitted_at, qr.supervisor_notes,
       o.full_name AS orphan_name
     FROM quran_reports qr
     JOIN orphans o ON o.id = qr.orphan_id
     WHERE qr.agent_id = $1
     ORDER BY qr.year DESC, qr.month DESC`,
    [agentId]
  );
  return rows;
};

// ── Fetch a specific report by ID (with orphan context) ───────────────────────
const findReportById = async (id) => {
  const { rows } = await query(
    `SELECT qr.*, o.full_name AS orphan_name, o.agent_id, o.date_of_birth AS orphan_dob,
            g.name_ar AS governorate_ar, u.full_name AS agent_name
     FROM quran_reports qr
     JOIN orphans o ON o.id = qr.orphan_id
     LEFT JOIN governorates g ON g.id = o.governorate_id
     LEFT JOIN users u ON u.id = qr.agent_id
     WHERE qr.id = $1`,
    [id]
  );
  return rows[0] || null;
};

// ── Update report status (approve/reject) ─────────────────────────────────────
const updateReportStatus = async (id, status, notes) => {
  const { rows } = await query(
    `UPDATE quran_reports
     SET status = $1, supervisor_notes = $2
     WHERE id = $3
     RETURNING *`,
    [status, notes || null, id]
  );
  return rows[0] || null;
};

// ── Fetch approved orphan IDs for a given month/year (Disbursements) ──────────
const findApprovedOrphanIds = async (month, year) => {
  const { rows } = await query(
    `SELECT orphan_id FROM quran_reports
     WHERE month = $1 AND year = $2 AND status = 'approved'`,
    [month, year]
  );
  return rows;
};

// ══════════════════════════════════════════════════════════════════════════════
// Quran Thresholds Queries
// ══════════════════════════════════════════════════════════════════════════════

// ── Fetch all thresholds ──────────────────────────────────────────────────────
const findAllThresholds = async () => {
  const { rows } = await query(
    'SELECT * FROM quran_thresholds ORDER BY age_min ASC'
  );
  return rows;
};

// ── Insert a new threshold ────────────────────────────────────────────────────
const insertThreshold = async (ageMin, ageMax, minJuzPerMonth, label) => {
  const { rows } = await query(
    `INSERT INTO quran_thresholds (age_min, age_max, min_juz_per_month, label)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [ageMin, ageMax, minJuzPerMonth, label || null]
  );
  return rows[0];
};

// ── Update an existing threshold ──────────────────────────────────────────────
const updateThreshold = async (id, ageMin, ageMax, minJuzPerMonth, label) => {
  const { rows } = await query(
    `UPDATE quran_thresholds
     SET age_min = COALESCE($1, age_min),
         age_max = COALESCE($2, age_max),
         min_juz_per_month = COALESCE($3, min_juz_per_month),
         label = COALESCE($4, label)
     WHERE id = $5
     RETURNING *`,
    [ageMin, ageMax, minJuzPerMonth, label, id]
  );
  return rows[0] || null;
};

module.exports = {
  findExistingReport,
  findOrphanById,
  findThresholdForAge,
  upsertReport,
  findPendingReports,
  findReportsByAgent,
  findReportById,
  updateReportStatus,
  findApprovedOrphanIds,
  findAllThresholds,
  insertThreshold,
  updateThreshold,
};
