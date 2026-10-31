/**
 * quran.controller.js — OFSMS Quran HTTP Handler Layer
 *
 * Responsible only for HTTP req/res handling.
 * Errors from the service carry .statusCode and are mapped to HTTP responses.
 */

const { validationResult } = require('express-validator');
const service = require('./quran.service');

// ── Shared: map service errors to HTTP responses ──────────────────────────────
const handleError = (err, res, next) => {
  if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
  next(err);
};

// ── POST /api/quran-reports ───────────────────────────────────────────────────
const submitReport = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
    
    const { orphanId, month, year, memorizedText, agentNotes } = req.body;
    
    const result = await service.submitReport({
      orphanId,
      agentId: req.user.id,
      role: req.user.role,
      month: parseInt(month),
      year: parseInt(year),
      memorizedText,
      agentNotes,
    });
    
    return res.status(201).json({
      message: 'تم رفع تقرير الحفظ بنجاح وهو الآن في قائمة انتظار المشرف',
      ...result,
    });
  } catch (err) { handleError(err, res, next); }
};

// ── GET /api/quran-reports/pending (Supervisor Queue) ─────────────────────────
const getPendingReports = async (req, res, next) => {
  try {
    const reports = await service.getPendingReports(req.query.status);
    return res.json({ reports, total: reports.length });
  } catch (err) { handleError(err, res, next); }
};

// ── GET /api/quran-reports/mine (Agent Queue) ─────────────────────────────────
const getReportsByAgent = async (req, res, next) => {
  try {
    const reports = await service.getReportsByAgent(req.user.id);
    return res.json({ reports });
  } catch (err) { handleError(err, res, next); }
};

// ── GET /api/quran-reports/:id ────────────────────────────────────────────────
const getReportById = async (req, res, next) => {
  try {
    const report = await service.getReportById(req.params.id);
    if (!report) return res.status(404).json({ error: 'التقرير غير موجود' });
    if (req.user.role === 'agent' && report.agent_id !== req.user.id) {
      return res.status(403).json({ error: 'غير مصرح لك بعرض هذا التقرير' });
    }
    return res.json({ report });
  } catch (err) { handleError(err, res, next); }
};

// ── PATCH /api/quran-reports/:id/review ───────────────────────────────────────
const reviewReport = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { action, notes } = req.body;

    const report = await service.reviewReport({
      reportId:     req.params.id,
      action,
      notes,
      reviewerId:   req.user.id,
      reviewerName: req.user.name,
    });

    const msgMap = {
      approved: 'تمت الموافقة على تقرير الحفظ وسيُدرج اليتيم في كشف الصرف',
      rejected: 'تم رفض تقرير الحفظ وتم إشعار المندوب',
    };

    return res.json({ message: msgMap[action], report });
  } catch (err) { handleError(err, res, next); }
};

module.exports = {
  submitReport,
  getPendingReports,
  getReportsByAgent,
  getReportById,
  reviewReport,
};
