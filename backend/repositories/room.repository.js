// controllers/users.controller.js
// ---------------------------------------------
// "ฉบับนักเรียน" : Controller คุย DB โดยตรงผ่าน Knex (ไม่มี repository)
// จุดประสงค์เพื่อให้เห็นเส้นทางข้อมูลแบบตรงไปตรงมา: HTTP -> Controller -> DB
// ---------------------------------------------

const db = require("../db/knex");   // ตัวเชื่อม MySQL ผ่าน Knex (ตั้งค่าใน db/knex.js)

// ฟังก์ชันเล็กๆ ช่วย "เลือกเฉพาะฟิลด์ที่ปลอดภัย" ไม่ส่ง password_hash ออกไป
// เหตุผล: ห้ามเปิดเผย password_hash ต่อ client เพื่อความปลอดภัย
const pickPublic = (row) =>
  row && {
    id: row.id,
    name: row.name,
    feature: row.feature,
  };


/**
 * GET /api/users/:id
 * ---------------------------
 * - ดึงรายละเอียดผู้ใช้จาก id
 * - ใช้ .first() เพื่อได้เพียงแถวเดียว
 */
exports.getById = async (room_id) => {
    const row = await db("room")
      .select("id", "name", "feature")
      .where({ id: room_id })
      .first();

    if (!row) {
      throw new Error("Room not found");
    }

    const experts = await db('room_expert as re')
      .join('subject as s', 're.subject_id', 's.id')
      .select('re.id as expert_id', 're.room_id', 're.subject_id', 're.expert', 's.name as subject_name', 's.level as subject_level')
      .where('re.room_id', room_id)
      .orderBy('re.id', 'desc');

    return {
      ...row,
      experts
    };
};

/* -------------------------------------------------------------
   Room Experts (ความเชี่ยวชาญ/ความเหมาะสมของห้องเรียน)
---------------------------------------------------------------- */
exports.getExperts = async (roomId) => {
  return await db('room_expert as re')
    .join('subject as s', 're.subject_id', 's.id')
    .select('re.id as expert_id', 're.room_id', 're.subject_id', 're.expert', 's.name as subject_name', 's.level as subject_level')
    .where('re.room_id', roomId)
    .orderBy('re.id', 'desc');
};

exports.addExpert = async (roomId, { subject_id, expert = 1 }) => {
  const existing = await db('room_expert')
    .where({ room_id: roomId, subject_id })
    .first();

  if (existing) {
    await db('room_expert')
      .where({ id: existing.id })
      .update({ expert: Number(expert) || 1 });
    return await db('room_expert as re')
      .join('subject as s', 're.subject_id', 's.id')
      .select('re.id as expert_id', 're.room_id', 're.subject_id', 're.expert', 's.name as subject_name', 's.level as subject_level')
      .where('re.id', existing.id)
      .first();
  }

  const [insertId] = await db('room_expert').insert({
    room_id: roomId,
    subject_id,
    expert: Number(expert) || 1
  });

  return await db('room_expert as re')
    .join('subject as s', 're.subject_id', 's.id')
    .select('re.id as expert_id', 're.room_id', 're.subject_id', 're.expert', 's.name as subject_name', 's.level as subject_level')
    .where('re.id', insertId)
    .first();
};

exports.updateExpert = async (expertId, { expert }) => {
  await db('room_expert').where({ id: expertId }).update({ expert: Number(expert) || 1 });
  return await db('room_expert as re')
    .join('subject as s', 're.subject_id', 's.id')
    .select('re.id as expert_id', 're.room_id', 're.subject_id', 're.expert', 's.name as subject_name', 's.level as subject_level')
    .where('re.id', expertId)
    .first();
};

exports.removeExpert = async (expertId) => {
  return await db('room_expert').where({ id: expertId }).del();
};

/**
 * POST /api/users
 * ---------------------------
 * - สร้างผู้ใช้ใหม่
 * - ตรวจค่าบังคับ (name_th, email, password)
 * - ตรวจอีเมลซ้ำ (unique)
 * - แฮชรหัสผ่านเก็บที่คอลัมน์ password_hash (ตามสคีมา)
 * - คืนข้อมูลผู้ใช้ (แบบไม่รวม password_hash)
 */
exports.create = async ({name,feature}) => {
    const [insertId] = await db("room").insert({
      name,
      feature
    });
    const created = await db("room")
      .select("id", "name", "feature")
      .where({ id: insertId })
      .first();

    return created;
};


/**
 * PUT /api/users/:id
 * ---------------------------
 * - อัปเดตข้อมูลผู้ใช้ตาม id
 * - อนุญาตแก้เฉพาะฟิลด์ที่ส่งมา (partial update)
 * - ถ้าเปลี่ยนอีเมล ต้องตรวจซ้ำ (unique)
 * - ถ้าส่ง password มาใหม่ -> แฮชใหม่และอัปเดต password_hash
 */
exports.update = async (id,name,feature) => {
    const payload = {};
    // 1) เก็บเฉพาะฟิลด์ที่ส่งเข้ามา (ไม่บังคับต้องส่งครบ)
    if (name != null) payload.name = name;
    if (feature != null) payload.feature = feature;
    const affected = await db("room").where({ id }).update(payload);
    if (!affected) {
      throw new Error("Room not found");
    }
    // 5) อ่านข้อมูลล่าสุดกลับเพื่อส่งให้ client (ไม่รวม password_hash)
    const updated = await db("room")
      .select("id", "name", "feature")
      .where({ id })
      .first();
      return updated;
};

/**
 * DELETE /api/users/:id
 * ---------------------------
 * - ลบผู้ใช้ตาม id
 * - ตัวอย่างนี้จำกัดสิทธิ์เฉพาะ admin (แสดงการใช้ RBAC ชัดเจน)
 */
exports.remove = async (id) => {
    const affected = await db("room").where({ id }).del();
    if (!affected) {
      throw new Error("Room not found");
    }
};

/**
 * GET /api/users/server
 * ---------------------------
 * - ตัวอย่าง Server-side Pagination + Search + Sort
 * - page, itemsPerPage, sortBy, sortDesc, search
 * - สอนเรื่อง "การนับ total" และ "LIMIT/OFFSET" บน DB
 */
exports.listServer = async (page, perpage, sortBy, sortDesc, search) => {
    const _page = Number(page || 1);
    const _itemsPerPage = Number(perpage || 10);
    const _sortBy = String(sortBy || "id");
    const _sortDesc = sortDesc === "false" ? false : true;
    const _search = String((search || "").trim());

    // 2) whitelist ชื่อคอลัมน์ที่อนุญาตให้ sort (ป้องกัน SQL Injection ทาง orderBy)
    const allowed = new Set(["id", "name", "feature"]);
    const column = allowed.has(_sortBy) ? _sortBy : "id";
    const dir = _sortDesc ? "DESC" : "ASC";

    // 3) คำนวณ offset และ pattern ค้นหา
    const off = (_page - 1) * _itemsPerPage;
    const like = `%${_search}%`;

    // 4) นับจำนวนแถวทั้งหมดที่ตรง search (ใช้ count แยก 1 คำสั่ง)
    const [{ cnt }] = await db("room")
      .whereRaw("CONCAT(id,' ',name,' ',feature) LIKE ?", [like])
      .count({ cnt: "*" });

    // 5) ดึงแถวเฉพาะหน้าที่ต้องการ (LIMIT/OFFSET + ORDER)
    const items = await db("room")
      .select("id", "name", "feature")
      .whereRaw("CONCAT(id,' ',name,' ',feature) LIKE ?", [like])
      .orderBy(column, dir)
      .limit(_itemsPerPage)
      .offset(off);

    // 6) ส่งกลับพร้อม total เพื่อให้หน้าเว็บคำนวณจำนวนหน้าได้
    return {
      success: true,
      items,
      total: Number(cnt || 0),
      page: _page,
      itemsPerPage: _itemsPerPage,
    };

};

exports.search = async ({ search = '', limit = 5 }) => {
  const q = String(search || '').trim();
  const maxLimit = Math.min(Number(limit) || 5, 20);

  let query = db('room').select('id', 'name', 'feature');
  if (q) {
    query = query.whereRaw("CONCAT(id, ' ', COALESCE(name, ''), ' ', COALESCE(feature, '')) LIKE ?", [`%${q}%`]);
  }

  return await query.orderBy('id', 'desc').limit(maxLimit);
};

exports.list = async () => {
  return await db('room').select('id', 'name', 'feature').orderBy('id', 'desc');
};
