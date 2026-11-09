// backend/repositories/class.repository.js
const db = require('../db/knex');

exports.getById = async (id) => {
  const row = await db('class').where({ id }).first();
  if (!row) throw new Error('Class not found');
  return row;
};

exports.create = async ({ name }) => {
  const [insertId] = await db('class').insert({ name });
  return await db('class').where({ id: insertId }).first();
};

exports.update = async (id, { name }) => {
  const payload = {};
  if (name != null) payload.name = name;
  const affected = await db('class').where({ id }).update(payload);
  if (!affected) throw new Error('Class not found');
  return await db('class').where({ id }).first();
};

exports.remove = async (id) => {
  const affected = await db('class').where({ id }).del();
  if (!affected) throw new Error('Class not found');
  return true;
};

exports.search = async ({ search = '', limit = 5 }) => {
  const q = String(search || '').trim();
  const maxLimit = Math.min(Number(limit) || 5, 20);

  let query = db('class').select('id', 'name');
  if (q) {
    query = query.where('name', 'like', `%${q}%`);
  }

  return await query.orderBy('id', 'desc').limit(maxLimit);
};

exports.list = async () => {
  return await db('class').orderBy('id', 'desc');
};

exports.listServer = async (page, perpage, sortBy, sortDesc, search) => {
  const _page = Number(page || 1);
  const _itemsPerPage = Number(perpage || 10);
  const _sortBy = String(sortBy || 'id');
  const _sortDesc = sortDesc === 'false' ? false : true;
  const _search = String((search || '').trim());

  const allowed = new Set(['id', 'name']);
  const column = allowed.has(_sortBy) ? _sortBy : 'id';
  const dir = _sortDesc ? 'DESC' : 'ASC';

  const off = (_page - 1) * _itemsPerPage;
  const like = `%${_search}%`;

  let countQuery = db('class');
  let itemsQuery = db('class');

  if (_search) {
    countQuery = countQuery.whereRaw("CONCAT(id, ' ', COALESCE(name, '')) LIKE ?", [like]);
    itemsQuery = itemsQuery.whereRaw("CONCAT(id, ' ', COALESCE(name, '')) LIKE ?", [like]);
  }

  const [{ cnt }] = await countQuery.count({ cnt: '*' });
  const items = await itemsQuery
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

