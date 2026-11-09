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
      'sub.name as subject_name',
      's.teacher_id',
      'u.name_th as teacher_name'
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
      'sub.name as subject_name',
      's.teacher_id',
      'u.name_th as teacher_name'
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

