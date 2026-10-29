/**
 * users.validators.js — OFSMS Users Validation Rules
 *
 * Declarative express-validator schemas for all user management endpoints.
 * Centralizes validation and normalization out of route handlers.
 *
 * Usage:
 *   router.post('/', authenticate, authorize('gm'), createUserRules, validateRequest, handler)
 *   router.patch('/:id', authenticate, authorize('gm'), updateUserRules, validateRequest, handler)
 */

const { body, validationResult } = require('express-validator');

// ── Validation rules ──────────────────────────────────────────────────────────

const createUserRules = [
  body('fullName')
    .trim()
    .notEmpty().withMessage('الاسم الكامل مطلوب')
    .matches(/^[\p{L}\p{M}\s'-]+$/u).withMessage('الاسم يجب أن يحتوي على أحرف فقط ولا يمكن أن يحتوي على أرقام'),

  body('email')
    .trim()
    .toLowerCase()
    .notEmpty().withMessage('البريد الإلكتروني مطلوب')
    .isEmail().withMessage('البريد الإلكتروني غير صحيح'),

  body('password')
    .notEmpty().withMessage('كلمة المرور مطلوبة')
    .isLength({ min: 8 }).withMessage('كلمة المرور يجب أن تكون 8 أحرف على الأقل'),

  body('role')
    .isIn(['agent', 'supervisor', 'finance', 'gm'])
    .withMessage('الدور يجب أن يكون: agent, supervisor, finance, gm'),

  body('phone').optional({ nullable: true }).isString(),
];

const updateUserRules = [
  body('fullName')
    .optional()
    .trim()
    .notEmpty().withMessage('الاسم لا يمكن أن يكون فارغاً')
    .matches(/^[\p{L}\p{M}\s'-]+$/u).withMessage('الاسم يجب أن يحتوي على أحرف فقط ولا يمكن أن يحتوي على أرقام'),

  body('phone').optional({ nullable: true }).isString(),

  body('role')
    .optional()
    .isIn(['agent', 'supervisor', 'finance', 'gm'])
    .withMessage('الدور غير صحيح'),
];

const setPasswordRules = [
  body('password')
    .notEmpty().withMessage('كلمة المرور الجديدة مطلوبة')
    .isLength({ min: 8 }).withMessage('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
    .isLength({ max: 72 }).withMessage('كلمة المرور طويلة جداً (الحد الأقصى 72 حرفاً)'),
];

// ── Validation result handler ─────────────────────────────────────────────────

/**
 * Middleware to run after validation rules.
 * Returns 400 with first validation error if any field is invalid.
 * Consistent with the rest of the API error format: { error: 'message' }
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
};

module.exports = { createUserRules, updateUserRules, setPasswordRules, validateRequest };
