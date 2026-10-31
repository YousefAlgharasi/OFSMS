/**
 * s3.js — OFSMS S3 Storage Helper
 *
 * Supports:
 * - AWS S3 & Supabase Storage (S3-compatible) in production
 * - Automatic local file disk storage fallback for development
 */

const AWS  = require('aws-sdk');
const { query } = require('./db');
const path = require('path');
const fs   = require('fs');
const { v4: uuidv4 } = require('uuid');

// Where local-mode files are written. On Railway point this at a mounted Volume (e.g. /data/uploads).
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(__dirname, '../../uploads');

// Public address of this API, used to build file links in local-storage mode
const localUrl = (key) =>
  `${(process.env.PUBLIC_API_URL || 'http://localhost:4000').replace(/\/+$/, '')}/local-files/${key}`;

// ── S3 client ─────────────────────────────────────────────────────────────────
const s3 = new AWS.S3({
  accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region:          process.env.AWS_REGION || 'us-east-1',
  ...(process.env.S3_ENDPOINT && { endpoint: process.env.S3_ENDPOINT }),
  ...(process.env.S3_ENDPOINT && { s3ForcePathStyle: true }),
});

const BUCKET = process.env.S3_BUCKET_NAME;

// ── Local dev mode detection ──────────────────────────────────────────────────
// If bucket is not configured or creds are dummy/test, use local disk storage
const isLocalDev = () =>
  !BUCKET ||
  process.env.AWS_ACCESS_KEY_ID === 'dummy' ||
  process.env.AWS_ACCESS_KEY_ID === 'test' ||
  process.env.STORAGE_DRIVER === 'local' ||
  !process.env.AWS_ACCESS_KEY_ID;

// Production without a bucket: keep files in the database so they survive deploys
const useDbStorage = () => isLocalDev() && process.env.NODE_ENV === 'production' && process.env.STORAGE_DRIVER !== 'local';

const saveDbFile = (key, buffer, mimetype) =>
  query(
    `INSERT INTO stored_files (file_key, content_type, content) VALUES ($1, $2, $3)
     ON CONFLICT (file_key) DO UPDATE SET content = $3, content_type = $2`,
    [key, mimetype || null, buffer]
  );

const saveLocalFile = async (key, buffer) => {
  const filePath = path.join(UPLOADS_DIR, key);
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, buffer);
};

const deleteLocalFile = async (key) => {
  const filePath = path.join(UPLOADS_DIR, key);
  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    // Ignore if file doesn't exist
  }
};

// ── uploadFile ────────────────────────────────────────────────────────────────
/**
 * Upload a file buffer to S3 or local storage in development.
 *
 * @param {Object} options
 * @param {Buffer}  options.buffer       - File buffer (from multer memoryStorage)
 * @param {string}  options.originalName - Original filename (for extension)
 * @param {string}  options.mimetype     - MIME type
 * @param {string}  options.folder       - Destination folder (e.g. 'documents')
 * @returns {Promise<{ key: string, url: string }>}
 */
const uploadFile = async ({ buffer, originalName, mimetype, folder = 'documents' }) => {
  const ext = path.extname(originalName).toLowerCase();
  const key = `${folder}/${uuidv4()}${ext}`;

  // ── Local dev: save locally, return local URL ─────────────────────────────
  if (useDbStorage()) {
    await saveDbFile(key, buffer, mimetype);
    return { key, url: `/api/documents/file/${key}` };
  }
  if (isLocalDev()) {
    console.log(`[Storage LOCAL] Saving file locally: ${key}`);
    await saveLocalFile(key, buffer);
    return { key, url: localUrl(key) };
  }

  // ── S3 Upload with automatic fallback in development ──────────────────────
  try {
    const params = {
      Bucket:      BUCKET,
      Key:         key,
      Body:        buffer,
      ContentType: mimetype,
    };

    await s3.putObject(params).promise();
    const url = await getSignedUrl(key);
    return { key, url };
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[S3 Warning] S3 upload failed (${err.message}). Falling back to local storage.`);
      await saveLocalFile(key, buffer);
      return { key, url: localUrl(key) };
    }
    throw err;
  }
};

// ── getSignedUrl ──────────────────────────────────────────────────────────────
/**
 * @param {string} key     - S3 object key
 * @param {number} expires - Seconds until expiry (default: 1 hour)
 * @returns {Promise<string>}
 */
const getSignedUrl = async (key, expires = 3600) => {
  if (isLocalDev()) {
    return localUrl(key);
  }

  try {
    return await s3.getSignedUrlPromise('getObject', {
      Bucket:  BUCKET,
      Key:     key,
      Expires: expires,
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      return localUrl(key);
    }
    throw err;
  }
};

// ── deleteFile ────────────────────────────────────────────────────────────────
/**
 * @param {string} key - S3 object key
 * @returns {Promise<void>}
 */
const deleteFile = async (key) => {
  if (useDbStorage()) {
    await query('DELETE FROM stored_files WHERE file_key = $1', [key]);
    return;
  }
  if (isLocalDev()) {
    await deleteLocalFile(key);
    return;
  }

  try {
    await s3.deleteObject({ Bucket: BUCKET, Key: key }).promise();
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      await deleteLocalFile(key);
      return;
    }
    throw err;
  }
};

// ── readFile: returns { buffer, contentType } or null ────────────────────────
const readFile = async (key) => {
  const { rows } = await query('SELECT content, content_type FROM stored_files WHERE file_key = $1', [key]);
  if (rows[0]) return { buffer: rows[0].content, contentType: rows[0].content_type };
  if (isLocalDev()) {
    try {
      const buffer = await fs.promises.readFile(path.join(UPLOADS_DIR, key));
      return { buffer, contentType: null };
    } catch { return null; }
  }
  try {
    const obj = await s3.getObject({ Bucket: BUCKET, Key: key }).promise();
    return { buffer: obj.Body, contentType: obj.ContentType };
  } catch { return null; }
};

module.exports = { uploadFile, getSignedUrl, deleteFile, readFile };
