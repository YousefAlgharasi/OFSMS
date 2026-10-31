/**
 * families.service.js
 * Business logic for the families module.
 *
 * updateFamilyStatus fires a push notification to the agent on rejection
 * (FR-007, FR-048) and on approval.
 */

const { logAudit } = require('../../utils/auditLog');
const { sendPushNotification } = require('../notifications/notifications.service');
const { uploadFile } = require('../../config/s3');
const repository = require('./families.repository');

/**
 * Helper to upload documents to S3 and save to DB
 */
const _uploadDocument = async (file, familyId, docType, userId) => {
  const { key } = await uploadFile({
    buffer: file.buffer,
    originalName: file.originalname,
    mimetype: file.mimetype,
    folder: 'documents',
  });
  return repository.addDocument({
    entityType: 'family',
    entityId: familyId,
    docType,
    fileKey: key,
    originalName: file.originalname,
    uploadedBy: userId,
  });
};

/**
 * Create a new family record and handle document uploads.
 * Initial status is always 'under_review'.
 */
const createFamily = async (
  { familyName, headOfFamily, memberCount, governorateId, agentId, notes },
  files = {}
) => {
  const tooLong = (v, n) => typeof v === 'string' && v.length > n;
  if (tooLong(familyName, 150) || tooLong(headOfFamily, 150) || tooLong(notes, 3000)) {
    const e = new Error('أحد الحقول أطول من الحد المسموح');
    e.status = 400;
    throw e;
  }
  const family = await repository.createFamily({
    familyName,
    headOfFamily,
    memberCount: parseInt(memberCount, 10),
    governorateId: parseInt(governorateId, 10),
    agentId,
    notes,
  });

  const uploadedDocs = [];

  // Optional: head of family ID document
  const headIdFile = files.headOfFamilyId?.[0];
  if (headIdFile) {
    const doc = await _uploadDocument(headIdFile, family.id, 'guardian_id', agentId);
    uploadedDocs.push(doc);
  }

  // Optional: additional docs (up to 5)
  const additionalFiles = files.additionalDocs || [];
  for (const file of additionalFiles.slice(0, 5)) {
    const doc = await _uploadDocument(file, family.id, 'other', agentId);
    uploadedDocs.push(doc);
  }

  return { family, documents: uploadedDocs };
};

/**
 * Get all families — supports filtering by status and agent.
 */
const getFamilies = async ({ status, agentId } = {}) => {
  return repository.getFamilies({ status, agentId });
};

/**
 * Get a single family by ID.
 * Agents can only access their own families.
 */
const getFamilyById = async (id, userRole, userId) => {
  const family = await repository.getFamilyById(id);
  if (!family) {
    const err = new Error('الأسرة غير موجودة');
    err.statusCode = 404;
    throw err;
  }
  require('../../utils/statusTransitions').assertTransition(oldStatus, status);

  if (userRole === 'agent' && family.agent_id !== userId) {
    const err = new Error('ليس لديك صلاحية للوصول إلى هذا المورد');
    err.statusCode = 403;
    throw err;
  }

  const documents = await repository.getFamilyDocuments(id);
  return { family, documents };
};

/**
 * Update family status with optional notes.
 * Fires FCM push notification to the agent on rejection or approval (FR-007, FR-048).
 */
const updateFamilyStatus = async (id, status, notes, reviewerName, actorId, actorRole) => {
  if (actorRole === 'supervisor' && status === 'under_sponsorship') {
    const err = new Error('هذه الصلاحية للمدير العام فقط');
    err.statusCode = 403;
    throw err;
  }

  const oldStatus = await repository.getFamilyStatus(id);
  if (!oldStatus) {
    const err = new Error('الأسرة غير موجودة');
    err.statusCode = 404;
    throw err;
  }

  require('../../utils/statusTransitions').assertTransition(oldStatus, status);

  const family = await repository.updateFamilyStatus(id, status, notes);

  // Write audit log
  if (family && actorId) {
    await logAudit({
      userId:     actorId,
      action:     'family_status_updated',
      entityType: 'family',
      entityId:   id,
      oldValue:   { status: oldStatus },
      newValue:   { status, notes },
    });
  }

  // FR-007 / FR-048: fire push notification to agent on rejection
  if (family && status === 'rejected' && family.agent_id) {
    const notesText = notes ? ` السبب: ${notes}` : '';
    await sendPushNotification(
      family.agent_id,
      'تم رفض تسجيل أسرة',
      `تم رفض طلب تسجيل أسرة ${family.family_name} من قِبَل ${reviewerName}.${notesText}`,
      { familyId: id, action: 'registration_rejected' },
      'registration_rejected',
      id
    );
  }

  // Notify agent on approval
  if (family && status === 'under_marketing' && family.agent_id) {
    await sendPushNotification(
      family.agent_id,
      'تمت الموافقة على تسجيل أسرة',
      `تمت الموافقة على طلب تسجيل أسرة ${family.family_name} وهي الآن تحت التسويق`,
      { familyId: id, action: 'registration_approved' },
      'registration_approved',
      id
    );
  }

  return family;
};

/**
 * Update family details (agent can edit while under_review or rejected).
 */
const updateFamily = async (id, updates, userRole, userId) => {
  const existing = await repository.getFamilyById(id);
  if (!existing) {
    const err = new Error('الأسرة غير موجودة');
    err.statusCode = 404;
    throw err;
  }

  if (userRole === 'agent') {
    if (existing.agent_id !== userId) {
      const err = new Error('ليس لديك صلاحية لتعديل هذه الأسرة');
      err.statusCode = 403;
      throw err;
    }
    if (existing.status !== 'under_review' && existing.status !== 'rejected') {
      const err = new Error('لا يمكن تعديل الأسرة بعد اعتمادها');
      err.statusCode = 400;
      throw err;
    }
  }

  return repository.updateFamily(id, updates);
};

/**
 * Get families under marketing (available for sponsorship assignment).
 */
const getFamiliesUnderMarketing = async () => {
  return repository.getFamiliesUnderMarketing();
};

/**
 * Delete a family record and its documents (GM only).
 * Blocked if the family has an active sponsorship or appears in a disbursement list.
 */
const deleteFamily = async (id) => {
  const { query } = require('../../config/db');
  const { rows: activeRows } = await query(
    `SELECT id FROM sponsorships WHERE beneficiary_id = $1 AND beneficiary_type = 'family' AND is_active = TRUE LIMIT 1`,
    [id]
  );
  if (activeRows.length > 0) {
    throw Object.assign(new Error('لا يمكن حذف أسرة لديها كفالة نشطة'), { status: 409 });
  }
  try {
    await query(`DELETE FROM documents WHERE entity_type = 'family' AND entity_id = $1`, [id]);
    const { rows } = await query(`DELETE FROM families WHERE id = $1 RETURNING *`, [id]);
    return rows[0] || null;
  } catch (err) {
    if (err.code === '23503') { // foreign key: used in disbursement lists etc.
      throw Object.assign(new Error('لا يمكن حذف أسرة مرتبطة بكشوف صرف سابقة'), { status: 409 });
    }
    throw err;
  }
};

module.exports = {
  deleteFamily,
  createFamily,
  getFamilies,
  getFamilyById,
  updateFamilyStatus,
  updateFamily,
  getFamiliesUnderMarketing,
};
