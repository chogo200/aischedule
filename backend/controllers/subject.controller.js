// backend/controllers/subject.controller.js
const subjectRepo = require('../repositories/subject.repository');

exports.get = async (req, res, next) => {
  try {
    const row = await subjectRepo.getById(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }
    res.json({ success: true, data: row });
  } catch (e) {
    next(e);
  }
};

exports.list = async (req, res, next) => {
  try {
    const { search, limit } = req.query || {};
    let query = subjectRepo.list();
    if (search || limit) {
      const data = await subjectRepo.search({ search, limit });
      return res.json({ success: true, data });
    }
    const data = await query;
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
};

exports.getLevels = async (req, res, next) => {
  try {
    const { search, limit } = req.query || {};
    const data = await subjectRepo.listLevels({ search, limit });
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
};

exports.listServer = async (req, res, next) => {
  try {
    const { page, perpage, sortBy, sortDesc, search } = req.query || {};
    const result = await subjectRepo.listServer(page, perpage, sortBy, sortDesc, search);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { code, name, level } = req.body || {};
    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    const created = await subjectRepo.create({ code, name, level });
    res.status(201).json({ success: true, data: created });
  } catch (e) {
    next(e);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { code, name, level } = req.body || {};
    const updated = await subjectRepo.update(req.params.id, { code, name, level });
    res.json({ success: true, data: updated });
  } catch (e) {
    next(e);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await subjectRepo.remove(req.params.id);
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (e) {
    next(e);
  }
};

