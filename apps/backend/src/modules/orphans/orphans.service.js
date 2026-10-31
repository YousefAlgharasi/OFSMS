/**
 * orphans.service.js
 * All database queries for the orphans module.
 *
 * updateOrphanStatus now fires a push notification to the agent on rejection
 * (FR-007, FR-048) and saves a notification record for in-app bell.
 */

const { query } = require('../../config/db');
const { sendPushNotification } = require('../notifications/notifications.service');

/**
 * Create a new orphan record.
 * Initial status is always 'under_review'.
 */
const findDuplicate = async (fullName, dateOfBirth) => {
  const { rows } = await query(
    `SELECT id FROM orphans
     WHERE regexp_replace(lower(full_name), '\\s+', ' ', 'g') = regexp_replace(lower($1), '\\s+', ' ', 'g')
       AND date_of_birth = $2
     LIMIT 1`,
    [fullName, dateOfBirth]
  );
  return rows[0] || null;
};

const createOrphan = async ({
  fullName,
  dateOfBirth,
  gender,
  governorateId,
  guardianName,
  guardianRelation,
  agentId,
  isGifted = false,
  notes,
  profile = {},
}) => {
  const { rows } = await query(
    `INSERT INTO orphans
       (full_name, date_of_birth, gender, governorate_id,
        guardian_name, guardian_relation, agent_id, is_gifted, notes, profile)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [fullName, dateOfBirth, gender, governorateId, guardianName, guardianRelation, agentId, isGifted, notes || null, JSON.stringify(profile)]
  );
  return rows[0];
};

/**
 * Get orphans — supports filtering by status, agentId, governorateId, isGifted.
 */
const getOrphans = async ({ status, agentId, governorateId, isGifted } = {}) => {
  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`o.status = $${params.length}`);
  }
  if (agentId) {
    params.push(agentId);
    conditions.push(`o.agent_id = $${params.length}`);
  }
  if (governorateId) {
    params.push(governorateId);
    conditions.push(`o.governorate_id = $${params.length}`);
  }
  if (isGifted !== undefined) {
    params.push(isGifted);
    conditions.push(`o.is_gifted = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await query(
    `SELECT
       o.id, o.full_name, o.date_of_birth, o.gender, o.status,
       o.guardian_name, o.guardian_relation, o.is_gifted, o.notes,
       o.created_at, o.agent_id,
       g.name_ar AS governorate_ar, g.name_en AS governorate_en,
       u.full_name AS agent_name
     FROM orphans o
     LEFT JOIN governorates g ON g.id = o.governorate_id
     LEFT JOIN users u ON u.id = o.agent_id
     ${where}
     ORDER BY o.created_at DESC`,
    params
  );
  return rows;
};

/**
 * Get a single orphan by ID with their sponsorship info.
 */
const getOrphanById = async (id) => {
  const { rows } = await query(
    `SELECT
       o.*,
       g.name_ar AS governorate_ar, g.name_en AS governorate_en,
       u.full_name AS agent_name,
       u.id AS agent_id,
       sp.monthly_amount, sp.start_date AS sponsorship_start,
       s.full_name AS sponsor_name
     FROM orphans o
     LEFT JOIN governorates g ON g.id = o.governorate_id
     LEFT JOIN users u ON u.id = o.agent_id
     LEFT JOIN sponsorships sp ON sp.beneficiary_id = o.id AND sp.beneficiary_type = 'orphan' AND sp.is_active = TRUE
     LEFT JOIN sponsors s ON s.id = sp.sponsor_id
     WHERE o.id = $1`,
    [id]
  );
  return rows[0] || null;
};

/**
 * Update orphan status with optional notes.
 * Fires FCM push notification to the agent on rejection (FR-007, FR-048).
 *
 * Valid transitions per SADD §7.3:
 *   under_review    → under_marketing  (supervisor approves)
 *   under_review    → rejected         (supervisor rejects — fires notification)
 *   under_marketing → under_sponsorship (GM assigns sponsor)
 *   any             → inactive
 */
// const updateOrphanStatus = async (id, status, notes, reviewerName = 'المشرف') => {
//   const { rows } = await query(
//     `UPDATE orphans
//      SET status = $1, notes = COALESCE($2, notes)
//      WHERE id = $3
//      RETURNING *`,
//     [status, notes || null, id]
//   );
//   const orphan = rows[0] || null;
const { logAudit } = require('../../utils/auditLog');

const updateOrphanStatus = async (id, status, notes, reviewerName = 'المشرف', actorId = null) => {
  // fetch old value first
  const { rows: oldRows } = await query('SELECT status FROM orphans WHERE id = $1', [id]);
  const oldStatus = oldRows[0]?.status;
  if (oldStatus) require('../../utils/statusTransitions').assertTransition(oldStatus, status);

  const { rows } = await query(
    `UPDATE orphans SET status = $1, notes = COALESCE($2, notes) WHERE id = $3 RETURNING *`,
    [status, notes || null, id]
  );
  const orphan = rows[0] || null;

  if (orphan && actorId) {
    await logAudit({
      userId:     actorId,
      action:     'orphan_status_updated',
      entityType: 'orphan',
      entityId:   id,
      oldValue:   { status: oldStatus },
      newValue:   { status, notes },
    });
  }
  
  // FR-007 / FR-048: fire push notification to agent on rejection
  if (orphan && status === 'rejected' && orphan.agent_id) {
    const notesText = notes ? ` السبب: ${notes}` : '';
    await sendPushNotification(
      orphan.agent_id,
      'تم رفض تسجيل يتيم',
      `تم رفض طلب تسجيل ${orphan.full_name} من قِبَل ${reviewerName}.${notesText}`,
      { orphanId: id, action: 'registration_rejected' },
      'registration_rejected',
      id
    );
  }

  // Also notify agent on approval so they know to expect sponsorship assignment
  if (orphan && status === 'under_marketing' && orphan.agent_id) {
    await sendPushNotification(
      orphan.agent_id,
      'تمت الموافقة على تسجيل يتيم',
      `تمت الموافقة على طلب تسجيل ${orphan.full_name} وهو الآن تحت التسويق`,
      { orphanId: id, action: 'registration_approved' },
      'registration_approved',
      id
    );
  }

  return orphan;
};

/**
 * Update orphan details (agent can edit while under_review).
 */
const updateOrphan = async (id, fields, resetStatus = false) => {
  const { fullName, dateOfBirth, gender, governorateId, guardianName, guardianRelation, isGifted, notes, profile } = fields;
  const { rows } = await query(
    `UPDATE orphans
     SET
       full_name         = COALESCE($1, full_name),
       date_of_birth     = COALESCE($2, date_of_birth),
       gender            = COALESCE($3, gender),
       governorate_id    = COALESCE($4, governorate_id),
       guardian_name     = COALESCE($5, guardian_name),
       guardian_relation = COALESCE($6, guardian_relation),
       is_gifted         = COALESCE($7, is_gifted),
       notes             = COALESCE($8, notes),
       profile           = COALESCE($10, profile),
       status            = CASE WHEN $11 THEN 'under_review' ELSE status END
     WHERE id = $9
     RETURNING *`,
    [fullName, dateOfBirth, gender, governorateId, guardianName, guardianRelation, isGifted, notes, id,
     profile ? JSON.stringify(profile) : null, resetStatus]
  );
  return rows[0] || null;
};

/**
 * Get orphans under marketing pool (status = under_marketing).
 */
const getOrphansUnderMarketing = async () => {
  const { rows } = await query(
    `SELECT
       o.id, o.full_name, o.date_of_birth, o.gender,
       o.guardian_name, o.is_gifted, o.created_at,
       o.agent_id, 
       g.name_ar AS governorate_ar,
       u.full_name AS agent_name
     FROM orphans o
     LEFT JOIN governorates g ON g.id = o.governorate_id
     LEFT JOIN users u ON u.id = o.agent_id
     WHERE o.status = 'under_marketing'
     ORDER BY o.created_at ASC`
  );
  return rows;
};

/**
 * Save a document record after S3 upload.
 */
const addDocument = async ({ entityType, entityId, docType, fileKey, originalName, mimeType, fileSizeBytes, uploadedBy }) => {
  const { rows } = await query(
    `INSERT INTO documents
       (entity_type, entity_id, doc_type, file_key, original_name, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [entityType, entityId, docType, fileKey, originalName, uploadedBy]
  );
  return rows[0];
};

/**
 * Get all documents for an orphan.
 */
const getOrphanDocuments = async (orphanId) => {
  const { rows } = await query(
    `SELECT id, doc_type, file_key, original_name, uploaded_at
     FROM documents
     WHERE entity_type = 'orphan' AND entity_id = $1
     ORDER BY uploaded_at DESC`,
    [orphanId]
  );
  return rows;
};

/**
 * Delete an orphan record and their documents.
 * Blocked if orphan has an active sponsorship.
 */
const deleteOrphan = async (id) => {
  const { rows: activeRows } = await query(
    `SELECT id FROM sponsorships WHERE beneficiary_id = $1 AND beneficiary_type = 'orphan' AND is_active = TRUE LIMIT 1`,
    [id]
  );
  if (activeRows.length > 0) {
    throw Object.assign(new Error('لا يمكن حذف يتيم لديه كفالة نشطة'), { status: 409 });
  }

  await query(`DELETE FROM documents WHERE entity_type = 'orphan' AND entity_id = $1`, [id]);
  const { rows } = await query(`DELETE FROM orphans WHERE id = $1 RETURNING *`, [id]);
  return rows[0] || null;
};

module.exports = {
  findDuplicate,
  createOrphan,
  getOrphans,
  getOrphanById,
  updateOrphanStatus,
  updateOrphan,
  getOrphansUnderMarketing,
  addDocument,
  getOrphanDocuments,
  deleteOrphan,
};
