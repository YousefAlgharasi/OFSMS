/**
 * evaluations.controller.js
 * Request handlers for periodic evaluations endpoints.
 */

const service = require('./evaluations.service');

const getBeneficiaries = async (req, res, next) => {
  try {
    const { type = 'orphan', search = '' } = req.query;
    const list = await service.getBeneficiariesList(type, search);
    return res.json({ status: 'ok', beneficiaries: list });
  } catch (err) {
    next(err);
  }
};

const getByBeneficiary = async (req, res, next) => {
  try {
    const { beneficiaryType, beneficiaryId } = req.query;
    if (!beneficiaryType || !beneficiaryId) {
      return res.status(400).json({ error: 'نوع ورقم المستفيد مطلوبان' });
    }
    const evaluations = await service.getEvaluationsByBeneficiary(beneficiaryType, beneficiaryId);
    return res.json({ status: 'ok', evaluations });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const evaluation = await service.getEvaluationById(id);
    if (!evaluation) {
      return res.status(404).json({ error: 'لم يتم العثور على التقييم المطلوب' });
    }
    return res.json({ status: 'ok', evaluation });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const {
      beneficiaryType,
      beneficiaryId,
      evaluationDate,
      periodName,
      showInSponsorPortal,
      criteriaScores,
      generalSummary,
      recommendations
    } = req.body;

    if (!beneficiaryType || !beneficiaryId) {
      return res.status(400).json({ error: 'نوع ورقم المستفيد مطلوبان' });
    }

    if (!Array.isArray(criteriaScores) || criteriaScores.length === 0) {
      return res.status(400).json({ error: 'يرجى إدخال درجات معايير التقييم' });
    }
    const bad = criteriaScores.some((c) => {
      const n = Number(c && c.score);
      return !Number.isFinite(n) || n < 0 || n > 5;
    });
    if (bad) return res.status(400).json({ error: 'درجة كل معيار يجب أن تكون بين 0 و 5' });

    if (!['orphan', 'family'].includes(beneficiaryType)) {
      return res.status(400).json({ error: 'نوع المستفيد غير صحيح' });
    }
    if (req.user.role === 'agent') {
      const { query } = require('../../config/db');
      const table = beneficiaryType === 'orphan' ? 'orphans' : 'families';
      const { rows } = await query(`SELECT agent_id FROM ${table} WHERE id = $1`, [beneficiaryId]);
      if (!rows[0] || rows[0].agent_id !== req.user.id) {
        return res.status(403).json({ error: 'يمكنك تقييم المستفيدين المسجلين عن طريقك فقط' });
      }
    }

    const evaluation = await service.createEvaluation({
      beneficiaryType,
      beneficiaryId,
      evaluationDate,
      periodName,
      showInSponsorPortal,
      criteriaScores,
      generalSummary,
      recommendations,
      researcherId: req.user?.id
    });

    return res.status(201).json({ status: 'ok', evaluation });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      evaluationDate,
      periodName,
      showInSponsorPortal,
      criteriaScores,
      generalSummary,
      recommendations
    } = req.body;

    if (!Array.isArray(criteriaScores) || criteriaScores.length === 0) {
      return res.status(400).json({ error: 'يرجى إدخال درجات معايير التقييم' });
    }
    const bad = criteriaScores.some((c) => {
      const n = Number(c && c.score);
      return !Number.isFinite(n) || n < 0 || n > 5;
    });
    if (bad) return res.status(400).json({ error: 'درجة كل معيار يجب أن تكون بين 0 و 5' });

    const evaluation = await service.updateEvaluation(id, {
      evaluationDate,
      periodName,
      showInSponsorPortal,
      criteriaScores,
      generalSummary,
      recommendations
    });

    if (!evaluation) {
      return res.status(404).json({ error: 'لم يتم العثور على التقييم المطلوب' });
    }

    return res.json({ status: 'ok', evaluation });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await service.deleteEvaluation(id);
    if (!deleted) {
      return res.status(404).json({ error: 'لم يتم العثور على التقييم المطلوب' });
    }
    return res.json({ status: 'ok', message: 'تم حذف التقييم بنجاح' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getBeneficiaries,
  getByBeneficiary,
  getById,
  create,
  update,
  remove
};
