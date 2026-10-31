/**
 * orphans.controller.js
 * HTTP handlers for the orphans module.
 *
 * POST   /api/orphans                  → createOrphan     (Agent)
 * GET    /api/orphans                  → getOrphans       (Agent/Supervisor/GM)
 * GET    /api/orphans/marketing        → getOrphansUnderMarketing (GM)
 * GET    /api/orphans/:id              → getOrphanById    (Agent/Supervisor/GM)
 * PATCH  /api/orphans/:id              → updateOrphan     (Agent — under_review only)
 * PATCH  /api/orphans/:id/status       → updateOrphanStatus (Supervisor/GM)
 */

const { validationResult } = require('express-validator');
const service = require('./orphans.service');
const adsService = require('../ads/ads.service');
const { uploadFile } = require('../../config/s3');

const VALID_RELATIONS = ['uncle', 'maternal_uncle', 'grandfather', 'sibling', 'other'];
const VALID_GENDERS   = ['male', 'female'];

/**
 * POST /api/orphans
 */
const createOrphan = async (req, res, next) => {
  try {
    // 1. Run express-validator checks
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const {
      fullName, dateOfBirth, gender, governorateId,
      guardianName, guardianRelation, notes,
    } = req.body;

    // 2. Hard guards
    if (!gender || !VALID_GENDERS.includes(gender)) {
      return res.status(422).json({
        errors: [{ field: 'gender', msg: 'الجنس مطلوب ويجب أن يكون male أو female' }],
      });
    }
    if (!guardianRelation || !VALID_RELATIONS.includes(guardianRelation)) {
      return res.status(422).json({
        errors: [{ field: 'guardianRelation', msg: 'صلة الوصي مطلوبة ويجب أن تكون قيمة صحيحة' }],
      });
    }

    // isGifted: true if talents were selected on the form, or GM manually sets it
    const isGifted = req.body.isGifted === 'true';

    // 3. Build profile object from all extended case-study fields
    const b = req.body;
    const profile = {
      // Personal extras
      ...(b.birthPlace        && { birthPlace: b.birthPlace }),
      ...(b.residence         && { residence: b.residence }),
      ...(b.motherGovernorate && { motherGovernorate: b.motherGovernorate }),
      // Contact
      ...(b.phone1            && { phone1: b.phone1 }),
      ...(b.phone1Relation    && { phone1Relation: b.phone1Relation }),
      ...(b.phone2            && { phone2: b.phone2 }),
      ...(b.phone2Relation    && { phone2Relation: b.phone2Relation }),
      ...(b.address           && { address: b.address }),
      // Educational
      ...(b.schoolGrade       && { schoolGrade: b.schoolGrade }),
      ...(b.sectorType        && { sectorType: b.sectorType }),
      ...(b.directorate       && { directorate: b.directorate }),
      ...(b.schoolOrg         && { schoolOrg: b.schoolOrg }),
      ...(b.favoriteSubject   && { favoriteSubject: b.favoriteSubject }),
      ...(b.difficultySubject && { difficultySubject: b.difficultySubject }),
      ...(b.generalLevel      && { generalLevel: b.generalLevel }),
      ...(b.repeatedYear      && { repeatedYear: b.repeatedYear }),
      ...(b.repeatedYearReason && { repeatedYearReason: b.repeatedYearReason }),
      ...(b.gradeDetail       && { gradeDetail: b.gradeDetail }),
      ...(b.generalGrade      && { generalGrade: b.generalGrade }),
      ...(b.lastResultAvg     && { lastResultAvg: b.lastResultAvg }),
      ...(b.highestGrade      && { highestGrade: b.highestGrade }),
      ...(b.lowestGrade       && { lowestGrade: b.lowestGrade }),
      ...(b.eduResponsible    && { eduResponsible: b.eduResponsible }),
      ...(b.eduResponsiblePhone && { eduResponsiblePhone: b.eduResponsiblePhone }),
      ...(b.eduLevel          && { eduLevel: b.eduLevel }),
      // Family
      ...(b.guardianAge       && { guardianAge: b.guardianAge }),
      ...(b.guardianEduLevel  && { guardianEduLevel: b.guardianEduLevel }),
      ...(b.guardianJob       && { guardianJob: b.guardianJob }),
      ...(b.guardianHealth    && { guardianHealth: b.guardianHealth }),
      ...(b.familyMaleCount   && { familyMaleCount: b.familyMaleCount }),
      ...(b.familyFemaleCount && { familyFemaleCount: b.familyFemaleCount }),
      ...(b.familyProblems    && { familyProblems: b.familyProblems }),
      // Housing
      ...(b.ownershipType     && { ownershipType: b.ownershipType }),
      ...(b.buildingType      && { buildingType: b.buildingType }),
      ...(b.floorsCount       && { floorsCount: b.floorsCount }),
      ...(b.roomsCount        && { roomsCount: b.roomsCount }),
      ...(b.water             && { water: b.water }),
      ...(b.electricity       && { electricity: b.electricity }),
      ...(b.rentAmount        && { rentAmount: b.rentAmount }),
      ...(b.housingDetails    && { housingDetails: b.housingDetails }),
      // Health
      ...(b.hasChronicDisease    && { hasChronicDisease: b.hasChronicDisease }),
      ...(b.chronicDiseaseDetails && { chronicDiseaseDetails: b.chronicDiseaseDetails }),
      ...(b.hasRegularTreatment  && { hasRegularTreatment: b.hasRegularTreatment }),
      ...(b.hasHealthInsurance   && { hasHealthInsurance: b.hasHealthInsurance }),
      // Economic
      ...(b.incomeSource         && { incomeSource: b.incomeSource }),
      ...(b.monthlyIncome        && { monthlyIncome: b.monthlyIncome }),
      ...(b.hasCharitySupport    && { hasCharitySupport: b.hasCharitySupport }),
      ...(b.charitySupportDetails && { charitySupportDetails: b.charitySupportDetails }),
      // Talents
      ...(b.talents              && { talents: JSON.parse(b.talents) }),
      ...(b.talentsOther         && { talentsOther: b.talentsOther }),
      // Social
      ...(b.familyRelations      && { familyRelations: b.familyRelations }),
      ...(b.communityRelation    && { communityRelation: b.communityRelation }),
      ...(b.schoolRelation       && { schoolRelation: b.schoolRelation }),
      ...(b.socialBehavior       && { socialBehavior: b.socialBehavior }),
      ...(b.needsSocialSupport   && { needsSocialSupport: b.needsSocialSupport }),
      // Religious
      ...(b.quranLevel           && { quranLevel: b.quranLevel }),
      ...(b.prayerCommitment     && { prayerCommitment: b.prayerCommitment }),
      ...(b.moralBehavior        && { moralBehavior: b.moralBehavior }),
      // Psychological
      ...(b.generalAppearance    && { generalAppearance: b.generalAppearance }),
      ...(b.selfExpression       && { selfExpression: b.selfExpression }),
      ...(b.psychFamilyRelations && { psychFamilyRelations: b.psychFamilyRelations }),
      ...(b.peerRelations        && { peerRelations: b.peerRelations }),
      ...(b.sleepAppetite        && { sleepAppetite: b.sleepAppetite }),
      ...(b.psychSigns           && { psychSigns: b.psychSigns }),
      ...(b.needsPsychSupport    && { needsPsychSupport: b.needsPsychSupport }),
      // Recommendations
      ...(b.recommendations      && { recommendations: b.recommendations }),
    };

    // Required documents must be present BEFORE anything is saved
    for (const [field, label] of [['deathCert', 'شهادة الوفاة'], ['birthCert', 'شهادة الميلاد']]) {
      if (!req.files?.[field]?.[0]) {
        return res.status(422).json({ errors: [{ msg: `${label} مطلوبة`, field }] });
      }
    }

    // Same child registered twice (same name + birth date)
    if (await service.findDuplicate(fullName, dateOfBirth)) {
      return res.status(409).json({
        error: 'يوجد يتيم مسجّل بنفس الاسم وتاريخ الميلاد مسبقاً. تحقق من القائمة قبل التسجيل مرة أخرى.',
      });
    }

    // 4. Create orphan record
    const orphan = await service.createOrphan({
      fullName, dateOfBirth, gender,
      governorateId: parseInt(governorateId, 10),
      guardianName, guardianRelation,
      agentId: req.user.id,
      isGifted, notes, profile,
    });

    // 4. Upload required documents to S3
    const uploadedDocs = [];

    const filesToUpload = [
      { field: 'deathCert', docType: 'death_certificate', required: true },
      { field: 'birthCert', docType: 'birth_certificate', required: true },
    ];

    for (const { field, docType, required } of filesToUpload) {
      const file = req.files?.[field]?.[0];
      if (!file) {
        if (required) {
          return res.status(422).json({
            errors: [{ msg: `ملف ${field} مطلوب`, field }],
          });
        }
        continue;
      }

      const { key } = await uploadFile({
        buffer: file.buffer,
        originalName: file.originalname,
        mimetype: file.mimetype,
        folder: 'documents',
      });

      const doc = await service.addDocument({
        entityType: 'orphan',
        entityId: orphan.id,
        docType,
        fileKey: key,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        uploadedBy: req.user.id,
      });
      uploadedDocs.push(doc);
    }

    // 5. Upload optional additional documents (up to 5)
    const additionalFiles = req.files?.additionalDocs || [];
    for (const file of additionalFiles.slice(0, 5)) {
      const { key } = await uploadFile({
        buffer: file.buffer,
        originalName: file.originalname,
        mimetype: file.mimetype,
        folder: 'documents',
      });

      const doc = await service.addDocument({
        entityType: 'orphan',
        entityId: orphan.id,
        docType: 'other',
        fileKey: key,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        uploadedBy: req.user.id,
      });
      uploadedDocs.push(doc);
    }

    return res.status(201).json({
      message: 'تم تسجيل اليتيم بنجاح وهو الآن في قائمة انتظار المراجعة',
      orphan,
      documents: uploadedDocs,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/orphans
 */
const getOrphans = async (req, res, next) => {
  try {
    const { status, governorateId, isGifted } = req.query;
    const agentId = req.user.role === 'agent' ? req.user.id : req.query.agentId;

    const orphans = await service.getOrphans({
      status,
      agentId,
      governorateId: governorateId ? parseInt(governorateId, 10) : undefined,
      isGifted: isGifted !== undefined ? isGifted === 'true' : undefined,
    });

    return res.json({ orphans });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/orphans/marketing
 */
const getOrphansUnderMarketing = async (_req, res, next) => {
  try {
    const orphans = await service.getOrphansUnderMarketing();
    return res.json({ orphans });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/orphans/:id
 */
const getOrphanById = async (req, res, next) => {
  try {
    const orphan = await service.getOrphanById(req.params.id);
    if (!orphan) {
      return res.status(404).json({ error: 'اليتيم غير موجود' });
    }

    if (req.user.role === 'agent' && orphan.agent_id !== req.user.id) {
      return res.status(403).json({ error: 'ليس لديك صلاحية للوصول إلى هذا المورد' });
    }

    const documents = await service.getOrphanDocuments(req.params.id);
    return res.json({ orphan, documents });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/orphans/:id
 */
const updateOrphan = async (req, res, next) => {
  try {
    const existing = await service.getOrphanById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'اليتيم غير موجود' });
    }

    if (req.user.role === 'agent') {
      if (existing.agent_id !== req.user.id) {
        return res.status(403).json({ error: 'ليس لديك صلاحية لتعديل هذا اليتيم' });
      }
      if (existing.status !== 'under_review' && existing.status !== 'rejected') {
        return res.status(400).json({ error: 'لا يمكن تعديل بيانات اليتيم بعد اعتمادها' });
      }
    }

    const resetStatus = req.user.role === 'agent';
    const orphan = await service.updateOrphan(req.params.id, req.body, resetStatus);
    return res.json({ message: 'تم تحديث بيانات اليتيم', orphan });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/orphans/:id/status
 */
const updateOrphanStatus = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const { status, notes } = req.body;

    if (req.user.role === 'supervisor' && status === 'under_sponsorship') {
      return res.status(403).json({ error: 'هذه الصلاحية للمدير العام فقط' });
    }

    const orphan = await service.updateOrphanStatus(
      req.params.id,
      status,
      notes,
      req.user.name,
      req.user.id
    );

    if (!orphan) {
      return res.status(404).json({ error: 'اليتيم غير موجود' });
    }

    return res.json({ message: 'تم تحديث حالة اليتيم', orphan });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/orphans/:id/share
 */
const shareOrphanToAds = async (req, res, next) => {
  try {
    const { targetAll = true, sponsorIds = [] } = req.body || {};
    const shareWithAll = targetAll === true || targetAll === 'true';
    if (!shareWithAll && (!Array.isArray(sponsorIds) || sponsorIds.length === 0)) {
      return res.status(422).json({ error: 'يرجى اختيار كافل واحد على الأقل أو اختيار جميع الكفلاء' });
    }
    const orphan = await service.getOrphanById(req.params.id);
    if (!orphan) {
      return res.status(404).json({ error: 'اليتيم غير موجود' });
    }
    if (orphan.status !== 'under_marketing') {
      return res.status(400).json({ error: 'يمكن مشاركة الأيتام تحت التسويق فقط' });
    }
    if (orphan.sponsor_name) {
      return res.status(400).json({ error: 'لا يمكن مشاركة يتيم لديه كافل حالي' });
    }

    const ad = await adsService.createAd({
      beneficiaryType: 'orphan',
      beneficiaryId: orphan.id,
      createdBy: req.user.id,
      targetAll: shareWithAll,
      sponsorIds,
    });

    return res.status(201).json({
      message: 'تمت مشاركة بيانات اليتيم مع واجهة الكافل',
      ad,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/orphans/:id
 */
const deleteOrphan = async (req, res, next) => {
  try {
    const orphan = await service.deleteOrphan(req.params.id);
    if (!orphan) {
      return res.status(404).json({ error: 'اليتيم غير موجود' });
    }
    return res.json({ message: 'تم حذف اليتيم بنجاح' });
  } catch (err) {
    if (err.status === 409) {
      return res.status(409).json({ error: err.message });
    }
    next(err);
  }
};

module.exports = {
  createOrphan,
  getOrphans,
  getOrphansUnderMarketing,
  getOrphanById,
  updateOrphan,
  updateOrphanStatus,
  shareOrphanToAds,
  deleteOrphan,
};
