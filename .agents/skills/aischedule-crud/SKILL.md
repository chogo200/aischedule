---
name: aischedule-crud
description: >-
  Manage and CRUD all entities for the AI Schedule system (Projects, Classes, Teachers,
  Rooms, Subjects, Lesson Plans, and Schedules) via command-line interface. Use whenever
  the user pastes raw data, JSON, tables, or asks to add, edit, delete, or generate
  schedules in the database.
---

# AI Schedule Management Skill (CRUD & Scheduler)

This skill allows Antigravity to perform full CRUD operations directly on the timetable database via `docker exec aischedule-api-1 node cli.js <resource> <action> [args]`.

## When to Activate
- When the user pastes or provides curriculum data, subjects, teachers, rooms, classes, or lesson plans.
- When the user asks to add, update, list, delete, or bulk-import data.
- When the user asks to generate or inspect schedules for a project.

---

## Command Reference

Run all CLI commands using:
`docker exec aischedule-api-1 node cli.js <resource> <action> [args...]`

### 1. Project Management
- **List projects:** `docker exec aischedule-api-1 node cli.js project list`
- **Get project:** `docker exec aischedule-api-1 node cli.js project get <id|name>`
- **Create project:** `docker exec aischedule-api-1 node cli.js project create "<projectName>"`
- **Update project:** `docker exec aischedule-api-1 node cli.js project update <id> "<newName>"`
- **Delete project:** `docker exec aischedule-api-1 node cli.js project delete <id>`
- **Add class to project:** `docker exec aischedule-api-1 node cli.js project add-class <projectId> <classId> [planId] [nameInProject]`
- **Add teacher to project:** `docker exec aischedule-api-1 node cli.js project add-teacher <projectId> <teacherId>`
- **Add room to project:** `docker exec aischedule-api-1 node cli.js project add-room <projectId> <roomId>`

### 2. Subject Management
- **List subjects:** `docker exec aischedule-api-1 node cli.js subject list [search]`
- **Get subject:** `docker exec aischedule-api-1 node cli.js subject get <id|code|name>`
- **Create subject:** `docker exec aischedule-api-1 node cli.js subject create "<code>" "<name>" "[level]"`
- **Update subject:** `docker exec aischedule-api-1 node cli.js subject update <id> "<code>" "<name>" "[level]"`
- **Delete subject:** `docker exec aischedule-api-1 node cli.js subject delete <id>`

### 3. Class Management
- **List classes:** `docker exec aischedule-api-1 node cli.js class list [search]`
- **Create class:** `docker exec aischedule-api-1 node cli.js class create "<name>"`
- **Update class:** `docker exec aischedule-api-1 node cli.js class update <id> "<newName>"`
- **Delete class:** `docker exec aischedule-api-1 node cli.js class delete <id>`

### 4. Teacher Management
- **List teachers:** `docker exec aischedule-api-1 node cli.js teacher list [search]`
- **Get teacher + experts:** `docker exec aischedule-api-1 node cli.js teacher get <id|name>`
- **Create teacher:** `docker exec aischedule-api-1 node cli.js teacher create "<name>" [portfolio]`
- **Update teacher:** `docker exec aischedule-api-1 node cli.js teacher update <id> "<name>" [portfolio]`
- **Delete teacher:** `docker exec aischedule-api-1 node cli.js teacher delete <id>`
- **Add teacher expert skill:** `docker exec aischedule-api-1 node cli.js teacher add-expert <teacherId> <subjectId> <score>`

### 5. Room Management
- **List rooms:** `docker exec aischedule-api-1 node cli.js room list [search]`
- **Get room + experts:** `docker exec aischedule-api-1 node cli.js room get <id|name>`
- **Create room:** `docker exec aischedule-api-1 node cli.js room create "<name>" "[feature]"`
- **Update room:** `docker exec aischedule-api-1 node cli.js room update <id> "<name>" "[feature]"`
- **Delete room:** `docker exec aischedule-api-1 node cli.js room delete <id>`
- **Add room expert suitability:** `docker exec aischedule-api-1 node cli.js room add-expert <roomId> <subjectId> <expertScore>`

### 6. Lesson Plan Management
- **List plans:** `docker exec aischedule-api-1 node cli.js plan list [projectId]`
- **Get plan:** `docker exec aischedule-api-1 node cli.js plan get <id>`
- **Create plan:** `docker exec aischedule-api-1 node cli.js plan create <projectId> "<name>" '<subjectsJson>'`
  - Example `<subjectsJson>`: `[{"subject_id":23,"periods_per_week":4},{"subject_id":10,"periods_per_week":2}]`
- **Update plan:** `docker exec aischedule-api-1 node cli.js plan update <id> "<name>" '<subjectsJson>'`
- **Delete plan:** `docker exec aischedule-api-1 node cli.js plan delete <id>`

### 7. Schedule & Auto-Generation
- **List schedules:** `docker exec aischedule-api-1 node cli.js schedule list <projectId>`
- **Generate timetable:** `docker exec aischedule-api-1 node cli.js schedule generate <projectId> [totalPeriods=40] [periodsPerDay=8]`
- **Clear schedules:** `docker exec aischedule-api-1 node cli.js schedule clear <projectId>`
- **Check conflicts:** `docker exec aischedule-api-1 node cli.js schedule conflicts <projectId>`

### 8. Batch / JSON One-Shot Import
When the user throws a raw JSON structure containing curriculum or whole school schedule setup:
```bash
docker exec aischedule-api-1 node cli.js import json '{
  "projectName": "ภาคเรียนที่ 1/2567",
  "subjects": [
    { "code": "31901-2008", "name": "ระบบเครือข่าย", "level": "ปวส" },
    { "code": "30001-1001", "name": "ภาษาอังกฤษธุรกิจ", "level": "ปวส" }
  ],
  "teachers": [
    { "name": "อาจารย์พรชัย", "experts": [{ "subject_code": "31901-2008", "score": 10 }] }
  ],
  "rooms": [
    { "name": "9704", "feature": "Lab Network", "experts": [{ "subject_code": "31901-2008", "expert": 10 }] }
  ],
  "plan": {
    "name": "แผนเทคโนโลยีสารสนเทศ",
    "subjects": [
      { "subject_code": "31901-2008", "periods_per_week": 4 },
      { "subject_code": "30001-1001", "periods_per_week": 2 }
    ]
  },
  "classes": [
    { "name": "ปวส.1 เทคโนโลยีสารสนเทศ" }
  ]
}'
```

And then immediately generate:
`docker exec aischedule-api-1 node cli.js schedule generate <projectId> 40 8`

