/**
 * users.controller.js — OFSMS Users HTTP Handler Layer
 *
 * Responsible only for:
 *   - Reading from req (body, params, query, user)
 *   - Calling the service layer
 *   - Writing the HTTP response (status + JSON)
 *
 * No business logic or DB queries live here.
 * Errors from the service are caught and mapped to HTTP status codes.
 */

const service = require('./users.service');

// ── GET /api/users ────────────────────────────────────────────────────────────
const listUsers = async (_req, res, next) => {
  try {
    const users = await service.getAllUsers();
    return res.json({ users });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/users ───────────────────────────────────────────────────────────
const createUser = async (req, res, next) => {
  try {
    const { fullName, email, password, role, phone } = req.body;
    const user = await service.createUser(
      { fullName, email, password, role, phone },
      req.user.id
    );
    return res.status(201).json({ message: 'تم إنشاء المستخدم بنجاح', user });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
};

// ── PATCH /api/users/:id ──────────────────────────────────────────────────────
const updateUser = async (req, res, next) => {
  try {
    const { fullName, phone, role } = req.body;
    const user = await service.updateUser(
      req.params.id,
      { fullName, phone, role },
      req.user.id
    );
    return res.json({ message: 'تم تحديث بيانات المستخدم', user });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
};

// ── PATCH /api/users/:id/deactivate ──────────────────────────────────────────
const deactivateUser = async (req, res, next) => {
  try {
    const user = await service.deactivateUser(req.params.id, req.user.id);
    return res.json({ message: 'تم إيقاف الحساب', user });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
};

// ── PATCH /api/users/:id/activate ────────────────────────────────────────────
const activateUser = async (req, res, next) => {
  try {
    const user = await service.activateUser(req.params.id, req.user.id);
    return res.json({ message: 'تم تفعيل الحساب', user });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
};

// ── DELETE /api/users/:id ─────────────────────────────────────────────────────
const deleteUser = async (req, res, next) => {
  try {
    const user = await service.deleteUser(req.params.id, req.user.id);
    return res.json({ message: `تم حذف المستخدم ${user.full_name}` });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
};

// ── GET /api/audit-logs ───────────────────────────────────────────────────────
const getAuditLogs = async (req, res, next) => {
  try {
    const { entityType, entityId, limit, offset } = req.query;
    const logs = await service.getAuditLogs({ entityType, entityId, limit, offset });
    return res.json({ logs });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/users/:id/password ─────────────────────────────────────────────
const setUserPassword = async (req, res, next) => {
  try {
    const user = await service.setUserPassword(req.params.id, req.body.password, req.user.id);
    return res.json({ message: `تم تغيير كلمة مرور ${user.full_name}` });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
};

module.exports = {
  listUsers,
  createUser,
  updateUser,
  deactivateUser,
  activateUser,
  setUserPassword,
  deleteUser,
  getAuditLogs,
};
