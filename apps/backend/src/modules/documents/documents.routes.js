/**
 * documents.routes.js — Mounted at /api/documents
 * Authenticated download of orphan / family documents.
 */
const { Router } = require('express');
const path = require('path');
const { authenticate, authorize } = require('../../middleware/rbac');
const { query } = require('../../config/db');
const { readFile } = require('../../config/s3');

const router = Router();

const MIME = {
  '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp',
};

// GET /api/documents/:id/download — gm / supervisor / finance, or the agent who registered the record
router.get(
  '/:id/download',
  authenticate,
  authorize('gm', 'supervisor', 'agent'),
  async (req, res, next) => {
    try {
      if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(404).json({ error: 'المستند غير موجود' });
      const { rows } = await query(
        `SELECT d.file_key, d.original_name, d.entity_type,
                COALESCE(o.agent_id, f.agent_id) AS agent_id
         FROM documents d
         LEFT JOIN orphans o ON d.entity_type = 'orphan' AND o.id = d.entity_id
         LEFT JOIN families f ON d.entity_type = 'family' AND f.id = d.entity_id
         WHERE d.id = $1`,
        [req.params.id]
      );
      const doc = rows[0];
      if (!doc) return res.status(404).json({ error: 'المستند غير موجود' });
      if (req.user.role === 'agent' && doc.agent_id !== req.user.id) {
        return res.status(403).json({ error: 'غير مصرح لك بعرض هذا المستند' });
      }
      const file = await readFile(doc.file_key);
      if (!file) return res.status(404).json({ error: 'الملف غير متوفر على الخادم (قد يحتاج إلى إعادة رفع)' });
      const ext = path.extname(doc.file_key).toLowerCase();
      res.setHeader('Content-Type', file.contentType || MIME[ext] || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(doc.original_name || `document${ext}`)}`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, max-age=300');
      return res.send(file.buffer);
    } catch (err) { next(err); }
  }
);

module.exports = router;
