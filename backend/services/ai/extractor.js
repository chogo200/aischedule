// backend/services/ai/extractor.js
const xlsx = require('xlsx');
const fs = require('fs');
const { getModel } = require('./client');

/**
 * แกะข้อมูลไฟล์ Excel (.xlsx, .xls) หรือ CSV
 * @param {string} filePath ที่อยู่ไฟล์บนดิสก์
 * @returns {Array<object>} ข้อมูลตารางในรูป JSON
 */
function extractExcelOrCsv(filePath) {
  const workbook = xlsx.readFile(filePath);
  const sheetNames = workbook.SheetNames;
  const result = {};

  sheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    result[sheetName] = jsonData;
  });

  return result;
}

/**
 * ให้ AI วิเคราะห์โครงสร้างข้อมูลที่อ่านได้จากไฟล์ แล้วแปลงเป็น Entities ในระบบ
 * @param {object|string} rawContent ข้อมูลดิบจากไฟล์
 * @param {string} prompt คำสั่งเพิ่มเติมจากผู้ใช้ เช่น "ให้เพิ่มข้อมูลเป็นอาจารย์"
 * @param {string} modelKey key ของโมเดล เช่น 'groq-gpt-120b', 'groq-qwen-27b'
 */
async function analyzeAndStructureData(rawContent, prompt = '', modelKey = 'groq-gpt-120b') {
  const model = getModel(modelKey);

  const contentStr = typeof rawContent === 'object' ? JSON.stringify(rawContent, null, 2) : String(rawContent);

  const systemInstruction = `คุณเป็น AI ผู้เชี่ยวชาญการแปลงและสกัดโครงสร้างข้อมูล (Data Extraction Expert)
หน้าที่ของคุณคืออ่านข้อมูลดิบที่ได้จากไฟล์ (Excel/CSV/Text) และจัดหมวดหมู่ออกมาเป็น Entities ที่พร้อมบันทึกลงในฐานข้อมูลระบบจัดตารางสอน

โครงสร้าง JSON ที่คุณต้องส่งกลับต้องเป็นรูปแบบนี้เท่านั้น (ห้ามใส่ Markdown code block อื่นใดนอกเหนือจาก JSON):
{
  "summary": "สรุปสั้นๆ ว่าพบข้อมูลอะไรบ้าง เช่น พบวิชา 5 รายการ, อาจารย์ 2 ท่าน",
  "subjects": [
    { "code": "รหัสวิชา (ถ้ามี)", "name": "ชื่อวิชา", "level": "ระดับชั้น เช่น ปวช.1 หรือ ปวส.2" }
  ],
  "teachers": [
    { "name": "ชื่อ-สกุลอาจารย์", "portfolio": "ประวัติหรือความเชี่ยวชาญ (ถ้ามี)" }
  ],
  "rooms": [
    { "name": "ชื่อห้อง", "feature": "อุปกรณ์หรือคุณสมบัติห้อง (ถ้ามี)" }
  ],
  "classes": [
    { "name": "ชื่อชั้นเรียน" }
  ]
}`;

  const userQuery = `ข้อมูลดิบจากไฟล์:
${contentStr.slice(0, 15000)}

คำสั่งเพิ่มเติมจากผู้ใช้: ${prompt || 'โปรดวิเคราะห์และจำแนกข้อมูลเพื่อนำเข้าระบบ'}`;

  const response = await model.invoke([
    { role: 'system', content: systemInstruction },
    { role: 'user', content: userQuery }
  ]);

  let parsed = null;
  const text = response.content;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.error('JSON parse error from AI response:', err);
  }

  return {
    rawResponse: text,
    extracted: parsed || {
      summary: 'ไม่สามารถแยกแยะโครงสร้าง JSON ได้อัตโนมัติ',
      subjects: [],
      teachers: [],
      rooms: [],
      classes: [],
    }
  };
}

module.exports = {
  extractExcelOrCsv,
  analyzeAndStructureData,
};

