// backend/routes/schedules.routes.js
const router = require('express').Router();
const auth = require('../middlewares/auth');
const ctrl = require('../controllers/schedule.controller');

router.get('/',       auth('admin', 'permis1', 'permis2'), ctrl.list);
router.get('/:id',    auth('admin', 'permis1', 'permis2'), ctrl.get);

router.post('/',      auth('admin'), ctrl.create);
router.delete('/:id', auth('admin'), ctrl.remove);

module.exports = router;

