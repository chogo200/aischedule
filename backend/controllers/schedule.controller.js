// backend/controllers/schedule.controller.js
const scheduleRepo = require('../repositories/schedule.repository');

exports.list = async (req, res, next) => {
  try {
    const { project_id } = req.query || {};
    const data = await scheduleRepo.list(project_id);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
};

exports.get = async (req, res, next) => {
  try {
    const data = await scheduleRepo.getById(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Schedule not found' });
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { period, project_id, class_id, teacher_id, subject_id, room_id } = req.body || {};
    if (!period || !project_id || !room_id) {
      return res.status(400).json({ success: false, message: 'period, project_id, room_id are required' });
    }
    const created = await scheduleRepo.create({ period, project_id, class_id, teacher_id, subject_id, room_id });
    res.status(201).json({ success: true, data: created });
  } catch (e) {
    next(e);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await scheduleRepo.remove(req.params.id);
    res.json({ success: true, message: 'Schedule deleted' });
  } catch (e) {
    next(e);
  }
};

