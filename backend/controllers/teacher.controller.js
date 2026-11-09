// backend/controllers/teacher.controller.js
const teacherRepo = require('../repositories/teacher.repository');

exports.get = async (req, res, next) => {
  try {
    const row = await teacherRepo.getById(req.params.id);
    res.json({ success: true, data: row });
  } catch (e) {
    next(e);
  }
};

exports.list = async (req, res, next) => {
  try {
    const { search, limit } = req.query || {};
    if (search !== undefined || limit !== undefined) {
      const data = await teacherRepo.search({ search, limit });
      return res.json({ success: true, data });
    }
    const data = await teacherRepo.list();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
};

exports.listServer = async (req, res, next) => {
  try {
    const { page, perpage, sortBy, sortDesc, search } = req.query || {};
    const result = await teacherRepo.listServer(page, perpage, sortBy, sortDesc, search);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { name, user_id, portfolio } = req.body || {};
    const created = await teacherRepo.create({
      name: name ? String(name).trim() : null,
      user_id: user_id ? Number(user_id) : null,
      portfolio: portfolio ? String(portfolio).trim() : null
    });
    res.status(201).json({ success: true, data: created });
  } catch (e) {
    next(e);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { name, user_id, portfolio } = req.body || {};
    const updated = await teacherRepo.update(req.params.id, {
      name: name !== undefined ? (name ? String(name).trim() : null) : undefined,
      user_id: user_id !== undefined ? (user_id ? Number(user_id) : null) : undefined,
      portfolio: portfolio !== undefined ? (portfolio ? String(portfolio).trim() : null) : undefined
    });
    res.json({ success: true, data: updated });
  } catch (e) {
    next(e);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await teacherRepo.remove(req.params.id);
    res.json({ success: true, message: 'Teacher deleted successfully' });
  } catch (e) {
    next(e);
  }
};

/* -------------------------------------------------------------
   Teacher Experts Controllers
---------------------------------------------------------------- */
exports.getExperts = async (req, res, next) => {
  try {
    const data = await teacherRepo.getExperts(req.params.id);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
};

exports.addExpert = async (req, res, next) => {
  try {
    const { subject_id, score } = req.body || {};
    if (!subject_id) return res.status(400).json({ success: false, message: 'subject_id is required' });
    const data = await teacherRepo.addExpert(req.params.id, { subject_id, score });
    res.status(201).json({ success: true, data });
  } catch (e) {
    next(e);
  }
};

exports.updateExpert = async (req, res, next) => {
  try {
    const { score } = req.body || {};
    const data = await teacherRepo.updateExpert(req.params.expertId, { score });
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
};

exports.removeExpert = async (req, res, next) => {
  try {
    await teacherRepo.removeExpert(req.params.expertId);
    res.json({ success: true, message: 'Expert removed successfully' });
  } catch (e) {
    next(e);
  }
};

exports.evaluateExpertise = async (req, res, next) => {
  try {
    const { syncExpertiseToDatabase } = require('../services/ai/antigravityEvaluator');
    const result = await syncExpertiseToDatabase();
    res.json({
      success: true,
      message: 'ประเมินและบันทึกความเชี่ยวชาญครูโดย Antigravity AI สำเร็จเรียบร้อย',
      data: result
    });
  } catch (e) {
    next(e);
  }
};



