// backend/services/ai/agent.js
const { getModel } = require('./client');
const { allTools } = require('./tools');
const { SystemMessage, HumanMessage, ToolMessage } = require('@langchain/core/messages');

const SYSTEM_PROMPT = `คุณคือ AI Agent ผู้ช่วยบริหารจัดการระบบจัดตารางเรียนและฐานข้อมูลสถานศึกษาอัจฉริยะ
คุณมีความสามารถในการเรียกใช้ Tools เพื่อจัดการข้อมูลในระบบจริงได้ทันที เช่น:
1. สร้าง/ค้นหารายวิชา (Subjects) พร้อมรหัสวิชา (code), ชื่อวิชา (name), ระดับชั้น (level)
2. สร้าง/ค้นหาอาจารย์ (Teachers) และกำหนดวิชาความเชี่ยวชาญ (teacher_expert)
3. สร้าง/ค้นหาห้องเรียน (Rooms) และกำหนดความเหมาะสมของห้องกับวิชา (room_expert)
4. สร้าง/ค้นหาชั้นเรียน (Classes)
5. สร้าง/จัดการโครงการ (Project) พร้อมผูกชั้นเรียน, ครูผู้สอน, ห้องเรียน, และแผนการสอน (Lesson Plan)
6. จำลองชุดข้อมูล (Mock Data) ตามที่ผู้ใช้สั่ง

กฎสำคัญในการเลือกและเรียกใช้ Tools (Tool Calling Rules):
- ถ้าผู้ใช้ระบุชื่อภาคเรียน/โครงการ เช่น "2568/1", "2026/1", หรือสั่งสร้างโครงการ ให้เรียก 'create_project'
- ถ้าสั่งสร้างห้องเรียนหรือสถานที่ ให้เรียก 'create_room'
- รายชื่อ Tools ทั้งหมดที่มีในระบบ (ห้ามเรียกชื่อ Tool นอกเหนือจากนี้):
  • รายวิชา: create_subject, list_subjects
  • อาจารย์: create_teacher, add_teacher_expert, list_teachers
  • ห้องเรียน: create_room, add_room_expert, list_rooms
  • ชั้นเรียน: create_class, list_classes
  • โครงการ: create_project, add_class_to_project, add_teacher_to_project, add_room_to_project, create_lesson_plan, list_projects
  • ภาพรวม: get_system_overview
- ทุกครั้งที่เรียก Tool ต้องส่ง Parameters ให้ครบถ้วนตาม Schema
- รายงานผลการทำงานเป็นภาษาไทยที่สุภาพ กระชับ ชัดเจน พร้อมระบุ ID หรือชื่อของข้อมูลที่ได้สร้างหรือปรับปรุง`;

/**
 * รัน Agent Loop พร้อม Tool Calling
 * @param {string} userMessage ข้อความคำสั่งจากผู้ใช้
 * @param {string} modelKey key ของโมเดล เช่น 'groq-gpt-120b', 'groq-qwen-27b', 'gemini-1.5-flash'
 * @param {Array} history ประวัติข้อความก่อนหน้า
 */
async function runAgent(userMessage, modelKey = 'groq-gpt-120b', history = []) {
  const model = getModel(modelKey);
  const modelWithTools = model.bindTools(allTools);

  const messages = [
    new SystemMessage(SYSTEM_PROMPT),
    ...history,
    new HumanMessage(userMessage),
  ];

  // Tool-Calling Loop (สูงสุด 8 รอบป้องกัน infinite loop)
  const maxIterations = 8;
  const executionLog = [];

  for (let i = 0; i < maxIterations; i++) {
    const response = await modelWithTools.invoke(messages);
    messages.push(response);

    // ตรวจสอบว่า Model ต้องการเรียก Tools หรือไม่
    if (!response.tool_calls || response.tool_calls.length === 0) {
      // จบการทำงาน ส่งคำตอบสุดท้าย
      return {
        reply: response.content,
        modelUsed: modelKey,
        iterations: i + 1,
        logs: executionLog,
      };
    }

    // มี Tool Calls ให้ดำเนินการรันแต่ละ Tool
    for (const toolCall of response.tool_calls) {
      const targetTool = allTools.find(t => t.name === toolCall.name);
      let toolResult;

      if (targetTool) {
        try {
          toolResult = await targetTool.invoke(toolCall.args);
        } catch (err) {
          toolResult = JSON.stringify({ success: false, error: err.message });
        }
      } else {
        toolResult = JSON.stringify({ success: false, error: `Tool ${toolCall.name} not found` });
      }

      executionLog.push({
        tool: toolCall.name,
        args: toolCall.args,
        result: typeof toolResult === 'string' ? JSON.parse(toolResult) : toolResult,
      });

      messages.push(
        new ToolMessage({
          tool_call_id: toolCall.id || toolCall.name,
          content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
        })
      );
    }
  }

  return {
    reply: 'ดำเนินการประมวลผลเสร็จสิ้น (ถึงขีดจำกัดรอบการทำงาน)',
    iterations: maxIterations,
    logs: executionLog,
  };
}

module.exports = {
  runAgent,
};

