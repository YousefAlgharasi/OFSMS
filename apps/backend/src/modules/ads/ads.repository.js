/**
 * ads.repository.js — OFSMS Ads Database Access Layer
 *
 * Centralises all SQL queries for the ads module.
 * No business logic lives here — only raw data access.
 *
 * All functions return plain objects, arrays, or null.
 */

const { query } = require('../../config/db');

// ── Shared SELECT fragment (reused across all read queries) ───────────────────
const SELECT_ADS = `
  SELECT
    a.id,
    a.beneficiary_type,
    a.beneficiary_id,
    a.published_at,
    a.created_at,
    a.target_all,
    COUNT(ar.sponsor_id) AS targeted_sponsors_count,
    COALESCE(o.full_name, f.family_name) AS beneficiary_name,
    COALESCE(g_o.name_ar, g_f.name_ar) AS governorate_ar,
    COALESCE(u_o.full_name, u_f.full_name) AS agent_name,
    o.date_of_birth,
    o.gender,
    o.is_gifted,
    f.head_of_family,
    f.member_count,
    COALESCE(o.status, f.status) AS beneficiary_status,
    EXISTS (
      SELECT 1
      FROM sponsorships sp
      WHERE sp.beneficiary_type = a.beneficiary_type
        AND sp.beneficiary_id = a.beneficiary_id
        AND sp.is_active = TRUE
    ) AS is_sponsored
  FROM ads a
  LEFT JOIN orphans o ON o.id = a.beneficiary_id AND a.beneficiary_type = 'orphan'
  LEFT JOIN families f ON f.id = a.beneficiary_id AND a.beneficiary_type = 'family'
  LEFT JOIN governorates g_o ON g_o.id = o.governorate_id
  LEFT JOIN governorates g_f ON g_f.id = f.governorate_id
  LEFT JOIN users u_o ON u_o.id = o.agent_id
  LEFT JOIN users u_f ON u_f.id = f.agent_id
  LEFT JOIN ad_recipients ar ON ar.ad_id = a.id
`;

const GROUP_BY = 'GROUP BY a.id, o.id, f.id, g_o.id, g_f.id, u_o.id, u_f.id';

// ── Find all ads ──────────────────────────────────────────────────────────────
const findAllAds = async () => {
  const { rows } = await query(
    `${SELECT_ADS} ${GROUP_BY} ORDER BY a.published_at DESC`
  );
  return rows;
};

// ── Find single ad by ID ──────────────────────────────────────────────────────
const findAdById = async (id) => {
  const { rows } = await query(
    `${SELECT_ADS} WHERE a.id = $1 ${GROUP_BY}`,
    [id]
  );
  return rows[0] || null;
};

// ── Find ads visible to a specific sponsor ────────────────────────────────────
const findAdsForSponsor = async (sponsorId) => {
  const { rows } = await query(
    `${SELECT_ADS}
     WHERE a.target_all = TRUE
        OR EXISTS (
          SELECT 1 FROM ad_recipients ar2
          WHERE ar2.ad_id = a.id AND ar2.sponsor_id = $1
        )
     ${GROUP_BY}
     ORDER BY a.published_at DESC`,
    [sponsorId]
  );
  return rows;
};

// ── Insert a new ad (with optional targeted recipients, in a transaction) ─────
// An open ad for the same beneficiary
const findOpenAdForBeneficiary = async (type, id) => {
  const { rows } = await query('SELECT id FROM ads WHERE beneficiary_type = $1 AND beneficiary_id = $2 LIMIT 1', [type, id]);
  return rows[0] || null;
};

const insertAd = async ({ beneficiaryType, beneficiaryId, createdBy, targetAll = true, sponsorIds = [] }) => {
  try {
    const { rows } = await query(
      `INSERT INTO ads (beneficiary_type, beneficiary_id, created_by, target_all)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [beneficiaryType, beneficiaryId, createdBy, targetAll]
    );
    const ad = rows[0];

    if (!targetAll && sponsorIds.length > 0) {
      for (const sponsorId of sponsorIds) {
        await query(
          `INSERT INTO ad_recipients (ad_id, sponsor_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [ad.id, sponsorId]
        );
      }
    }

    return ad;
  } catch (err) {
    throw err;
  }
};

// ── Delete an ad by ID ────────────────────────────────────────────────────────
const removeAd = async (id) => {
  const { rows } = await query(
    'DELETE FROM ads WHERE id = $1 RETURNING *',
    [id]
  );
  return rows[0] || null;
};

module.exports = {
  findAllAds,
  findAdById,
  findAdsForSponsor,
  insertAd,
  findOpenAdForBeneficiary,
  removeAd,
};
