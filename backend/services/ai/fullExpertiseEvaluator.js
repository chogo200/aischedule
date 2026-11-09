/**
 * backend/services/ai/fullExpertiseEvaluator.js
 * 
 * Antigravity AI Full Expertise Evaluator
 * Evaluates EVERY teacher against EVERY subject in the curriculum.
 * Produces a full score matrix (14 teachers x 44 subjects = 616 evaluations).
 * Scores range from 1 to 10.
 */

const db = require('../../db/knex');

// Domains mapped to teachers
const TEACHER_DOMAINS = {
  6: { // สมชาย ใจดี
    expertise: 'Programming',
    primaryKeywords: ['เขียนโปรแกรม', 'programming', 'python', 'javascript', 'เชิงวัตถุ', 'เชิงโครงสร้าง', 'พัฒนาโปรแกรม', 'coding'],
    secondaryKeywords: ['full stack', 'เว็บ', 'web', 'แอปพลิเคชัน', 'application', 'ทดสอบ', 'quality', 'ซอฟต์แวร์', 'data analytics'],
    baseScore: 3
  },
  7: { // สุดา แก้วใส
    expertise: 'Database',
    primaryKeywords: ['ฐานข้อมูล', 'database', 'sql', 'จัดการฐานข้อมูล', 'data analytics', 'วิเคราะห์ข้อมูล'],
    secondaryKeywords: ['สารสนเทศองค์กร', 'วิเคราะห์และออกแบบ', 'system analysis', 'โปรแกรมสำนักงาน', 'office', 'จัดเก็บ'],
    baseScore: 3
  },
  8: { // วิทยา มั่นคง
    expertise: 'Network',
    primaryKeywords: ['เครือข่าย', 'network', 'อินเทอร์เน็ต', 'internet', 'ดูแลระบบเครือข่าย', 'บริหารจัดการเครือข่าย'],
    secondaryKeywords: ['cloud', 'เซิร์ฟเวอร์', 'server', 'iot', 'hardware', 'cybersecurity', 'ความปลอดภัย'],
    baseScore: 3
  },
  9: { // ธนกร สุขใจ
    expertise: 'Web Development',
    primaryKeywords: ['เว็บไซต์', 'web', 'html', 'css', 'javascript', 'full stack', 'เว็บแอปพลิเคชัน'],
    secondaryKeywords: ['แอปพลิเคชัน', 'application', 'ux/ui', 'เขียนโปรแกรม', 'programming', 'สื่อดิจิทัล'],
    baseScore: 3
  },
  10: { // กมลชนก มีสุข
    expertise: 'Graphic Design',
    primaryKeywords: ['กราฟิก', 'graphic', 'สื่อดิจิทัล', 'มัลติมีเดีย', 'multimedia', 'ux/ui', 'ออกแบบ'],
    secondaryKeywords: ['เว็บไซต์', 'web', 'โปรแกรมสำนักงาน', 'office', 'นำเสนอ', 'อินเตอร์เฟส'],
    baseScore: 3
  },
  11: { // อนุชา พัฒนกิจ
    expertise: 'Hardware',
    primaryKeywords: ['hardware', 'ฮาร์ดแวร์', 'ซ่อมและประกอบ', 'คอมพิวเตอร์', 'บำรุงรักษา', 'วงจร'],
    secondaryKeywords: ['iot', 'ระบบปฏิบัติการ', 'os', 'เซิร์ฟเวอร์', 'server', 'เครือข่าย'],
    baseScore: 3
  },
  12: { // พิมพ์ชนก รุ่งเรือง
    expertise: 'AI',
    primaryKeywords: ['ai', 'ปัญญาประดิษฐ์', 'machine learning', 'data analytics', 'วิเคราะห์ข้อมูล', 'python'],
    secondaryKeywords: ['cloud', 'คณิตศาสตร์', 'algorithm', 'เขียนโปรแกรม', 'สถิติ'],
    baseScore: 3
  },
  13: { // กิตติพงษ์ ศรีสุข
    expertise: 'Operating System',
    primaryKeywords: ['ระบบปฏิบัติการ', 'operating system', 'os', 'จัดการระบบปฏิบัติการ', 'เซิร์ฟเวอร์', 'server'],
    secondaryKeywords: ['devops', 'ci/cd', 'cloud', 'บำรุงรักษา', 'พื้นฐานคอมพิวเตอร์', 'linux'],
    baseScore: 3
  },
  14: { // ณัฐพล คงดี
    expertise: 'Cybersecurity',
    primaryKeywords: ['ความปลอดภัย', 'cybersecurity', 'security', 'ระบบสารสนเทศ', 'รักษาความปลอดภัย', 'audit'],
    secondaryKeywords: ['เครือข่าย', 'network', 'เซิร์ฟเวอร์', 'server', 'ทดสอบ', 'ระบบปฏิบัติการ'],
    baseScore: 3
  },
  15: { // วราภรณ์ แสงทอง
    expertise: 'Mathematics',
    primaryKeywords: ['คณิตศาสตร์', 'math', 'คณิตศาสตร์คอมพิวเตอร์', 'logic', 'สถิติ', 'ตรรกศาสตร์'],
    secondaryKeywords: ['วิเคราะห์ข้อมูล', 'data', 'algorithm', 'เชิงโครงสร้าง', 'เขียนโปรแกรมเบื้องต้น'],
    baseScore: 3
  },
  16: { // เอกชัย บุญมี
    expertise: 'English',
    primaryKeywords: ['ภาษาอังกฤษ', 'english', 'อาชีพ it', 'เตรียมความพร้อม', 'การสื่อสาร', 'career'],
    secondaryKeywords: ['โปรแกรมสำนักงาน', 'office', 'เอกสาร', 'พื้นฐานคอมพิวเตอร์', 'การทำงาน'],
    baseScore: 3
  },
  17: { // สุภาพร อินทร์ทอง
    expertise: 'Business',
    primaryKeywords: ['โปรแกรมสำนักงาน', 'office', 'สารสนเทศองค์กร', 'enterprise', 'วิเคราะห์และออกแบบ', 'ธุรกิจ', 'business'],
    secondaryKeywords: ['อาชีพ it', 'career', 'จัดการ', 'บริหาร', 'ทดสอบและควบคุมคุณภาพ', 'qa'],
    baseScore: 3
  },
  18: { // ภาคภูมิ ชัยชนะ
    expertise: 'IoT',
    primaryKeywords: ['iot', 'อินเทอร์เน็ตของสรรพสิ่ง', 'เซ็นเซอร์', 'microcontroller', 'embedded'],
    secondaryKeywords: ['hardware', 'python', 'เครือข่าย', 'cloud', 'devops', 'ซ่อมและประกอบ'],
    baseScore: 3
  },
  19: { // ปกรณ์ ตั้งใจ
    expertise: 'Project',
    primaryKeywords: ['โครงงาน', 'project', 'devops', 'ci/cd', 'โครงงานวิชาชีพ', 'พัฒนาโครงงาน'],
    secondaryKeywords: ['สารสนเทศองค์กร', 'วิเคราะห์และออกแบบ', 'เตรียมความพร้อม', 'บูรณาการ', 'บริหารโครงการ'],
    baseScore: 3
  }
};

function calculateScore(teacherId, subject) {
  const cfg = TEACHER_DOMAINS[teacherId];
  if (!cfg) return 3;

  const textToScan = `${subject.code} ${subject.name} ${subject.level}`.toLowerCase();

  // 1. Check Primary Keywords
  for (const kw of cfg.primaryKeywords) {
    if (textToScan.includes(kw.toLowerCase())) {
      return 10;
    }
  }

  // 2. Check Secondary Keywords
  for (const kw of cfg.secondaryKeywords) {
    if (textToScan.includes(kw.toLowerCase())) {
      return 7;
    }
  }

  // 3. General IT Fundamentals
  if (textToScan.includes('พื้นฐาน') || textToScan.includes('ทั่วไป') || textToScan.includes('เบื้องต้น')) {
    return 5;
  }

  // Baseline IT general competence
  return cfg.baseScore; // 3 (ทุกคนในแผนก IT สอนวิชาพื้นฐานทั่วไปได้ที่ระดับ 3)
}

async function evaluateAllTeachersAllSubjects(projectId = 7) {
  console.log(`[Antigravity AI] Evaluating all teachers across all subjects for project ${projectId}...`);

  const teachers = await db('teacher_in_project')
    .where({ project_id: projectId })
    .join('teacher', 'teacher_in_project.teacher_id', 'teacher.id')
    .select('teacher.id', 'teacher.name', 'teacher.portfolio');

  const plans = await db('lesson_plan').where({ project_id: projectId }).select('subjects');
  const subjectIds = new Set();
  plans.forEach(p => {
    const list = typeof p.subjects === 'string' ? JSON.parse(p.subjects) : p.subjects;
    list.forEach(s => subjectIds.add(s.subject_id));
  });

  const subjects = await db('subject').whereIn('id', Array.from(subjectIds)).select('id', 'code', 'name', 'level');

  console.log(`Evaluating ${teachers.length} teachers x ${subjects.length} subjects = ${teachers.length * subjects.length} pairs...`);

  let inserted = 0;
  let updated = 0;

  for (const t of teachers) {
    for (const s of subjects) {
      const score = calculateScore(t.id, s);

      const existing = await db('teacher_expert')
        .where({ teacher_id: t.id, subject_id: s.id })
        .first();

      if (existing) {
        await db('teacher_expert')
          .where({ id: existing.id })
          .update({ score });
        updated++;
      } else {
        await db('teacher_expert').insert({
          teacher_id: t.id,
          subject_id: s.id,
          score
        });
        inserted++;
      }
    }
  }

  console.log(`[Antigravity AI] Complete! ${inserted} inserted, ${updated} updated.`);
  return { total: teachers.length * subjects.length, inserted, updated };
}

module.exports = {
  evaluateAllTeachersAllSubjects
};

if (require.main === module) {
  evaluateAllTeachersAllSubjects()
    .then(r => {
      console.log('Result:', r);
      process.exit(0);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

