/**
 * quran.routes.js
 * Mounted at: /api/quran-reports
 *
 * This file contains ONLY route definitions and middleware wiring.
 * Business logic  → quran.service.js
 * HTTP handling   → quran.controller.js
 * DB queries      → quran.repository.js
 */

const { Router } = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../../middleware/rbac');
const controller = require('./quran.controller');

const router = Router();

// POST /api/quran-reports — agent submits a report
router.post(
  '/',
  authenticate,
  authorize('agent', 'gm'),
  [
    body('orphanId').isUUID().withMessage('معرّف اليتيم غير صحيح'),
    body('month').isInt({ min: 1, max: 12 }).withMessage('الشهر يجب أن يكون بين 1 و 12'),
    body('year').isInt({ min: 2020 }).withMessage('السنة غير صحيحة'),
    body('memorizedText')
      .trim()
      .notEmpty().withMessage('يرجى كتابة ما حفظه اليتيم هذا الشهر')
      .isLength({ max: 2000 }).withMessage('نص الحفظ طويل جداً (الحد الأقصى 2000 حرف)'),
    body('agentNotes')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 1000 }).withMessage('الملاحظات طويلة جداً (الحد الأقصى 1000 حرف)'),
  ],
  controller.submitReport
);

// GET /api/quran-reports/pending — supervisor sees all pending reports
router.get(
  '/pending',
  authenticate,
  authorize('supervisor', 'gm'),
  controller.getPendingReports
);

// GET /api/quran-reports/mine — agent sees their own submitted reports
router.get(
  '/mine',
  authenticate,
  authorize('agent'),
  controller.getReportsByAgent
);

// GET /api/quran-reports/:id — supervisor/gm gets single report
router.get(
  '/:id',
  authenticate,
  authorize('agent', 'supervisor', 'gm'),
  controller.getReportById
);

// PATCH /api/quran-reports/:id/review — supervisor approves or rejects
router.patch(
  '/:id/review',
  authenticate,
  authorize('supervisor', 'gm'),
  [
    body('action')
      .isIn(['approved', 'rejected'])
      .withMessage('الإجراء يجب أن يكون approved أو rejected'),
    body('notes')
      .if(body('action').equals('rejected'))
      .notEmpty().withMessage('ملاحظات الرفض مطلوبة عند الرفض'),
  ],
  controller.reviewReport
);

module.exports = router;
