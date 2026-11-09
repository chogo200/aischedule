// backend/routes/agent.routes.js
const router = require('express').Router();
const auth = require('../middlewares/auth');
const ctrl = require('../controllers/agent.controller');
const multer = require('multer');
const path = require('path');
const os = require('os');

const upload = multer({ dest: os.tmpdir() });

router.post('/chat',           auth('admin', 'permis1', 'permis2'), ctrl.chat);
router.post('/upload-extract', auth('admin', 'permis1', 'permis2'), upload.single('file'), ctrl.uploadAndExtract);
router.post('/execute-import', auth('admin'), ctrl.executeImport);

module.exports = router;

