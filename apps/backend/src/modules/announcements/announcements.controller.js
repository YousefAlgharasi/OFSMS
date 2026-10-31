const { validationResult } = require('express-validator');
const service = require('./announcements.service');
const { logAudit } = require('../../utils/auditLog');
const audit = (req, action, entityId, newValue) =>
  logAudit({ userId: req.user.id, action, entityType: 'announcement', entityId, newValue }).catch(() => {});

const createAnnouncement = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { title, body } = req.body;
    const announcement = await service.createAnnouncement({
      title: title.trim(),
      body: body.trim(),
      createdBy: req.user.id,
    });
    await audit(req, 'announcement_created', announcement.id, { title: announcement.title });
    return res.status(201).json({ message: 'تم إنشاء الإعلان بنجاح', announcement });
  } catch (err) { next(err); }
};

const getAnnouncements = async (req, res, next) => {
  try {
    // GM sees all (including inactive), everyone else sees only active
    const announcements = req.user.role === 'gm'
      ? await service.getAllAnnouncements()
      : await service.getActiveAnnouncements();
    return res.json({ announcements });
  } catch (err) { next(err); }
};

const updateAnnouncement = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { title, body, isActive } = req.body;
    const announcement = await service.updateAnnouncement(req.params.id, { title, body, isActive });
    if (!announcement) return res.status(404).json({ error: 'الإعلان غير موجود' });
    await audit(req, 'announcement_updated', req.params.id, { title, isActive });
    return res.json({ message: 'تم تحديث الإعلان', announcement });
  } catch (err) { next(err); }
};

const deleteAnnouncement = async (req, res, next) => {
  try {
    const announcement = await service.deleteAnnouncement(req.params.id);
    if (!announcement) return res.status(404).json({ error: 'الإعلان غير موجود' });
    await audit(req, 'announcement_deleted', req.params.id, null);
    return res.json({ message: 'تم حذف الإعلان بنجاح' });
  } catch (err) { next(err); }
};

module.exports = { createAnnouncement, getAnnouncements, updateAnnouncement, deleteAnnouncement };