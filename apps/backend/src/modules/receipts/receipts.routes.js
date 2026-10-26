/**
 * receipts.routes.js
 * Mounted at: /api/receipts
 *
 * POST /api/receipts/biometric          → agent uploads a fingerprint receipt
 * POST /api/receipts/confirm            → agent confirms receipt for their own orphan
 * GET  /api/receipts/my-items/:listId   → agent's own orphans in a released list
 * GET  /api/receipts/my-items/:listId/pdf → same list as a PDF
 * GET  /api/receipts                    → supervisor/GM view all receipts (filterable)
 * GET  /api/receipts/summary/:listId    → agent checks their completion for a list
 */

const { Router } = require('express');
const { body, query: qv, param } = require('express-validator');
const { authenticate, authorize } = require('../../middleware/rbac');
const controller = require('./receipts.controller');

const router = Router();

// ── POST /api/receipts/biometric ──────────────────────────────────────────────
// Agent uploads a biometric fingerprint for one disbursement item
router.post(
  '/biometric',
  authenticate,
  authorize('agent', 'gm'),
  [
    body('itemId')
      .isUUID()
      .withMessage('معرّف بند الصرف غير صحيح'),
    body('fingerprintBase64')
      .notEmpty()
      .withMessage('بيانات البصمة مطلوبة')
      .isBase64()
      .withMessage('صيغة البصمة غير صحيحة — يجب أن تكون Base64'),
    body('mimeType')
      .optional()
      .isIn(['image/png', 'image/jpeg'])
      .withMessage('نوع الملف يجب أن يكون image/png أو image/jpeg'),
  ],
  controller.uploadBiometricReceipt
);

// ── POST /api/receipts/confirm ────────────────────────────────────────────────
// Agent confirms that one of the orphans they registered received the money
router.post(
  '/confirm',
  authenticate,
  authorize('agent'),
  [body('itemId').isUUID().withMessage('معرّف بند الصرف غير صحيح')],
  controller.confirmReceipt
);

// ── GET /api/receipts/my-items/:listId ────────────────────────────────────────
// Agent: only the orphans this agent registered, for one released list
router.get(
  '/my-items/:listId',
  authenticate,
  authorize('agent'),
  [param('listId').isUUID().withMessage('listId غير صحيح')],
  controller.getMyListItems
);

// ── GET /api/receipts/my-items/:listId/pdf ────────────────────────────────────
// Agent: PDF of their own orphans for one released list
router.get(
  '/my-items/:listId/pdf',
  authenticate,
  authorize('agent'),
  [param('listId').isUUID().withMessage('listId غير صحيح')],
  controller.exportMyItemsPdf
);

// ── GET /api/receipts ─────────────────────────────────────────────────────────
// Supervisor / GM: list all receipts, optionally filtered
router.get(
  '/',
  authenticate,
  authorize('supervisor', 'gm'),
  [
    qv('agentId').optional().isUUID().withMessage('agentId غير صحيح'),
    qv('listId').optional().isUUID().withMessage('listId غير صحيح'),
  ],
  controller.getReceipts
);

// ── GET /api/receipts/summary/:listId ─────────────────────────────────────────
// Agent: check how many receipts they've completed for a given disbursement list
router.get(
  '/summary/:listId',
  authenticate,
  authorize('agent', 'supervisor', 'gm'),
  controller.getAgentReceiptSummary
);

// ── POST /api/receipts/batch-confirm ──────────────────────────────────────────
// Agent: confirms that all orphans in their batch have been paid for a list
router.post(
  '/batch-confirm',
  authenticate,
  authorize('agent', 'gm'),
  [
    body('listId')
      .isUUID()
      .withMessage('معرّف كشف الصرف غير صحيح'),
    body('notes')
      .optional()
      .trim(),
  ],
  controller.batchConfirm
);

// ── GET /api/receipts/my-batch ────────────────────────────────────────────────
// Agent: get active disbursement batch items
router.get(
  '/my-batch',
  authenticate,
  authorize('agent'),
  controller.getMyBatch
);

// ── GET /api/receipts/supervisor-log/:listId ──────────────────────────────────
// Supervisor: get completion log per agent
router.get(
  '/supervisor-log/:listId',
  authenticate,
  authorize('supervisor', 'finance', 'gm'),
  [
    param('listId').isUUID().withMessage('listId غير صحيح'),
  ],
  controller.getSupervisorLog
);

module.exports = router;