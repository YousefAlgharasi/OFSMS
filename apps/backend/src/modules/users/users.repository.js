/**
 * users.repository.js — OFSMS Users Data Access Layer
 *
 * All raw SQL queries for the users module live here.
 * No business logic — only parameterized DB queries.
 *
 * Depends on: ../../config/db
 */

const { query } = require('../../config/db');

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Return all users ordered by creation date (newest first).
 * @returns {Promise<Array>}
 */
const findAllUsers = async () => {
  const { rows } = await query(
    `SELECT id, full_name, email, role, phone, is_active, created_at
     FROM users
     ORDER BY created_at DESC`
  );
  return rows;
};

/**
 * Return a single user by UUID.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
const findUserById = async (id) => {
  const { rows } = await query(
    `SELECT id, full_name, email, role, phone, is_active, created_at
     FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
};

/**
 * Return a user row by normalized email (used for duplicate check).
 * @param {string} email — already lowercased + trimmed
 * @returns {Promise<Object|null>}
 */
const findByEmail = async (email) => {
  const { rows } = await query(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );
  return rows[0] || null;
};

/**
 * Return a user row by phone number (used for duplicate check).
 * @param {string} phone
 * @returns {Promise<Object|null>}
 */
const findByPhone = async (phone) => {
  const { rows } = await query(
    'SELECT id FROM users WHERE phone = $1',
    [phone]
  );
  return rows[0] || null;
};

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Insert a new user row.
 * @param {{ fullName: string, email: string, passwordHash: string, role: string, phone: string|null }} params
 * @returns {Promise<Object>} newly created user row
 */
const createUser = async ({ fullName, email, passwordHash, role, phone }) => {
  const { rows } = await query(
    `INSERT INTO users (full_name, email, password_hash, role, phone)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, full_name, email, role, phone, is_active, created_at`,
    [fullName, email, passwordHash, role, phone || null]
  );
  return rows[0];
};

/**
 * Update user's editable fields (only non-null values are applied via COALESCE).
 * @param {string} id
 * @param {{ fullName?: string, phone?: string, role?: string }} updates
 * @returns {Promise<Object|null>} updated user or null if not found
 */
const updateUser = async (id, { fullName, phone, role }) => {
  const { rows } = await query(
    `UPDATE users
     SET full_name = COALESCE($1, full_name),
         phone     = COALESCE($2, phone),
         role      = COALESCE($3, role)
     WHERE id = $4
     RETURNING id, full_name, email, role, phone, is_active`,
    [fullName || null, phone || null, role || null, id]
  );
  return rows[0] || null;
};

/**
 * Flip the is_active flag for a user.
 * @param {string} id
 * @param {boolean} isActive
 * @returns {Promise<Object|null>}
 */
const setUserActive = async (id, isActive) => {
  const { rows } = await query(
    `UPDATE users SET is_active = $1 WHERE id = $2
     RETURNING id, full_name, email, role, is_active`,
    [isActive, id]
  );
  return rows[0] || null;
};

/**
 * Permanently delete a user row.
 * @param {string} id
 * @returns {Promise<Object|null>} deleted user { id, full_name } or null if not found
 */
const deleteUser = async (id) => {
  const { rows } = await query(
    'DELETE FROM users WHERE id = $1 RETURNING id, full_name',
    [id]
  );
  return rows[0] || null;
};

// ── Audit Logs ────────────────────────────────────────────────────────────────

/**
 * Fetch paginated audit logs with optional entity filters.
 * @param {{ entityType?: string, entityId?: string, limit?: number, offset?: number }} filters
 * @returns {Promise<Array>}
 */
const getAuditLogs = async ({ entityType, entityId, limit = 20, offset = 0 } = {}) => {
  const conditions = [];
  const params = [];

  if (entityType) {
    params.push(entityType);
    conditions.push(`al.entity_type = $${params.length}`);
  }
  if (entityId) {
    params.push(entityId);
    conditions.push(`al.entity_id = $${params.length}`);
  }

  const safeLimit = Math.min(parseInt(limit, 10) || 20, 100);
  const safeOffset = parseInt(offset, 10) || 0;

  params.push(safeLimit);
  params.push(safeOffset);

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await query(
    `SELECT al.id, al.action, al.entity_type, al.entity_id,
            al.old_value, al.new_value, al.created_at,
            u.full_name AS actor_name
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.user_id
     ${where}
     ORDER BY al.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows;
};

/**
 * Replace a user's password hash.
 * @returns {Promise<Object|null>} { id, full_name } or null if not found
 */
const setPasswordHash = async (id, passwordHash) => {
  const { rows } = await query(
    `UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, full_name`,
    [passwordHash, id]
  );
  return rows[0] || null;
};

module.exports = {
  findAllUsers,
  findUserById,
  findByEmail,
  findByPhone,
  createUser,
  updateUser,
  setUserActive,
  setPasswordHash,
  deleteUser,
  getAuditLogs,
};
