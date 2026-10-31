/**
 * dashboard.repository.js — OFSMS Dashboard Database Access Layer
 *
 * Centralises all SQL queries for the dashboard module.
 * No business logic or data shaping lives here — only raw data access.
 *
 * All functions return raw rows from the database.
 */

const { query } = require('../../config/db');

// ══════════════════════════════════════════════════════════════════════════════
// GM Dashboard Queries
// ══════════════════════════════════════════════════════════════════════════════

const getGmTotals = async () => {
  const { rows: [row] } = await query(`
    SELECT COUNT(*) AS total_orphans FROM orphans WHERE status != 'inactive'
  `);
  return row;
};

const getOrphansPerGovernorate = async () => {
  const { rows } = await query(`
    SELECT g.name_ar AS governorate_ar, g.name_en AS governorate_en, COUNT(o.id) AS count
    FROM orphans o JOIN governorates g ON g.id = o.governorate_id
    WHERE o.status != 'inactive'
    GROUP BY g.id, g.name_ar, g.name_en ORDER BY count DESC
  `);
  return rows;
};

const getOrphansPerSponsor = async () => {
  const { rows } = await query(`
    SELECT s.id AS sponsor_id, s.full_name AS sponsor_name, COUNT(sp.id) AS count
    FROM sponsorships sp JOIN sponsors s ON s.id = sp.sponsor_id
    WHERE sp.is_active = TRUE
    GROUP BY s.id, s.full_name ORDER BY count DESC LIMIT 10
  `);
  return rows;
};

const getLatestOrphans = async () => {
  const { rows } = await query(`
    SELECT o.id, o.full_name, o.status, o.is_gifted, o.created_at, g.name_ar AS governorate_ar
    FROM orphans o LEFT JOIN governorates g ON g.id = o.governorate_id
    ORDER BY o.created_at DESC LIMIT 10
  `);
  return rows;
};

const getGmPendingCounts = async () => {
  const { rows: [row] } = await query(`
    SELECT
      (SELECT COUNT(*) FROM orphans WHERE status = 'under_review')                     AS registrations,
      (SELECT COUNT(*) FROM quran_reports WHERE status = 'pending')                     AS quran_reports,
      (SELECT COUNT(*) FROM disbursement_lists WHERE status IN ('draft','supervisor_approved','finance_approved')) AS disbursements
  `);
  return row;
};

const getMonthlyDisbursementSummary = async () => {
  const { rows: [row] } = await query(`
    SELECT
      COALESCE(SUM(di.amount), 0)                                                      AS total,
      COALESCE(SUM(di.amount) FILTER (WHERE dl.status = 'released'), 0)               AS released,
      COALESCE(SUM(di.amount) FILTER (WHERE dl.status != 'released'), 0)              AS pending
    FROM disbursement_items di
    JOIN disbursement_lists dl ON dl.id = di.list_id
    WHERE dl.month = EXTRACT(MONTH FROM NOW()) AND dl.year = EXTRACT(YEAR FROM NOW())
      AND di.included = TRUE
  `);
  return row;
};

// ══════════════════════════════════════════════════════════════════════════════
// Agent Dashboard Queries
// ══════════════════════════════════════════════════════════════════════════════

const getAgentOrphans = async (agentId) => {
  const { rows } = await query(`
    SELECT o.id, o.full_name, o.status, o.is_gifted, o.date_of_birth, o.created_at,
           g.name_ar AS governorate_ar
    FROM orphans o LEFT JOIN governorates g ON g.id = o.governorate_id
    WHERE o.agent_id = $1 ORDER BY o.created_at DESC
  `, [agentId]);
  return rows;
};

const getAgentPendingReports = async (agentId) => {
  const { rows } = await query(`
    SELECT o.id, o.full_name
    FROM orphans o
    WHERE o.agent_id = $1 AND o.status = 'under_sponsorship'
      AND NOT EXISTS (
        SELECT 1 FROM quran_reports qr
        WHERE qr.orphan_id = o.id
          AND qr.month = EXTRACT(MONTH FROM NOW())
          AND qr.year  = EXTRACT(YEAR  FROM NOW())
      )
  `, [agentId]);
  return rows;
};

const getAgentRejectedSubmissions = async (agentId) => {
  const { rows } = await query(`
    SELECT id, full_name AS name, 'orphan' AS type, status, notes, created_at
    FROM orphans WHERE agent_id = $1 AND status = 'rejected'
    UNION ALL
    SELECT id, family_name AS name, 'family' AS type, status, notes, created_at
    FROM families WHERE agent_id = $1 AND status = 'rejected'
    ORDER BY created_at DESC
  `, [agentId]);
  return rows;
};

// ══════════════════════════════════════════════════════════════════════════════
// Supervisor Dashboard Queries
// ══════════════════════════════════════════════════════════════════════════════

const getSupervisorPendingCounts = async () => {
  const { rows: [row] } = await query(`
    SELECT
      (SELECT COUNT(*) FROM orphans   WHERE status = 'under_review')       AS pending_orphans,
      (SELECT COUNT(*) FROM families  WHERE status = 'under_review')       AS pending_families,
      (SELECT COUNT(*) FROM quran_reports WHERE status = 'pending')         AS pending_quran_reports,
      (SELECT COUNT(*) FROM disbursement_lists
       WHERE status = 'draft')                                               AS pending_disbursements
  `);
  return row;
};

// The disbursement list of a given month (null when none was generated yet)
const getDisbursementListForMonth = async (month, year) => {
  const { rows } = await query(
    `SELECT id, status, month, year FROM disbursement_lists WHERE month = $1 AND year = $2`,
    [month, year]
  );
  return rows[0] || null;
};

const getSupervisorPendingOrphans = async () => {
  const { rows } = await query(`
    SELECT o.id, o.full_name AS name, 'orphan' AS record_type,
           o.status, o.created_at, g.name_ar AS governorate_ar, u.full_name AS agent_name
    FROM orphans o
    LEFT JOIN governorates g ON g.id = o.governorate_id
    LEFT JOIN users u ON u.id = o.agent_id
    WHERE o.status = 'under_review' ORDER BY o.created_at ASC LIMIT 5
  `);
  return rows;
};

const getSupervisorPendingFamilies = async () => {
  const { rows } = await query(`
    SELECT f.id, f.family_name AS name, 'family' AS record_type,
           f.status, f.created_at, g.name_ar AS governorate_ar, u.full_name AS agent_name
    FROM families f
    LEFT JOIN governorates g ON g.id = f.governorate_id
    LEFT JOIN users u ON u.id = f.agent_id
    WHERE f.status = 'under_review' ORDER BY f.created_at ASC LIMIT 5
  `);
  return rows;
};

const getSupervisorPendingQuranReports = async () => {
  const { rows } = await query(`
    SELECT qr.id, o.full_name AS orphan_name,
           qr.month, qr.year, qr.juz_memorized, qr.memorized_text, qr.submitted_at, u.full_name AS agent_name
    FROM quran_reports qr
    JOIN orphans o ON o.id = qr.orphan_id
    JOIN users u ON u.id = qr.agent_id
    WHERE qr.status = 'pending' ORDER BY qr.submitted_at ASC LIMIT 5
  `);
  return rows;
};

// ══════════════════════════════════════════════════════════════════════════════
// Finance Dashboard Queries
// ══════════════════════════════════════════════════════════════════════════════

const getFinanceAwaitingAuth = async () => {
  const { rows } = await query(`
    SELECT
      dl.id, dl.month, dl.year, dl.status,
      dl.supervisor_approved_at,
      COUNT(di.id)        AS beneficiary_count,
      SUM(di.amount)      AS total_amount
    FROM disbursement_lists dl
    LEFT JOIN disbursement_items di ON di.list_id = dl.id AND di.included = TRUE
    WHERE dl.status = 'supervisor_approved'
    GROUP BY dl.id
    ORDER BY dl.supervisor_approved_at ASC
  `);
  return rows;
};

const getFinanceRecentHistory = async () => {
  const { rows } = await query(`
    SELECT
      dl.id, dl.month, dl.year, dl.status,
      dl.finance_approved_at, dl.created_at,
      SUM(di.amount) AS total_amount
    FROM disbursement_lists dl
    LEFT JOIN disbursement_items di ON di.list_id = dl.id AND di.included = TRUE
    WHERE dl.status IN ('finance_approved', 'released', 'rejected')
    GROUP BY dl.id
    ORDER BY COALESCE(dl.finance_approved_at, dl.created_at) DESC
    LIMIT 10
  `);
  return rows;
};

const getFinanceMonthlySummary = async () => {
  const { rows: [row] } = await query(`
    SELECT
      COALESCE(SUM(di.amount) FILTER (WHERE di.included = TRUE), 0)                      AS current_month_total,
      COALESCE(SUM(di.amount) FILTER (WHERE di.included = TRUE AND dl.status = 'released'), 0)  AS released_this_month,
      COALESCE(SUM(di.amount) FILTER (WHERE di.included = TRUE AND dl.status != 'released'), 0) AS pending_this_month,
      COUNT(di.id) FILTER (WHERE di.included = TRUE)                                     AS current_month_count
    FROM disbursement_items di
    JOIN disbursement_lists dl ON dl.id = di.list_id
    WHERE dl.month = EXTRACT(MONTH FROM NOW()) AND dl.year = EXTRACT(YEAR FROM NOW())
  `);
  return row;
};

module.exports = {
  // GM
  getGmTotals,
  getOrphansPerGovernorate,
  getOrphansPerSponsor,
  getLatestOrphans,
  getGmPendingCounts,
  getMonthlyDisbursementSummary,
  // Agent
  getAgentOrphans,
  getAgentPendingReports,
  getAgentRejectedSubmissions,
  // Supervisor
  getSupervisorPendingCounts,
  getDisbursementListForMonth,
  getSupervisorPendingOrphans,
  getSupervisorPendingFamilies,
  getSupervisorPendingQuranReports,
  // Finance
  getFinanceAwaitingAuth,
  getFinanceRecentHistory,
  getFinanceMonthlySummary,
};
