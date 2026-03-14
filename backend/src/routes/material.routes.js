const express = require('express');
const router  = express.Router();
const { getMaterials, createMaterial } = require('../controllers/main.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);
router.get('/',    getMaterials);
router.post('/',   authorize('teacher','admin'), createMaterial);

module.exports = router;
