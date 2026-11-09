    const router = require('express').Router();
    const auth = require('../middlewares/auth');
    const ctrl = require('../controllers/room.controller');
 
    
// หมายเหตุเพื่อการสอน:
// - list/listServer/get: ให้ทุกบทบาทที่ล็อกอินแล้วเรียกได้ (admin/evaluator/evaluatee)
// - create/update/delete: ตัวอย่างนี้จำกัด admin (นักเรียนจะเห็นการควบคุมสิทธิ์ชัดเจน)

router.get('/server', auth('admin','permis1','permis2'), ctrl.listServer);
router.get('/',       auth('admin','permis1','permis2'), ctrl.list);
router.get('/:id',    auth('admin','permis1','permis2'), ctrl.get);

router.post('/',auth('admin'), ctrl.create);
// router.post('/',  ctrl.create);
router.put('/:id',    auth('admin'), ctrl.update);
router.delete('/:id', auth('admin'), ctrl.remove);

/* Room Experts */
router.get('/:id/experts',              auth('admin', 'permis1', 'permis2'), ctrl.getExperts);
router.post('/:id/experts',             auth('admin'), ctrl.addExpert);
router.put('/:id/experts/:expertId',    auth('admin'), ctrl.updateExpert);
router.delete('/:id/experts/:expertId', auth('admin'), ctrl.removeExpert);

module.exports = router;








    module.exports = router;
