/**
 * ads.service.js — OFSMS Ads Business Logic Layer
 *
 * Orchestrates ad operations using:
 *   - ads.repository.js (data access)
 *
 * No HTTP knowledge lives here (no req/res/next).
 * All functions throw plain Errors with a .statusCode property
 * that the controller maps to the correct HTTP status code.
 */

const repository = require('./ads.repository');

// ── Get all ads ───────────────────────────────────────────────────────────────
const getAds = async () => {
  return repository.findAllAds();
};

// ── Get a single ad by ID (throws 404 if not found) ──────────────────────────
const getAdById = async (id) => {
  const ad = await repository.findAdById(id);
  if (!ad) {
    const err = new Error('الإعلان غير موجود');
    err.statusCode = 404;
    throw err;
  }
  return ad;
};

// ── Get ads visible to a specific sponsor ────────────────────────────────────
const getAdsForSponsor = async (sponsorId) => {
  // Sponsors only see requests that are still open (not yet sponsored)
  const ads = await repository.findAdsForSponsor(sponsorId);
  return ads.filter((a) => !a.is_sponsored);
};

// ── Create a new ad ───────────────────────────────────────────────────────────
const createAd = async (payload) => {
  if (await repository.findOpenAdForBeneficiary(payload.beneficiaryType, payload.beneficiaryId)) {
    const e = new Error('تمت مشاركة هذا المستفيد مسبقاً في الإعلانات');
    e.status = 409;
    throw e;
  }
  return repository.insertAd(payload);
};

// ── Delete an ad (enforces business rule: must be sponsored first) ────────────
const deleteAd = async (id) => {
  const ad = await repository.findAdById(id);

  if (!ad) {
    const err = new Error('الإعلان غير موجود');
    err.statusCode = 404;
    throw err;
  }

  if (!ad.is_sponsored) {
    const err = new Error('لا يمكن حذف الإعلان قبل اكتمال الكفالة');
    err.statusCode = 400;
    throw err;
  }

  return repository.removeAd(id);
};

module.exports = {
  getAds,
  getAdById,
  getAdsForSponsor,
  createAd,
  deleteAd,
};
