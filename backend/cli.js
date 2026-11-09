#!/usr/bin/env node
/**
 * aischedule CLI tool
 * CRUD and management tool for AI Schedule Database
 * 
 * Usage:
 *   node backend/cli.js <command> [subcommand] [options/json]
 */

const db = require('./db/knex');
const { generateSchedule, validateSchedule } = require('./services/scheduler/scheduler');
const scheduleRepo = require('./repositories/schedule.repository');
const projectRepo = require('./repositories/project.repository');

const args = process.argv.slice(2);
const command = args[0]?.toLowerCase();
const action = args[1]?.toLowerCase();
const extraArgs = args.slice(2);

function printHelp() {
  console.log(`
=============================================================
  AISCHEDULE CLI - Database CRUD & Scheduler Tool
=============================================================
Usage:
  node backend/cli.js <resource> <action> [options]

Resources & Actions:
  project:
    list
    get <id|name>
    create <name>
    update <id> <name>
    delete <id>
    add-class <projectId> <classId> [planId] [nameInProject]
    add-teacher <projectId> <teacherId>
    add-room <projectId> <roomId>

  class:
    list [search]
    get <id|name>
    create <name>
    update <id> <name>
    delete <id>

  teacher:
    list [search]
    get <id|name>
    create <name> [portfolio] [userId]
    update <id> <name> [portfolio]
    delete <id>
    add-expert <teacherId> <subjectId> <score>

  room:
    list [search]
    get <id|name>
    create <name> [feature]
    update <id> <name> [feature]
    delete <id>
    add-expert <roomId> <subjectId> <expertScore>

  subject:
    list [search]
    get <id|code|name>
    create <code> <name> [level]
    update <id> <code> <name> [level]
    delete <id>

  plan:
    list [projectId]
    get <id>
    create <projectId> <name> '<subjectsJson>'
    update <id> [name] '<subjectsJson>'
    delete <id>

  schedule:
    list <projectId>
    generate <projectId> [totalPeriods=40] [periodsPerDay=8]
    clear <projectId>
    conflicts <projectId>

  import:
    json '<fullJsonObject>'
    batch <resource> '<itemsJsonArray>'

Examples:
  node backend/cli.js project create "ภาคเรียนที่ 1/2567"
  node backend/cli.js subject create "31901-2008" "ระบบเครือข่าย" "ปวส"
  node backend/cli.js schedule generate 4 40 8
  node backend/cli.js import batch subject '[{"code":"2000-1001","name":"ภาษาไทย","level":"ปวช"}]'
=============================================================
  `);
}

async function run() {
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    process.exit(0);
  }

  try {
    switch (command) {
      /* ==========================================================
         PROJECT
         ========================================================== */
      case 'project': {
        if (action === 'list') {
          const list = await db('project').select('*');
          console.log(JSON.stringify({ success: true, count: list.length, data: list }, null, 2));
        } else if (action === 'get') {
          const key = extraArgs[0];
          const item = isNaN(key)
            ? await db('project').where({ name: key }).first()
            : await db('project').where({ id: Number(key) }).first();
          if (!item) throw new Error(`Project not found: ${key}`);
          console.log(JSON.stringify({ success: true, data: item }, null, 2));
        } else if (action === 'create') {
          const name = extraArgs.join(' ').trim();
          if (!name) throw new Error('Project name required');
          const [id] = await db('project').insert({ name });
          const item = await db('project').where({ id }).first();
          console.log(JSON.stringify({ success: true, message: 'Created project', data: item }, null, 2));
        } else if (action === 'update') {
          const id = Number(extraArgs[0]);
          const name = extraArgs.slice(1).join(' ').trim();
          await db('project').where({ id }).update({ name });
          const item = await db('project').where({ id }).first();
          console.log(JSON.stringify({ success: true, message: 'Updated project', data: item }, null, 2));
        } else if (action === 'delete') {
          const id = Number(extraArgs[0]);
          await db('project').where({ id }).del();
          console.log(JSON.stringify({ success: true, message: `Deleted project ${id}` }, null, 2));
        } else if (action === 'add-class') {
          const [projectId, classId, planId, ...restName] = extraArgs;
          const name = restName.join(' ').trim() || null;
          const [id] = await db('class_in_project').insert({
            project_id: Number(projectId),
            class_id: Number(classId),
            plan_id: planId ? Number(planId) : null,
            name
          });
          console.log(JSON.stringify({ success: true, message: 'Added class to project', id }, null, 2));
        } else if (action === 'add-teacher') {
          const [projectId, teacherId] = extraArgs;
          const [id] = await db('teacher_in_project').insert({
            project_id: Number(projectId),
            teacher_id: Number(teacherId)
          });
          console.log(JSON.stringify({ success: true, message: 'Added teacher to project', id }, null, 2));
        } else if (action === 'add-room') {
          const [projectId, roomId] = extraArgs;
          const [id] = await db('room_in_project').insert({
            project_id: Number(projectId),
            room_id: Number(roomId)
          });
          console.log(JSON.stringify({ success: true, message: 'Added room to project', id }, null, 2));
        } else {
          throw new Error(`Unknown project action: ${action}`);
        }
        break;
      }

      /* ==========================================================
         CLASS
         ========================================================== */
      case 'class': {
        if (action === 'list') {
          const search = extraArgs[0];
          let q = db('class').select('*');
          if (search) q = q.where('name', 'like', `%${search}%`);
          const list = await q;
          console.log(JSON.stringify({ success: true, count: list.length, data: list }, null, 2));
        } else if (action === 'get') {
          const key = extraArgs[0];
          const item = isNaN(key)
            ? await db('class').where({ name: key }).first()
            : await db('class').where({ id: Number(key) }).first();
          if (!item) throw new Error(`Class not found: ${key}`);
          console.log(JSON.stringify({ success: true, data: item }, null, 2));
        } else if (action === 'create') {
          const name = extraArgs.join(' ').trim();
          const [id] = await db('class').insert({ name });
          const item = await db('class').where({ id }).first();
          console.log(JSON.stringify({ success: true, message: 'Created class', data: item }, null, 2));
        } else if (action === 'update') {
          const id = Number(extraArgs[0]);
          const name = extraArgs.slice(1).join(' ').trim();
          await db('class').where({ id }).update({ name });
          const item = await db('class').where({ id }).first();
          console.log(JSON.stringify({ success: true, message: 'Updated class', data: item }, null, 2));
        } else if (action === 'delete') {
          const id = Number(extraArgs[0]);
          await db('class').where({ id }).del();
          console.log(JSON.stringify({ success: true, message: `Deleted class ${id}` }, null, 2));
        } else {
          throw new Error(`Unknown class action: ${action}`);
        }
        break;
      }

      /* ==========================================================
         TEACHER
         ========================================================== */
      case 'teacher': {
        if (action === 'list') {
          const search = extraArgs[0];
          let q = db('teacher as t')
            .leftJoin('users as u', 't.user_id', 'u.id')
            .select('t.*', 'u.name_th as user_name', 'u.email');
          if (search) {
            q = q.where('t.name', 'like', `%${search}%`).orWhere('u.name_th', 'like', `%${search}%`);
          }
          const list = await q;
          console.log(JSON.stringify({ success: true, count: list.length, data: list }, null, 2));
        } else if (action === 'get') {
          const key = extraArgs[0];
          const item = isNaN(key)
            ? await db('teacher').where({ name: key }).first()
            : await db('teacher').where({ id: Number(key) }).first();
          if (!item) throw new Error(`Teacher not found: ${key}`);
          const experts = await db('teacher_expert as te')
            .leftJoin('subject as s', 'te.subject_id', 's.id')
            .where('te.teacher_id', item.id)
            .select('te.id', 'te.subject_id', 's.code as subject_code', 's.name as subject_name', 'te.score');
          console.log(JSON.stringify({ success: true, data: { ...item, experts } }, null, 2));
        } else if (action === 'create') {
          const name = extraArgs[0];
          const portfolio = extraArgs[1] || null;
          const userId = extraArgs[2] ? Number(extraArgs[2]) : null;
          const [id] = await db('teacher').insert({ name, portfolio, user_id: userId });
          const item = await db('teacher').where({ id }).first();
          console.log(JSON.stringify({ success: true, message: 'Created teacher', data: item }, null, 2));
        } else if (action === 'update') {
          const id = Number(extraArgs[0]);
          const name = extraArgs[1];
          const portfolio = extraArgs[2] || null;
          const payload = {};
          if (name) payload.name = name;
          if (portfolio !== null) payload.portfolio = portfolio;
          await db('teacher').where({ id }).update(payload);
          const item = await db('teacher').where({ id }).first();
          console.log(JSON.stringify({ success: true, message: 'Updated teacher', data: item }, null, 2));
        } else if (action === 'delete') {
          const id = Number(extraArgs[0]);
          await db('teacher_expert').where({ teacher_id: id }).del();
          await db('teacher_in_project').where({ teacher_id: id }).del();
          await db('teacher').where({ id }).del();
          console.log(JSON.stringify({ success: true, message: `Deleted teacher ${id}` }, null, 2));
        } else if (action === 'add-expert') {
          const [teacherId, subjectId, score] = extraArgs;
          const [id] = await db('teacher_expert').insert({
            teacher_id: Number(teacherId),
            subject_id: Number(subjectId),
            score: Number(score) || 1
          });
          console.log(JSON.stringify({ success: true, message: 'Added teacher expert', id }, null, 2));
        } else if (action === 'set-constraint') {
          const key = extraArgs[0];
          const rawConstraint = extraArgs.slice(1).join(' ').trim();
          const item = isNaN(key)
            ? await db('teacher').where({ name: key }).orWhere('name', 'like', `%${key}%`).first()
            : await db('teacher').where({ id: Number(key) }).first();
          if (!item) throw new Error(`Teacher not found: ${key}`);

          let portfolioObj = {};
          if (item.portfolio) {
            try {
              portfolioObj = typeof item.portfolio === 'string' ? JSON.parse(item.portfolio) : item.portfolio;
            } catch {}
          }

          let parsedConstraint = {};
          try {
            parsedConstraint = JSON.parse(rawConstraint);
          } catch {
            parsedConstraint = { rule_text: rawConstraint };
          }

          portfolioObj.time_constraints = {
            ...portfolioObj.time_constraints,
            ...parsedConstraint,
            updated_at: new Date().toISOString()
          };

          await db('teacher').where({ id: item.id }).update({
            portfolio: JSON.stringify(portfolioObj)
          });

          console.log(JSON.stringify({
            success: true,
            message: `Updated constraints for teacher: ${item.name}`,
            data: {
              teacher_id: item.id,
              teacher_name: item.name,
              time_constraints: portfolioObj.time_constraints
            }
          }, null, 2));
        } else {
          throw new Error(`Unknown teacher action: ${action}`);
        }
        break;
      }

      /* ==========================================================
         ROOM
         ========================================================== */
      case 'room': {
        if (action === 'list') {
          const search = extraArgs[0];
          let q = db('room').select('*');
          if (search) q = q.where('name', 'like', `%${search}%`);
          const list = await q;
          console.log(JSON.stringify({ success: true, count: list.length, data: list }, null, 2));
        } else if (action === 'get') {
          const key = extraArgs[0];
          const item = isNaN(key)
            ? await db('room').where({ name: key }).first()
            : await db('room').where({ id: Number(key) }).first();
          if (!item) throw new Error(`Room not found: ${key}`);
          const experts = await db('room_expert as re')
            .leftJoin('subject as s', 're.subject_id', 's.id')
            .where('re.room_id', item.id)
            .select('re.id', 're.subject_id', 's.code as subject_code', 's.name as subject_name', 're.expert');
          console.log(JSON.stringify({ success: true, data: { ...item, experts } }, null, 2));
        } else if (action === 'create') {
          const name = extraArgs[0];
          const feature = extraArgs.slice(1).join(' ').trim() || null;
          const [id] = await db('room').insert({ name, feature });
          const item = await db('room').where({ id }).first();
          console.log(JSON.stringify({ success: true, message: 'Created room', data: item }, null, 2));
        } else if (action === 'update') {
          const id = Number(extraArgs[0]);
          const name = extraArgs[1];
          const feature = extraArgs.slice(2).join(' ').trim() || null;
          const payload = {};
          if (name) payload.name = name;
          if (feature !== null) payload.feature = feature;
          await db('room').where({ id }).update(payload);
          const item = await db('room').where({ id }).first();
          console.log(JSON.stringify({ success: true, message: 'Updated room', data: item }, null, 2));
        } else if (action === 'delete') {
          const id = Number(extraArgs[0]);
          await db('room_expert').where({ room_id: id }).del();
          await db('room_in_project').where({ room_id: id }).del();
          await db('room').where({ id }).del();
          console.log(JSON.stringify({ success: true, message: `Deleted room ${id}` }, null, 2));
        } else if (action === 'add-expert') {
          const [roomId, subjectId, expertScore] = extraArgs;
          const [id] = await db('room_expert').insert({
            room_id: Number(roomId),
            subject_id: Number(subjectId),
            expert: Number(expertScore) || 1
          });
          console.log(JSON.stringify({ success: true, message: 'Added room expert', id }, null, 2));
        } else {
          throw new Error(`Unknown room action: ${action}`);
        }
        break;
      }

      /* ==========================================================
         SUBJECT
         ========================================================== */
      case 'subject': {
        if (action === 'list') {
          const search = extraArgs[0];
          let q = db('subject').select('*');
          if (search) {
            q = q.where('code', 'like', `%${search}%`).orWhere('name', 'like', `%${search}%`);
          }
          const list = await q;
          console.log(JSON.stringify({ success: true, count: list.length, data: list }, null, 2));
        } else if (action === 'get') {
          const key = extraArgs[0];
          const item = isNaN(key)
            ? await db('subject').where({ code: key }).orWhere({ name: key }).first()
            : await db('subject').where({ id: Number(key) }).first();
          if (!item) throw new Error(`Subject not found: ${key}`);
          console.log(JSON.stringify({ success: true, data: item }, null, 2));
        } else if (action === 'create') {
          const code = extraArgs[0];
          const name = extraArgs[1];
          const level = extraArgs[2] || 'ปวช';
          const [id] = await db('subject').insert({ code, name, level });
          const item = await db('subject').where({ id }).first();
          console.log(JSON.stringify({ success: true, message: 'Created subject', data: item }, null, 2));
        } else if (action === 'update') {
          const id = Number(extraArgs[0]);
          const code = extraArgs[1];
          const name = extraArgs[2];
          const level = extraArgs[3];
          const payload = {};
          if (code) payload.code = code;
          if (name) payload.name = name;
          if (level) payload.level = level;
          await db('subject').where({ id }).update(payload);
          const item = await db('subject').where({ id }).first();
          console.log(JSON.stringify({ success: true, message: 'Updated subject', data: item }, null, 2));
        } else if (action === 'delete') {
          const id = Number(extraArgs[0]);
          await db('subject').where({ id }).del();
          console.log(JSON.stringify({ success: true, message: `Deleted subject ${id}` }, null, 2));
        } else {
          throw new Error(`Unknown subject action: ${action}`);
        }
        break;
      }

      /* ==========================================================
         LESSON PLAN
         ========================================================== */
      case 'plan': {
        if (action === 'list') {
          const projectId = extraArgs[0] ? Number(extraArgs[0]) : null;
          let q = db('lesson_plan').select('*');
          if (projectId) q = q.where({ project_id: projectId });
          const list = await q;
          const parsed = list.map(p => ({
            ...p,
            subjects: typeof p.subjects === 'string' ? JSON.parse(p.subjects) : (p.subjects || [])
          }));
          console.log(JSON.stringify({ success: true, count: parsed.length, data: parsed }, null, 2));
        } else if (action === 'get') {
          const id = Number(extraArgs[0]);
          const item = await db('lesson_plan').where({ id }).first();
          if (!item) throw new Error(`Plan not found: ${id}`);
          item.subjects = typeof item.subjects === 'string' ? JSON.parse(item.subjects) : (item.subjects || []);
          console.log(JSON.stringify({ success: true, data: item }, null, 2));
        } else if (action === 'create') {
          const projectId = Number(extraArgs[0]);
          const name = extraArgs[1];
          const subjectsStr = extraArgs[2] || '[]';
          const subjects = JSON.parse(subjectsStr);
          const [id] = await db('lesson_plan').insert({
            project_id: projectId,
            name,
            subjects: JSON.stringify(subjects)
          });
          const item = await db('lesson_plan').where({ id }).first();
          item.subjects = JSON.parse(item.subjects);
          console.log(JSON.stringify({ success: true, message: 'Created lesson plan', data: item }, null, 2));
        } else if (action === 'update') {
          const id = Number(extraArgs[0]);
          const name = extraArgs[1];
          const subjectsStr = extraArgs[2];
          const payload = {};
          if (name) payload.name = name;
          if (subjectsStr) payload.subjects = JSON.stringify(JSON.parse(subjectsStr));
          await db('lesson_plan').where({ id }).update(payload);
          const item = await db('lesson_plan').where({ id }).first();
          item.subjects = typeof item.subjects === 'string' ? JSON.parse(item.subjects) : (item.subjects || []);
          console.log(JSON.stringify({ success: true, message: 'Updated lesson plan', data: item }, null, 2));
        } else if (action === 'delete') {
          const id = Number(extraArgs[0]);
          await db('lesson_plan').where({ id }).del();
          console.log(JSON.stringify({ success: true, message: `Deleted lesson plan ${id}` }, null, 2));
        } else {
          throw new Error(`Unknown plan action: ${action}`);
        }
        break;
      }

      /* ==========================================================
         SCHEDULE & SCHEDULER
         ========================================================== */
      case 'schedule': {
        if (action === 'list') {
          const projectId = Number(extraArgs[0]);
          const list = await scheduleRepo.list(projectId);
          console.log(JSON.stringify({ success: true, count: list.length, data: list }, null, 2));
        } else if (action === 'generate') {
          const projectId = Number(extraArgs[0]);
          const totalPeriods = Number(extraArgs[1]) || 40;
          const periodsPerDay = Number(extraArgs[2]) || 8;

          const inputs = await scheduleRepo.loadProjectInputs(projectId);
          const result = generateSchedule({
            classes: inputs.classes,
            teachers: inputs.teachers,
            rooms: inputs.rooms,
            teacherExperts: inputs.teacherExperts,
            roomExperts: inputs.roomExperts,
            totalPeriods,
            periodsPerDay,
          });

          await scheduleRepo.replaceForProject(projectId, result.scheduledSlots);
          const saved = await scheduleRepo.list(projectId);

          console.log(JSON.stringify({
            success: true,
            message: `Generated schedule: ${result.totalPlaced} slots`,
            totalPlaced: result.totalPlaced,
            unplacedLessons: result.unplacedLessons,
            validation: result.validation,
            count: saved.length
          }, null, 2));
        } else if (action === 'clear') {
          const projectId = Number(extraArgs[0]);
          await scheduleRepo.clearForProject(projectId);
          console.log(JSON.stringify({ success: true, message: `Cleared schedules for project ${projectId}` }, null, 2));
        } else if (action === 'conflicts') {
          const projectId = Number(extraArgs[0]);
          const schedules = await scheduleRepo.list(projectId);
          const val = validateSchedule(schedules);
          console.log(JSON.stringify({ success: true, validation: val }, null, 2));
        } else {
          throw new Error(`Unknown schedule action: ${action}`);
        }
        break;
      }

      /* ==========================================================
         IMPORT / BATCH
         ========================================================== */
      case 'import': {
        if (action === 'batch') {
          const resource = extraArgs[0];
          const rawJson = extraArgs.slice(1).join(' ');
          const items = JSON.parse(rawJson);
          if (!Array.isArray(items)) throw new Error('Input must be a JSON array');

          let inserted = 0;
          for (const item of items) {
            if (resource === 'subject') {
              await db('subject').insert({
                code: item.code,
                name: item.name,
                level: item.level || 'ปวช'
              });
            } else if (resource === 'class') {
              await db('class').insert({ name: item.name });
            } else if (resource === 'teacher') {
              await db('teacher').insert({ name: item.name, portfolio: item.portfolio || null });
            } else if (resource === 'room') {
              await db('room').insert({ name: item.name, feature: item.feature || null });
            }
            inserted++;
          }
          console.log(JSON.stringify({ success: true, message: `Batch imported ${inserted} ${resource} items` }, null, 2));
        } else if (action === 'json') {
          // Import whole project setup at once
          const raw = extraArgs.join(' ');
          const data = JSON.parse(raw);
          // { projectName, classes, teachers, rooms, subjects, plan: { name, subjects: [{ subject_code, periods_per_week }] } }
          
          let projectId = data.projectId;
          if (!projectId && data.projectName) {
            const [pid] = await db('project').insert({ name: data.projectName });
            projectId = pid;
          }

          const createdSubjects = {};
          if (data.subjects) {
            for (const s of data.subjects) {
              let existing = await db('subject').where({ code: s.code }).first();
              if (!existing) {
                const [sid] = await db('subject').insert({ code: s.code, name: s.name, level: s.level || 'ปวช' });
                existing = { id: sid, ...s };
              }
              createdSubjects[s.code] = existing.id;
            }
          }

          const createdTeachers = {};
          if (data.teachers) {
            for (const t of data.teachers) {
              let existing = await db('teacher').where({ name: t.name }).first();
              if (!existing) {
                const [tid] = await db('teacher').insert({ name: t.name, portfolio: t.portfolio || null });
                existing = { id: tid, ...t };
              }
              createdTeachers[t.name] = existing.id;

              if (projectId) {
                const rel = await db('teacher_in_project').where({ project_id: projectId, teacher_id: existing.id }).first();
                if (!rel) await db('teacher_in_project').insert({ project_id: projectId, teacher_id: existing.id });
              }

              if (t.experts) {
                for (const exp of t.experts) {
                  const subId = createdSubjects[exp.subject_code] || exp.subject_id;
                  if (subId) {
                    await db('teacher_expert').insert({ teacher_id: existing.id, subject_id: subId, score: exp.score || 1 });
                  }
                }
              }
            }
          }

          const createdRooms = {};
          if (data.rooms) {
            for (const r of data.rooms) {
              let existing = await db('room').where({ name: r.name }).first();
              if (!existing) {
                const [rid] = await db('room').insert({ name: r.name, feature: r.feature || null });
                existing = { id: rid, ...r };
              }
              createdRooms[r.name] = existing.id;

              if (projectId) {
                const rel = await db('room_in_project').where({ project_id: projectId, room_id: existing.id }).first();
                if (!rel) await db('room_in_project').insert({ project_id: projectId, room_id: existing.id });
              }

              if (r.experts) {
                for (const exp of r.experts) {
                  const subId = createdSubjects[exp.subject_code] || exp.subject_id;
                  if (subId) {
                    await db('room_expert').insert({ room_id: existing.id, subject_id: subId, expert: exp.expert || 1 });
                  }
                }
              }
            }
          }

          let planId = null;
          if (data.plan && projectId) {
            const planSubjects = (data.plan.subjects || []).map(ps => ({
              subject_id: createdSubjects[ps.subject_code] || ps.subject_id,
              periods_per_week: ps.periods_per_week || ps.periods || 2
            })).filter(ps => ps.subject_id);

            const [pid] = await db('lesson_plan').insert({
              project_id: projectId,
              name: data.plan.name || 'แผนการสอนหลัก',
              subjects: JSON.stringify(planSubjects)
            });
            planId = pid;
          }

          if (data.classes && projectId) {
            for (const c of data.classes) {
              let existing = await db('class').where({ name: c.name }).first();
              if (!existing) {
                const [cid] = await db('class').insert({ name: c.name });
                existing = { id: cid, ...c };
              }
              const rel = await db('class_in_project').where({ project_id: projectId, class_id: existing.id }).first();
              if (!rel) {
                await db('class_in_project').insert({
                  project_id: projectId,
                  class_id: existing.id,
                  plan_id: planId,
                  name: c.name_in_project || c.name
                });
              }
            }
          }

          console.log(JSON.stringify({
            success: true,
            message: 'Imported full project dataset successfully',
            projectId,
            planId
          }, null, 2));
        } else {
          throw new Error(`Unknown import action: ${action}`);
        }
        break;
      }

      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (err) {
    console.error(JSON.stringify({ success: false, error: err.message }, null, 2));
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

run();

