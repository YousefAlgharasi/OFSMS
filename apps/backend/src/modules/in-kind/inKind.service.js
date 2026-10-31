/**
 * inKind.service.js — In-Kind Support Programs Business Logic & Queries
 */

const { query } = require('../../config/db');

// ── Types ────────────────────────────────────────────────────────────────────

const getTypes = async () => {
  const { rows } = await query(`
    SELECT t.*, COUNT(p.id) AS program_count
    FROM in_kind_types t
    LEFT JOIN in_kind_programs p ON p.type_id = t.id
    GROUP BY t.id
    ORDER BY t.name ASC
  `);
  return rows;
};

const createType = async ({ name, unit = 'قطعة' }) => {
  const { rows } = await query(
    `INSERT INTO in_kind_types (name, unit)
     VALUES ($1, $2)
     RETURNING *`,
    [name.trim(), unit.trim()]
  );
  return rows[0];
};

const deleteType = async (id) => {
  const { rows } = await query(
    `DELETE FROM in_kind_types WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] || null;
};

// ── Programs ─────────────────────────────────────────────────────────────────

const getPrograms = async ({ status, typeId, sponsorId, search } = {}) => {
  const conditions = [];
  const params = [];

  if (status && status !== 'all') {
    params.push(status);
    conditions.push(`p.status = $${params.length}`);
  }

  if (typeId && typeId !== 'all') {
    params.push(parseInt(typeId, 10));
    conditions.push(`p.type_id = $${params.length}`);
  }

  if (sponsorId && sponsorId !== 'all') {
    params.push(sponsorId);
    conditions.push(`p.sponsor_id = $${params.length}`);
  }

  if (search && search.trim()) {
    params.push(`%${search.trim()}%`);
    conditions.push(`(p.title ILIKE $${params.length} OR p.notes ILIKE $${params.length})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await query(`
    SELECT
      p.id, p.title, p.status, p.start_date, p.end_date,
      p.target_quantity, p.notes, p.created_at,
      t.id AS type_id, t.name AS type_name, t.unit AS type_unit,
      s.id AS sponsor_id, s.full_name AS sponsor_name,
      COUNT(b.id) AS beneficiary_count,
      COUNT(b.id) FILTER (WHERE b.status = 'delivered') AS delivered_count
    FROM in_kind_programs p
    LEFT JOIN in_kind_types t ON t.id = p.type_id
    LEFT JOIN sponsors s ON s.id = p.sponsor_id
    LEFT JOIN in_kind_beneficiaries b ON b.program_id = p.id
    ${whereClause}
    GROUP BY p.id, t.id, t.name, t.unit, s.id, s.full_name
    ORDER BY p.created_at DESC
  `, params);

  return rows.map((r) => {
    const benCount = parseInt(r.beneficiary_count, 10) || 0;
    const delCount = parseInt(r.delivered_count, 10) || 0;
    const target = parseInt(r.target_quantity, 10) || benCount || 1;
    const coverage = benCount > 0 ? Math.round((delCount / benCount) * 100) : 0;

    return {
      ...r,
      beneficiary_count: benCount,
      delivered_count: delCount,
      coverage_percent: coverage,
    };
  });
};

const getProgramById = async (id) => {
  const { rows: [program] } = await query(`
    SELECT
      p.*,
      t.name AS type_name, t.unit AS type_unit,
      s.full_name AS sponsor_name,
      u.full_name AS creator_name,
      COUNT(b.id) AS beneficiary_count,
      COUNT(b.id) FILTER (WHERE b.status = 'delivered') AS delivered_count
    FROM in_kind_programs p
    LEFT JOIN in_kind_types t ON t.id = p.type_id
    LEFT JOIN sponsors s ON s.id = p.sponsor_id
    LEFT JOIN users u ON u.id = p.created_by
    LEFT JOIN in_kind_beneficiaries b ON b.program_id = p.id
    WHERE p.id = $1
    GROUP BY p.id, t.name, t.unit, s.full_name, u.full_name
  `, [id]);

  if (!program) return null;

  // Beneficiaries list
  const { rows: beneficiaries } = await query(`
    SELECT
      b.id AS beneficiary_id,
      b.status,
      b.delivered_at,
      b.receiver_name,
      b.receiver_relation,
      b.delivery_method,
      b.notes,
      b.created_at,
      -- Orphan info
      o.id AS orphan_id,
      o.full_name AS orphan_name,
      CONCAT('ORP-', LPAD(SUBSTRING(o.id::text, 1, 6), 6, '0')) AS orphan_code,
      o.guardian_name,
      o.guardian_relation,
      gov.name_ar AS governorate_ar,
      -- Family info
      f.id AS family_id,
      f.family_name,
      f.head_of_family,
      -- Sponsor attribution
      COALESCE(bs.id, ps.id) AS sponsor_id,
      COALESCE(bs.full_name, ps.full_name) AS sponsor_name
    FROM in_kind_beneficiaries b
    LEFT JOIN orphans o ON o.id = b.orphan_id
    LEFT JOIN governorates gov ON gov.id = o.governorate_id
    LEFT JOIN families f ON f.id = b.family_id
    LEFT JOIN sponsors bs ON bs.id = b.sponsor_id
    LEFT JOIN in_kind_programs p ON p.id = b.program_id
    LEFT JOIN sponsors ps ON ps.id = p.sponsor_id
    WHERE b.program_id = $1
    ORDER BY b.status DESC, b.created_at ASC
  `, [id]);

  const benCount = parseInt(program.beneficiary_count, 10) || 0;
  const delCount = parseInt(program.delivered_count, 10) || 0;
  const coverage = benCount > 0 ? Math.round((delCount / benCount) * 100) : 0;

  return {
    ...program,
    beneficiary_count: benCount,
    delivered_count: delCount,
    coverage_percent: coverage,
    beneficiaries,
  };
};

const createProgram = async ({
  title,
  typeId,
  sponsorId = null,
  status = 'active',
  startDate = null,
  endDate = null,
  targetQuantity = 0,
  notes = null,
  userId = null,
}) => {
  if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
    const e = new Error('تاريخ النهاية يجب أن يكون بعد تاريخ البداية');
    e.status = 400;
    throw e;
  }
  const { rows } = await query(`
    INSERT INTO in_kind_programs
      (title, type_id, sponsor_id, status, start_date, end_date, target_quantity, notes, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `, [
    title.trim(),
    typeId ? parseInt(typeId, 10) : null,
    sponsorId || null,
    status,
    startDate || null,
    endDate || null,
    parseInt(targetQuantity, 10) || 0,
    notes || null,
    userId || null,
  ]);
  return rows[0];
};

const updateProgram = async (id, data) => {
  const fields = [];
  const params = [id];

  if (data.title !== undefined) {
    params.push(data.title.trim());
    fields.push(`title = $${params.length}`);
  }
  if (data.typeId !== undefined) {
    params.push(data.typeId ? parseInt(data.typeId, 10) : null);
    fields.push(`type_id = $${params.length}`);
  }
  if (data.sponsorId !== undefined) {
    params.push(data.sponsorId || null);
    fields.push(`sponsor_id = $${params.length}`);
  }
  if (data.status !== undefined) {
    params.push(data.status);
    fields.push(`status = $${params.length}`);
  }
  if (data.startDate !== undefined) {
    params.push(data.startDate || null);
    fields.push(`start_date = $${params.length}`);
  }
  if (data.endDate !== undefined) {
    params.push(data.endDate || null);
    fields.push(`end_date = $${params.length}`);
  }
  if (data.targetQuantity !== undefined) {
    params.push(parseInt(data.targetQuantity, 10) || 0);
    fields.push(`target_quantity = $${params.length}`);
  }
  if (data.notes !== undefined) {
    params.push(data.notes || null);
    fields.push(`notes = $${params.length}`);
  }

  fields.push(`updated_at = NOW()`);

  const { rows } = await query(`
    UPDATE in_kind_programs
    SET ${fields.join(', ')}
    WHERE id = $1
    RETURNING *
  `, params);

  return rows[0] || null;
};

const deleteProgram = async (id) => {
  const { rows } = await query(
    `DELETE FROM in_kind_programs WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] || null;
};

// ── Beneficiaries Assignment ─────────────────────────────────────────────────

const addBeneficiary = async ({
  programId,
  orphanId = null,
  familyId = null,
  sponsorId = null,
  status = 'pending',
  deliveryMethod = 'من المقر',
  receiverName = null,
  receiverRelation = null,
  notes = null,
}) => {
  const { rows } = await query(`
    INSERT INTO in_kind_beneficiaries
      (program_id, orphan_id, family_id, sponsor_id, status, delivery_method, receiver_name, receiver_relation, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT DO NOTHING
    RETURNING *
  `, [
    programId,
    orphanId || null,
    familyId || null,
    sponsorId || null,
    status,
    deliveryMethod,
    receiverName || null,
    receiverRelation || null,
    notes || null,
  ]);
  return rows[0] || null;
};

const addMultipleBeneficiaries = async (programId, beneficiaries) => {
  const added = [];
  for (const b of beneficiaries) {
    const row = await addBeneficiary({
      programId,
      orphanId: b.orphanId,
      familyId: b.familyId,
      sponsorId: b.sponsorId,
      deliveryMethod: b.deliveryMethod || 'من المقر',
      receiverName: b.receiverName,
      receiverRelation: b.receiverRelation,
      notes: b.notes,
    });
    if (row) added.push(row);
  }
  return added;
};

const updateBeneficiaryDelivery = async (beneficiaryId, {
  status = 'delivered',
  deliveredAt = new Date(),
  deliveredBy = null,
  receiverName,
  receiverRelation,
  deliveryMethod = 'من المقر',
  notes = null,
}) => {
  const { rows } = await query(`
    UPDATE in_kind_beneficiaries
    SET
      status = $2,
      delivered_at = $3,
      delivered_by = $4,
      receiver_name = COALESCE($5, receiver_name),
      receiver_relation = COALESCE($6, receiver_relation),
      delivery_method = COALESCE($7, delivery_method),
      notes = COALESCE($8, notes)
    WHERE id = $1
    RETURNING *
  `, [
    beneficiaryId,
    status,
    deliveredAt,
    deliveredBy,
    receiverName || null,
    receiverRelation || null,
    deliveryMethod,
    notes || null,
  ]);
  return rows[0] || null;
};

const removeBeneficiary = async (beneficiaryId) => {
  const { rows } = await query(
    `DELETE FROM in_kind_beneficiaries WHERE id = $1 RETURNING *`,
    [beneficiaryId]
  );
  return rows[0] || null;
};

module.exports = {
  getTypes,
  createType,
  deleteType,
  getPrograms,
  getProgramById,
  createProgram,
  updateProgram,
  deleteProgram,
  addBeneficiary,
  addMultipleBeneficiaries,
  updateBeneficiaryDelivery,
  removeBeneficiary,
};
