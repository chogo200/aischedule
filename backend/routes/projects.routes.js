// backend/routes/projects.routes.js
const router = require('express').Router();
const auth = require('../middlewares/auth');
const ctrl = require('../controllers/project.controller');

router.get('/server',         auth('admin', 'permis1', 'permis2'), ctrl.listServer);
router.get('/by-name/:name', auth('admin', 'permis1', 'permis2'), ctrl.getByName);
router.get('/',               auth('admin', 'permis1', 'permis2'), ctrl.list);
router.get('/:id',            auth('admin', 'permis1', 'permis2'), ctrl.get);

router.post('/',      auth('admin'), ctrl.create);
router.put('/:id',    auth('admin'), ctrl.update);
router.delete('/:id', auth('admin'), ctrl.remove);

// 1. Classes in Project (มี name in project)
router.get('/:id/classes',              auth('admin', 'permis1', 'permis2'), ctrl.getClasses);
router.post('/:id/classes',             auth('admin'), ctrl.addClass);
router.put('/:id/classes/:relId',       auth('admin'), ctrl.updateClassInProject);
router.delete('/:id/classes/:relId',    auth('admin'), ctrl.removeClass);

// 2. Rooms in Project
router.get('/:id/rooms',                auth('admin', 'permis1', 'permis2'), ctrl.getRooms);
router.post('/:id/rooms',               auth('admin'), ctrl.addRoom);
router.delete('/:id/rooms/:relId',      auth('admin'), ctrl.removeRoom);

// 3. Teachers in Project
router.get('/:id/teachers',             auth('admin', 'permis1', 'permis2'), ctrl.getTeachers);
router.post('/:id/teachers',            auth('admin'), ctrl.addTeacher);
router.delete('/:id/teachers/:relId',   auth('admin'), ctrl.removeTeacher);

// 4. Lesson Plans
router.get('/:id/lesson-plans',            auth('admin', 'permis1', 'permis2'), ctrl.getLessonPlans);
router.post('/:id/lesson-plans',           auth('admin'), ctrl.createLessonPlan);
router.put('/:id/lesson-plans/:planId',    auth('admin'), ctrl.updateLessonPlan);
router.delete('/:id/lesson-plans/:planId', auth('admin'), ctrl.removeLessonPlan);

// 5. Schedules (ตารางสอน AI)
router.get('/:id/schedules',            auth('admin', 'permis1', 'permis2'), ctrl.getSchedules);

module.exports = router;
