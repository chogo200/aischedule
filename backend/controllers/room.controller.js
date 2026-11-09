// controllers/users.controller.js
// ---------------------------------------------
// "ฉบับนักเรียน" : Controller คุย DB โดยตรงผ่าน Knex (ไม่มี repository)
// จุดประสงค์เพื่อให้เห็นเส้นทางข้อมูลแบบตรงไปตรงมา: HTTP -> Controller -> DB
// ---------------------------------------------

const db = require("../db/knex");   // ตัวเชื่อม MySQL ผ่าน Knex (ตั้งค่าใน db/knex.js)
const roomRepo = require("../repositories/room.repository");   // สำหรับแฮช (เข้ารหัสทางเดียว) รหัสผ่าน

exports.list = async (req, res, next) => {
  try {
    const { search, limit } = req.query || {};
    if (search !== undefined || limit !== undefined) {
      const data = await roomRepo.search({ search, limit });
      return res.json({ success: true, data });
    }
    const data = await roomRepo.list();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
};

exports.get = async (req, res, next) => {
  try {
    const room = await roomRepo.getById(req.params.id);

    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }
    res.json({ success: true, data: room });
  } catch (e) {
    next(e);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { name, feature } = req.body || {};

    const created = await roomRepo.create({ name, feature });

    res.status(201).json({ success: true, data: created });
  } catch (e) {
    next(e);
  }
};

/**
 * PUT /api/users/:id
 * ---------------------------
 * - อัปเดตข้อมูลผู้ใช้ตาม id
 * - อนุญาตแก้เฉพาะฟิลด์ที่ส่งมา (partial update)
 * - ถ้าเปลี่ยนอีเมล ต้องตรวจซ้ำ (unique)
 * - ถ้าส่ง password มาใหม่ -> แฮชใหม่และอัปเดต password_hash
 */
exports.update = async (req, res, next) => {
  try {
    const { name, feature } = req.body || {};

    const updated = await roomRepo.update(req.params.id,  name, feature );

    res.json({ success: true, data: updated });
  } catch (e) {
    next(e);
  }
};

/**
 * DELETE /api/users/:id
 * ---------------------------
 * - ลบผู้ใช้ตาม id
 * - ตัวอย่างนี้จำกัดสิทธิ์เฉพาะ admin (แสดงการใช้ RBAC ชัดเจน)
 */
exports.remove = async (req, res, next) => {
  try {
    await roomRepo.remove(req.params.id);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};

/* -------------------------------------------------------------
   Room Experts Controllers
---------------------------------------------------------------- */
exports.getExperts = async (req, res, next) => {
  try {
    const data = await roomRepo.getExperts(req.params.id);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
};

exports.addExpert = async (req, res, next) => {
  try {
    const { subject_id, expert, score } = req.body || {};
    const expertVal = expert !== undefined ? expert : score;
    if (!subject_id) return res.status(400).json({ success: false, message: 'subject_id is required' });
    const data = await roomRepo.addExpert(req.params.id, { subject_id, expert: expertVal });
    res.status(201).json({ success: true, data });
  } catch (e) {
    next(e);
  }
};

exports.updateExpert = async (req, res, next) => {
  try {
    const { expert, score } = req.body || {};
    const expertVal = expert !== undefined ? expert : score;
    const data = await roomRepo.updateExpert(req.params.expertId, { expert: expertVal });
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
};

exports.removeExpert = async (req, res, next) => {
  try {
    await roomRepo.removeExpert(req.params.expertId);
    res.json({ success: true, message: 'Room expert removed successfully' });
  } catch (e) {
    next(e);
  }
};


exports.listServer = async (req, res, next) => {
  try {
    const { page, perpage, sortBy, sortDesc, search } = req.query || {};
    const result = await roomRepo.listServer(page, perpage, sortBy, sortDesc, search);

    // 6) ส่งกลับพร้อม total เพื่อให้หน้าเว็บคำนวณจำนวนหน้าได้
    res.json(result);
  } catch (e) {
    next(e);
  }
};
