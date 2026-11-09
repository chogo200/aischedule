// backend/controllers/project.controller.js
const projectRepo = require('../repositories/project.repository');

async function resolveProjectId(param) {
  if (!param) return null;
  if (!isNaN(param)) return Number(param);
  const found = await projectRepo.getByName(decodeURIComponent(param));
  return found ? found.id : null;
}

exports.getByName = async (req, res, next) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const row = await projectRepo.getByName(name);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    res.json({ success: true, data: row });
  } catch (e) {
    next(e);
  }
};

exports.get = async (req, res, next) => {
  try {
    const id = await resolveProjectId(req.params.id);
    if (!id) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    const row = await projectRepo.getById(id);
    res.json({ success: true, data: row });
  } catch (e) {
    next(e);
  }
};

exports.list = async (req, res, next) => {
  try {
    const data = await projectRepo.list();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
};

exports.listServer = async (req, res, next) => {
  try {
    const { page, perpage, sortBy, sortDesc, search } = req.query || {};
    const result = await projectRepo.listServer(page, perpage, sortBy, sortDesc, search);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { name } = req.body || {};
    const trimmed = (name || '').trim();
    if (!trimmed) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุชื่อโครงการ' });
    }

    const exists = await projectRepo.getByName(trimmed);
    if (exists) {
      return res.status(409).json({ success: false, message: `ชื่อโครงการ "${trimmed}" มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น` });
    }

    const created = await projectRepo.create({ name: trimmed });
    res.status(201).json({ success: true, data: created });
  } catch (e) {
    next(e);
  }
};

exports.update = async (req, res, next) => {
  try {
    const id = await resolveProjectId(req.params.id);
    if (!id) return res.status(404).json({ success: false, message: 'Project not found' });

    const { name } = req.body || {};
    const trimmed = (name || '').trim();
    if (!trimmed) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุชื่อโครงการ' });
    }

    const exists = await projectRepo.getByName(trimmed);
    if (exists && exists.id != id) {
      return res.status(409).json({ success: false, message: `ชื่อโครงการ "${trimmed}" มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น` });
    }

    const updated = await projectRepo.update(id, { name: trimmed });
    res.json({ success: true, data: updated });
  } catch (e) {
    next(e);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const id = await resolveProjectId(req.params.id);
    if (!id) return res.status(404).json({ success: false, message: 'Project not found' });
    await projectRepo.remove(id);
    res.json({ success: true, message: 'ลบโครงการเรียบร้อยแล้ว' });
  } catch (e) {
    next(e);
  }
};

/* 1. Classes in Project */
exports.getClasses = async (req, res, next) => {
  try {
    const id = await resolveProjectId(req.params.id);
    const data = await projectRepo.getClasses(id);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
};

exports.addClass = async (req, res, next) => {
  try {
    const id = await resolveProjectId(req.params.id);
    const { class_id, plan_id, name } = req.body || {};
    if (!class_id) return res.status(400).json({ success: false, message: 'class_id is required' });
    if (!plan_id) return res.status(400).json({ success: false, message: 'กรุณาระบุแผนการสอน (plan_id is required)' });
    const added = await projectRepo.addClass(id, { class_id, plan_id, name });
    res.status(201).json({ success: true, data: added });
  } catch (e) {
    next(e);
  }
};

exports.updateClassInProject = async (req, res, next) => {
  try {
    const { name, plan_id } = req.body || {};
    const updated = await projectRepo.updateClassInProject(req.params.relId, { name, plan_id });
    res.json({ success: true, data: updated });
  } catch (e) {
    next(e);
  }
};

exports.removeClass = async (req, res, next) => {
  try {
    await projectRepo.removeClass(req.params.relId);
    res.json({ success: true, message: 'นำชั้นเรียนออกจากโครงการเรียบร้อยแล้ว' });
  } catch (e) {
    next(e);
  }
};

/* 2. Rooms in Project */
exports.getRooms = async (req, res, next) => {
  try {
    const id = await resolveProjectId(req.params.id);
    const data = await projectRepo.getRooms(id);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
};

exports.addRoom = async (req, res, next) => {
  try {
    const id = await resolveProjectId(req.params.id);
    const { room_id } = req.body || {};
    if (!room_id) return res.status(400).json({ success: false, message: 'room_id is required' });
    const added = await projectRepo.addRoom(id, { room_id });
    res.status(201).json({ success: true, data: added });
  } catch (e) {
    next(e);
  }
};

exports.removeRoom = async (req, res, next) => {
  try {
    await projectRepo.removeRoom(req.params.relId);
    res.json({ success: true, message: 'นำห้องเรียนออกจากโครงการเรียบร้อยแล้ว' });
  } catch (e) {
    next(e);
  }
};

/* 3. Teachers in Project */
exports.getTeachers = async (req, res, next) => {
  try {
    const id = await resolveProjectId(req.params.id);
    const data = await projectRepo.getTeachers(id);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
};

exports.addTeacher = async (req, res, next) => {
  try {
    const id = await resolveProjectId(req.params.id);
    const { teacher_id } = req.body || {};
    if (!teacher_id) return res.status(400).json({ success: false, message: 'teacher_id is required' });
    const added = await projectRepo.addTeacher(id, { teacher_id });
    res.status(201).json({ success: true, data: added });
  } catch (e) {
    next(e);
  }
};

exports.removeTeacher = async (req, res, next) => {
  try {
    await projectRepo.removeTeacher(req.params.relId);
    res.json({ success: true, message: 'นำอาจารย์ออกจากโครงการเรียบร้อยแล้ว' });
  } catch (e) {
    next(e);
  }
};

/* 4. Lesson Plans */
exports.getLessonPlans = async (req, res, next) => {
  try {
    const id = await resolveProjectId(req.params.id);
    const data = await projectRepo.getLessonPlans(id);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
};

exports.createLessonPlan = async (req, res, next) => {
  try {
    const id = await resolveProjectId(req.params.id);
    const { name, subjects } = req.body || {};
    if (!name) return res.status(400).json({ success: false, message: 'กรุณาระบุชื่อแผนการสอน' });
    const created = await projectRepo.createLessonPlan(id, { name, subjects });
    res.status(201).json({ success: true, data: created });
  } catch (e) {
    next(e);
  }
};

exports.updateLessonPlan = async (req, res, next) => {
  try {
    const { name, subjects } = req.body || {};
    const updated = await projectRepo.updateLessonPlan(req.params.planId, { name, subjects });
    res.json({ success: true, data: updated });
  } catch (e) {
    next(e);
  }
};

exports.removeLessonPlan = async (req, res, next) => {
  try {
    await projectRepo.removeLessonPlan(req.params.planId);
    res.json({ success: true, message: 'ลบแผนการสอนเรียบร้อยแล้ว' });
  } catch (e) {
    next(e);
  }
};

/* 5. Schedules */
exports.getSchedules = async (req, res, next) => {
  try {
    const id = await resolveProjectId(req.params.id);
    const data = await projectRepo.getSchedules(id);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
};
