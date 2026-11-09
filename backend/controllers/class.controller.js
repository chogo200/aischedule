// backend/controllers/class.controller.js
const classRepo = require('../repositories/class.repository');

exports.get = async (req, res, next) => {
  try {
    const row = await classRepo.getById(req.params.id);
    res.json({ success: true, data: row });
  } catch (e) {
    next(e);
  }
};

exports.list = async (req, res, next) => {
  try {
    const { search, limit } = req.query || {};
    if (search !== undefined || limit !== undefined) {
      const data = await classRepo.search({ search, limit });
      return res.json({ success: true, data });
    }
    const data = await classRepo.list();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
};

exports.listServer = async (req, res, next) => {
  try {
    const { page, perpage, sortBy, sortDesc, search } = req.query || {};
    const result = await classRepo.listServer(page, perpage, sortBy, sortDesc, search);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ success: false, message: 'Class name is required' });
    const created = await classRepo.create({ name });
    res.status(201).json({ success: true, data: created });
  } catch (e) {
    next(e);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { name } = req.body || {};
    const updated = await classRepo.update(req.params.id, { name });
    res.json({ success: true, data: updated });
  } catch (e) {
    next(e);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await classRepo.remove(req.params.id);
    res.json({ success: true, message: 'Class deleted successfully' });
  } catch (e) {
    next(e);
  }
};

