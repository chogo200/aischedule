// backend/routes/teachers.routes.js
const router = require('express').Router();
const auth = require('../middlewares/auth');
const ctrl = require('../controllers/teacher.controller');

router.get('/server', auth('admin', 'permis1', 'permis2'), ctrl.listServer);
router.get('/',       auth('admin', 'permis1', 'permis2'), ctrl.list);
router.get('/:id',    auth('admin', 'permis1', 'permis2'), ctrl.get);

router.post('/',      auth('admin'), ctrl.create);
router.put('/:id',    auth('admin'), ctrl.update);
router.delete('/:id', auth('admin'), ctrl.remove);

/* Teacher Experts */
router.post('/evaluate-expertise',         auth('admin', 'permis1', 'permis2'), ctrl.evaluateExpertise);
router.get('/:id/experts',             auth('admin', 'permis1', 'permis2'), ctrl.getExperts);
router.post('/:id/experts',            auth('admin'), ctrl.addExpert);
router.put('/:id/experts/:expertId',   auth('admin'), ctrl.updateExpert);
router.delete('/:id/experts/:expertId', auth('admin'), ctrl.removeExpert);

module.exports = router;

