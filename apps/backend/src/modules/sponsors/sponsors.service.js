/**
 * sponsors.service.js
 * Business logic for the sponsors module.
 */

const crypto = require('crypto');
const repo = require('./sponsors.repository');
const { logAudit } = require('../../utils/auditLog');
const { query } = require('../../config/db');

/**
 * Generate a cryptographically secure unique portal token.
 */
const generatePortalToken = () => crypto.randomBytes(32).toString('hex');

/**
 * Create a new sponsor record.
 */
const createSponsor = async ({ fullName, phone, email, portalPasswordHash, portalPasswordPlain, createdBy }) => {
  // Check for duplicate email or phone before inserting
  if (email || phone) {
    const existing = await repo.findSponsorByEmailOrPhone(email, phone);
    if (existing.length > 0) {
      const match = existing[0];
      if (email && match.email === email) {
        const err = new Error('البريد الإلكتروني مستخدم بالفعل لكافل آخر');
        err.status = 409;
        throw err;
      }
      if (phone && match.phone === phone) {
        const err = new Error('رقم الهاتف مستخدم بالفعل لكافل آخر');
        err.status = 409;
        throw err;
      }
    }
  }

  const portalToken = generatePortalToken();

  return await repo.insertSponsor({
    fullName,
    phone,
    email,
    portalToken,
    portalPasswordHash,
    portalPasswordPlain,
    createdBy,
  });
};

/**
 * Get all sponsors with their active sponsorships count.
 */
const getAllSponsors = async () => {
  return await repo.findAllSponsors();
};

/**
 * Get a single sponsor by ID.
 */
const getSponsorById = async (id) => {
  return await repo.findSponsorById(id);
};

/**
 * Get a sponsor by portal token.
 */
const getSponsorByToken = async (portalToken) => {
  return await repo.findSponsorByToken(portalToken);
};

/**
 * Get all sponsorships for a sponsor.
 */
const getSponsorshipsBySponsorId = async (sponsorId) => {
  return await repo.findSponsorshipsBySponsorId(sponsorId);
};

/**
 * Create a new sponsorship.
 * Runs inside a transaction to keep the sponsorship insert and status update atomic.
 */
// A beneficiary can only be sponsored from the marketing pool; a transfer needs an active sponsorship
// with a different sponsor.
const assertBeneficiaryState = async (type, id, sponsorId, requiredStatus) => {
  const fail = (msg, status = 400) => { const e = new Error(msg); e.status = status; throw e; };
  if (!['orphan', 'family'].includes(type)) fail('نوع المستفيد غير صحيح');
  const table = type === 'orphan' ? 'orphans' : 'families';
  const { rows: [b] } = await query(`SELECT status FROM ${table} WHERE id = $1`, [id]);
  if (!b) fail('المستفيد غير موجود', 404);
  const { rows: [sp] } = await query('SELECT id FROM sponsors WHERE id = $1', [sponsorId]);
  if (!sp) fail('الكافل غير موجود', 404);
  if (b.status !== requiredStatus) {
    fail(requiredStatus === 'under_marketing'
      ? 'لا يمكن كفالة هذا المستفيد إلا بعد اعتماده ووجوده تحت التسويق (قد يكون مكفولاً بالفعل)'
      : 'لا يمكن نقل كفالة مستفيد غير مكفول');
  }
  const { rows: [cur] } = await query(
    `SELECT sponsor_id FROM sponsorships WHERE beneficiary_id = $1 AND beneficiary_type = $2 AND is_active = TRUE LIMIT 1`,
    [id, type]
  );
  if (requiredStatus === 'under_sponsorship' && cur && cur.sponsor_id === sponsorId) {
    fail('المستفيد مكفول بالفعل لدى هذا الكافل');
  }
};

const createSponsorship = async ({
  sponsorId,
  beneficiaryType,
  beneficiaryId,
  agentId,
  intermediary,
  startDate,
  monthlyAmount,
}) => {
  await assertBeneficiaryState(beneficiaryType, beneficiaryId, sponsorId, 'under_marketing');

  try {
    // 1. Deactivate any existing active sponsorship (none expected: checked above)
    await repo.deactivateActiveSponsorships(beneficiaryType, beneficiaryId, 'reassigned');

    // 2. Insert the new sponsorship
    const sponsorship = await repo.insertSponsorship({
      sponsorId,
      beneficiaryType,
      beneficiaryId,
      agentId,
      intermediary,
      startDate,
      monthlyAmount,
    });

    // 3. flip beneficiary status to under_sponsorship
    const table = beneficiaryType === 'orphan' ? 'orphans' : 'families';
    await repo.updateBeneficiaryStatus(table, beneficiaryId, 'under_sponsorship');

    return sponsorship;
  } catch (err) {
    throw err;
  }
};

/**
 * Transfer a beneficiary from one sponsor to another.
 * Closes old sponsorship, opens new one, keeps beneficiary status as under_sponsorship.
 */
const transferSponsorship = async ({
  beneficiaryType,
  beneficiaryId,
  newSponsorId,
  agentId,
  monthlyAmount,
  endReason,
  actorId,
}) => {
  await assertBeneficiaryState(beneficiaryType, beneficiaryId, newSponsorId, 'under_sponsorship');

  try {
    // 1. Close existing active sponsorship
    await repo.deactivateActiveSponsorships(beneficiaryType, beneficiaryId, endReason || 'transferred');

    // 2. Open new sponsorship
    const sponsorship = await repo.insertSponsorship({
      sponsorId: newSponsorId,
      beneficiaryType,
      beneficiaryId,
      agentId,
      startDate: new Date(),
      monthlyAmount,
    });

    // 3. Audit log with real actor
    await logAudit({
      userId: actorId || null,
      action: 'sponsorship_transferred',
      entityType: 'sponsorship',
      entityId: sponsorship.id,
      oldValue: { beneficiary_type: beneficiaryType, beneficiary_id: beneficiaryId },
      newValue: { new_sponsor_id: newSponsorId, monthly_amount: monthlyAmount },
    });

    return sponsorship;
  } catch (err) {
    throw err;
  }
};

/**
 * Update an existing sponsor.
 */
const updateSponsor = async (id, { fullName, phone, email, portalPasswordHash, portalPasswordPlain }) => {
  // Check for duplicates
  if (email || phone) {
    const existing = await repo.findSponsorByEmailOrPhoneExcludingId(id, email, phone);
    if (existing.length > 0) {
      const match = existing[0];
      if (email && match.email === email) {
        const err = new Error('البريد الإلكتروني مستخدم بالفعل لكافل آخر');
        err.status = 409;
        throw err;
      }
      if (phone && match.phone === phone) {
        const err = new Error('رقم الهاتف مستخدم بالفعل لكافل آخر');
        err.status = 409;
        throw err;
      }
    }
  }

  const sponsor = await repo.updateSponsorDetails(id, {
    fullName,
    phone,
    email,
    portalPasswordHash,
    portalPasswordPlain,
  });

  if (!sponsor) {
    const err = new Error('الكافل غير موجود');
    err.status = 404;
    throw err;
  }
  return sponsor;
};

/**
 * Delete a sponsor (must not have active sponsorships).
 */
const deleteSponsor = async (id) => {
  // First check if they have active sponsorships
  const activeCount = await repo.countActiveSponsorships(id);
  if (activeCount > 0) {
    const err = new Error('لا يمكن حذف كافل لديه كفالات نشطة. قم بنقل الكفالات أولاً.');
    err.status = 400;
    throw err;
  }

  // Delete historical sponsorships first
  await repo.deleteSponsorshipsBySponsorId(id);
  
  // Then delete the sponsor
  const deletedCount = await repo.deleteSponsorById(id);
  if (deletedCount === 0) {
    const err = new Error('الكافل غير موجود');
    err.status = 404;
    throw err;
  }
  return true;
};

/**
 * Get detailed active and historical sponsorships with summary metrics (portfolio view).
 */
const getSponsorPortfolio = async (id) => {
  const sponsor = await repo.findSponsorById(id);
  if (!sponsor) {
    const err = new Error('الكافل غير موجود');
    err.status = 404;
    throw err;
  }

  const sponsorships = await repo.findPortfolioSponsorships(id);

  const active = sponsorships.filter(s => s.is_active);
  const historical = sponsorships.filter(s => !s.is_active);

  const summary = {
    total_sponsorships: sponsorships.length,
    active_sponsorships: active.length,
    historical_sponsorships: historical.length,
    total_monthly_amount: active.reduce((sum, s) => sum + Number(s.monthly_amount || 0), 0),
    orphans_count: active.filter(s => s.beneficiary_type === 'orphan').length,
    families_count: active.filter(s => s.beneficiary_type === 'family').length,
    gifted_count: active.filter(s => s.is_gifted).length,
  };

  return {
    sponsor,
    summary,
    active,
    historical,
  };
};

module.exports = {
  createSponsor,
  getAllSponsors,
  getSponsorById,
  getSponsorByToken,
  getSponsorshipsBySponsorId,
  createSponsorship,
  transferSponsorship,
  updateSponsor,
  deleteSponsor,
  getSponsorPortfolio,
};
