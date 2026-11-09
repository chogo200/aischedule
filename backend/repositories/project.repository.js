// backend/repositories/project.repository.js
const db = require('../db/knex');

exports.getById = async (id) => {
  const row = await db('project').where({ id }).first();
  if (!row) throw new Error('Project not found');

  // ดึงสถิติต่างๆ ในโครงการ
  const [{ class_count }] = await db('class_in_project').where({ project_id: id }).count({ class_count: '*' });
  const [{ room_count }] = await db('room_in_project').where({ project_id: id }).count({ room_count: '*' });
  const [{ teacher_count }] = await db('teacher_in_project').where({ project_id: id }).count({ teacher_count: '*' });
  const [{ schedule_count }] = await db('schedule').where({ project_id: id }).count({ schedule_count: '*' });
  const [{ plan_count }] = await db('lesson_plan').where({ project_id: id }).count({ plan_count: '*' });

  return {
    ...row,
    stats: {
      classes: Number(class_count || 0),
      rooms: Number(room_count || 0),
      teachers: Number(teacher_count || 0),
      schedules: Number(schedule_count || 0),
      lesson_plans: Number(plan_count || 0),
    }
  };
};

exports.getByName = async (name) => {
  const row = await db('project').where({ name }).first();
  if (!row) return null;

  // ดึงสถิติต่างๆ ในโครงการเช่นเดียวกับ getById
  const id = row.id;
  const [{ class_count }] = await db('class_in_project').where({ project_id: id }).count({ class_count: '*' });
  const [{ room_count }] = await db('room_in_project').where({ project_id: id }).count({ room_count: '*' });
  const [{ teacher_count }] = await db('teacher_in_project').where({ project_id: id }).count({ teacher_count: '*' });
  const [{ schedule_count }] = await db('schedule').where({ project_id: id }).count({ schedule_count: '*' });
  const [{ plan_count }] = await db('lesson_plan').where({ project_id: id }).count({ plan_count: '*' });

  return {
    ...row,
    stats: {
      classes: Number(class_count || 0),
      rooms: Number(room_count || 0),
      teachers: Number(teacher_count || 0),
      schedules: Number(schedule_count || 0),
      lesson_plans: Number(plan_count || 0),
    }
  };
};

exports.create = async ({ name }) => {
  const [insertId] = await db('project').insert({ name });
  return await exports.getById(insertId);
};

exports.update = async (id, { name }) => {
  const payload = {};
  if (name != null) payload.name = name;
  const affected = await db('project').where({ id }).update(payload);
  if (!affected) throw new Error('Project not found');
  return await exports.getById(id);
};

exports.remove = async (id) => {
  const affected = await db('project').where({ id }).del();
  if (!affected) throw new Error('Project not found');
  return true;
};

exports.list = async () => {
  return await db('project').orderBy('id', 'desc');
};

exports.listServer = async (page, perpage, sortBy, sortDesc, search) => {
  const _page = Number(page || 1);
  const _itemsPerPage = Number(perpage || 12);
  const _sortBy = String(sortBy || 'id');
  const _sortDesc = sortDesc === 'false' ? false : true;
  const _search = String((search || '').trim());

  const allowed = new Set(['id', 'name']);
  const column = allowed.has(_sortBy) ? _sortBy : 'id';
  const dir = _sortDesc ? 'DESC' : 'ASC';

  const off = (_page - 1) * _itemsPerPage;
  const like = `%${_search}%`;

  let countQuery = db('project');
  let itemsQuery = db('project');

  if (_search) {
    countQuery = countQuery.whereRaw("CONCAT(id, ' ', COALESCE(name, '')) LIKE ?", [like]);
    itemsQuery = itemsQuery.whereRaw("CONCAT(id, ' ', COALESCE(name, '')) LIKE ?", [like]);
  }

  const [{ cnt }] = await countQuery.count({ cnt: '*' });
  const items = await itemsQuery
    .orderBy(column, dir)
    .limit(_itemsPerPage)
    .offset(off);

  const enriched = await Promise.all(
    items.map(async (p) => {
      const [{ class_cnt }] = await db('class_in_project').where({ project_id: p.id }).count({ class_cnt: '*' });
      const [{ room_cnt }] = await db('room_in_project').where({ project_id: p.id }).count({ room_cnt: '*' });
      const [{ teacher_cnt }] = await db('teacher_in_project').where({ project_id: p.id }).count({ teacher_cnt: '*' });
      const [{ plan_cnt }] = await db('lesson_plan').where({ project_id: p.id }).count({ plan_cnt: '*' });
      const [{ schedule_cnt }] = await db('schedule').where({ project_id: p.id }).count({ schedule_cnt: '*' });
      return {
        ...p,
        stats: {
          classes: Number(class_cnt || 0),
          rooms: Number(room_cnt || 0),
          teachers: Number(teacher_cnt || 0),
          lesson_plans: Number(plan_cnt || 0),
          schedules: Number(schedule_cnt || 0),
        }
      };
    })
  );

  return {
    success: true,
    items: enriched,
    total: Number(cnt || 0),
    page: _page,
    itemsPerPage: _itemsPerPage,
  };
};

/* -------------------------------------------------------------
   1. จัดการชั้นเรียนในโครงการ (class_in_project + name in project)
---------------------------------------------------------------- */
exports.getClasses = async (projectId) => {
  return await db('class_in_project as cp')
    .join('class as c', 'cp.class_id', 'c.id')
    .leftJoin('lesson_plan as lp', 'cp.plan_id', 'lp.id')
    .select(
      'cp.id as rel_id',
      'cp.project_id',
      'cp.class_id',
      'cp.plan_id',
      'cp.name as name_in_project',
      'c.name as class_name',
      'lp.name as plan_name'
    )
    .where('cp.project_id', projectId)
    .orderBy('cp.id', 'desc');
};

exports.addClass = async (projectId, { class_id, plan_id, name }) => {
  const [insertId] = await db('class_in_project').insert({
    project_id: projectId,
    class_id,
    plan_id: plan_id || null,
    name: name || null
  });
  return await db('class_in_project as cp')
    .join('class as c', 'cp.class_id', 'c.id')
    .leftJoin('lesson_plan as lp', 'cp.plan_id', 'lp.id')
    .select(
      'cp.id as rel_id',
      'cp.project_id',
      'cp.class_id',
      'cp.plan_id',
      'cp.name as name_in_project',
      'c.name as class_name',
      'lp.name as plan_name'
    )
    .where('cp.id', insertId)
    .first();
};

exports.updateClassInProject = async (relId, { name, plan_id }) => {
  const payload = {};
  if (name !== undefined) payload.name = name || null;
  if (plan_id !== undefined) payload.plan_id = plan_id || null;

  if (Object.keys(payload).length > 0) {
    await db('class_in_project').where({ id: relId }).update(payload);
  }

  return await db('class_in_project as cp')
    .join('class as c', 'cp.class_id', 'c.id')
    .leftJoin('lesson_plan as lp', 'cp.plan_id', 'lp.id')
    .select(
      'cp.id as rel_id',
      'cp.project_id',
      'cp.class_id',
      'cp.plan_id',
      'cp.name as name_in_project',
      'c.name as class_name',
      'lp.name as plan_name'
    )
    .where('cp.id', relId)
    .first();
};

exports.removeClass = async (relId) => {
  return await db('class_in_project').where({ id: relId }).del();
};

/* -------------------------------------------------------------
   2. จัดการห้องเรียนในโครงการ (room_in_project)
---------------------------------------------------------------- */
exports.getRooms = async (projectId) => {
  return await db('room_in_project as rp')
    .join('room as r', 'rp.room_id', 'r.id')
    .select('rp.id as rel_id', 'rp.project_id', 'rp.room_id', 'r.name as room_name', 'r.feature')
    .where('rp.project_id', projectId)
    .orderBy('rp.id', 'desc');
};

exports.addRoom = async (projectId, { room_id }) => {
  const [insertId] = await db('room_in_project').insert({
    project_id: projectId,
    room_id
  });
  return await db('room_in_project as rp')
    .join('room as r', 'rp.room_id', 'r.id')
    .select('rp.id as rel_id', 'rp.project_id', 'rp.room_id', 'r.name as room_name', 'r.feature')
    .where('rp.id', insertId)
    .first();
};

exports.removeRoom = async (relId) => {
  return await db('room_in_project').where({ id: relId }).del();
};

/* -------------------------------------------------------------
   3. จัดการอาจารย์ในโครงการ (teacher_in_project)
---------------------------------------------------------------- */
exports.getTeachers = async (projectId) => {
  const rows = await db('teacher_in_project as tp')
    .join('teacher as t', 'tp.teacher_id', 't.id')
    .leftJoin('users as u', 't.user_id', 'u.id')
    .select('tp.id as rel_id', 'tp.project_id', 'tp.teacher_id', 't.name as teacher_name', 'u.name_th as user_name', 'u.email', 't.portfolio')
    .where('tp.project_id', projectId)
    .orderBy('tp.id', 'desc');

  return rows.map(r => ({
    ...r,
    name: r.teacher_name || r.user_name || '-'
  }));
};

exports.addTeacher = async (projectId, { teacher_id }) => {
  const [insertId] = await db('teacher_in_project').insert({
    project_id: projectId,
    teacher_id
  });
  const row = await db('teacher_in_project as tp')
    .join('teacher as t', 'tp.teacher_id', 't.id')
    .leftJoin('users as u', 't.user_id', 'u.id')
    .select('tp.id as rel_id', 'tp.project_id', 'tp.teacher_id', 't.name as teacher_name', 'u.name_th as user_name', 'u.email', 't.portfolio')
    .where('tp.id', insertId)
    .first();

  return {
    ...row,
    name: row.teacher_name || row.user_name || '-'
  };
};

exports.removeTeacher = async (relId) => {
  return await db('teacher_in_project').where({ id: relId }).del();
};

/* -------------------------------------------------------------
   4. แผนการสอน (lesson_plan: project_id, name, subjects=[{subject_id, hours}])
---------------------------------------------------------------- */
exports.getLessonPlans = async (projectId) => {
  const rows = await db('lesson_plan').where({ project_id: projectId }).orderBy('id', 'desc');
  const allSubjects = await db('subject').select('id', 'name', 'level');
  const subjectMap = new Map(allSubjects.map(s => [s.id, s]));

  return rows.map(r => {
    const list = typeof r.subjects === 'string' ? JSON.parse(r.subjects) : (r.subjects || []);
    const enriched = list.map(item => {
      const sub = subjectMap.get(item.subject_id);
      return {
        ...item,
        subject_name: sub ? sub.name : `วิชา #${item.subject_id}`,
        subject_level: sub ? sub.level : null
      };
    });
    return {
      ...r,
      subjects: enriched
    };
  });
};

exports.createLessonPlan = async (projectId, { name, subjects }) => {
  const [insertId] = await db('lesson_plan').insert({
    project_id: projectId,
    name,
    subjects: JSON.stringify(subjects || [])
  });
  const row = await db('lesson_plan').where({ id: insertId }).first();
  return {
    ...row,
    subjects: typeof row.subjects === 'string' ? JSON.parse(row.subjects) : (row.subjects || [])
  };
};

exports.updateLessonPlan = async (id, { name, subjects }) => {
  const payload = {};
  if (name != null) payload.name = name;
  if (subjects != null) payload.subjects = JSON.stringify(subjects || []);
  await db('lesson_plan').where({ id }).update(payload);
  const row = await db('lesson_plan').where({ id }).first();
  return {
    ...row,
    subjects: typeof row?.subjects === 'string' ? JSON.parse(row.subjects) : (row?.subjects || [])
  };
};

exports.removeLessonPlan = async (id) => {
  return await db('lesson_plan').where({ id }).del();
};

/* -------------------------------------------------------------
   5. ตารางเรียนที่ AI จัดให้ (schedule ใน project)
---------------------------------------------------------------- */
exports.getSchedules = async (projectId) => {
  return await db('schedule as s')
    .leftJoin('class as c', 's.class_id', 'c.id')
    .leftJoin('teacher as t', 's.teacher_id', 't.id')
    .leftJoin('users as u', 't.user_id', 'u.id')
    .leftJoin('subject as sub', 's.subject_id', 'sub.id')
    .leftJoin('room as r', 's.room_id', 'r.id')
    .select(
      's.id',
      's.period',
      's.project_id',
      's.class_id',
      'c.name as class_name',
      's.teacher_id',
      db.raw('COALESCE(u.name_th, t.name) as teacher_name'),
      's.subject_id',
      'sub.code as subject_code',
      'sub.name as subject_name',
      's.room_id',
      'r.name as room_name'
    )
    .where('s.project_id', projectId)
    .orderBy(['s.period', 's.id']);
};
