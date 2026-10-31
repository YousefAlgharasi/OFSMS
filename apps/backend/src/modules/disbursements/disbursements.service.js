/**
 * disbursements.service.js — OFSMS Disbursements Business Logic Layer
 *
 * Orchestrates disbursement operations using:
 *   - disbursements.repository.js (data access)
 *
 * No SQL lives here. No HTTP knowledge (no req/res/next).
 * All errors carry .statusCode for clean HTTP mapping in the controller.
 */

const repository = require('./disbursements.repository');

// ── Helper: throw a domain error with an HTTP status code ─────────────────────
const domainError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

// ── List all disbursement lists ───────────────────────────────────────────────
const getDisbursementLists = async () => {
  return repository.findAllLists();
};

// ── History view (same data, separate endpoint for UI clarity) ────────────────
const getDisbursementHistory = async () => {
  return repository.findAllLists();
};

// ── Get single list with all items, sorted ────────────────────────────────────
const getDisbursementById = async (id) => {
  const list = await repository.findListById(id);
  if (!list) return null;

  const [orphanItems, familyItems] = await Promise.all([
    repository.findOrphanItemsByListId(id),
    repository.findFamilyItemsByListId(id),
  ]);

  const items = [...orphanItems, ...familyItems].sort((a, b) =>
    b.included - a.included || a.beneficiary_name.localeCompare(b.beneficiary_name, 'ar')
  );

  return { ...list, items };
};

// ── Generate monthly disbursement list ────────────────────────────────────────
const generateDisbursementList = async (createdBy) => {
  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  // Guard: only one list per month
  const existing = await repository.findListByMonthYear(month, year);
  if (existing) {
    // A draft or rejected list can be rebuilt (e.g. after Quran reports were approved or the list was rejected)
    if (!['draft', 'rejected'].includes(existing.status)) {
      throw domainError('كشف الصرف لهذا الشهر موجود بالفعل', 409);
    }
    await repository.deleteListById(existing.id);
  }

  // Create list header
  const list = await repository.insertList(month, year, createdBy);

  // Fetch all active sponsorships in parallel
  const [orphanRows, familyRows] = await Promise.all([
    repository.findActiveOrphanSponsorships(month, year),
    repository.findActiveFamilySponsorships(),
  ]);

  // Determine inclusion based on quran report status
  for (const o of orphanRows) {
    const included = !o.quran_status || o.quran_status === 'approved';
    const reason   = o.quran_status === 'rejected'
      ? 'رفض المشرف تقرير الحفظ الشهري'
      : o.quran_status === 'pending'
      ? 'تقرير الحفظ قيد المراجعة'
      : null;
    await repository.insertOrphanItem(list.id, o.orphan_id, o.monthly_amount, included, reason);
  }

  for (const f of familyRows) {
    await repository.insertFamilyItem(list.id, f.family_id, f.monthly_amount);
  }

  return getDisbursementById(list.id);
};

// ── Get released lists visible to a specific agent ────────────────────────────
const getReleasedListsByAgent = async (agentId) => {
  return repository.findReleasedListsByAgent(agentId);
};

// ── Supervisor approve ────────────────────────────────────────────────────────
const supervisorApprove = async (id, supervisorId, role) => {
  const statusClause = role === 'gm'
    ? `status NOT IN ('released', 'rejected')`
    : `status = 'draft'`;

  const list = await repository.updateListStatus(id, {
    status: 'supervisor_approved',
    approved_by_supervisor: supervisorId,
    supervisor_approved_at: new Date(),
  }, statusClause);

  if (!list) throw domainError('الكشف غير موجود أو لا يمكن اعتماده بهذه الحالة', 400);
  return list;
};

// ── Supervisor reject ─────────────────────────────────────────────────────────
const supervisorReject = async (id, supervisorId, notes, role) => {
  const statusClause = role === 'gm'
    ? `status NOT IN ('released', 'rejected')`
    : `status = 'draft'`;

  const list = await repository.updateListStatus(id, {
    status: 'rejected',
    rejection_notes: notes,
  }, statusClause);

  if (!list) throw domainError('الكشف غير موجود أو لا يمكن رفضه', 400);
  return list;
};

// ── Finance approve ───────────────────────────────────────────────────────────
const financeApprove = async (id, financeId, role) => {
  const statusClause = role === 'gm'
    ? `status NOT IN ('released', 'rejected')`
    : `status = 'supervisor_approved'`;

  const list = await repository.updateListStatus(id, {
    status: 'finance_approved',
    approved_by_finance: financeId,
    finance_approved_at: new Date(),
  }, statusClause);

  if (!list) throw domainError('الكشف غير موجود أو لا يمكن اعتماده', 400);
  return list;
};

// ── Finance reject ────────────────────────────────────────────────────────────
const financeReject = async (id, financeId, notes, role) => {
  const statusClause = role === 'gm'
    ? `status NOT IN ('released', 'rejected')`
    : `status = 'supervisor_approved'`;

  const list = await repository.updateListStatus(id, {
    status: 'draft',
    rejection_notes: notes,
  }, statusClause);

  if (!list) throw domainError('الكشف غير موجود أو لا يمكن رفضه', 400);
  return list;
};

// ── GM release ────────────────────────────────────────────────────────────────
const gmRelease = async (id, gmId) => {
  const list = await repository.updateListStatus(id, {
    status: 'released',
    approved_by_gm: gmId,
    gm_approved_at: new Date(),
  }, `status NOT IN ('released', 'rejected')`);

  if (!list) throw domainError('الكشف غير موجود أو لا يمكن إصداره', 400);
  return list;
};

module.exports = {
  getDisbursementLists,
  getDisbursementHistory,
  getDisbursementById,
  generateDisbursementList,
  getReleasedListsByAgent,
  supervisorApprove,
  supervisorReject,
  financeApprove,
  financeReject,
  gmRelease,
};
