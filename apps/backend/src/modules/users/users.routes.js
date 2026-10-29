/**
 * users.routes.js — OFSMS User Management Endpoints
 *
 * Mounted at:
 *   /api/users      → full CRUD for user accounts (GM only)
 *   /api/audit-logs → paginated audit log viewer (GM only)
 *
 * This file contains ONLY route definitions and middleware wiring.
 * Business logic  → users.service.js
 * HTTP handling   → users.controller.js
 * DB queries      → users.repository.js
 * Validation      → users.validators.js
 */

const express = require('express');
const router  = express.Router();

const { authenticate, authorize } = require('../../middleware/rbac');
const { createUserRules, updateUserRules, setPasswordRules, validateRequest } = require('./users.validators');
const controller = require('./users.controller');

// ── GET /api/users ────────────────────────────────────────────────────────────
router.get(
  '/',
  authenticate,
  authorize('gm'),
  controller.listUsers
);

// ── POST /api/users ───────────────────────────────────────────────────────────
router.post(
  '/',
  authenticate,
  authorize('gm'),
  createUserRules,
  validateRequest,
  controller.createUser
);

// ── PATCH /api/users/:id ──────────────────────────────────────────────────────
router.patch(
  '/:id',
  authenticate,
  authorize('gm'),
  updateUserRules,
  validateRequest,
  controller.updateUser
);

// ── PATCH /api/users/:id/deactivate ──────────────────────────────────────────
router.patch(
  '/:id/deactivate',
  authenticate,
  authorize('gm'),
  controller.deactivateUser
);

// ── PATCH /api/users/:id/activate ────────────────────────────────────────────
router.patch(
  '/:id/activate',
  authenticate,
  authorize('gm'),
  controller.activateUser
);

// ── PATCH /api/users/:id/password ────────────────────────────────────────────
router.patch(
  '/:id/password',
  authenticate,
  authorize('gm'),
  setPasswordRules,
  validateRequest,
  controller.setUserPassword
);

// ── DELETE /api/users/:id ─────────────────────────────────────────────────────
router.delete(
  '/:id',
  authenticate,
  authorize('gm'),
  controller.deleteUser
);

// ── GET /api/audit-logs ───────────────────────────────────────────────────────
// Note: this router is mounted at both /api/users AND /api/audit-logs (see index.js)
router.get(
  '/audit-logs',
  authenticate,
  authorize('gm'),
  controller.getAuditLogs
);

module.exports = router;