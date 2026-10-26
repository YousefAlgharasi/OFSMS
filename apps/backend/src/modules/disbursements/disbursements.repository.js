/**
 * disbursements.repository.js — OFSMS Disbursements Database Access Layer
 *
 * Centralises all SQL queries for the disbursements module.
 * No business logic lives here — only raw data access.
 *
 * All functions return plain objects, arrays, or null.
 */

const { query } = require('../../config/db');

// ── List all disbursement lists ───────────────────────────────────────────────
const findAllLists = async () => {
  const { rows } = await query(`
    SELECT
      dl.id, dl.month, dl.year, dl.status,
      dl.created_at,
      dl.supervisor_approved_at,
      dl.finance_approved_at,
      dl.gm_approved_at,
      dl.rejection_notes,
      u_created.full_name  AS created_by_name,
      u_sup.full_name      AS supervisor_name,
      u_fin.full_name      AS finance_name,
      u_gm.full_name       AS gm_name,
      COUNT(di.id) FILTER (WHERE di.included = TRUE)   AS included_count,
      COUNT(di.id) FILTER (WHERE di.included = FALSE)  AS excluded_count,
      COALESCE(SUM(di.amount) FILTER (WHERE di.included = TRUE), 0) AS total_amount
    FROM disbursement_lists dl
    LEFT JOIN users u_created ON u_created.id = dl.created_by
    LEFT JOIN users u_sup     ON u_sup.id     = dl.approved_by_supervisor
    LEFT JOIN users u_fin     ON u_fin.id     = dl.approved_by_finance
    LEFT JOIN users u_gm      ON u_gm.id      = dl.approved_by_gm
    LEFT JOIN disbursement_items di ON di.list_id = dl.id
    GROUP BY dl.id, u_created.full_name, u_sup.full_name, u_fin.full_name, u_gm.full_name
    ORDER BY dl.year DESC, dl.month DESC
  `);
  return rows;
};

// ── Find a single list header by ID ──────────────────────────────────────────
const findListById = async (id) => {
  const { rows: [list] } = await query(`
    SELECT
      dl.*,
      u_created.full_name AS created_by_name,
      u_sup.full_name     AS supervisor_name,
      u_fin.full_name     AS finance_name,
      u_gm.full_name      AS gm_name
    FROM disbursement_lists dl
    LEFT JOIN users u_created ON u_created.id = dl.created_by
    LEFT JOIN users u_sup     ON u_sup.id     = dl.approved_by_supervisor
    LEFT JOIN users u_fin     ON u_fin.id     = dl.approved_by_finance
    LEFT JOIN users u_gm      ON u_gm.id      = dl.approved_by_gm
    WHERE dl.id = $1
  `, [id]);
  return list || null;
};

// ── Find orphan items for a list ──────────────────────────────────────────────
const findOrphanItemsByListId = async (listId) => {
  const { rows } = await query(`
    SELECT
      di.id, di.amount, di.included, di.exclusion_reason,
      'orphan' AS beneficiary_type,
      o.full_name AS beneficiary_name,
      g.name_ar   AS governorate_ar,
      s.full_name AS sponsor_name,
      sp.monthly_amount,
      u.full_name AS agent_name,
      br.confirmed_at AS biometric_confirmed_at
    FROM disbursement_items di
    JOIN orphans o ON o.id = di.orphan_id
    LEFT JOIN governorates g ON g.id = o.governorate_id
    LEFT JOIN sponsorships sp ON sp.beneficiary_id = o.id
      AND sp.beneficiary_type = 'orphan' AND sp.is_active = TRUE
    LEFT JOIN sponsors s ON s.id = sp.sponsor_id
    LEFT JOIN users u ON u.id = sp.agent_id
    LEFT JOIN biometric_receipts br ON br.item_id = di.id
    WHERE di.list_id = $1 AND di.orphan_id IS NOT NULL
    ORDER BY di.included DESC, o.full_name ASC
  `, [listId]);
  return rows;
};

// ── Find family items for a list ──────────────────────────────────────────────
const findFamilyItemsByListId = async (listId) => {
  const { rows } = await query(`
    SELECT
      di.id, di.amount, di.included, di.exclusion_reason,
      'family' AS beneficiary_type,
      f.family_name AS beneficiary_name,
      g.name_ar     AS governorate_ar,
      s.full_name   AS sponsor_name,
      sp.monthly_amount,
      u.full_name   AS agent_name,
      br.confirmed_at AS biometric_confirmed_at
    FROM disbursement_items di
    JOIN families f ON f.id = di.family_id
    LEFT JOIN governorates g ON g.id = f.governorate_id
    LEFT JOIN sponsorships sp ON sp.beneficiary_id = f.id
      AND sp.beneficiary_type = 'family' AND sp.is_active = TRUE
    LEFT JOIN sponsors s ON s.id = sp.sponsor_id
    LEFT JOIN users u ON u.id = sp.agent_id
    LEFT JOIN biometric_receipts br ON br.item_id = di.id
    WHERE di.list_id = $1 AND di.family_id IS NOT NULL
    ORDER BY di.included DESC, f.family_name ASC
  `, [listId]);
  return rows;
};

// ── Check if a list already exists for a given month/year ────────────────────
const findListByMonthYear = async (month, year) => {
  const { rows } = await query(
    'SELECT id FROM disbursement_lists WHERE month = $1 AND year = $2',
    [month, year]
  );
  return rows[0] || null;
};

// ── Insert a new disbursement list header ─────────────────────────────────────
const insertList = async (month, year, createdBy) => {
  const { rows: [list] } = await query(
    `INSERT INTO disbursement_lists (month, year, created_by)
     VALUES ($1, $2, $3) RETURNING *`,
    [month, year, createdBy]
  );
  return list;
};

// ── Find active orphan sponsorships with quran report status ──────────────────
const findActiveOrphanSponsorships = async (month, year) => {
  const { rows } = await query(`
    SELECT sp.beneficiary_id AS orphan_id, sp.monthly_amount,
           qr.status AS quran_status
    FROM sponsorships sp
    LEFT JOIN quran_reports qr ON qr.orphan_id = sp.beneficiary_id
      AND qr.month = $1 AND qr.year = $2
    WHERE sp.beneficiary_type = 'orphan' AND sp.is_active = TRUE
  `, [month, year]);
  return rows;
};

// ── Find active family sponsorships ──────────────────────────────────────────
const findActiveFamilySponsorships = async () => {
  const { rows } = await query(`
    SELECT sp.beneficiary_id AS family_id, sp.monthly_amount
    FROM sponsorships sp
    WHERE sp.beneficiary_type = 'family' AND sp.is_active = TRUE
  `);
  return rows;
};

// ── Insert an orphan disbursement item ────────────────────────────────────────
const insertOrphanItem = async (listId, orphanId, amount, included, reason) => {
  await query(
    `INSERT INTO disbursement_items (list_id, orphan_id, amount, included, exclusion_reason)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING`,
    [listId, orphanId, amount, included, reason]
  );
};

// ── Insert a family disbursement item ─────────────────────────────────────────
const insertFamilyItem = async (listId, familyId, amount) => {
  await query(
    `INSERT INTO disbursement_items (list_id, family_id, amount, included)
     VALUES ($1, $2, $3, TRUE)
     ON CONFLICT DO NOTHING`,
    [listId, familyId, amount]
  );
};

// ── Update list status (generic, used by all approval/reject steps) ───────────
const updateListStatus = async (id, fields, statusClause) => {
  const setEntries = Object.entries(fields);
  const setClauses = setEntries.map(([col], i) => `${col} = $${i + 1}`).join(', ');
  const values = setEntries.map(([, val]) => val);
  const { rows: [list] } = await query(
    `UPDATE disbursement_lists
     SET ${setClauses}
     WHERE id = $${values.length + 1} AND ${statusClause}
     RETURNING *`,
    [...values, id]
  );
  return list || null;
};

// ── Find released lists for a specific agent ──────────────────────────────────
const findReleasedListsByAgent = async (agentId) => {
  const { rows } = await query(
    `SELECT DISTINCT
       dl.id,
       dl.month,
       dl.year,
       dl.status,
       dl.gm_approved_at                                          AS released_at,
       COUNT(di.id) FILTER (WHERE di.included = TRUE)            AS total_items,
       COUNT(br.id)                                               AS confirmed_items,
       COUNT(di.id) FILTER (WHERE di.included = TRUE)
         - COUNT(br.id)                                           AS pending_items
     FROM disbursement_lists dl
     JOIN disbursement_items di ON di.list_id = dl.id
     JOIN orphans o ON o.id = di.orphan_id
     LEFT JOIN biometric_receipts br ON br.item_id = di.id
     WHERE dl.status = 'released'
       AND di.included = TRUE
       AND o.agent_id = $1
     GROUP BY dl.id
     ORDER BY dl.year DESC, dl.month DESC`,
    [agentId]
  );
  return rows;
};

module.exports = {
  findAllLists,
  findListById,
  findOrphanItemsByListId,
  findFamilyItemsByListId,
  findListByMonthYear,
  insertList,
  findActiveOrphanSponsorships,
  findActiveFamilySponsorships,
  insertOrphanItem,
  insertFamilyItem,
  updateListStatus,
  findReleasedListsByAgent,
};
