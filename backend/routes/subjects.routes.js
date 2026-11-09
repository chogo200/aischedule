// backend/routes/subjects.routes.js
const router = require('express').Router();
const auth = require('../middlewares/auth');
const ctrl = require('../controllers/subject.controller');

router.get('/server', auth('admin', 'permis1', 'permis2'), ctrl.listServer);
router.get('/levels', auth('admin', 'permis1', 'permis2'), ctrl.getLevels);
router.get('/',       auth('admin', 'permis1', 'permis2'), ctrl.list);
router.get('/:id',    auth('admin', 'permis1', 'permis2'), ctrl.get);

router.post('/',      auth('admin'), ctrl.create);
router.put('/:id',    auth('admin'), ctrl.update);
router.delete('/:id', auth('admin'), ctrl.remove);

module.exports = router;

