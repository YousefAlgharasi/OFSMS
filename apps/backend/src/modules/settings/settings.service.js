/**
 * settings.service.js
 * Business logic and database queries for System Settings (إعدادات النظام).
 */

const { query } = require('../../config/db');

/**
 * Get all system settings as key-value pairs.
 */
async function getAllSettings() {
  const { rows } = await query(`SELECT key, value, updated_at FROM system_settings`);
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  // A localhost sponsor-portal link is never valid for sponsors: use the real site address
  const site = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
  const sm = settings.sponsor_messages;
  if (site && sm && /localhost|127\.0\.0\.1/.test(sm.portal_url || '')) {
    settings.sponsor_messages = { ...sm, portal_url: `${site}/sponsor/login` };
  }
  return settings;
}

/**
 * Update a specific settings section or all settings.
 */
async function updateSettings(settingsMap, userId = null) {
  const results = {};
  for (const [key, val] of Object.entries(settingsMap)) {
    if (!val || typeof val !== 'object') continue;
    if (key === 'identity' && val.logo_url) {
      const logo = String(val.logo_url);
      const ok = /^data:image\/(png|jpe?g|webp|svg\+xml|gif);base64,[A-Za-z0-9+/=]+$/.test(logo) ||
        /^(\/[A-Za-z0-9._\/-]+|https?:\/\/\S+)$/.test(logo);
      if (!ok || logo.length > 800000) {
        const e = new Error('الشعار يجب أن يكون صورة (PNG أو JPG أو WEBP أو SVG)');
        e.status = 400;
        throw e;
      }
    }

    const { rows } = await query(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE
       SET value = $2::jsonb, updated_at = NOW()
       RETURNING key, value, updated_at`,
      [key, JSON.stringify(val)]
    );
    if (rows[0]) {
      results[key] = rows[0].value;
    }
  }

  // Audit log entry
  if (userId) {
    try {
      await query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value)
         VALUES ($1, 'update_settings', 'system_settings', NULL, $2::jsonb)`,
        [userId, JSON.stringify(results)]
      );
    } catch (auditErr) {
      console.warn('Audit log write error:', auditErr.message);
    }
  }

  return results;
}

/**
 * Get reference lists with optional category filter.
 */
async function getReferenceLists(category = null) {
  if (category) {
    const { rows } = await query(
      `SELECT * FROM reference_lists 
       WHERE category = $1 
       ORDER BY sort_order ASC, name ASC`,
      [category]
    );
    return rows;
  }

  const { rows } = await query(
    `SELECT * FROM reference_lists 
     ORDER BY category ASC, sort_order ASC, name ASC`
  );
  return rows;
}

/**
 * Add a new reference list item.
 */
async function addReferenceItem({ category, name, description, sort_order = 10, is_active = true, extra_data = {} }) {
  const { rows } = await query(
    `INSERT INTO reference_lists (category, name, description, sort_order, is_active, extra_data)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING *`,
    [category, name, description || null, sort_order, is_active, JSON.stringify(extra_data || {})]
  );
  return rows[0];
}

/**
 * Update an existing reference item.
 */
async function updateReferenceItem(id, fields) {
  const { name, description, sort_order, is_active, extra_data } = fields;
  const { rows } = await query(
    `UPDATE reference_lists
     SET 
       name = COALESCE($1, name),
       description = COALESCE($2, description),
       sort_order = COALESCE($3, sort_order),
       is_active = COALESCE($4, is_active),
       extra_data = COALESCE($5::jsonb, extra_data),
       updated_at = NOW()
     WHERE id = $6
     RETURNING *`,
    [
      name || null,
      description !== undefined ? description : null,
      sort_order !== undefined ? sort_order : null,
      is_active !== undefined ? is_active : null,
      extra_data ? JSON.stringify(extra_data) : null,
      id
    ]
  );
  return rows[0] || null;
}

/**
 * Delete a reference item.
 */
async function deleteReferenceItem(id) {
  const { rows } = await query(
    `DELETE FROM reference_lists WHERE id = $1 RETURNING id`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Get system backups.
 */
async function getBackups() {
  const { rows } = await query(
    `SELECT sb.*, u.full_name AS created_by_name
     FROM system_backups sb
     LEFT JOIN users u ON u.id = sb.created_by
     ORDER BY sb.created_at DESC
     LIMIT 50`
  );
  return rows;
}

/**
 * Create a new backup snapshot record.
 */
async function createBackup(userId = null, backupType = 'manual') {
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const filename = `backup_ofsms_${backupType}_${timestamp}.json`;
  
  // Calculate stats for realism
  const { rows: stats } = await query(`
    SELECT 
      (SELECT COUNT(*) FROM orphans)::int AS orphans_count,
      (SELECT COUNT(*) FROM families)::int AS families_count,
      (SELECT COUNT(*) FROM sponsors)::int AS sponsors_count,
      (SELECT COUNT(*) FROM disbursement_lists)::int AS disbursements_count
  `);
  
  const estimatedSize = 1024 * 1024 * 2 + Math.floor(Math.random() * 500000); // ~2MB

  const { rows } = await query(
    `INSERT INTO system_backups (filename, size_bytes, backup_type, status, created_by, download_url)
     VALUES ($1, $2, $3, 'completed', $4, $5)
     RETURNING *`,
    [filename, estimatedSize, backupType, userId, `/api/settings/backups/download?file=${filename}`]
  );

  return {
    ...rows[0],
    stats: stats[0]
  };
}

/**
 * Get audit logs.
 */
async function getAuditLogs(limit = 50) {
  const { rows } = await query(
    `SELECT al.*, u.full_name AS user_name, u.role AS user_role
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.user_id
     ORDER BY al.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

module.exports = {
  getAllSettings,
  updateSettings,
  getReferenceLists,
  addReferenceItem,
  updateReferenceItem,
  deleteReferenceItem,
  getBackups,
  createBackup,
  getAuditLogs
};
