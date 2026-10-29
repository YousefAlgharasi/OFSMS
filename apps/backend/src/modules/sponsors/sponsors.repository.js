/**
 * sponsors.repository.js
 * Database queries for sponsors, sponsorships, and related joins.
 */

const { query } = require('../../config/db');

/**
 * Find matching sponsors by email or phone.
 */
const findSponsorByEmailOrPhone = async (email, phone) => {
  if (!email && !phone) return [];
  const conditions = [];
  const params = [];
  if (email) {
    params.push(email);
    conditions.push(`email = $${params.length}`);
  }
  if (phone) {
    params.push(phone);
    conditions.push(`phone = $${params.length}`);
  }
  const { rows } = await query(
    `SELECT email, phone FROM sponsors WHERE ${conditions.join(' OR ')}`,
    params
  );
  return rows;
};

/**
 * Find matching sponsors by email or phone excluding a specific sponsor ID.
 */
const findSponsorByEmailOrPhoneExcludingId = async (id, email, phone) => {
  if (!email && !phone) return [];
  const conditions = [];
  const params = [id];
  if (email) {
    params.push(email);
    conditions.push(`email = $${params.length}`);
  }
  if (phone) {
    params.push(phone);
    conditions.push(`phone = $${params.length}`);
  }
  const { rows } = await query(
    `SELECT email, phone FROM sponsors WHERE id != $1 AND (${conditions.join(' OR ')})`,
    params
  );
  return rows;
};

/**
 * Insert a new sponsor.
 */
const insertSponsor = async ({ fullName, phone, email, portalToken, portalPasswordHash, portalPasswordPlain, createdBy }) => {
  const { rows } = await query(
    `INSERT INTO sponsors
       (full_name, phone, email, portal_token, portal_password_hash, portal_password_plain, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, full_name, phone, email, portal_token, portal_password_plain, created_at`,
    [fullName, phone || null, email || null, portalToken, portalPasswordHash, portalPasswordPlain, createdBy]
  );
  return rows[0];
};

/**
 * Get all sponsors with their active sponsorships count.
 */
const findAllSponsors = async () => {
  const { rows } = await query(
    `SELECT
       s.id, s.full_name, s.phone, s.email, s.portal_token,
       s.portal_password_plain,
       s.created_at,
       u.full_name AS created_by_name,
       COUNT(sp.id) FILTER (WHERE sp.is_active) AS active_sponsorships
     FROM sponsors s
     LEFT JOIN users u ON u.id = s.created_by
     LEFT JOIN sponsorships sp ON sp.sponsor_id = s.id
     GROUP BY s.id, u.full_name
     ORDER BY s.created_at DESC`
  );
  return rows;
};

/**
 * Find a sponsor by ID (for admin/GM view).
 */
const findSponsorById = async (id) => {
  const { rows } = await query(
    `SELECT
       s.id, s.full_name, s.phone, s.email, s.portal_token,
       s.portal_password_plain,
       s.created_at, u.full_name AS created_by_name
     FROM sponsors s
     LEFT JOIN users u ON u.id = s.created_by
     WHERE s.id = $1`,
    [id]
  );
  return rows[0] || null;
};

/**
 * Find a sponsor by portal token (for portal login).
 */
const findSponsorByToken = async (token) => {
  const { rows } = await query(
    `SELECT id, full_name, email, portal_token, portal_password_hash
     FROM sponsors
     WHERE portal_token = $1`,
    [token]
  );
  return rows[0] || null;
};

/**
 * Find all sponsorships for a sponsor.
 */
const findSponsorshipsBySponsorId = async (sponsorId) => {
  const { rows } = await query(
    `SELECT
       sp.id, sp.beneficiary_type, sp.beneficiary_id,
       sp.monthly_amount, sp.start_date, sp.intermediary, sp.is_active,
       u.full_name AS agent_name,
       CASE
         WHEN sp.beneficiary_type = 'orphan'  THEN o.full_name
         WHEN sp.beneficiary_type = 'family'  THEN f.family_name
       END AS beneficiary_name,
       CASE
         WHEN sp.beneficiary_type = 'orphan'  THEN g1.name_ar
         WHEN sp.beneficiary_type = 'family'  THEN g2.name_ar
       END AS governorate_ar
     FROM sponsorships sp
     LEFT JOIN users u      ON u.id  = sp.agent_id
     LEFT JOIN orphans o    ON o.id  = sp.beneficiary_id AND sp.beneficiary_type = 'orphan'
     LEFT JOIN families f   ON f.id  = sp.beneficiary_id AND sp.beneficiary_type = 'family'
     LEFT JOIN governorates g1 ON g1.id = o.governorate_id
     LEFT JOIN governorates g2 ON g2.id = f.governorate_id
     WHERE sp.sponsor_id = $1
     ORDER BY sp.is_active DESC, sp.start_date DESC`,
    [sponsorId]
  );
  return rows;
};

/**
 * Deactivate active sponsorships for a beneficiary.
 */
const deactivateActiveSponsorships = async (beneficiaryType, beneficiaryId, endReason) => {
  const { rows } = await query(
    `UPDATE sponsorships
     SET is_active = FALSE, end_date = NOW(), end_reason = $1
     WHERE beneficiary_type = $2 AND beneficiary_id = $3 AND is_active = TRUE`,
    [endReason || 'reassigned', beneficiaryType, beneficiaryId]
  );
  return rows;
};

/**
 * Insert a new sponsorship record.
 */
const insertSponsorship = async ({ sponsorId, beneficiaryType, beneficiaryId, agentId, intermediary, startDate, monthlyAmount }) => {
  const { rows } = await query(
    `INSERT INTO sponsorships
       (sponsor_id, beneficiary_type, beneficiary_id, agent_id,
        intermediary, start_date, monthly_amount)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [sponsorId, beneficiaryType, beneficiaryId, agentId, intermediary || null, startDate || new Date(), monthlyAmount]
  );
  return rows[0];
};

/**
 * Update beneficiary status in their respective table.
 */
const updateBeneficiaryStatus = async (table, beneficiaryId, status) => {
  await query(
    `UPDATE ${table} SET status = $1 WHERE id = $2`,
    [status, beneficiaryId]
  );
};

/**
 * Update sponsor details.
 */
const updateSponsorDetails = async (id, { fullName, phone, email, portalPasswordHash, portalPasswordPlain }) => {
  let queryStr = `UPDATE sponsors SET full_name = $1, phone = $2, email = $3`;
  const params = [fullName, phone || null, email || null];

  if (portalPasswordHash) {
    params.push(portalPasswordHash);
    queryStr += `, portal_password_hash = $${params.length}`;
    params.push(portalPasswordPlain);
    queryStr += `, portal_password_plain = $${params.length}`;
  }

  params.push(id);
  queryStr += ` WHERE id = $${params.length} RETURNING id, full_name, phone, email, portal_token, portal_password_plain, created_at`;

  const { rows } = await query(queryStr, params);
  return rows[0] || null;
};

/**
 * Count active sponsorships for a sponsor.
 */
const countActiveSponsorships = async (sponsorId) => {
  const { rows } = await query(
    `SELECT COUNT(*) FROM sponsorships WHERE sponsor_id = $1 AND is_active = TRUE`,
    [sponsorId]
  );
  return parseInt(rows[0].count, 10);
};

/**
 * Delete all sponsorships for a sponsor.
 */
const deleteSponsorshipsBySponsorId = async (sponsorId) => {
  await query(`DELETE FROM sponsorships WHERE sponsor_id = $1`, [sponsorId]);
};

/**
 * Delete a sponsor record.
 */
const deleteSponsorById = async (id) => {
  const { rowCount } = await query(`DELETE FROM sponsors WHERE id = $1`, [id]);
  return rowCount;
};

/**
 * Fetch detailed active and historical sponsorships (portfolio view).
 */
const findPortfolioSponsorships = async (sponsorId) => {
  const { rows } = await query(
    `SELECT
       sp.id                  AS sponsorship_id,
       sp.beneficiary_type,
       sp.beneficiary_id,
       sp.monthly_amount,
       sp.start_date,
       sp.end_date,
       sp.is_active,
       sp.intermediary,
       sp.end_reason,
       -- Beneficiary name (orphan or family)
       COALESCE(o.full_name, f.family_name)   AS beneficiary_name,
       -- Governorate
       COALESCE(go.name_ar,  gf.name_ar)      AS governorate_ar,
       -- Agent
       COALESCE(uo.full_name, uf.full_name)   AS agent_name,
       COALESCE(uo.id,        uf.id)           AS agent_id,
       -- Orphan-specific fields
       o.date_of_birth,
       o.gender,
       o.status                               AS beneficiary_status,
       o.is_gifted,
       -- Latest Quran report (orphans only)
       qr.status        AS latest_report_status,
       qr.month         AS latest_report_month,
       qr.year          AS latest_report_year,
       qr.juz_memorized AS latest_juz_memorized,
       qr.memorized_text AS latest_memorized_text
     FROM sponsorships sp
     LEFT JOIN orphans   o  ON o.id  = sp.beneficiary_id AND sp.beneficiary_type = 'orphan'
     LEFT JOIN families  f  ON f.id  = sp.beneficiary_id AND sp.beneficiary_type = 'family'
     LEFT JOIN governorates go ON go.id = o.governorate_id
     LEFT JOIN governorates gf ON gf.id = f.governorate_id
     LEFT JOIN users uo ON uo.id = o.agent_id
     LEFT JOIN users uf ON uf.id = f.agent_id
     LEFT JOIN LATERAL (
       SELECT status, month, year, juz_memorized, memorized_text
       FROM quran_reports
       WHERE orphan_id = sp.beneficiary_id
       ORDER BY year DESC, month DESC
       LIMIT 1
     ) qr ON sp.beneficiary_type = 'orphan'
     WHERE sp.sponsor_id = $1
     ORDER BY sp.is_active DESC, sp.start_date DESC`,
    [sponsorId]
  );
  return rows;
};

/**
 * Find sponsor by ID (for sponsor portal `/me`).
 */
const findSponsorByIdForMe = async (id) => {
  const { rows } = await query(
    `SELECT id, full_name, email, created_at FROM sponsors WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
};

/**
 * Find active orphans for a sponsor portal view.
 */
const findActiveOrphansBySponsorId = async (sponsorId) => {
  const { rows } = await query(
    `SELECT
       o.id,
       o.full_name,
       o.gender,
       o.is_gifted,
       o.status,
       g.name_ar   AS governorate_ar,
       sp.monthly_amount,
       sp.start_date AS sponsorship_start,
       u.full_name  AS agent_name
     FROM sponsorships sp
     JOIN orphans o       ON o.id  = sp.beneficiary_id
     JOIN governorates g  ON g.id  = o.governorate_id
     JOIN users u         ON u.id  = o.agent_id
     WHERE sp.sponsor_id      = $1
       AND sp.beneficiary_type = 'orphan'
       AND sp.is_active        = TRUE
     ORDER BY sp.start_date DESC`,
    [sponsorId]
  );
  return rows;
};

/**
 * Check ownership of an orphan for a sponsor.
 */
const checkSponsorshipOwnership = async (sponsorId, orphanId) => {
  const { rows } = await query(
    `SELECT id FROM sponsorships
     WHERE sponsor_id      = $1
       AND beneficiary_id   = $2
       AND beneficiary_type = 'orphan'
       AND is_active        = TRUE`,
    [sponsorId, orphanId]
  );
  return rows.length > 0;
};

/**
 * Fetch Quran reports for an orphan (sponsor view).
 */
const findQuranReportsByOrphanId = async (orphanId) => {
  const { rows } = await query(
    `SELECT
       qr.id,
       qr.month,
       qr.year,
       qr.juz_memorized,
       qr.memorized_text,
       qr.status,
       qr.submitted_at,
       qr.supervisor_notes
     FROM quran_reports qr
     WHERE qr.orphan_id = $1
     ORDER BY qr.year DESC, qr.month DESC`,
    [orphanId]
  );
  return rows;
};

/**
 * Fetch disbursement receipts for an orphan (sponsor view).
 */
const findDisbursementsByOrphanId = async (orphanId) => {
  const { rows } = await query(
    `SELECT
       di.amount,
       di.included,
       di.exclusion_reason,
       dl.month,
       dl.year,
       dl.status  AS list_status,
       br.confirmed_at AS receipt_confirmed_at
     FROM disbursement_items di
     JOIN disbursement_lists dl ON dl.id  = di.list_id
     LEFT JOIN biometric_receipts br ON br.item_id = di.id
     WHERE di.orphan_id = $1
     ORDER BY dl.year DESC, dl.month DESC`,
    [orphanId]
  );
  return rows;
};

module.exports = {
  findSponsorByEmailOrPhone,
  findSponsorByEmailOrPhoneExcludingId,
  insertSponsor,
  findAllSponsors,
  findSponsorById,
  findSponsorByToken,
  findSponsorshipsBySponsorId,
  deactivateActiveSponsorships,
  insertSponsorship,
  updateBeneficiaryStatus,
  updateSponsorDetails,
  countActiveSponsorships,
  deleteSponsorshipsBySponsorId,
  deleteSponsorById,
  findPortfolioSponsorships,
  findSponsorByIdForMe,
  findActiveOrphansBySponsorId,
  checkSponsorshipOwnership,
  findQuranReportsByOrphanId,
  findDisbursementsByOrphanId,
};
