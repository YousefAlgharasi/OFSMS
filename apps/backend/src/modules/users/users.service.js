/**
 * users.service.js — OFSMS Users Business Logic Layer
 *
 * Orchestrates user management operations by combining:
 *   - users.repository.js  (data access)
 *   - bcryptjs             (password hashing)
 *   - auditLog             (audit trail)
 *
 * No HTTP knowledge lives here (no req/res/next).
 * All functions throw plain Errors with a .statusCode property
 * that the controller maps to the correct HTTP status code.
 */

const bcrypt = require('bcryptjs');
const { logAudit } = require('../../utils/auditLog');
const repo = require('./users.repository');

// ── Read operations ───────────────────────────────────────────────────────────

/**
 * Return all users.
 * @returns {Promise<Array>}
 */
const getAllUsers = () => repo.findAllUsers();

/**
 * Return a single user by ID, throws 404 if not found.
 * @param {string} id
 * @returns {Promise<Object>}
 */
const getUserById = async (id) => {
  const user = await repo.findUserById(id);
  if (!user) {
    const err = new Error('المستخدم غير موجود');
    err.statusCode = 404;
    throw err;
  }
  return user;
};

/**
 * Return paginated audit logs.
 * @param {{ entityType?, entityId?, limit?, offset? }} filters
 * @returns {Promise<Array>}
 */
const getAuditLogs = (filters) => repo.getAuditLogs(filters);

// ── Write operations ──────────────────────────────────────────────────────────

/**
 * Create a new user after validating uniqueness of email and phone.
 * Hashes the password before storing.
 *
 * @param {{ fullName: string, email: string, password: string, role: string, phone?: string }} data
 * @param {string} actorId — UUID of the GM performing the action
 * @returns {Promise<Object>} created user row
 */
const createUser = async ({ fullName, email, password, role, phone }, actorId) => {
  // Email is already normalized by the validator (trim + toLowerCase)

  // 1. Ensure email is unique
  const existingEmail = await repo.findByEmail(email);
  if (existingEmail) {
    const err = new Error('البريد الإلكتروني مستخدم بالفعل');
    err.statusCode = 409;
    throw err;
  }

  // 2. Ensure phone is unique (only if provided)
  if (phone) {
    const existingPhone = await repo.findByPhone(phone);
    if (existingPhone) {
      const err = new Error('رقم الهاتف مستخدم بالفعل');
      err.statusCode = 409;
      throw err;
    }
  }

  // 3. Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // 4. Insert user
  const user = await repo.createUser({
    fullName: fullName.trim(),
    email,
    passwordHash,
    role,
    phone: phone || null,
  });

  // 5. Write audit log
  await logAudit({
    userId:     actorId,
    action:     'user_created',
    entityType: 'user',
    entityId:   user.id,
    newValue:   { email: user.email, role },
  });

  return user;
};

/**
 * Update editable fields for an existing user.
 *
 * @param {string} id
 * @param {{ fullName?: string, phone?: string, role?: string }} updates
 * @param {string} actorId
 * @returns {Promise<Object>} updated user row
 */
const updateUser = async (id, updates, actorId) => {
  const user = await repo.updateUser(id, updates);
  if (!user) {
    const err = new Error('المستخدم غير موجود');
    err.statusCode = 404;
    throw err;
  }

  await logAudit({
    userId:     actorId,
    action:     'user_updated',
    entityType: 'user',
    entityId:   id,
    newValue:   updates,
  });

  return user;
};

/**
 * Deactivate a user account.
 * Prevents a GM from deactivating their own account.
 *
 * @param {string} id — target user UUID
 * @param {string} actorId — GM performing the action
 * @returns {Promise<Object>}
 */
const deactivateUser = async (id, actorId) => {
  if (id === actorId) {
    const err = new Error('لا يمكنك إيقاف حسابك الخاص');
    err.statusCode = 400;
    throw err;
  }

  const user = await repo.setUserActive(id, false);
  if (!user) {
    const err = new Error('المستخدم غير موجود');
    err.statusCode = 404;
    throw err;
  }

  await logAudit({
    userId:     actorId,
    action:     'user_deactivated',
    entityType: 'user',
    entityId:   id,
    newValue:   { is_active: false },
  });

  return user;
};

/**
 * Activate a previously deactivated user account.
 *
 * @param {string} id — target user UUID
 * @param {string} actorId
 * @returns {Promise<Object>}
 */
const activateUser = async (id, actorId) => {
  const user = await repo.setUserActive(id, true);
  if (!user) {
    const err = new Error('المستخدم غير موجود');
    err.statusCode = 404;
    throw err;
  }

  await logAudit({
    userId:     actorId,
    action:     'user_activated',
    entityType: 'user',
    entityId:   id,
    newValue:   { is_active: true },
  });

  return user;
};

/**
 * Permanently delete a user.
 * Prevents a GM from deleting their own account.
 *
 * @param {string} id — target user UUID
 * @param {string} actorId
 * @returns {Promise<Object>} deleted user { id, full_name }
 */
const deleteUser = async (id, actorId) => {
  if (id === actorId) {
    const err = new Error('لا يمكنك حذف حسابك الخاص');
    err.statusCode = 400;
    throw err;
  }

  const user = await repo.deleteUser(id);
  if (!user) {
    const err = new Error('المستخدم غير موجود');
    err.statusCode = 404;
    throw err;
  }

  await logAudit({
    userId:     actorId,
    action:     'user_deleted',
    entityType: 'user',
    entityId:   id,
    oldValue:   { fullName: user.full_name },
  });

  return user;
};

/**
 * Set a new password for a user (GM only). The password itself is never logged.
 *
 * @param {string} id — target user UUID
 * @param {string} password — new plain password (validated by the route)
 * @param {string} actorId — GM performing the action
 */
const setUserPassword = async (id, password, actorId) => {
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await repo.setPasswordHash(id, passwordHash);
  if (!user) {
    const err = new Error('المستخدم غير موجود');
    err.statusCode = 404;
    throw err;
  }

  await logAudit({
    userId:     actorId,
    action:     'user_password_changed',
    entityType: 'user',
    entityId:   id,
    newValue:   { fullName: user.full_name },
  });

  return user;
};

module.exports = {
  getAllUsers,
  getUserById,
  getAuditLogs,
  createUser,
  updateUser,
  deactivateUser,
  activateUser,
  setUserPassword,
  deleteUser,
};
