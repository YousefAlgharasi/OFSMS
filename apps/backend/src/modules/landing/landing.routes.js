/**
 * landing.routes.js — Endpoints for landing page CMS
 *
 * GET   /api/landing           → Public: get landing page content
 * PUT   /api/landing           → GM/Supervisor: update all content
 * PATCH /api/landing/:section  → GM/Supervisor: update single section
 */

const { Router } = require('express');
const { authenticate, authorize } = require('../../middleware/rbac');
const controller = require('./landing.controller');

const router = Router();

// Public route to view landing page
router.get('/', controller.getContent);

// Admin routes to manage landing page
router.put('/', authenticate, authorize('gm'), controller.updateContent);
router.patch('/:section', authenticate, authorize('gm'), controller.updateSection);

module.exports = router;
