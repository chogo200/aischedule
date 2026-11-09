const fs = require('fs');
const path = require('path');
const db = require('./db/knex');

function parseCSV(content) {
  // Strip UTF-8 BOM if present
  const cleanContent = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
  const lines = cleanContent.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] !== undefined ? values[idx] : '';
    });
    rows.push(row);
  }
  return rows;
}

async function runImport() {
  const projectId = 7; // Project 2099/1
  console.log(`=== Starting Data Import for Project ID: ${projectId} (2099/1) ===`);

  const importDir = path.join(__dirname, 'import');
  if (!fs.existsSync(importDir)) {
    console.error(`Import directory not found: ${importDir}`);
    process.exit(1);
  }

  // 1. Check Project exists
  const project = await db('project').where({ id: projectId }).first();
  if (!project) {
    console.error(`Project ID ${projectId} does not exist!`);
    process.exit(1);
  }
  console.log(`Found project: "${project.name}" (ID: ${project.id})`);

  // 2. Import Rooms (IT_rooms.csv)
  const roomFile = path.join(importDir, 'IT_rooms.csv');
  if (fs.existsSync(roomFile)) {
    console.log(`\n--- Importing Rooms from ${roomFile} ---`);
    const roomRows = parseCSV(fs.readFileSync(roomFile, 'utf8'));
    for (const r of roomRows) {
      const roomName = `${r.room_code} - ${r.room_name}`;
      const feature = JSON.stringify({
        code: r.room_code,
        department: r.department,
        type: r.room_type,
        capacity: Number(r.capacity) || 0
      });

      // Upsert room
      let room = await db('room').where({ name: roomName }).first();
      if (!room) {
        // also check if exists by code or exact name
        room = await db('room').where('name', 'like', `%${r.room_name}%`).first();
      }

      let roomId;
      if (room) {
        roomId = room.id;
        await db('room').where({ id: roomId }).update({ feature });
        console.log(`[Room] Updated room: ${roomName} (ID: ${roomId})`);
      } else {
        const [insertedId] = await db('room').insert({ name: roomName, feature });
        roomId = insertedId;
        console.log(`[Room] Created room: ${roomName} (ID: ${roomId})`);
      }

      // Bind to Project
      const bound = await db('room_in_project').where({ project_id: projectId, room_id: roomId }).first();
      if (!bound) {
        await db('room_in_project').insert({ project_id: projectId, room_id: roomId });
        console.log(`  -> Added room to project ${projectId}`);
      }
    }
  }

  // 3. Import Teachers (IT_teachers.csv)
  const teacherFile = path.join(importDir, 'IT_teachers.csv');
  if (fs.existsSync(teacherFile)) {
    console.log(`\n--- Importing Teachers from ${teacherFile} ---`);
    const teacherRows = parseCSV(fs.readFileSync(teacherFile, 'utf8'));
    for (const t of teacherRows) {
      const teacherName = t.teacher_name;
      const portfolio = JSON.stringify({
        code: t.teacher_code,
        department: t.department,
        expertise: t.expertise
      });

      let teacher = await db('teacher').where({ name: teacherName }).first();
      let teacherId;
      if (teacher) {
        teacherId = teacher.id;
        await db('teacher').where({ id: teacherId }).update({ portfolio });
        console.log(`[Teacher] Updated teacher: ${teacherName} (ID: ${teacherId})`);
      } else {
        const [insertedId] = await db('teacher').insert({ name: teacherName, portfolio });
        teacherId = insertedId;
        console.log(`[Teacher] Created teacher: ${teacherName} (ID: ${teacherId})`);
      }

      // Bind to Project
      const bound = await db('teacher_in_project').where({ project_id: projectId, teacher_id: teacherId }).first();
      if (!bound) {
        await db('teacher_in_project').insert({ project_id: projectId, teacher_id: teacherId });
        console.log(`  -> Added teacher to project ${projectId}`);
      }
    }
  }

  // 4. Import Subjects & Create Lesson Plans & Classes
  const subjectFiles = [
    { file: 'ปวช1_IT_subjects.csv', level: 'ปวช1', className: 'ปวช.1 เทคโนโลยีสารสนเทศ' },
    { file: 'ปวช2_IT_subjects.csv', level: 'ปวช2', className: 'ปวช.2 เทคโนโลยีสารสนเทศ' },
    { file: 'ปวช3_IT_subjects.csv', level: 'ปวช3', className: 'ปวช.3 เทคโนโลยีสารสนเทศ' },
    { file: 'ปวส1_IT_subjects.csv', level: 'ปวส1', className: 'ปวส.1 เทคโนโลยีสารสนเทศ' },
    { file: 'ปวส2_IT_subjects.csv', level: 'ปวส2', className: 'ปวส.2 เทคโนโลยีสารสนเทศ' },
  ];

  for (const sf of subjectFiles) {
    const fullPath = path.join(importDir, sf.file);
    if (!fs.existsSync(fullPath)) continue;

    console.log(`\n--- Processing Subjects for ${sf.level} (${sf.file}) ---`);
    const rows = parseCSV(fs.readFileSync(fullPath, 'utf8'));
    const planSubjects = [];

    for (const r of rows) {
      const code = r.subject_code;
      const name = r.subject_name;
      const hours = Number(r.hours_per_week) || 4;

      let subject = await db('subject').where({ name }).first();
      if (!subject) {
        subject = await db('subject').where({ code }).first();
      }

      let subjectId;
      if (subject) {
        subjectId = subject.id;
        await db('subject').where({ id: subjectId }).update({ code, level: sf.level });
        console.log(`[Subject] Updated subject: ${code} - ${name} (ID: ${subjectId})`);
      } else {
        const [insertedId] = await db('subject').insert({ code, name, level: sf.level });
        subjectId = insertedId;
        console.log(`[Subject] Created subject: ${code} - ${name} (ID: ${subjectId})`);
      }

      planSubjects.push({
        subject_id: subjectId,
        hours: hours
      });
    }

    // 5. Create or Update Lesson Plan for this level in this project
    const planName = `แผนการเรียน ${sf.level} เทคโนโลยีสารสนเทศ`;
    let plan = await db('lesson_plan').where({ project_id: projectId, name: planName }).first();
    let planId;

    if (plan) {
      planId = plan.id;
      await db('lesson_plan').where({ id: planId }).update({
        subjects: JSON.stringify(planSubjects),
        updated_at: db.fn.now()
      });
      console.log(`[Lesson Plan] Updated plan: "${planName}" (ID: ${planId}) with ${planSubjects.length} subjects`);
    } else {
      const [insertedPlanId] = await db('lesson_plan').insert({
        project_id: projectId,
        name: planName,
        subjects: JSON.stringify(planSubjects)
      });
      planId = insertedPlanId;
      console.log(`[Lesson Plan] Created plan: "${planName}" (ID: ${planId}) with ${planSubjects.length} subjects`);
    }

    // 6. Ensure Class exists and is linked to Project & Plan
    let classObj = await db('class').where({ name: sf.className }).first();
    let classId;
    if (classObj) {
      classId = classObj.id;
      console.log(`[Class] Found class: "${sf.className}" (ID: ${classId})`);
    } else {
      const [newClassId] = await db('class').insert({ name: sf.className });
      classId = newClassId;
      console.log(`[Class] Created class: "${sf.className}" (ID: ${classId})`);
    }

    // Link class to project
    let cip = await db('class_in_project').where({ project_id: projectId, class_id: classId }).first();
    if (cip) {
      await db('class_in_project').where({ id: cip.id }).update({ plan_id: planId, name: sf.className });
      console.log(`  -> Updated class_in_project with plan ID: ${planId}`);
    } else {
      await db('class_in_project').insert({
        project_id: projectId,
        class_id: classId,
        plan_id: planId,
        name: sf.className
      });
      console.log(`  -> Added class "${sf.className}" to project ${projectId} with plan ${planId}`);
    }
  }

  console.log(`\n=============================================================`);
  console.log(`🎉 ALL CSV DATA IMPORTED & LINKED TO PROJECT 2099/1 (ID: ${projectId}) SUCCESSFULLY!`);
  console.log(`=============================================================`);
  process.exit(0);
}

runImport().catch(err => {
  console.error("Import failed:", err);
  process.exit(1);
});

