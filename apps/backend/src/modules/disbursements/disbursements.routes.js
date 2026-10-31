/**
 * disbursements.routes.js
 * Mounted at: /api/disbursements
 *
 * This file contains ONLY route definitions and middleware wiring.
 * Business logic  → disbursements.service.js
 * HTTP handling   → disbursements.controller.js
 * DB queries      → disbursements.repository.js
 */

const { Router } = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../../middleware/rbac');
const controller = require('./disbursements.controller');

const router = Router();

// ── GET /api/disbursements/agent/released ─────────────────────────────────────
// Agent only: released lists where this agent has beneficiaries
// MUST be defined BEFORE /:id to avoid param capture
router.get(
  '/agent/released',
  authenticate,
  authorize('agent', 'supervisor', 'gm'),
  controller.getReleasedByAgent
);

// ── GET /api/disbursements — list all (supervisor / finance / gm only) ─────────
router.get(
  '/',
  authenticate,
  authorize('supervisor', 'finance', 'gm'),
  controller.getDisbursementLists
);

// ── POST /api/disbursements/generate ─────────────────────────────────────────
router.post(
  '/generate',
  authenticate,
  authorize('supervisor', 'gm'),
  controller.generateDisbursementList
);

/**
 * ── GET /api/disbursements/history ──────────────────────────────────────────
 * "History" view for UI (must be defined BEFORE /:id to avoid param capture)
 */
router.get(
  '/history',
  authenticate,
  authorize('supervisor', 'finance', 'gm'),
  controller.getDisbursementHistory
);

// ── GET /api/disbursements/:id ────────────────────────────────────────────────
// Agents can also view a specific list (needed for the batch receipts page)
router.get(
  '/:id',
  authenticate,
  authorize('supervisor', 'finance', 'gm'),
  controller.getDisbursementById
);

// ── PATCH /api/disbursements/:id/approve — supervisor approves ────────────────
router.patch(
  '/:id/approve',
  authenticate,
  authorize('supervisor', 'gm'),
  controller.supervisorApprove
);

// ── PATCH /api/disbursements/:id/reject — supervisor rejects ──────────────────
router.patch(
  '/:id/reject',
  authenticate,
  authorize('supervisor', 'gm'),
  [body('notes').notEmpty().withMessage('ملاحظات الرفض مطلوبة')],
  controller.supervisorReject
);

// ── PATCH /api/disbursements/:id/finance-approve ──────────────────────────────
router.patch(
  '/:id/finance-approve',
  authenticate,
  authorize('finance', 'gm'),
  controller.financeApprove
);

// ── PATCH /api/disbursements/:id/finance-reject ───────────────────────────────
router.patch(
  '/:id/finance-reject',
  authenticate,
  authorize('finance', 'gm'),
  [body('notes').notEmpty().withMessage('ملاحظات الرفض مطلوبة')],
  controller.financeReject
);

// ── PATCH /api/disbursements/:id/release — GM releases funds ──────────────────
router.patch(
  '/:id/release',
  authenticate,
  authorize('gm'),
  controller.gmRelease
);

module.exports = router;