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

/**
 * POST /api/projects/:id/schedules/generate
 * Auto-generate timetable for a specific project
 */
const { generateSchedule, validateSchedule } = require('../services/scheduler/scheduler');
const projectRepo = require('../repositories/project.repository');

exports.generate = async (req, res, next) => {
  try {
    const projectId = Number(req.params.id);
    const { totalPeriods = 40, periodsPerDay = 8, dryRun = false } = req.body || {};

    // 1. Verify project exists
    const project = await projectRepo.getById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // 2. Load inputs
    const inputs = await scheduleRepo.loadProjectInputs(projectId);

    if (!inputs.classes || inputs.classes.length === 0) {
      return res.status(400).json({ success: false, message: 'โครงการนี้ยังไม่มีชั้นเรียน กรุณาเพิ่มชั้นเรียนก่อนจัดตาราง' });
    }
    if (!inputs.teachers || inputs.teachers.length === 0) {
      return res.status(400).json({ success: false, message: 'โครงการนี้ยังไม่มีอาจารย์ กรุณาเพิ่มอาจารย์ก่อนจัดตาราง' });
    }
    if (!inputs.rooms || inputs.rooms.length === 0) {
      return res.status(400).json({ success: false, message: 'โครงการนี้ยังไม่มีห้องเรียน กรุณาเพิ่มห้องเรียนก่อนจัดตาราง' });
    }

    // Check if any class has a lesson plan
    const classesWithPlans = inputs.classes.filter(c => c.subjects && c.subjects.length > 0);
    if (classesWithPlans.length === 0) {
      return res.status(400).json({ success: false, message: 'ชั้นเรียนในโครงการนี้ยังไม่ได้ผูกแผนการสอน (Lesson Plan)' });
    }

    // 3. Run algorithm
    const result = generateSchedule({
      classes: inputs.classes,
      teachers: inputs.teachers,
      rooms: inputs.rooms,
      teacherExperts: inputs.teacherExperts,
      roomExperts: inputs.roomExperts,
      totalPeriods: Number(totalPeriods) || 40,
      periodsPerDay: Number(periodsPerDay) || 8,
    });

    // 4. Save to database if not dryRun
    if (!dryRun) {
      await scheduleRepo.replaceForProject(projectId, result.scheduledSlots);
    }

    // 5. Fetch populated schedules
    const savedSchedules = await projectRepo.getSchedules(projectId);

    res.json({
      success: true,
      message: `จัดตารางเรียนสำเร็จ ${result.totalPlaced} คาบ`,
      data: {
        totalPlaced: result.totalPlaced,
        unplacedLessons: result.unplacedLessons,
        validation: result.validation,
        schedules: savedSchedules,
      }
    });
  } catch (e) {
    next(e);
  }
};

/**
 * DELETE /api/projects/:id/schedules
 * Clear all schedules in a project
 */
exports.clearForProject = async (req, res, next) => {
  try {
    const projectId = Number(req.params.id);
    await scheduleRepo.clearForProject(projectId);
    res.json({ success: true, message: 'ลบตารางเรียนในโครงการเรียบร้อยแล้ว' });
  } catch (e) {
    next(e);
  }
};

/**
 * GET /api/projects/:id/schedules/conflicts
 * Check conflict in existing schedule
 */
exports.checkConflicts = async (req, res, next) => {
  try {
    const projectId = Number(req.params.id);
    const schedules = await projectRepo.getSchedules(projectId);
    const validation = validateSchedule(schedules);
    res.json({ success: true, data: validation });
  } catch (e) {
    next(e);
  }
};

