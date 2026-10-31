/**
 * evaluations.routes.js
 * Endpoints for Researcher Periodic Evaluations (تقييم الباحث الدوري).
 * Mounted at: /api/evaluations
 */

const { Router } = require('express');
const { authenticate, authorize } = require('../../middleware/rbac');
const controller = require('./evaluations.controller');

const router = Router();

// Beneficiaries list with evaluation stats
router.get('/beneficiaries', authenticate, controller.getBeneficiaries);

// Evaluations list by beneficiary
router.get('/', authenticate, controller.getByBeneficiary);

// Single evaluation by ID
router.get('/:id', authenticate, controller.getById);

// Create evaluation (GM, Supervisor, Agent)
router.post('/', authenticate, authorize('gm', 'supervisor', 'agent'), controller.create);

// Update evaluation (GM, Supervisor, Agent)
router.put('/:id', authenticate, authorize('gm', 'supervisor', 'agent'), controller.update);

// Delete evaluation (GM only)
router.delete('/:id', authenticate, authorize('gm'), controller.remove);

module.exports = router;
