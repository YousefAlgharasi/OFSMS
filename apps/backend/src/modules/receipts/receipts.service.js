/**
 * receipts.service.js
 * DB queries for the biometric receipts module.
 * Covers FR-029, FR-030, FR-031, FR-032.
 */

const { query } = require('../../config/db');
const { uploadFile } = require('../../config/s3');
const { logAudit } = require('../../utils/auditLog');

/**
 * Upload a base64 fingerprint image to S3 and create a BiometricReceipt record.
 *
 * @param {Object} params
 * @param {string} params.itemId              - UUID of the disbursement_item being confirmed
 * @param {string} params.agentId             - UUID of the agent uploading
 * @param {string} params.fingerprintBase64   - Base64-encoded image string (no data URI prefix)
 * @param {string} [params.mimeType]          - e.g. 'image/png' (default)
 * @returns {Promise<Object>} the inserted biometric_receipt row
 */
const uploadBiometricReceipt = async ({
  itemId,
  agentId,
  fingerprintBase64,
  mimeType = 'image/png',
}) => {
  // 1. Verify the disbursement item exists and belongs to an active released list
  const { rows: itemRows } = await query(
    `SELECT di.id, di.orphan_id, di.family_id, di.included, dl.status AS list_status
     FROM disbursement_items di
     JOIN disbursement_lists dl ON dl.id = di.list_id
     WHERE di.id = $1`,
    [itemId]
  );

  const item = itemRows[0];
  if (!item) {
    throw Object.assign(new Error('بند الصرف غير موجود'), { status: 404 });
  }
  if (!item.included) {
    throw Object.assign(new Error('هذا المستفيد مستبعد من الصرف الحالي'), { status: 400 });
  }
  if (item.list_status !== 'released') {
    throw Object.assign(
      new Error('لا يمكن تسجيل استلام بصمة لكشف لم يُصدر بعد'),
      { status: 400 }
    );
  }

  // 2. Check: no duplicate receipt for this item
  const { rows: existing } = await query(
    'SELECT id FROM biometric_receipts WHERE item_id = $1',
    [itemId]
  );
  if (existing.length > 0) {
    throw Object.assign(
      new Error('تم تسجيل بصمة الاستلام لهذا المستفيد مسبقاً'),
      { status: 409 }
    );
  }

  // 3. Decode base64 → Buffer and upload to S3
  const buffer = Buffer.from(fingerprintBase64, 'base64');
  const ext = mimeType === 'image/jpeg' ? '.jpg' : '.png';

  const { key } = await uploadFile({
    buffer,
    originalName: `fingerprint${ext}`,
    mimetype: mimeType,
    folder: 'biometrics',
  });

  // 4. Insert receipt record
  const { rows } = await query(
    `INSERT INTO biometric_receipts (item_id, agent_id, fingerprint_key)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [itemId, agentId, key]
  );
  const receipt = rows[0];

  // 5. Audit log
  await logAudit({
    userId:     agentId,
    action:     'biometric_receipt_uploaded',
    entityType: 'biometric_receipt',
    entityId:   receipt.id,
    newValue:   { item_id: itemId, fingerprint_key: key },
  });

  return receipt;
};

/**
 * Agent confirms that a registered orphan received the money (no fingerprint).
 * Only orphans registered by this agent, in a released list, can be confirmed.
 */
const confirmReceipt = async ({ itemId, agentId }) => {
  const { rows: itemRows } = await query(
    `SELECT di.id, di.included, dl.status AS list_status, o.agent_id AS orphan_agent_id
     FROM disbursement_items di
     JOIN disbursement_lists dl ON dl.id = di.list_id
     JOIN orphans o ON o.id = di.orphan_id
     WHERE di.id = $1`,
    [itemId]
  );

  const item = itemRows[0];
  if (!item) {
    throw Object.assign(new Error('بند الصرف غير موجود'), { status: 404 });
  }
  if (item.orphan_agent_id !== agentId) {
    throw Object.assign(new Error('هذا اليتيم غير مسجّل باسمك'), { status: 403 });
  }
  if (!item.included) {
    throw Object.assign(new Error('هذا المستفيد مستبعد من الصرف الحالي'), { status: 400 });
  }
  if (item.list_status !== 'released') {
    throw Object.assign(new Error('لا يمكن تأكيد الاستلام لكشف لم يُصدر بعد'), { status: 400 });
  }

  const { rows } = await query(
    `INSERT INTO biometric_receipts (item_id, agent_id)
     VALUES ($1, $2)
     ON CONFLICT (item_id) DO NOTHING
     RETURNING *`,
    [itemId, agentId]
  );
  if (rows.length === 0) {
    throw Object.assign(new Error('تم تأكيد الاستلام لهذا اليتيم مسبقاً'), { status: 409 });
  }

  await logAudit({
    userId:     agentId,
    action:     'receipt_confirmed',
    entityType: 'biometric_receipt',
    entityId:   rows[0].id,
    newValue:   { item_id: itemId },
  });

  return rows[0];
};

/**
 * Items of one released list that belong to orphans registered by this agent.
 */
const getAgentListItems = async (agentId, listId) => {
  const { rows: lists } = await query(
    `SELECT id, month, year, status FROM disbursement_lists WHERE id = $1`,
    [listId]
  );
  const list = lists[0];
  if (!list || list.status !== 'released') {
    throw Object.assign(new Error('الكشف غير موجود أو لم يُصدر بعد'), { status: 404 });
  }

  const { rows: items } = await query(
    `SELECT
       di.id,
       di.amount,
       o.full_name  AS beneficiary_name,
       g.name_ar    AS governorate_ar,
       s.full_name  AS sponsor_name,
       br.confirmed_at AS confirmed_at
     FROM disbursement_items di
     JOIN orphans o ON o.id = di.orphan_id
     LEFT JOIN governorates g ON g.id = o.governorate_id
     LEFT JOIN sponsorships sp ON sp.beneficiary_id = o.id
       AND sp.beneficiary_type = 'orphan' AND sp.is_active = TRUE
     LEFT JOIN sponsors s ON s.id = sp.sponsor_id
     LEFT JOIN biometric_receipts br ON br.item_id = di.id
     WHERE di.list_id = $1
       AND di.included = TRUE
       AND o.agent_id = $2
     ORDER BY o.full_name ASC`,
    [listId, agentId]
  );

  return { list, items };
};

/**
 * Get all biometric receipts — filterable by agent_id or list_id.
 * Used by supervisor/GM (FR-032).
 *
 * @param {Object} filters
 * @param {string} [filters.agentId]
 * @param {string} [filters.listId]
 * @returns {Promise<Array>}
 */
const getReceipts = async ({ agentId, listId } = {}) => {
  const conditions = [];
  const params = [];

  if (agentId) {
    params.push(agentId);
    conditions.push(`br.agent_id = $${params.length}`);
  }
  if (listId) {
    params.push(listId);
    conditions.push(`di.list_id = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await query(
    `SELECT
       br.id,
       br.item_id,
       br.agent_id,
       br.fingerprint_key,
       br.confirmed_at,
       u.full_name         AS agent_name,
       di.amount,
       di.list_id,
       dl.month,
       dl.year,
       COALESCE(o.full_name, f.family_name) AS beneficiary_name,
       CASE WHEN di.orphan_id IS NOT NULL THEN 'orphan' ELSE 'family' END AS beneficiary_type
     FROM biometric_receipts br
     JOIN disbursement_items di ON di.id  = br.item_id
     JOIN disbursement_lists dl ON dl.id  = di.list_id
     JOIN users u               ON u.id   = br.agent_id
     LEFT JOIN orphans   o ON o.id = di.orphan_id
     LEFT JOIN families  f ON f.id = di.family_id
     ${where}
     ORDER BY br.confirmed_at DESC`,
    params
  );

  return rows;
};

/**
 * Get receipt completion summary for an agent's batch in a given disbursement list.
 * Used by agent to confirm they've uploaded all receipts (FR-031).
 */
const getAgentReceiptSummary = async (agentId, listId) => {
  const { rows } = await query(
    `SELECT
       COUNT(di.id)                                          AS total_items,
       COUNT(br.id)                                          AS confirmed_items,
       COUNT(di.id) - COUNT(br.id)                          AS pending_items,
       BOOL_AND(br.id IS NOT NULL)                          AS all_confirmed
     FROM disbursement_items di
     JOIN disbursement_lists dl ON dl.id = di.list_id
     JOIN orphans o ON o.id = di.orphan_id
     LEFT JOIN biometric_receipts br ON br.item_id = di.id
     WHERE dl.id = $1
       AND di.included = TRUE
       AND o.agent_id = $2`,
    [listId, agentId]
  );
  return rows[0];
};

/**
 * Confirm that all receipts for a batch have been submitted.
 */
const batchConfirm = async (agentId, listId, notes = null) => {
  const summary = await getAgentReceiptSummary(agentId, listId);
  
  if (parseInt(summary.total_items, 10) === 0) {
    throw Object.assign(new Error('لا يوجد مستفيدين في هذا الكشف'), { status: 400 });
  }
  if (!summary.all_confirmed) {
    throw Object.assign(new Error(`لم يتم تأكيد استلام جميع الأيتام (متبقي ${summary.pending_items})`), { status: 400 });
  }

  const { rows } = await query(
    `INSERT INTO agent_batch_confirmations (list_id, agent_id, notes)
     VALUES ($1, $2, $3)
     ON CONFLICT (list_id, agent_id) DO NOTHING
     RETURNING *`,
    [listId, agentId, notes]
  );

  if (rows.length > 0) {
    await logAudit({
      userId:     agentId,
      action:     'agent_batch_confirmed',
      entityType: 'agent_batch_confirmation',
      entityId:   listId,
      newValue:   { list_id: listId, agent_id: agentId, notes },
    });
  }

  return rows[0] || { list_id: listId, agent_id: agentId, already_confirmed: true };
};

/**
 * Get the active disbursement batch items for an agent,
 * along with their current receipt status.
 */
const getAgentActiveBatch = async (agentId) => {
  // 1. Find the latest released list
  const { rows: lists } = await query(
    `SELECT id, month, year 
     FROM disbursement_lists 
     WHERE status = 'released' 
     ORDER BY created_at DESC LIMIT 1`
  );
  if (!lists.length) return null;
  const list = lists[0];

  // 2. Find items for this agent
  const { rows: items } = await query(
    `SELECT 
       di.id AS item_id, 
       di.amount, 
       di.included, 
       di.exclusion_reason,
       COALESCE(o.full_name, f.family_name) AS beneficiary_name,
       CASE WHEN di.orphan_id IS NOT NULL THEN 'orphan' ELSE 'family' END AS beneficiary_type,
       br.id AS receipt_id,
       br.confirmed_at
     FROM disbursement_items di
     LEFT JOIN orphans o ON o.id = di.orphan_id
     LEFT JOIN families f ON f.id = di.family_id
     LEFT JOIN biometric_receipts br ON br.item_id = di.id
     WHERE di.list_id = $1
       AND di.included = TRUE
       AND (o.agent_id = $2 OR f.agent_id = $2)
     ORDER BY beneficiary_name ASC`,
    [list.id, agentId]
  );

  // 3. Check if batch is already confirmed
  const { rows: confs } = await query(
    `SELECT confirmed_at FROM agent_batch_confirmations 
     WHERE list_id = $1 AND agent_id = $2`,
    [list.id, agentId]
  );

  return {
    list_id: list.id,
    month: list.month,
    year: list.year,
    batch_confirmed_at: confs.length ? confs[0].confirmed_at : null,
    items,
  };
};

/**
 * Get supervisor log for a specific list.
 * Groups disbursement items by agent and includes receipt status.
 */
const getSupervisorLog = async (listId) => {
  // 1. Get the list details
  const { rows: lists } = await query(
    `SELECT id, month, year, status FROM disbursement_lists WHERE id = $1`,
    [listId]
  );
  if (!lists.length) throw Object.assign(new Error('الكشف غير موجود'), { status: 404 });
  const list = lists[0];

  // 2. Get all agents who have items in this list, and their batch confirmations
  const { rows: agents } = await query(
    `SELECT DISTINCT 
       u.id AS agent_id, 
       u.full_name AS agent_name,
       abc.confirmed_at AS batch_confirmed_at
     FROM disbursement_items di
     JOIN orphans o ON o.id = di.orphan_id
     JOIN users u ON u.id = o.agent_id
     LEFT JOIN agent_batch_confirmations abc ON abc.list_id = di.list_id AND abc.agent_id = u.id
     WHERE di.list_id = $1 AND di.included = TRUE`,
    [listId]
  );

  // 3. Get all items with their receipt status
  const { rows: items } = await query(
    `SELECT 
       di.id AS item_id, 
       o.agent_id AS agent_id,
       o.full_name AS beneficiary_name,
       'orphan' AS beneficiary_type,
       br.id AS receipt_id,
       br.fingerprint_key,
       br.confirmed_at
     FROM disbursement_items di
     JOIN orphans o ON o.id = di.orphan_id
     LEFT JOIN biometric_receipts br ON br.item_id = di.id
     WHERE di.list_id = $1 AND di.included = TRUE`,
    [listId]
  );

  // 4. Group items by agent
  const agentsLog = agents.map(agent => {
    const agentItems = items.filter(item => item.agent_id === agent.agent_id);
    const confirmedCount = agentItems.filter(item => item.receipt_id).length;
    return {
      agent_id: agent.agent_id,
      agent_name: agent.agent_name,
      batch_confirmed_at: agent.batch_confirmed_at,
      total_items: agentItems.length,
      confirmed_items: confirmedCount,
      all_confirmed: confirmedCount === agentItems.length,
      items: agentItems,
    };
  });

  return {
    list,
    agents: agentsLog,
  };
};

module.exports = { uploadBiometricReceipt, confirmReceipt, getAgentListItems, getReceipts, getAgentReceiptSummary, batchConfirm, getAgentActiveBatch, getSupervisorLog };