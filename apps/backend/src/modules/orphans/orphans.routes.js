/**
 * orphans.routes.js
 * Mounted at: /api/orphans
 *
 * Uses multer memoryStorage so file buffers are available for S3 upload.
 * Allowed file types: PDF, JPG, PNG (max 5MB each) per SADD §8.3
 */

const { Router } = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const { authenticate, authorize } = require('../../middleware/rbac');
const { scanUploadedFiles } = require('../../middleware/fileScanner');
const controller = require('./orphans.controller');
const giftedRouter = require('./gifted.routes');

const router = Router();

// ── Multer config ─────────────────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('نوع الملف غير مسموح. المسموح به: PDF، JPG، PNG فقط'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

// Accept: deathCert (1), birthCert (1), additionalDocs (up to 5)
const uploadFields = upload.fields([
  { name: 'deathCert', maxCount: 1 },
  { name: 'birthCert', maxCount: 1 },
  { name: 'additionalDocs', maxCount: 5 },
]);

// ── Validation rules ──────────────────────────────────────────────────────────
const createOrphanRules = [
  body('fullName')
    .trim()
    .notEmpty().withMessage('الاسم الكامل مطلوب')
    .isLength({ max: 150 }).withMessage('الاسم الكامل طويل جداً (الحد الأقصى 150 حرفاً)')
    .custom((val) => {
      const parts = val.trim().split(/\s+/).filter(Boolean);
      if (parts.length < 2) {
        throw new Error('الاسم يجب أن يكون ثنائياً على الأقل، ويحتوي على أحرف فقط');
      }
      const nameRegex = /^[\p{L}\p{M}]+(?:[-'ـ][\p{L}\p{M}]+)*$/u;
      if (!parts.every((p) => nameRegex.test(p))) {
        throw new Error('الاسم يجب أن يحتوي على أحرف فقط');
      }
      return true;
    }),

  body('dateOfBirth')
    .notEmpty().withMessage('تاريخ الميلاد مطلوب')
    .isDate().withMessage('تاريخ الميلاد غير صحيح')
    .custom((val) => {
      if (new Date(val) >= new Date()) {
        throw new Error('تاريخ الميلاد يجب أن يكون في الماضي');
      }
      return true;
    }),

  body('gender')
    .notEmpty().withMessage('الجنس مطلوب')
    .isIn(['male', 'female']).withMessage('الجنس يجب أن يكون male أو female'),

  body('governorateId')
    .notEmpty().withMessage('المحافظة مطلوبة')
    .isInt({ min: 1 }).withMessage('المحافظة غير صحيحة'),

  body('guardianName')
    .notEmpty().withMessage('اسم الوصي مطلوب')
    .trim()
    .isLength({ max: 150 }).withMessage('اسم الوصي طويل جداً (الحد الأقصى 150 حرفاً)'),

  body('notes').optional({ nullable: true }).isLength({ max: 3000 }).withMessage('الملاحظات طويلة جداً'),

  body('guardianRelation')
    .notEmpty().withMessage('صلة الوصي مطلوبة')
    .isIn(['uncle', 'maternal_uncle', 'grandfather', 'sibling', 'other'])
    .withMessage('صلة الوصي غير صحيحة'),
];

const updateStatusRules = [
  body('status')
    .notEmpty().withMessage('الحالة مطلوبة')
    .isIn(['under_marketing', 'under_sponsorship', 'rejected', 'inactive'])
    .withMessage('حالة غير صحيحة'),

  body('notes')
    .if(body('status').equals('rejected'))
    .notEmpty().withMessage('ملاحظات الرفض مطلوبة عند الرفض'),
];

// ── Routes ────────────────────────────────────────────────────────────────────

// GM only: orphans ready for sponsor assignment
router.get(
  '/marketing',
  authenticate,
  authorize('gm'),
  controller.getOrphansUnderMarketing
);
router.use('/', giftedRouter);

// Agent / Supervisor / GM: list orphans (with filters)
router.get(
  '/',
  authenticate,
  authorize('agent', 'supervisor', 'gm'),
  controller.getOrphans
);

// Agent (+ GM): register a new orphan with document uploads
router.post(
  '/',
  authenticate,
  authorize('agent', 'gm'),
  uploadFields,
  scanUploadedFiles,
  createOrphanRules,
  controller.createOrphan
);

// All allowed roles: get single orphan + documents
router.get(
  '/:id',
  authenticate,
  authorize('agent', 'supervisor', 'gm'),
  controller.getOrphanById
);

// Agent / GM: edit orphan details (agent only while under_review)
router.patch(
  '/:id',
  authenticate,
  authorize('agent', 'supervisor', 'gm'),
  controller.updateOrphan
);

// Supervisor / GM: approve or reject
router.patch(
  '/:id/status',
  authenticate,
  authorize('supervisor', 'gm'),
  updateStatusRules,
  controller.updateOrphanStatus
);

// GM only: share orphan profile as a sponsor-facing ad/request
router.post(
  '/:id/share',
  authenticate,
  authorize('gm'),
  controller.shareOrphanToAds
);

// GM only: delete orphan (blocked if active sponsorship exists)
router.delete(
  '/:id',
  authenticate,
  authorize('gm'),
  controller.deleteOrphan
);

// ── Multer error handler (must be last in this router) ────────────────────────
router.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError || err.message?.includes('نوع الملف')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
