// backend/repositories/subject.repository.js
const db = require('../db/knex');

exports.getById = async (id) => {
  const row = await db('subject')
    .select('id', 'code', 'name', 'level')
    .where({ id })
    .first();

  if (!row) {
    throw new Error('Subject not found');
  }
  return row;
};

exports.create = async ({ code, name, level }) => {
  const [insertId] = await db('subject').insert({
    code: code ? String(code).trim() : null,
    name,
    level,
  });

  const created = await db('subject')
    .select('id', 'code', 'name', 'level')
    .where({ id: insertId })
    .first();

  return created;
};

exports.update = async (id, { code, name, level }) => {
  const payload = {};
  if (code !== undefined) payload.code = code ? String(code).trim() : null;
  if (name != null) payload.name = name;
  if (level != null) payload.level = level;

  const affected = await db('subject').where({ id }).update(payload);
  if (!affected) {
    throw new Error('Subject not found');
  }

  const updated = await db('subject')
    .select('id', 'code', 'name', 'level')
    .where({ id })
    .first();

  return updated;
};

exports.remove = async (id) => {
  const affected = await db('subject').where({ id }).del();
  if (!affected) {
    throw new Error('Subject not found');
  }
  return true;
};

exports.list = async () => {
  return await db('subject').select('id', 'code', 'name', 'level').orderBy('id', 'desc');
};

exports.search = async ({ search, limit = 5 }) => {
  let q = db('subject').select('id', 'code', 'name', 'level');
  if (search && search.trim()) {
    const s = search.trim();
    q = q.whereRaw("CONCAT(COALESCE(code, ''), ' ', COALESCE(name, '')) LIKE ?", [`%${s}%`]);
  }
  return await q.orderBy('id', 'desc').limit(Number(limit) || 5);
};

exports.listLevels = async ({ search, limit = 5 }) => {
  let q = db('subject')
    .distinct('level')
    .whereNotNull('level')
    .where('level', '!=', '');

  if (search && search.trim()) {
    q = q.where('level', 'like', `%${search.trim()}%`);
  }
  const rows = await q.limit(Number(limit) || 5);
  return rows.map(r => r.level);
};

exports.listServer = async (page, perpage, sortBy, sortDesc, search) => {
  const _page = Number(page || 1);
  const _itemsPerPage = Number(perpage || 10);
  const _sortBy = String(sortBy || 'id');
  const _sortDesc = sortDesc === 'false' ? false : true;
  const _search = String((search || '').trim());

  const allowed = new Set(['id', 'code', 'name', 'level']);
  const column = allowed.has(_sortBy) ? _sortBy : 'id';
  const dir = _sortDesc ? 'DESC' : 'ASC';

  const off = (_page - 1) * _itemsPerPage;
  const like = `%${_search}%`;

  let countQuery = db('subject');
  let itemsQuery = db('subject');

  if (_search) {
    countQuery = countQuery.whereRaw("CONCAT(id, ' ', COALESCE(code, ''), ' ', COALESCE(name, ''), ' ', COALESCE(level, '')) LIKE ?", [like]);
    itemsQuery = itemsQuery.whereRaw("CONCAT(id, ' ', COALESCE(code, ''), ' ', COALESCE(name, ''), ' ', COALESCE(level, '')) LIKE ?", [like]);
  }

  const [{ cnt }] = await countQuery.count({ cnt: '*' });

  const items = await itemsQuery
    .select('id', 'code', 'name', 'level')
    .orderBy(column, dir)
    .limit(_itemsPerPage)
    .offset(off);

  return {
    success: true,
    items,
    total: Number(cnt || 0),
    page: _page,
    itemsPerPage: _itemsPerPage,
  };
};

