// backend/controllers/agent.controller.js
const { runAgent } = require('../services/ai/agent');
const { extractExcelOrCsv, analyzeAndStructureData } = require('../services/ai/extractor');
const subjectRepo = require('../repositories/subject.repository');
const teacherRepo = require('../repositories/teacher.repository');
const roomRepo = require('../repositories/room.repository');
const classRepo = require('../repositories/class.repository');
const fs = require('fs');

/**
 * POST /api/agent/chat
 * สั่งงาน AI Agent ด้วยภาษาธรรมชาติ (เช่น สั่งให้ Mock ข้อมูล, จัดการระบบ)
 */
exports.chat = async (req, res, next) => {
  try {
    const { message, model = 'groq-gpt-120b', provider, history = [] } = req.body || {};
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const selectedModel = model || provider || 'groq-gpt-120b';
    const result = await runAgent(message.trim(), selectedModel, history);
    res.json({ success: true, ...result });
  } catch (e) {
    if (e.message && (e.message.includes('API key not found') || e.message.includes('API_KEY'))) {
      return res.json({
        success: true,
        reply: `⚠️ ${e.message}\n\nกรุณาเพิ่ม API Key ลงในไฟล์ \`.env\` ในโฟลเดอร์ \`backend/.env\` หรือ root \`.env\` แล้ว Restart เซิร์ฟเวอร์ครับ`,
        model: req.body?.model || 'groq-gpt-120b'
      });
    }
    if (e.message && (e.message.includes('tool_use_failed') || e.message.includes('tool call validation failed'))) {
      return res.json({
        success: true,
        reply: `⚠️ โมเดลที่เลือกจัดรูปแบบคำสั่ง (Tool Calling) ผิดพลาด แนะนำให้สลับไปใช้โมเดล **GPT-120B** ในเมนูด้านบน ซึ่งมีความแม่นยำในการจัดการข้อมูลสูงสุดครับ`,
        model: req.body?.model || 'groq-gpt-120b'
      });
    }
    if (e.status === 429 || (e.message && (e.message.startsWith('429') || e.message.includes('rate_limit') || e.message.includes('Rate limit')))) {
      const waitMatch = e.message && e.message.match(/try again in ([\d.]+)s/);
      const waitText = waitMatch ? `ประมาณ ${Math.ceil(Number(waitMatch[1]))} วินาที` : 'สักครู่';
      return res.json({
        success: true,
        reply: `⚠️ โมเดลที่เลือก (${req.body?.model || 'ไม่ระบุ'}) ใช้โควตาฟรีครบแล้ว (Rate limit 429)\n\nทางเลือก:\n• รอ${waitText}แล้วส่งใหม่\n• สลับไปใช้โมเดลอื่นในเมนูด้านบน เช่น **GPT-120B** หรือ **GPT-20B** (Groq) หรือ **Nemotron 3.5** (OpenRouter)`,
        model: req.body?.model || 'groq-gpt-120b'
      });
    }
    next(e);
  }
};

/**
 * POST /api/agent/upload-extract
 * อัปโหลดไฟล์ (Excel/CSV) ให้ Agent แกะข้อมูลออกมาพรีวิวก่อนนำเข้า
 */
exports.uploadAndExtract = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File is required' });
    }

    const filePath = req.file.path;
    const prompt = req.body?.prompt || '';
    const selectedModel = req.body?.model || req.body?.provider || 'groq-gpt-120b';

    // 1. อ่านไฟล์ Excel / CSV
    const rawData = extractExcelOrCsv(filePath);

    // 2. ให้ AI วิเคราะห์โครงสร้าง
    const analysis = await analyzeAndStructureData(rawData, prompt, selectedModel);

    // ลบไฟล์ชั่วคราวหลังวิเคราะห์เสร็จ
    try {
      fs.unlinkSync(filePath);
    } catch (ignore) {}

    res.json({
      success: true,
      data: analysis.extracted,
      rawSummary: analysis.rawResponse,
    });
  } catch (e) {
    next(e);
  }
};

/**
 * POST /api/agent/execute-import
 * นำข้อมูลที่สกัดได้ (หรือผู้ใช้แก้ไขแล้ว) บันทึกลงระบบจริงแบบ Batch
 */
exports.executeImport = async (req, res, next) => {
  try {
    const { subjects = [], teachers = [], rooms = [], classes = [] } = req.body || {};
    const createdLogs = {
      subjects: 0,
      teachers: 0,
      rooms: 0,
      classes: 0,
    };

    // บันทึกรายวิชา
    for (const sub of subjects) {
      if (sub.name && sub.name.trim()) {
        try {
          await subjectRepo.create({
            code: sub.code || null,
            name: sub.name.trim(),
            level: sub.level || null,
          });
          createdLogs.subjects++;
        } catch (err) {
          console.warn('Import subject warn:', err.message);
        }
      }
    }

    // บันทึกอาจารย์
    for (const t of teachers) {
      if (t.name && t.name.trim()) {
        try {
          await teacherRepo.create({
            name: t.name.trim(),
            user_id: null,
            portfolio: t.portfolio || null,
          });
          createdLogs.teachers++;
        } catch (err) {
          console.warn('Import teacher warn:', err.message);
        }
      }
    }

    // บันทึกห้องเรียน
    for (const r of rooms) {
      if (r.name && r.name.trim()) {
        try {
          await roomRepo.create({
            name: r.name.trim(),
            feature: r.feature || null,
          });
          createdLogs.rooms++;
        } catch (err) {
          console.warn('Import room warn:', err.message);
        }
      }
    }

    // บันทึกชั้นเรียน
    for (const c of classes) {
      if (c.name && c.name.trim()) {
        try {
          await classRepo.create({
            name: c.name.trim(),
          });
          createdLogs.classes++;
        } catch (err) {
          console.warn('Import class warn:', err.message);
        }
      }
    }

    res.json({
      success: true,
      message: `นำเข้าข้อมูลเรียบร้อย: วิชา ${createdLogs.subjects} รายการ, อาจารย์ ${createdLogs.teachers} ท่าน, ห้อง ${createdLogs.rooms} ห้อง, ชั้นเรียน ${createdLogs.classes} ชั้น`,
      createdLogs,
    });
  } catch (e) {
    next(e);
  }
};

