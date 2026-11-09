// backend/repositories/schedule.repository.js
const db = require('../db/knex');

exports.list = async (projectId) => {
  let query = db('schedule as s')
    .leftJoin('class as c', 's.class_id', 'c.id')
    .leftJoin('project as p', 's.project_id', 'p.id')
    .leftJoin('room as r', 's.room_id', 'r.id')
    .leftJoin('subject as sub', 's.subject_id', 'sub.id')
    .leftJoin('teacher as t', 's.teacher_id', 't.id')
    .leftJoin('users as u', 't.user_id', 'u.id')
    .select(
      's.id',
      's.period',
      's.project_id',
      'p.name as project_name',
      's.class_id',
      'c.name as class_name',
      's.room_id',
      'r.name as room_name',
      's.subject_id',
      'sub.code as subject_code',
      'sub.name as subject_name',
      's.teacher_id',
      db.raw('COALESCE(u.name_th, t.name) as teacher_name')
    )
    .orderBy(['s.project_id', 's.period', 's.id']);

  if (projectId) {
    query = query.where('s.project_id', projectId);
  }

  return await query;
};

exports.getById = async (id) => {
  return await db('schedule as s')
    .leftJoin('class as c', 's.class_id', 'c.id')
    .leftJoin('project as p', 's.project_id', 'p.id')
    .leftJoin('room as r', 's.room_id', 'r.id')
    .leftJoin('subject as sub', 's.subject_id', 'sub.id')
    .leftJoin('teacher as t', 's.teacher_id', 't.id')
    .leftJoin('users as u', 't.user_id', 'u.id')
    .select(
      's.id',
      's.period',
      's.project_id',
      'p.name as project_name',
      's.class_id',
      'c.name as class_name',
      's.room_id',
      'r.name as room_name',
      's.subject_id',
      'sub.code as subject_code',
      'sub.name as subject_name',
      's.teacher_id',
      db.raw('COALESCE(u.name_th, t.name) as teacher_name')
    )
    .where('s.id', id)
    .first();
};

exports.create = async ({ period, project_id, class_id, teacher_id, subject_id, room_id }) => {
  const [insertId] = await db('schedule').insert({
    period,
    project_id,
    class_id: class_id || null,
    teacher_id: teacher_id || null,
    subject_id: subject_id || null,
    room_id
  });
  return await exports.getById(insertId);
};

exports.remove = async (id) => {
  const affected = await db('schedule').where({ id }).del();
  if (!affected) throw new Error('Schedule not found');
  return true;
};

/**
 * Load all input data required for auto-scheduling a project
 */
exports.loadProjectInputs = async (projectId) => {
  // 1. Classes in project with their lesson plan
  const classesRaw = await db('class_in_project as cp')
    .join('class as c', 'cp.class_id', 'c.id')
    .leftJoin('lesson_plan as lp', 'cp.plan_id', 'lp.id')
    .select(
      'cp.id as rel_id',
      'c.id as class_id',
      'c.name as class_name',
      'cp.name as name_in_project',
      'cp.plan_id',
      'lp.name as plan_name',
      'lp.subjects as plan_subjects'
    )
    .where('cp.project_id', projectId);

  // Parse subjects JSON for each class
  const classes = classesRaw.map(c => {
    let subjects = [];
    if (c.plan_subjects) {
      subjects = typeof c.plan_subjects === 'string'
        ? JSON.parse(c.plan_subjects)
        : c.plan_subjects;
    }
    return {
      id: c.class_id,
      name: c.name_in_project || c.class_name,
      plan_id: c.plan_id,
      subjects,
    };
  });

  // 2. Teachers in project
  const teachers = await db('teacher_in_project as tp')
    .join('teacher as t', 'tp.teacher_id', 't.id')
    .leftJoin('users as u', 't.user_id', 'u.id')
    .select(
      't.id',
      't.name',
      't.user_id',
      't.portfolio',
      'u.name_th'
    )
    .where('tp.project_id', projectId);

  // 3. Rooms in project
  const rooms = await db('room_in_project as rp')
    .join('room as r', 'rp.room_id', 'r.id')
    .select(
      'r.id',
      'r.name',
      'r.feature'
    )
    .where('rp.project_id', projectId);

  // 4. Teacher experts
  const teacherIds = teachers.map(t => t.id);
  const teacherExperts = teacherIds.length > 0
    ? await db('teacher_expert')
        .whereIn('teacher_id', teacherIds)
        .select('teacher_id', 'subject_id', 'score')
    : [];

  // 5. Room experts
  const roomIds = rooms.map(r => r.id);
  const roomExperts = roomIds.length > 0
    ? await db('room_expert')
        .whereIn('room_id', roomIds)
        .select('room_id', 'subject_id', 'expert')
    : [];

  return {
    classes,
    teachers,
    rooms,
    teacherExperts,
    roomExperts,
  };
};

/**
 * Replace all schedules of a project in an atomic transaction
 */
exports.replaceForProject = async (projectId, slots = []) => {
  return await db.transaction(async (trx) => {
    // 1. Delete old schedules
    await trx('schedule').where('project_id', projectId).del();

    // 2. Insert new slots
    if (slots.length > 0) {
      const rows = slots.map(s => ({
        project_id: projectId,
        period: s.period,
        class_id: s.class_id || null,
        teacher_id: s.teacher_id || null,
        subject_id: s.subject_id || null,
        room_id: s.room_id,
      }));

      // Chunk insert if large
      const chunkSize = 100;
      for (let i = 0; i < rows.length; i += chunkSize) {
        await trx('schedule').insert(rows.slice(i, i + chunkSize));
      }
    }

    return true;
  });
};

/**
 * Delete all schedules in a project
 */
exports.clearForProject = async (projectId) => {
  return await db('schedule').where('project_id', projectId).del();
};

