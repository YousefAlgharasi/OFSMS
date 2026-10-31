/**
 * sponsors.controller.js
 * Handles HTTP requests for the sponsors module.
 */

const bcrypt = require('bcryptjs');
const service = require('./sponsors.service');
const { logAudit } = require('../../utils/auditLog');

// Audit entries must never break the request
const audit = (req, action, entityId, newValue) =>
  logAudit({ userId: req.user.id, action, entityType: 'sponsor', entityId, newValue }).catch(() => {});

/**
 * POST /api/sponsors
 * GM only — create a new sponsor and generate their portal token.
 */
const createSponsor = async (req, res, next) => {
  try {
    const { fullName, phone, email, portalPassword } = req.body;

    const portalPasswordHash = await bcrypt.hash(portalPassword, 12);

    const sponsor = await service.createSponsor({
      fullName,
      phone,
      email,
      portalPasswordHash,
      portalPasswordPlain: portalPassword,
      createdBy: req.user.id,
    });

    await audit(req, 'sponsor_created', sponsor.id, { full_name: fullName });
    return res.status(201).json({
      message: 'تم إنشاء الكافل بنجاح',
      sponsor,
    });
  } catch (err) {
    if (err.status === 409) {
      return res.status(409).json({ error: err.message });
    }
    next(err);
  }
};

/**
 * GET /api/sponsors
 * GM only — list all sponsors with active sponsorship count.
 */
const getAllSponsors = async (req, res, next) => {
  try {
    let sponsors = await service.getAllSponsors();
    // Portal credentials are for the GM only
    if (req.user?.role !== 'gm') {
      sponsors = sponsors.map(({ portal_password_plain, portal_token, ...rest }) => rest);
    }
    return res.json({ sponsors });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/sponsors/:id
 * GM only — get a single sponsor with their sponsorships.
 */
const getSponsorById = async (req, res, next) => {
  try {
    const sponsor = await service.getSponsorById(req.params.id);
    if (!sponsor) {
      return res.status(404).json({ error: 'الكافل غير موجود' });
    }

    const sponsorships = await service.getSponsorshipsBySponsorId(req.params.id);
    return res.json({ sponsor, sponsorships });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/sponsors/:id/sponsorships
 * GM only — assign a beneficiary to this sponsor.
 */
const createSponsorship = async (req, res, next) => {
  try {
    const { beneficiaryType, beneficiaryId, agentId, intermediary, startDate, monthlyAmount } =
      req.body;

    const sponsorship = await service.createSponsorship({
      sponsorId: req.params.id,
      beneficiaryType,
      beneficiaryId,
      agentId,
      intermediary,
      startDate,
      monthlyAmount,
    });

    return res.status(201).json({
      message: 'تم تعيين الكفالة بنجاح',
      sponsorship,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/sponsors/transfer
 * GM only — transfer a beneficiary from one sponsor to another.
 */
const transferSponsorship = async (req, res, next) => {
  try {
    const { beneficiaryType, beneficiaryId, newSponsorId, agentId, monthlyAmount, endReason } =
      req.body;

    const sponsorship = await service.transferSponsorship({
      beneficiaryType,
      beneficiaryId,
      newSponsorId,
      agentId,
      monthlyAmount,
      endReason,
      actorId: req.user.id,
    });

    await audit(req, 'sponsorship_transferred', newSponsorId, { beneficiaryType, beneficiaryId });
    return res.status(200).json({
      message: 'تم نقل الكفالة بنجاح',
      sponsorship,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/sponsors/:id
 * GM only — update a sponsor's information.
 */
const updateSponsor = async (req, res, next) => {
  try {
    const { fullName, phone, email, portalPassword } = req.body;
    let portalPasswordHash;

    if (portalPassword) {
      portalPasswordHash = await bcrypt.hash(portalPassword, 12);
    }

    const sponsor = await service.updateSponsor(req.params.id, {
      fullName,
      phone,
      email,
      portalPasswordHash,
      portalPasswordPlain: portalPassword,
    });

    await audit(req, portalPassword ? 'sponsor_updated_password_changed' : 'sponsor_updated', req.params.id, { full_name: fullName });
    return res.status(200).json({
      message: 'تم تحديث بيانات الكافل بنجاح',
      sponsor,
    });
  } catch (err) {
    if (err.status === 409 || err.status === 404) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
};

/**
 * DELETE /api/sponsors/:id
 * GM only — delete a sponsor completely.
 */
const deleteSponsor = async (req, res, next) => {
  try {
    await service.deleteSponsor(req.params.id);
    await audit(req, 'sponsor_deleted', req.params.id, null);
    return res.status(200).json({ message: 'تم حذف الكافل بنجاح' });
  } catch (err) {
    if (err.status === 400 || err.status === 404) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
};

/**
 * GET /api/sponsors/:id/portfolio
 * GM only — full portfolio view for a sponsor.
 */
const getSponsorPortfolio = async (req, res, next) => {
  try {
    const portfolio = await service.getSponsorPortfolio(req.params.id);
    return res.json(portfolio);
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
};

module.exports = {
  createSponsor,
  getAllSponsors,
  getSponsorById,
  createSponsorship,
  transferSponsorship,
  updateSponsor,
  deleteSponsor,
  getSponsorPortfolio,
};
