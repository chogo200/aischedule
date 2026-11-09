// backend/services/ai/tools.js
const { tool } = require('@langchain/core/tools');
const { z } = require('zod');
const db = require('../../db/knex');
const subjectRepo = require('../../repositories/subject.repository');
const teacherRepo = require('../../repositories/teacher.repository');
const roomRepo = require('../../repositories/room.repository');
const classRepo = require('../../repositories/class.repository');
const projectRepo = require('../../repositories/project.repository');
const scheduleRepo = require('../../repositories/schedule.repository');

// 1. Tool จัดการรายวิชา
const createSubjectTool = tool(
  async ({ code, name, level }) => {
    try {
      const created = await subjectRepo.create({ code: code || null, name, level: level || null });
      return JSON.stringify({ success: true, message: `สร้างวิชา ${name} เรียบร้อย`, data: created });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'create_subject',
    description: 'สร้างรายวิชาใหม่ในระบบ กำหนด code (รหัสวิชาถ้ามี), name (ชื่อวิชา), level (ระดับชั้น เช่น ปวช.1, ปวส.2)',
    schema: z.object({
      name: z.string().describe('ชื่อวิชา'),
      code: z.string().optional().describe('รหัสวิชา เช่น TH101'),
      level: z.string().optional().describe('ระดับชั้น เช่น ปวช.1'),
    }),
  }
);

const listSubjectsTool = tool(
  async ({ search }) => {
    try {
      const items = await subjectRepo.search({ search: search || '', limit: 20 });
      return JSON.stringify({ success: true, count: items.length, data: items });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'list_subjects',
    description: 'ค้นหาและดึงรายการวิชาในระบบ โดยใส่คำค้นหา (search)',
    schema: z.object({
      search: z.string().optional().describe('คำค้นหาชื่อหรือรหัสวิชา'),
    }),
  }
);

// 2. Tool จัดการอาจารย์
const createTeacherTool = tool(
  async ({ name, portfolio }) => {
    try {
      const created = await teacherRepo.create({ name, user_id: null, portfolio });
      return JSON.stringify({ success: true, message: `สร้างอาจารย์ ${name} เรียบร้อย`, data: created });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'create_teacher',
    description: 'สร้างอาจารย์ใหม่ในระบบ โดยระบุ name (ชื่ออาจารย์) และ portfolio (ผลงาน/ประวัติถ้ามี)',
    schema: z.object({
      name: z.string().describe('ชื่อ-นามสกุลอาจารย์'),
      portfolio: z.string().optional().describe('ประวัติ ผลงาน หรือความเชี่ยวชาญคร่าวๆ'),
    }),
  }
);

const addTeacherExpertTool = tool(
  async ({ teacher_id, subject_id, score }) => {
    try {
      const expert = await teacherRepo.addExpert(teacher_id, { subject_id, score: score || 1 });
      return JSON.stringify({ success: true, message: `เพิ่มความเชี่ยวชาญให้อาจารย์เรียบร้อย`, data: expert });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'add_teacher_expert',
    description: 'กำหนดความเชี่ยวชาญให้อาจารย์ โดยระบุ teacher_id, subject_id, และ score (ระดับความเชี่ยวชาญ 1-5)',
    schema: z.object({
      teacher_id: z.number().describe('ID ของอาจารย์'),
      subject_id: z.number().describe('ID ของวิชา'),
      score: z.number().optional().default(1).describe('ระดับความเชี่ยวชาญ 1-5'),
    }),
  }
);

const listTeachersTool = tool(
  async ({ search }) => {
    try {
      const items = await teacherRepo.search({ search: search || '', limit: 20 });
      return JSON.stringify({ success: true, count: items.length, data: items });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'list_teachers',
    description: 'ค้นหาและดึงรายชื่ออาจารย์ในระบบ',
    schema: z.object({
      search: z.string().optional().describe('คำค้นหาชื่ออาจารย์'),
    }),
  }
);

// 3. Tool จัดการห้องเรียน
const createRoomTool = tool(
  async ({ name, feature }) => {
    try {
      const created = await roomRepo.create({ name, feature });
      return JSON.stringify({ success: true, message: `สร้างห้องเรียน ${name} เรียบร้อย`, data: created });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'create_room',
    description: 'สร้างห้องเรียนใหม่ในระบบ โดยระบุ name (ชื่อห้อง) และ feature (คุณสมบัติ/อุปกรณ์ห้อง เช่น คอมพิวเตอร์ 40 เครื่อง)',
    schema: z.object({
      name: z.string().describe('ชื่อห้อง เช่น 421, LAB-COM1'),
      feature: z.string().optional().describe('อุปกรณ์หรือคุณสมบัติห้อง เช่น คอมพิวเตอร์ 40 เครื่อง'),
    }),
  }
);

const addRoomExpertTool = tool(
  async ({ room_id, subject_id, expert }) => {
    try {
      const res = await roomRepo.addExpert(room_id, { subject_id, expert: expert || 1 });
      return JSON.stringify({ success: true, message: `เพิ่มความเหมาะสมของห้องกับวิชาเรียบร้อย`, data: res });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'add_room_expert',
    description: 'กำหนดความเหมาะสม/วิชาที่ห้องนี้รองรับ โดยระบุ room_id, subject_id, และ expert (คะแนนความเหมาะสม 1-5)',
    schema: z.object({
      room_id: z.number().describe('ID ของห้องเรียน'),
      subject_id: z.number().describe('ID ของวิชา'),
      expert: z.number().optional().default(1).describe('ระดับความเหมาะสมของห้อง 1-5'),
    }),
  }
);

const listRoomsTool = tool(
  async ({ search }) => {
    try {
      const items = await roomRepo.search({ search: search || '', limit: 20 });
      return JSON.stringify({ success: true, count: items.length, data: items });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'list_rooms',
    description: 'ค้นหาและดึงรายชื่อห้องเรียนในระบบ',
    schema: z.object({
      search: z.string().optional().describe('คำค้นหาชื่อห้อง'),
    }),
  }
);

// 4. Tool จัดการชั้นเรียน
const createClassTool = tool(
  async ({ name }) => {
    try {
      const created = await classRepo.create({ name });
      return JSON.stringify({ success: true, message: `สร้างชั้นเรียน ${name} เรียบร้อย`, data: created });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'create_class',
    description: 'สร้างชั้นเรียนใหม่ในระบบ เช่น "ม.4/1", "ปวช.1 คอมพิวเตอร์ 1"',
    schema: z.object({
      name: z.string().describe('ชื่อชั้นเรียน'),
    }),
  }
);

const listClassesTool = tool(
  async ({ search }) => {
    try {
      const items = await classRepo.search({ search: search || '', limit: 20 });
      return JSON.stringify({ success: true, count: items.length, data: items });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'list_classes',
    description: 'ค้นหาและดึงรายชื่อชั้นเรียนในระบบ',
    schema: z.object({
      search: z.string().optional().describe('คำค้นหาชื่อชั้นเรียน'),
    }),
  }
);

// 5. Tool จัดการโครงการและทรัพยากรในโครงการ
const createProjectTool = tool(
  async ({ name }) => {
    try {
      const created = await projectRepo.create({ name });
      return JSON.stringify({ success: true, message: `สร้างโครงการ ${name} เรียบร้อย`, data: created });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'create_project',
    description: 'สร้างโครงการใหม่ในระบบ เช่น "it2569/1", "ปีการศึกษา 2568 เทอม 2"',
    schema: z.object({
      name: z.string().describe('ชื่อโครงการ'),
    }),
  }
);

const addClassToProjectTool = tool(
  async ({ project_id, class_id, plan_id, name_in_project }) => {
    try {
      const added = await projectRepo.addClass(project_id, {
        class_id,
        plan_id: plan_id || null,
        name: name_in_project || null,
      });
      return JSON.stringify({ success: true, message: `เพิ่มชั้นเรียนเข้าโครงการเรียบร้อย`, data: added });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'add_class_to_project',
    description: 'เพิ่มชั้นเรียนเข้าโครงการ โดยระบุ project_id, class_id, plan_id (รหัสแผนการสอนถ้ามี), และ name_in_project (ถ้ามี)',
    schema: z.object({
      project_id: z.number().describe('ID ของโครงการ'),
      class_id: z.number().describe('ID ของชั้นเรียน'),
      plan_id: z.number().optional().describe('ID ของแผนการสอน (ถ้ามี)'),
      name_in_project: z.string().optional().describe('ชื่อเรียกเฉพาะในโครงการ (ถ้ามี)'),
    }),
  }
);

const addTeacherToProjectTool = tool(
  async ({ project_id, teacher_id }) => {
    try {
      const added = await projectRepo.addTeacher(project_id, { teacher_id });
      return JSON.stringify({ success: true, message: `เพิ่มอาจารย์เข้าโครงการเรียบร้อย`, data: added });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'add_teacher_to_project',
    description: 'เพิ่มอาจารย์เข้าโครงการ โดยระบุ project_id และ teacher_id',
    schema: z.object({
      project_id: z.number().describe('ID ของโครงการ'),
      teacher_id: z.number().describe('ID ของอาจารย์'),
    }),
  }
);

const addRoomToProjectTool = tool(
  async ({ project_id, room_id }) => {
    try {
      const added = await projectRepo.addRoom(project_id, { room_id });
      return JSON.stringify({ success: true, message: `เพิ่มห้องเรียนเข้าโครงการเรียบร้อย`, data: added });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'add_room_to_project',
    description: 'เพิ่มห้องเรียนเข้าโครงการ โดยระบุ project_id และ room_id',
    schema: z.object({
      project_id: z.number().describe('ID ของโครงการ'),
      room_id: z.number().describe('ID ของห้องเรียน'),
    }),
  }
);

const createLessonPlanTool = tool(
  async ({ project_id, name, subjects }) => {
    try {
      const parsedSubjects = typeof subjects === 'string' ? JSON.parse(subjects) : (subjects || []);
      const created = await projectRepo.createLessonPlan(project_id, {
        name,
        subjects: parsedSubjects,
      });
      return JSON.stringify({ success: true, message: `สร้างแผนการสอน ${name} เรียบร้อย`, data: created });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'create_lesson_plan',
    description: 'สร้างแผนการสอนประจำโครงการ โดยระบุ project_id, name (ชื่อแผนการสอน), และ subjects (อาร์เรย์ของ { subject_id, hours })',
    schema: z.object({
      project_id: z.number().describe('ID ของโครงการ'),
      name: z.string().describe('ชื่อแผนการสอน'),
      subjects: z.array(z.object({
        subject_id: z.number(),
        hours: z.number().default(2)
      })).optional().describe('รายการวิชาในแผน'),
    }),
  }
);

const listProjectsTool = tool(
  async () => {
    try {
      const items = await projectRepo.list();
      return JSON.stringify({ success: true, data: items });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'list_projects',
    description: 'ดึงรายชื่อโครงการทั้งหมดในระบบ',
    schema: z.object({}),
  }
);

// 6. Tool ตรวจสอบโครงสร้างฐานข้อมูล / ภาพรวม
const getSystemOverviewTool = tool(
  async () => {
    try {
      const [projects, subjects, teachers, rooms, classes] = await Promise.all([
        db('project').count({ count: '*' }).first(),
        db('subject').count({ count: '*' }).first(),
        db('teacher').count({ count: '*' }).first(),
        db('room').count({ count: '*' }).first(),
        db('class').count({ count: '*' }).first(),
      ]);
      return JSON.stringify({
        success: true,
        stats: {
          projects: projects?.count || 0,
          subjects: subjects?.count || 0,
          teachers: teachers?.count || 0,
          rooms: rooms?.count || 0,
          classes: classes?.count || 0,
        }
      });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
  {
    name: 'get_system_overview',
    description: 'ดูสถิติภาพรวมข้อมูลในระบบทั้งหมด (จำนวนโครงการ, วิชา, อาจารย์, ห้อง, ชั้นเรียน)',
    schema: z.object({}),
  }
);

const allTools = [
  createSubjectTool,
  listSubjectsTool,
  createTeacherTool,
  addTeacherExpertTool,
  listTeachersTool,
  createRoomTool,
  addRoomExpertTool,
  listRoomsTool,
  createClassTool,
  listClassesTool,
  createProjectTool,
  addClassToProjectTool,
  addTeacherToProjectTool,
  addRoomToProjectTool,
  createLessonPlanTool,
  listProjectsTool,
  getSystemOverviewTool,
];

module.exports = {
  allTools,
  createSubjectTool,
  listSubjectsTool,
  createTeacherTool,
  addTeacherExpertTool,
  createRoomTool,
  addRoomExpertTool,
  createClassTool,
  createProjectTool,
  createLessonPlanTool,
  getSystemOverviewTool,
};
