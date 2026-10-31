/**
 * sponsorPortal.routes.js
 * Mounted at: /api/sponsor
 *
 * POST /api/sponsor/login   → authenticate with portal_token + password
 * GET  /api/sponsor/me      → return current sponsor info (auth required)
 */

const { Router } = require('express');
const bcrypt = require('bcryptjs');
const repo = require('../sponsors/sponsors.repository');
const validators = require('../sponsors/sponsors.validators');
const { generateSponsorToken, authenticateSponsor } = require('../../middleware/sponsorAuth');
const announcementsService = require('../announcements/announcements.service');

const { rateLimit } = require('../../middleware/rateLimit');

const router = Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

// ── POST /api/sponsor/login ───────────────────────────────────────────────────
router.post(
  '/login',
  loginLimiter,
  validators.sponsorLoginRules,
  async (req, res, next) => {
    try {
      const { portalToken, password } = req.body;

      // Look up sponsor by portal_token
      const sponsor = await repo.findSponsorByToken(portalToken);

      // Use a consistent error message (no enumeration)
      if (!sponsor) {
        return res.status(401).json({ error: 'رمز البوابة أو كلمة المرور غير صحيحة' });
      }

      const passwordMatch = await bcrypt.compare(password, sponsor.portal_password_hash);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'رمز البوابة أو كلمة المرور غير صحيحة' });
      }

      const accessToken = generateSponsorToken(sponsor);

      return res.json({
        accessToken,
        sponsor: {
          id: sponsor.id,
          name: sponsor.full_name,
          email: sponsor.email,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/sponsor/me ───────────────────────────────────────────────────────
router.get('/me', authenticateSponsor, async (req, res, next) => {
  try {
    const sponsor = await repo.findSponsorByIdForMe(req.sponsor.id);

    if (!sponsor) {
      return res.status(404).json({ error: 'الكافل غير موجود' });
    }

    return res.json({ sponsor });
  } catch (err) {
    next(err);
  }
});

// Sponsor-only ads/announcements board.
router.get('/announcements', authenticateSponsor, async (_req, res, next) => {
  try {
    const announcements = await announcementsService.getActiveSponsorAnnouncements();
    return res.json({ announcements });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/sponsor/families ─ the sponsor's active sponsored families
router.get('/families', authenticateSponsor, async (req, res, next) => {
  try {
    const families = await repo.findActiveFamiliesBySponsorId(req.sponsor.id);
    return res.json({ families, total: families.length });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/sponsor/orphans ──────────────────────────────────────────────────
// Returns the sponsor's active sponsored orphans — selected fields only (FR-034, FR-037)
router.get('/orphans', authenticateSponsor, async (req, res, next) => {
  try {
    const orphans = await repo.findActiveOrphansBySponsorId(req.sponsor.id);
    return res.json({ orphans, total: orphans.length });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/sponsor/reports/:orphanId ────────────────────────────────────────
// Returns Quran reports + disbursement receipts for one orphan (FR-035)
// Sponsor can only access orphans they sponsor — ownership check enforced
router.get('/reports/:orphanId', authenticateSponsor, async (req, res, next) => {
  try {
    const { orphanId } = req.params;

    // Ownership check: verify this orphan belongs to this sponsor
    const isOwner = await repo.checkSponsorshipOwnership(req.sponsor.id, orphanId);
    if (!isOwner) {
      return res.status(403).json({ error: 'ليس لديك صلاحية للوصول إلى بيانات هذا اليتيم' });
    }

    // Quran reports
    const quranReports = await repo.findQuranReportsByOrphanId(orphanId);

    // Disbursement receipts (confirmed payments)
    const disbursements = await repo.findDisbursementsByOrphanId(orphanId);

    return res.json({
      orphan_id: orphanId,
      quran_reports: quranReports,
      disbursements,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
