// backend/repositories/teacher.repository.js
const db = require('../db/knex');

exports.getById = async (id) => {
  const row = await db('teacher as t')
    .leftJoin('users as u', 't.user_id', 'u.id')
    .select('t.id', 't.name', 't.user_id', 't.portfolio', 'u.name_th as user_name', 'u.email', 'u.role')
    .where('t.id', id)
    .first();

  if (!row) throw new Error('Teacher not found');

  // ถ้า t.name เป็น null ให้ fallback เป็น user_name
  row.name = row.name || row.user_name || '';

  // ดึงความเชี่ยวชาญ (teacher_expert) พร้อมชื่อวิชาและ level
  const experts = await db('teacher_expert as te')
    .join('subject as s', 'te.subject_id', 's.id')
    .select('te.id as expert_id', 'te.teacher_id', 'te.subject_id', 'te.score', 's.name as subject_name', 's.level as subject_level')
    .where('te.teacher_id', id)
    .orderBy('te.id', 'desc');

  return {
    ...row,
    experts
  };
};

/* -------------------------------------------------------------
   Teacher Experts (ความเชี่ยวชาญของอาจารย์)
---------------------------------------------------------------- */
exports.getExperts = async (teacherId) => {
  return await db('teacher_expert as te')
    .join('subject as s', 'te.subject_id', 's.id')
    .select('te.id as expert_id', 'te.teacher_id', 'te.subject_id', 'te.score', 's.name as subject_name', 's.level as subject_level')
    .where('te.teacher_id', teacherId)
    .orderBy('te.id', 'desc');
};

exports.addExpert = async (teacherId, { subject_id, score = 1 }) => {
  const existing = await db('teacher_expert')
    .where({ teacher_id: teacherId, subject_id })
    .first();

  if (existing) {
    await db('teacher_expert')
      .where({ id: existing.id })
      .update({ score: Number(score) || 1 });
    return await db('teacher_expert as te')
      .join('subject as s', 'te.subject_id', 's.id')
      .select('te.id as expert_id', 'te.teacher_id', 'te.subject_id', 'te.score', 's.name as subject_name', 's.level as subject_level')
      .where('te.id', existing.id)
      .first();
  }

  const [insertId] = await db('teacher_expert').insert({
    teacher_id: teacherId,
    subject_id,
    score: Number(score) || 1
  });

  return await db('teacher_expert as te')
    .join('subject as s', 'te.subject_id', 's.id')
    .select('te.id as expert_id', 'te.teacher_id', 'te.subject_id', 'te.score', 's.name as subject_name', 's.level as subject_level')
    .where('te.id', insertId)
    .first();
};

exports.updateExpert = async (expertId, { score }) => {
  await db('teacher_expert').where({ id: expertId }).update({ score: Number(score) || 1 });
  return await db('teacher_expert as te')
    .join('subject as s', 'te.subject_id', 's.id')
    .select('te.id as expert_id', 'te.teacher_id', 'te.subject_id', 'te.score', 's.name as subject_name', 's.level as subject_level')
    .where('te.id', expertId)
    .first();
};

exports.removeExpert = async (expertId) => {
  return await db('teacher_expert').where({ id: expertId }).del();
};

exports.create = async ({ name, user_id, portfolio }) => {
  const [insertId] = await db('teacher').insert({
    name: name || null,
    user_id: user_id || null,
    portfolio: portfolio || null
  });
  return await exports.getById(insertId);
};

exports.update = async (id, { name, user_id, portfolio }) => {
  const payload = {};
  if (name !== undefined) payload.name = name || null;
  if (user_id !== undefined) payload.user_id = user_id || null;
  if (portfolio !== undefined) payload.portfolio = portfolio || null;

  const affected = await db('teacher').where({ id }).update(payload);
  if (!affected) throw new Error('Teacher not found');
  return await exports.getById(id);
};

exports.remove = async (id) => {
  const affected = await db('teacher').where({ id }).del();
  if (!affected) throw new Error('Teacher not found');
  return true;
};

exports.search = async ({ search = '', limit = 5 }) => {
  const q = String(search || '').trim();
  const maxLimit = Math.min(Number(limit) || 5, 20);

  let query = db('teacher as t')
    .leftJoin('users as u', 't.user_id', 'u.id')
    .select('t.id', 't.name', 't.user_id', 't.portfolio', 'u.name_th as user_name', 'u.email');

  if (q) {
    query = query.whereRaw("CONCAT(t.id, ' ', COALESCE(t.name, ''), ' ', COALESCE(u.name_th, ''), ' ', COALESCE(u.email, '')) LIKE ?", [`%${q}%`]);
  }

  const rows = await query.orderBy('t.id', 'desc').limit(maxLimit);
  return rows.map(r => ({
    ...r,
    name: r.name || r.user_name || ''
  }));
};

exports.list = async () => {
  const list = await db('teacher as t')
    .leftJoin('users as u', 't.user_id', 'u.id')
    .select('t.id', 't.name', 't.user_id', 't.portfolio', 'u.name_th as user_name', 'u.email')
    .orderBy('t.id', 'desc');

  return list.map(item => ({
    ...item,
    name: item.name || item.user_name || ''
  }));
};

exports.listServer = async (page, perpage, sortBy, sortDesc, search) => {
  const _page = Number(page || 1);
  const _itemsPerPage = Number(perpage || 10);
  const _sortBy = String(sortBy || 'id');
  const _sortDesc = sortDesc === 'false' ? false : true;
  const _search = String((search || '').trim());

  const columnMap = {
    id: 't.id',
    name: 't.name',
    user_id: 't.user_id',
    email: 'u.email',
  };
  const column = columnMap[_sortBy] || 't.id';
  const dir = _sortDesc ? 'DESC' : 'ASC';

  const off = (_page - 1) * _itemsPerPage;
  const like = `%${_search}%`;

  let countQuery = db('teacher as t').leftJoin('users as u', 't.user_id', 'u.id');
  let itemsQuery = db('teacher as t').leftJoin('users as u', 't.user_id', 'u.id');

  if (_search) {
    const rawWhere = "CONCAT(t.id, ' ', COALESCE(t.name, ''), ' ', COALESCE(u.name_th, ''), ' ', COALESCE(u.email, ''), ' ', COALESCE(t.portfolio, '')) LIKE ?";
    countQuery = countQuery.whereRaw(rawWhere, [like]);
    itemsQuery = itemsQuery.whereRaw(rawWhere, [like]);
  }

  const [{ cnt }] = await countQuery.count({ cnt: '*' });
  const rawItems = await itemsQuery
    .select('t.id', 't.name', 't.user_id', 't.portfolio', 'u.name_th as user_name', 'u.email')
    .orderBy(column, dir)
    .limit(_itemsPerPage)
    .offset(off);

  const items = rawItems.map(item => ({
    ...item,
    name: item.name || item.user_name || ''
  }));

  return {
    success: true,
    items,
    total: Number(cnt || 0),
    page: _page,
    itemsPerPage: _itemsPerPage,
  };
};

